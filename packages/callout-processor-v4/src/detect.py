#!/usr/bin/env python3
"""
Callout Processor v4 - Generalized callout detection.

Improvements over v3:
1. Widened radius detection (10-80px) - more permissive, filter downstream
2. US/NCS standard support alongside PSPC (Canadian)
3. Tiered validation: OCR first, LLM optional for edge cases
4. Better debug output with confidence scoring

Supports:
- Canadian (PSPC) plans
- US (NCS) plans
- Auto-detection of standard
"""

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple, Dict

import cv2
import fitz
import numpy as np

from standards import (
    is_valid_detail_label,
    is_valid_section_label,
    is_rejected_text,
    detect_standard,
)

_ocr = None


def get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    return _ocr


@dataclass
class Callout:
    x: float
    y: float
    bbox: dict
    label: str
    callout_type: str
    confidence: float
    ocr_confidence: float = 0.0
    standard: str = 'auto'  # 'pspc', 'ncs', or 'auto'


@dataclass
class CircleCallout:
    x: float
    y: float
    radius: int
    bbox: dict
    label: str
    callout_type: str  # 'detail', 'elevation', 'section', 'title'
    identifier: Optional[str] = None
    view_sheet: Optional[str] = None
    location_sheet: Optional[str] = None
    confidence: float = 0.0
    ocr_confidence: float = 0.0
    triangle_count: int = 0
    triangle_positions: List[str] = field(default_factory=list)
    standard: str = 'auto'
    validation_tier: str = 'ocr'  # 'ocr' or 'llm'


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 300) -> np.ndarray:
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    doc.close()
    return img


def check_interior_density(gray: np.ndarray, cx: int, cy: int, radius: int) -> Tuple[bool, float]:
    """Check if circle interior is mostly white (empty)."""
    h, w = gray.shape
    inner_radius = max(1, int(radius * 0.75))
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), inner_radius, 255, -1)

    interior_pixels = gray[mask > 0]
    if len(interior_pixels) == 0:
        return False, 0.0

    white_count = np.sum(interior_pixels > 200)
    whiteness = white_count / len(interior_pixels)
    return whiteness > 0.60, whiteness  # Lowered threshold for more permissive detection


def check_has_outline(gray: np.ndarray, cx: int, cy: int, radius: int) -> Tuple[bool, float]:
    """Check if circle has a visible outline (dark ring at edge)."""
    h, w = gray.shape

    # Create ring mask at circle edge
    outer_mask = np.zeros((h, w), dtype=np.uint8)
    inner_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(outer_mask, (cx, cy), radius + 3, 255, -1)
    cv2.circle(inner_mask, (cx, cy), max(1, radius - 3), 255, -1)
    ring_mask = outer_mask - inner_mask

    ring_pixels = gray[ring_mask > 0]
    if len(ring_pixels) == 0:
        return False, 0.0

    # Count dark pixels in the ring (the outline)
    dark_count = np.sum(ring_pixels < 128)
    darkness = dark_count / len(ring_pixels)
    return darkness > 0.15, darkness  # At least 15% of ring should be dark


def find_horizontal_line_inside(gray: np.ndarray, cx: int, cy: int, radius: int) -> Tuple[bool, Optional[int]]:
    """Find a horizontal dividing line inside the circle."""
    margin = 2
    x1 = max(0, cx - radius + margin)
    y1 = max(0, cy - radius + margin)
    x2 = min(gray.shape[1], cx + radius - margin)
    y2 = min(gray.shape[0], cy + radius - margin)

    if x2 <= x1 or y2 <= y1:
        return False, None

    region = gray[y1:y2, x1:x2]
    region_h, region_w = region.shape[:2]

    _, binary = cv2.threshold(region, 127, 255, cv2.THRESH_BINARY_INV)
    lines = cv2.HoughLinesP(binary, 1, np.pi/180, threshold=10,
                            minLineLength=int(radius * 0.4), maxLineGap=5)

    if lines is None:
        return False, None

    horizontal_lines = []
    for line in lines:
        x1_l, y1_l, x2_l, y2_l = line[0]
        angle = abs(np.arctan2(y2_l - y1_l, x2_l - x1_l) * 180 / np.pi)
        if angle < 15 or angle > 165:
            avg_y = (y1_l + y2_l) // 2
            if region_h * 0.25 < avg_y < region_h * 0.75:
                horizontal_lines.append(avg_y)

    if not horizontal_lines:
        return False, None

    center_y = region_h // 2
    best_line_y = min(horizontal_lines, key=lambda y: abs(y - center_y))
    return True, y1 + best_line_y


def check_is_title_callout(gray: np.ndarray, cx: int, cy: int, radius: int) -> bool:
    """Check if this is a title callout (has line extending right + title text)."""
    h, w = gray.shape

    # Title callouts are in lower portion of sheet
    if cy < h * 0.50:
        return False

    # Look for horizontal line extending from circle
    line_start_x = cx + radius
    line_end_x = min(w, cx + radius + 500)
    line_y1 = max(0, cy - 15)
    line_y2 = min(h, cy + radius + 25)

    if line_end_x <= line_start_x or line_y2 <= line_y1:
        return False

    line_region = gray[line_y1:line_y2, line_start_x:line_end_x]
    if line_region.size == 0:
        return False

    _, binary = cv2.threshold(line_region, 127, 255, cv2.THRESH_BINARY_INV)
    dark_per_row = np.sum(binary > 0, axis=1)
    best_row_content = np.max(dark_per_row) if len(dark_per_row) > 0 else 0

    # Title lines are long - need substantial content
    if best_row_content < 150:
        return False

    # Check for title text above
    text_y1 = max(0, cy - 60)
    text_y2 = cy - 5
    text_x1 = cx + radius + 20
    text_x2 = min(w, cx + radius + 700)

    if text_y2 <= text_y1 or text_x2 <= text_x1:
        return False

    text_region = gray[text_y1:text_y2, text_x1:text_x2]
    if text_region.size == 0:
        return False

    text_dark_ratio = np.sum(text_region < 128) / text_region.size
    return text_dark_ratio > 0.03


def check_is_letter_in_word(gray: np.ndarray, cx: int, cy: int, radius: int) -> bool:
    """Check if circle is likely a letter in a word (like 'O' in 'ROOF')."""
    h, w = gray.shape

    # Check for text on LEFT side
    left_x1 = max(0, cx - radius - 35)
    left_x2 = cx - radius + 5
    left_y1 = max(0, cy - radius)
    left_y2 = min(h, cy + radius)

    # Check for text on RIGHT side
    right_x1 = cx + radius - 5
    right_x2 = min(w, cx + radius + 35)
    right_y1 = max(0, cy - radius)
    right_y2 = min(h, cy + radius)

    has_text_left = False
    has_text_right = False

    if left_x2 > left_x1 and left_y2 > left_y1:
        left_region = gray[left_y1:left_y2, left_x1:left_x2]
        if left_region.size > 0:
            dark_ratio = np.sum(left_region < 128) / left_region.size
            has_text_left = dark_ratio > 0.06

    if right_x2 > right_x1 and right_y2 > right_y1:
        right_region = gray[right_y1:right_y2, right_x1:right_x2]
        if right_region.size > 0:
            dark_ratio = np.sum(right_region < 128) / right_region.size
            has_text_right = dark_ratio > 0.06

    return has_text_left and has_text_right


def find_small_triangles_near_circle(
    gray: np.ndarray,
    cx: int, cy: int, radius: int,
    search_margin: int = 20,
    min_tri_area: int = 40,
    max_tri_area: int = 800
) -> List[Dict]:
    """Find small filled triangles attached to circle perimeter."""
    triangles = []

    search_r = radius + search_margin
    x1 = max(0, cx - search_r)
    y1 = max(0, cy - search_r)
    x2 = min(gray.shape[1], cx + search_r)
    y2 = min(gray.shape[0], cy + search_r)

    region = gray[y1:y2, x1:x2]
    if region.size == 0:
        return triangles

    thresh = cv2.adaptiveThreshold(region, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY_INV, 11, 4)
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not (min_tri_area < area < max_tri_area):
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue

        is_triangle = False
        for epsilon_mult in [0.04, 0.05, 0.06, 0.08]:
            approx = cv2.approxPolyDP(cnt, epsilon_mult * perimeter, True)
            if len(approx) == 3:
                is_triangle = True
                break

        if not is_triangle:
            hull = cv2.convexHull(cnt)
            hull_approx = cv2.approxPolyDP(hull, 0.05 * cv2.arcLength(hull, True), True)
            if len(hull_approx) == 3:
                hull_area = cv2.contourArea(hull)
                if hull_area > 0 and area / hull_area > 0.6:
                    is_triangle = True

        if not is_triangle:
            continue

        rx, ry, rw, rh = cv2.boundingRect(cnt)
        tri_cx = x1 + rx + rw // 2
        tri_cy = y1 + ry + rh // 2

        dist_from_center = np.hypot(tri_cx - cx, tri_cy - cy)
        dist_from_edge = abs(dist_from_center - radius)

        if dist_from_edge > search_margin:
            continue

        # Check if filled
        mask = np.zeros(region.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        mean_val = cv2.mean(region, mask=mask)[0]

        if mean_val > 100:
            continue

        # Determine position
        angle = np.arctan2(tri_cy - cy, tri_cx - cx) * 180 / np.pi

        if -45 <= angle <= 45:
            position = 'right'
        elif 45 < angle <= 135:
            position = 'bottom'
        elif -135 <= angle < -45:
            position = 'top'
        else:
            position = 'left'

        triangles.append({
            'position': position,
            'bbox': (x1 + rx, y1 + ry, rw, rh),
            'center': (tri_cx, tri_cy),
            'angle': angle
        })

    # Deduplicate
    deduped = []
    for tri in triangles:
        is_dup = any(
            tri['position'] == d['position'] and
            np.hypot(tri['center'][0] - d['center'][0], tri['center'][1] - d['center'][1]) < 20
            for d in deduped
        )
        if not is_dup:
            deduped.append(tri)

    return deduped


def _ocr_region(image: np.ndarray, min_size: int = 150) -> Tuple[Optional[str], float]:
    """OCR a single image region. Returns (text, confidence)."""
    if image.size == 0 or image.shape[0] < 5 or image.shape[1] < 5:
        return None, 0.0

    try:
        h, w = image.shape[:2]
        if h < min_size or w < min_size:
            scale_factor = max(min_size / h, min_size / w, 3.0)
            image = cv2.resize(image, None, fx=scale_factor, fy=scale_factor,
                              interpolation=cv2.INTER_CUBIC)

        ocr = get_ocr()
        result = ocr.ocr(image, det=False, cls=True)
        if result and result[0]:
            texts = []
            confidences = []
            for line in result[0]:
                text, conf = line
                if conf > 0.3:  # Lower threshold to catch more
                    texts.append(text)
                    confidences.append(conf)
            if texts:
                avg_conf = sum(confidences) / len(confidences)
                return ' '.join(texts).strip(), avg_conf
    except:
        pass
    return None, 0.0


def extract_text_inside_circle(
    image: np.ndarray,
    cx: int, cy: int, radius: int,
    padding: int = 2
) -> Tuple[Optional[str], float]:
    """
    Extract text from inside a circle using OCR.
    Returns (text, confidence).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    has_line, line_y = find_horizontal_line_inside(gray, cx, cy, radius)

    x1 = max(0, cx - radius + padding)
    x2 = min(image.shape[1], cx + radius - padding)

    if x2 <= x1:
        return None, 0.0

    if has_line and line_y is not None:
        top_y1 = max(0, cy - radius + padding)
        top_y2 = line_y - 2
        bottom_y1 = line_y + 2
        bottom_y2 = min(image.shape[0], cy + radius - padding)

        top_text, top_conf = None, 0.0
        bottom_text, bottom_conf = None, 0.0

        if top_y2 > top_y1:
            top_crop = image[top_y1:top_y2, x1:x2]
            top_text, top_conf = _ocr_region(top_crop)

        if bottom_y2 > bottom_y1:
            bottom_crop = image[bottom_y1:bottom_y2, x1:x2]
            bottom_text, bottom_conf = _ocr_region(bottom_crop)

        if top_text and bottom_text:
            avg_conf = (top_conf + bottom_conf) / 2
            return f"{top_text}/{bottom_text}", avg_conf
        elif top_text:
            return top_text, top_conf
        elif bottom_text:
            return bottom_text, bottom_conf
        return None, 0.0
    else:
        y1 = max(0, cy - radius + padding)
        y2 = min(image.shape[0], cy + radius - padding)

        if y2 <= y1:
            return None, 0.0

        crop = image[y1:y2, x1:x2]
        return _ocr_region(crop)


def parse_callout_label(text: str) -> Dict:
    """Parse callout label into components."""
    if not text:
        return {'identifier': None, 'view_sheet': None, 'location_sheet': None}

    text = text.strip().upper()
    text = re.sub(r'\s+', ' ', text)

    result = {
        'identifier': None,
        'view_sheet': None,
        'location_sheet': None
    }

    # Pattern 1: "3/A5" or "A/S5.1" format
    match = re.match(r'^([A-Z0-9]{1,2})\s*/\s*([A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?)$', text)
    if match:
        result['identifier'] = match.group(1)
        result['view_sheet'] = match.group(2)
        return result

    # Pattern 2: Simple identifier "1", "2", "A"
    match = re.match(r'^([A-Z]?[0-9]{1,2}|[A-Z])$', text)
    if match:
        result['identifier'] = match.group(1)
        return result

    # Pattern 3: Two-part "1 A5" or "1 S5.1"
    match = re.match(r'^([A-Z0-9]{1,2})\s+([A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?)$', text)
    if match:
        result['identifier'] = match.group(1)
        result['view_sheet'] = match.group(2)
        return result

    # Fallback
    tokens = re.findall(r'[A-Z0-9]{1,5}', text)
    if tokens:
        result['identifier'] = tokens[0]
        if len(tokens) > 1:
            result['view_sheet'] = tokens[-1]

    return result


def find_circles_widened(
    gray: np.ndarray,
    dpi: int = 300,
    min_radius_base: int = 10,
    max_radius_base: int = 80
) -> List[Tuple[int, int, int]]:
    """
    Find circles with widened radius range.

    Key change from v3: 10-80px range (was 22-45px)
    This is more permissive - we filter downstream with OCR validation.
    """
    scale = dpi / 300.0
    min_radius = int(min_radius_base * scale)
    max_radius = int(max_radius_base * scale)

    # Run HoughCircles with multiple parameter sets for better coverage
    all_circles = []

    # Pass 1: Standard parameters
    circles1 = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1, minDist=25,
        param1=50, param2=30, minRadius=min_radius, maxRadius=max_radius
    )
    if circles1 is not None:
        all_circles.extend(circles1[0])

    # Pass 2: More sensitive (catches smaller/fainter circles)
    circles2 = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1, minDist=25,
        param1=40, param2=25, minRadius=min_radius, maxRadius=int(max_radius * 0.7)
    )
    if circles2 is not None:
        all_circles.extend(circles2[0])

    # Deduplicate circles that are too close
    if not all_circles:
        return []

    circles = np.array(all_circles)
    deduped = []
    for cx, cy, r in circles:
        cx, cy, r = int(cx), int(cy), int(r)
        is_dup = any(
            np.hypot(cx - dx, cy - dy) < min(r, dr) * 0.6
            for dx, dy, dr in deduped
        )
        if not is_dup:
            deduped.append((cx, cy, r))

    return deduped


def detect_circle_callouts(
    image: np.ndarray,
    dpi: int = 300,
    standard: str = 'auto'
) -> Tuple[List[CircleCallout], dict]:
    """
    Detect circle-based callouts with widened parameters and multi-standard support.

    Key improvements:
    1. Widened radius range (10-80px base)
    2. Multi-standard validation (PSPC and NCS)
    3. Tiered validation with confidence scoring
    """
    scale = dpi / 300.0
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    debug_info = {
        'circles_found': 0,
        'passed_interior_check': 0,
        'passed_outline_check': 0,
        'detail_candidates': 0,
        'detail_callouts': 0,
        'elevation_callouts': 0,
        'section_callouts': 0,
        'title_callouts': 0,
        'rejected_labels': 0,
        'rejected_as_letters': 0,
        'low_confidence': 0,
        'standard_detected': standard,
    }

    callouts = []

    # Phase 1: Find ALL circles with widened range
    circles = find_circles_widened(gray, dpi)
    debug_info['circles_found'] = len(circles)

    # Phase 2: Filter and classify each circle
    for cx, cy, r in circles:
        # Filter 1: Interior density (must be mostly white)
        is_valid_interior, whiteness = check_interior_density(gray, cx, cy, r)
        if whiteness < 0.40:
            continue
        debug_info['passed_interior_check'] = debug_info.get('passed_interior_check', 0) + 1

        # Filter 2: Must have visible outline
        has_outline, outline_darkness = check_has_outline(gray, cx, cy, r)
        if not has_outline:
            continue
        debug_info['passed_outline_check'] = debug_info.get('passed_outline_check', 0) + 1

        # Filter 3: Reject if it's a letter in a word
        if check_is_letter_in_word(gray, cx, cy, r):
            debug_info['rejected_as_letters'] += 1
            continue

        # Classify by triangle presence
        nearby_triangles = find_small_triangles_near_circle(
            gray, cx, cy, r,
            search_margin=int(15 * scale),
            min_tri_area=int(40 * scale**2),
            max_tri_area=int(800 * scale**2)
        )

        top_triangles = [t for t in nearby_triangles if t['position'] == 'top']
        side_triangles = [t for t in nearby_triangles if t['position'] in ('left', 'right')]

        has_top_triangle = len(top_triangles) > 0
        has_side_triangles = len(side_triangles) > 0

        if has_top_triangle or has_side_triangles:
            if has_side_triangles:
                callout_type = 'section'
            else:
                callout_type = 'elevation'
            triangle_positions = [t['position'] for t in nearby_triangles]
            base_confidence = 0.80
        else:
            debug_info['detail_candidates'] += 1

            if check_is_title_callout(gray, cx, cy, r):
                callout_type = 'title'
                base_confidence = 0.70
            else:
                callout_type = 'detail'
                has_line = find_horizontal_line_inside(gray, cx, cy, r)[0]
                base_confidence = 0.85 if has_line else 0.70

            triangle_positions = []

        # Phase 3: OCR validation
        text, ocr_conf = extract_text_inside_circle(image, int(cx), int(cy), r)

        # Validate based on callout type and standard
        if callout_type in ('detail', 'title'):
            is_valid = is_valid_detail_label(text, standard)
        else:
            is_valid = is_valid_section_label(text, standard)

        if not is_valid:
            debug_info['rejected_labels'] += 1
            continue

        # Calculate final confidence
        final_confidence = base_confidence * (0.5 + 0.5 * ocr_conf)

        # Stricter threshold for simple identifiers (no sheet reference)
        min_confidence = 0.5
        if text and len(text.strip()) <= 2 and '/' not in text:
            min_confidence = 0.70  # Require higher confidence for simple IDs

        if final_confidence < min_confidence:
            debug_info['low_confidence'] += 1
            continue

        parsed = parse_callout_label(text)

        # Detect standard from sheet reference if possible
        detected_std = 'auto'
        if parsed['view_sheet']:
            detected_std = detect_standard(parsed['view_sheet'])

        tri_extension = int(r * 0.4) if has_top_triangle else 0

        callouts.append(CircleCallout(
            x=float(cx),
            y=float(cy),
            radius=r,
            bbox={'x1': cx - r, 'y1': cy - r - tri_extension,
                  'x2': cx + r, 'y2': cy + r},
            label=text.strip().upper() if text else '',
            callout_type=callout_type,
            identifier=parsed['identifier'],
            view_sheet=parsed['view_sheet'],
            location_sheet=parsed['location_sheet'],
            confidence=final_confidence,
            ocr_confidence=ocr_conf,
            triangle_count=len(nearby_triangles),
            triangle_positions=triangle_positions,
            standard=detected_std,
            validation_tier='ocr'
        ))

        # Update counts
        if callout_type == 'detail':
            debug_info['detail_callouts'] += 1
        elif callout_type == 'elevation':
            debug_info['elevation_callouts'] += 1
        elif callout_type == 'section':
            debug_info['section_callouts'] += 1
        elif callout_type == 'title':
            debug_info['title_callouts'] += 1

    # Deduplicate
    deduped = []
    for c in callouts:
        is_dup = any(
            np.hypot(c.x - d.x, c.y - d.y) < 50 and c.label == d.label
            for d in deduped
        )
        if not is_dup:
            deduped.append(c)

    return deduped, debug_info


def find_filled_triangles(gray: np.ndarray, min_area=300, max_area=8000) -> List[Tuple]:
    """Find all filled (solid black) triangular contours for section cut markers."""
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY_INV, 15, 5)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    triangles = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not (min_area < area < max_area):
            continue

        perimeter = cv2.arcLength(cnt, True)

        is_triangle = False
        for epsilon_mult in [0.04, 0.03, 0.05, 0.06]:
            approx = cv2.approxPolyDP(cnt, epsilon_mult * perimeter, True)
            if len(approx) == 3:
                is_triangle = True
                break

        if not is_triangle:
            hull = cv2.convexHull(cnt)
            hull_approx = cv2.approxPolyDP(hull, 0.04 * cv2.arcLength(hull, True), True)
            if len(hull_approx) == 3:
                hull_area = cv2.contourArea(hull)
                if area / hull_area > 0.7:
                    is_triangle = True
                    approx = hull_approx

        if not is_triangle:
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        aspect = w / h if h > 0 else 0
        if not (0.3 < aspect < 3.0):
            continue

        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        mean_val = cv2.mean(gray, mask=mask)[0]

        if mean_val < 80:
            triangles.append((x, y, w, h, cnt))

    return triangles


def get_text_search_regions(tri_x, tri_y, tri_w, tri_h, img_w, img_h) -> List[dict]:
    """Generate regions around triangle to search for text label."""
    pad = 10
    regions = []

    text_h = max(40, tri_h)
    regions.append({
        'name': 'above',
        'x1': max(0, tri_x - pad),
        'y1': max(0, tri_y - text_h - pad),
        'x2': min(img_w, tri_x + tri_w + pad),
        'y2': tri_y
    })

    regions.append({
        'name': 'below',
        'x1': max(0, tri_x - pad),
        'y1': tri_y + tri_h,
        'x2': min(img_w, tri_x + tri_w + pad),
        'y2': min(img_h, tri_y + tri_h + text_h + pad)
    })

    text_w = max(60, tri_w)
    regions.append({
        'name': 'left',
        'x1': max(0, tri_x - text_w - pad),
        'y1': max(0, tri_y - pad),
        'x2': tri_x,
        'y2': min(img_h, tri_y + tri_h + pad)
    })

    regions.append({
        'name': 'right',
        'x1': tri_x + tri_w,
        'y1': max(0, tri_y - pad),
        'x2': min(img_w, tri_x + tri_w + text_w + pad),
        'y2': min(img_h, tri_y + tri_h + pad)
    })

    return regions


def extract_text_from_region(image: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> Tuple[Optional[str], float]:
    """Extract text from a region using OCR. Returns (text, confidence)."""
    if x2 <= x1 or y2 <= y1:
        return None, 0.0

    crop = image[y1:y2, x1:x2]
    if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
        return None, 0.0

    try:
        ocr = get_ocr()
        result = ocr.ocr(crop, cls=True)
        if result and result[0]:
            texts = []
            confs = []
            for line in result[0]:
                if line[1][1] > 0.4:
                    texts.append(line[1][0])
                    confs.append(line[1][1])
            if texts:
                return ' '.join(texts).strip(), sum(confs) / len(confs)
    except:
        pass
    return None, 0.0


def is_valid_section_cut_label(text: Optional[str], standard: str = 'auto') -> bool:
    """Validate section cut marker labels."""
    if not text:
        return False
    text = text.strip().upper()

    if len(text) > 15:
        return False

    if is_rejected_text(text):
        return False

    # Sheet reference patterns for both standards
    # PSPC: "3/A5", "1/A6"
    # NCS: "3/S5.1", "A/A-201"
    pspc_pattern = r'^[A-Z0-9]{1,2}\s*/\s*[A-Z][0-9]{1,2}$'
    ncs_pattern = r'^[A-Z0-9]{1,2}\s*/\s*[A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?$'

    if standard == 'pspc':
        if re.match(pspc_pattern, text):
            return True
    elif standard == 'ncs':
        if re.match(ncs_pattern, text):
            return True
    else:
        # Auto: try both
        if re.match(pspc_pattern, text) or re.match(ncs_pattern, text):
            return True

    # Simple identifiers
    if re.match(r'^[0-9]{1,2}$', text):
        return True
    if re.match(r'^[A-Z][0-9]?$', text):
        return True

    return False


def detect_section_callouts(
    image: np.ndarray,
    dpi: int = 300,
    standard: str = 'auto'
) -> Tuple[List[Callout], dict]:
    """Detect section callouts using triangle-first strategy."""
    scale = dpi / 300.0
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    debug_info = {
        'triangles_found': 0,
        'valid_labels': 0,
        'standard': standard
    }

    min_area = int(300 * scale**2)
    max_area = int(8000 * scale**2)
    triangles = find_filled_triangles(gray, min_area, max_area)
    debug_info['triangles_found'] = len(triangles)

    callouts = []

    for tri_x, tri_y, tri_w, tri_h, tri_cnt in triangles:
        regions = get_text_search_regions(tri_x, tri_y, tri_w, tri_h, w, h)

        best_label = None
        best_region = None
        best_conf = 0.0

        for region in regions:
            text, conf = extract_text_from_region(
                image, region['x1'], region['y1'], region['x2'], region['y2']
            )
            if is_valid_section_cut_label(text, standard) and conf > best_conf:
                best_label = text.strip().upper()
                best_region = region
                best_conf = conf

        if best_label:
            debug_info['valid_labels'] += 1

            cx = tri_x + tri_w / 2
            cy = tri_y + tri_h / 2

            bbox_x1 = min(tri_x, best_region['x1'])
            bbox_y1 = min(tri_y, best_region['y1'])
            bbox_x2 = max(tri_x + tri_w, best_region['x2'])
            bbox_y2 = max(tri_y + tri_h, best_region['y2'])

            callouts.append(Callout(
                x=cx,
                y=cy,
                bbox={'x1': int(bbox_x1), 'y1': int(bbox_y1),
                      'x2': int(bbox_x2), 'y2': int(bbox_y2)},
                label=best_label,
                callout_type='section_cut',
                confidence=0.90 * best_conf,
                ocr_confidence=best_conf,
                standard=detect_standard(best_label) if '/' in best_label else 'auto'
            ))

    # Deduplicate
    deduped = []
    for c in callouts:
        is_dup = any(
            np.hypot(c.x - d.x, c.y - d.y) < 50 and c.label == d.label
            for d in deduped
        )
        if not is_dup:
            deduped.append(c)

    return deduped, debug_info


def process_pdf(pdf_path: str, output_dir: str, dpi: int = 300, standard: str = 'auto', debug: bool = True):
    """Process PDF and detect callouts."""
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    num_pages = len(doc)
    doc.close()

    print(f"\n{'='*70}")
    print(f"Callout Processor v4 - Generalized Multi-Standard Detection")
    print(f"{'='*70}")
    print(f"PDF: {pdf_path.name}")
    print(f"Pages: {num_pages}, DPI: {dpi}, Standard: {standard}")
    print(f"{'='*70}")

    all_results = []

    for page_num in range(num_pages):
        sheet_dir = output_dir / f"sheet-{page_num}"
        sheet_dir.mkdir(exist_ok=True)

        print(f"\nSheet {page_num}:")

        image = render_pdf_page(str(pdf_path), page_num, dpi)
        h, w = image.shape[:2]
        print(f"  Rendered: {w}x{h}")

        cv2.imwrite(str(sheet_dir / "source.png"), image)

        # Detect triangle-based section cuts
        triangle_callouts, triangle_debug = detect_section_callouts(image, dpi, standard)
        print(f"  Triangle detection:")
        print(f"    Triangles found: {triangle_debug['triangles_found']}")
        print(f"    Section cuts: {len(triangle_callouts)}")

        # Detect circle-based callouts
        circle_callouts, circle_debug = detect_circle_callouts(image, dpi, standard)
        print(f"  Circle detection:")
        print(f"    Circles found: {circle_debug['circles_found']}")
        print(f"    Passed interior: {circle_debug.get('passed_interior_check', 0)}")
        print(f"    Passed outline: {circle_debug.get('passed_outline_check', 0)}")
        print(f"    Details: {circle_debug['detail_callouts']}")
        print(f"    Elevations: {circle_debug['elevation_callouts']}")
        print(f"    Sections: {circle_debug['section_callouts']}")
        print(f"    Titles: {circle_debug['title_callouts']}")
        print(f"    Rejected labels: {circle_debug['rejected_labels']}")
        print(f"    Rejected as letters: {circle_debug['rejected_as_letters']}")

        # Create annotated image
        annotated = image.copy()

        colors = {
            'section_cut': (0, 0, 255),    # Red
            'detail': (255, 0, 0),          # Blue
            'elevation': (0, 165, 255),     # Orange
            'section': (128, 0, 128),       # Purple
            'title': (0, 128, 0),           # Green
        }

        # Draw triangle-based callouts
        for c in triangle_callouts:
            color = colors['section_cut']
            cv2.rectangle(annotated,
                         (c.bbox['x1'], c.bbox['y1']),
                         (c.bbox['x2'], c.bbox['y2']),
                         color, 2)
            label = f"CUT:{c.label} ({c.confidence:.0%})"
            cv2.putText(annotated, label, (c.bbox['x1'], c.bbox['y1'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Draw circle-based callouts
        for c in circle_callouts:
            color = colors.get(c.callout_type, (0, 0, 255))
            cv2.circle(annotated, (int(c.x), int(c.y)), c.radius, color, 2)
            cv2.rectangle(annotated,
                         (c.bbox['x1'], c.bbox['y1']),
                         (c.bbox['x2'], c.bbox['y2']),
                         color, 1)
            type_prefix = c.callout_type[0].upper()
            label = f"{type_prefix}:{c.label} ({c.confidence:.0%})"
            cv2.putText(annotated, label, (c.bbox['x1'], c.bbox['y1'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        cv2.imwrite(str(sheet_dir / "annotated.png"), annotated)

        # Save markers JSON
        markers = []
        marker_idx = 0

        for c in triangle_callouts:
            markers.append({
                'id': f"marker-{page_num}-{marker_idx}",
                'label': c.label,
                'type': 'section_cut',
                'x': c.x / w,
                'y': c.y / h,
                'pixelX': int(c.x),
                'pixelY': int(c.y),
                'bbox': c.bbox,
                'confidence': c.confidence,
                'ocrConfidence': c.ocr_confidence,
                'standard': c.standard,
            })
            marker_idx += 1

        for c in circle_callouts:
            marker = {
                'id': f"marker-{page_num}-{marker_idx}",
                'label': c.label,
                'type': c.callout_type,
                'x': float(c.x / w),
                'y': float(c.y / h),
                'pixelX': int(c.x),
                'pixelY': int(c.y),
                'bbox': {k: int(v) for k, v in c.bbox.items()},
                'confidence': float(c.confidence),
                'ocrConfidence': float(c.ocr_confidence),
                'radius': int(c.radius),
                'triangleCount': int(c.triangle_count),
                'trianglePositions': c.triangle_positions,
                'standard': c.standard,
                'validationTier': c.validation_tier,
            }
            if c.identifier:
                marker['identifier'] = c.identifier
            if c.view_sheet:
                marker['viewSheet'] = c.view_sheet
            if c.location_sheet:
                marker['locationSheet'] = c.location_sheet
            markers.append(marker)
            marker_idx += 1

        with open(sheet_dir / "markers.json", 'w') as f:
            json.dump(markers, f, indent=2)

        # Save debug info
        with open(sheet_dir / "debug.json", 'w') as f:
            json.dump({
                'triangle': triangle_debug,
                'circle': circle_debug
            }, f, indent=2)

        all_results.append({
            'sheet': page_num,
            'width': w,
            'height': h,
            'section_cuts': len(triangle_callouts),
            'detail_callouts': circle_debug['detail_callouts'],
            'elevation_callouts': circle_debug['elevation_callouts'],
            'section_callouts': circle_debug['section_callouts'],
            'title_callouts': circle_debug['title_callouts'],
            'total_callouts': len(triangle_callouts) + len(circle_callouts),
        })

        # Print detected callouts
        if triangle_callouts:
            print(f"  Section cuts:")
            for c in triangle_callouts:
                print(f"    - {c.label} @ ({int(c.x)}, {int(c.y)}) conf={c.confidence:.0%}")
        if circle_callouts:
            print(f"  Circle callouts:")
            for c in circle_callouts:
                std_tag = f" [{c.standard}]" if c.standard != 'auto' else ""
                print(f"    - [{c.callout_type}] {c.label}{std_tag} @ ({int(c.x)}, {int(c.y)}) conf={c.confidence:.0%}")

    # Save summary
    with open(output_dir / "summary.json", 'w') as f:
        json.dump(all_results, f, indent=2)

    # Print summary
    print(f"\n{'='*70}")
    print("Summary:")
    total_section_cuts = sum(r['section_cuts'] for r in all_results)
    total_details = sum(r['detail_callouts'] for r in all_results)
    total_elevations = sum(r['elevation_callouts'] for r in all_results)
    total_sections = sum(r['section_callouts'] for r in all_results)
    total_titles = sum(r['title_callouts'] for r in all_results)
    print(f"  Section cuts (triangle): {total_section_cuts}")
    print(f"  Detail callouts: {total_details}")
    print(f"  Elevation callouts: {total_elevations}")
    print(f"  Section callouts: {total_sections}")
    print(f"  Title callouts: {total_titles}")
    print(f"  Total: {sum(r['total_callouts'] for r in all_results)}")
    print(f"\nOutput: {output_dir}")
    print("Done!")


def main():
    parser = argparse.ArgumentParser(description='Callout Processor v4 - Generalized Multi-Standard Detection')
    parser.add_argument('--pdf', required=True, help='Input PDF file')
    parser.add_argument('--output', required=True, help='Output directory')
    parser.add_argument('--dpi', type=int, default=300, help='Render DPI')
    parser.add_argument('--standard', choices=['auto', 'pspc', 'ncs'], default='auto',
                        help='Drawing standard (auto-detect if not specified)')
    parser.add_argument('--debug', action='store_true', help='Save debug images')

    args = parser.parse_args()
    process_pdf(args.pdf, args.output, args.dpi, args.standard, args.debug)


if __name__ == '__main__':
    main()
