#!/usr/bin/env python3
"""
Callout Processor v3 - Triangle and Circle-based callout detection.

Supports two detection strategies:

1. Triangle-first (section cut markers):
   - Filled black triangle pointing toward the section
   - Text label (like "3/A5") positioned NEAR the triangle

2. Circle-first (detail/elevation/section callouts):
   - Outlined circle with text INSIDE
   - Count attached triangles to classify:
     - 0 triangles → Detail callout
     - 1 triangle (top) → Elevation callout
     - 3 triangles (top + left + right) → Section callout
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
    triangle_pos: Tuple[int, int, int, int]  # x, y, w, h of triangle (for triangle-based)


@dataclass
class CircleCallout:
    x: float
    y: float
    radius: int
    bbox: dict
    label: str
    callout_type: str  # 'detail', 'elevation', or 'section'
    identifier: Optional[str] = None
    view_sheet: Optional[str] = None
    location_sheet: Optional[str] = None
    confidence: float = 0.0
    triangle_count: int = 0
    triangle_positions: List[str] = field(default_factory=list)  # ['top', 'left', 'right']


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


def find_filled_triangles(gray: np.ndarray, min_area=300, max_area=8000) -> List[Tuple]:
    """Find all filled (solid black) triangular contours."""
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

        # Try multiple approximation levels
        is_triangle = False
        for epsilon_mult in [0.04, 0.03, 0.05, 0.06]:
            approx = cv2.approxPolyDP(cnt, epsilon_mult * perimeter, True)
            if len(approx) == 3:
                is_triangle = True
                break

        # Also check convex hull - triangular shapes should have triangular hull
        if not is_triangle:
            hull = cv2.convexHull(cnt)
            hull_approx = cv2.approxPolyDP(hull, 0.04 * cv2.arcLength(hull, True), True)
            if len(hull_approx) == 3:
                hull_area = cv2.contourArea(hull)
                # If hull is triangular and the contour fills most of the hull, it's likely a triangle
                if area / hull_area > 0.7:
                    is_triangle = True
                    approx = hull_approx

        if not is_triangle:
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        # Check aspect ratio - not too elongated
        aspect = w / h if h > 0 else 0
        if not (0.3 < aspect < 3.0):
            continue

        # Check if filled (dark inside)
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        mean_val = cv2.mean(gray, mask=mask)[0]

        if mean_val < 80:  # Filled (dark)
            triangles.append((x, y, w, h, cnt))

    return triangles


def calculate_circularity(contour) -> float:
    """Calculate circularity score: 1.0 = perfect circle."""
    area = cv2.contourArea(contour)
    perimeter = cv2.arcLength(contour, True)
    if perimeter == 0:
        return 0
    return 4 * np.pi * area / (perimeter * perimeter)


def check_interior_density(gray: np.ndarray, cx: int, cy: int, radius: int) -> Tuple[bool, float]:
    """
    Check if circle interior is mostly white (empty).
    Returns (is_valid, whiteness_ratio).
    Callout circles should be >80% white inside.
    """
    h, w = gray.shape

    # Create mask for interior (slightly smaller to avoid edge)
    inner_radius = max(1, int(radius * 0.8))
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), inner_radius, 255, -1)

    # Get interior pixels
    interior_pixels = gray[mask > 0]
    if len(interior_pixels) == 0:
        return False, 0.0

    # Count white pixels (> 200 brightness)
    white_count = np.sum(interior_pixels > 200)
    whiteness = white_count / len(interior_pixels)

    return whiteness > 0.75, whiteness


def check_horizontal_line_inside(gray: np.ndarray, cx: int, cy: int, radius: int) -> bool:
    """
    Check if there's a horizontal dividing line inside the circle.
    This is a strong positive signal for callout symbols.
    """
    _, line_y = find_horizontal_line_inside(gray, cx, cy, radius)
    return line_y is not None


def check_is_title_callout(gray: np.ndarray, cx: int, cy: int, radius: int) -> bool:
    """
    Check if this circle is a TITLE callout per PSPC 2.4.

    Title callouts have the full pattern:
    1. Circle with identifier
    2. Horizontal line extending from RIGHT side of circle
    3. Title TEXT above that line (substantial text like "FOUNDATION PLAN")
    4. Scale notation below (strongly expected)
    5. Located in lower portion of sheet (main plan area, not detail views)

    Reference callouts (detail/elevation/section) are standalone circles
    that may have nearby drawing lines but NOT the title pattern.
    """
    h, w = gray.shape

    # Title callouts for main plans are in the lower 55% of the sheet
    # Detail views (which also have titles) are typically in upper portion
    if cy < h * 0.55:
        return False

    # Step 1: Look for substantial horizontal line extending from circle
    # The line extends from the circle to the right, at or below circle center
    line_start_x = cx + radius
    line_end_x = min(w, cx + radius + 600)
    line_y1 = max(0, cy - 10)  # Slightly above center
    line_y2 = min(h, cy + radius + 20)  # Below circle

    line_region = gray[line_y1:line_y2, line_start_x:line_end_x]
    if line_region.size == 0:
        return False

    _, binary = cv2.threshold(line_region, 127, 255, cv2.THRESH_BINARY_INV)

    # Check each row for line-like structure
    dark_per_row = np.sum(binary > 0, axis=1)
    # Find the row with the most continuous dark content (the line)
    best_row_idx = np.argmax(dark_per_row) if len(dark_per_row) > 0 else 0
    line_cols_with_content = dark_per_row[best_row_idx] if len(dark_per_row) > 0 else 0

    # Title lines are LONG - need at least 200 columns (typical title text span)
    if line_cols_with_content < 200:
        return False

    # Step 2: Check for substantial title TEXT ABOVE the line
    text_y1 = max(0, cy - 50)
    text_y2 = cy - 5  # Text is above the circle center
    text_x1 = cx + radius + 30
    text_x2 = min(w, cx + radius + 800)

    if text_y2 <= text_y1 or text_x2 <= text_x1:
        return False

    text_region = gray[text_y1:text_y2, text_x1:text_x2]
    if text_region.size == 0:
        return False

    text_dark_ratio = np.sum(text_region < 128) / text_region.size
    if text_dark_ratio < 0.04:
        return False

    # Step 3: Check for scale notation BELOW the line
    scale_y1 = cy + 15
    scale_y2 = min(h, cy + 120)
    scale_x1 = cx - 20
    scale_x2 = min(w, cx + radius + 500)

    if scale_y2 <= scale_y1 or scale_x2 <= scale_x1:
        return False

    scale_region = gray[scale_y1:scale_y2, scale_x1:scale_x2]
    if scale_region.size == 0:
        return False

    scale_dark_ratio = np.sum(scale_region < 128) / scale_region.size

    # Title callout requires: long line + text above + scale below
    return scale_dark_ratio > 0.02


def check_is_letter_in_word(gray: np.ndarray, cx: int, cy: int, radius: int) -> bool:
    """
    Check if the circle is likely a letter in a word (like "O" in "ROOF").

    Letters in words have text characters on both LEFT and RIGHT sides.
    Standalone callout circles do not.
    """
    h, w = gray.shape

    # Check for dark pixels (text) on LEFT side of circle
    left_x1 = max(0, cx - radius - 30)
    left_x2 = cx - radius + 5
    left_y1 = max(0, cy - radius)
    left_y2 = min(h, cy + radius)

    # Check for dark pixels (text) on RIGHT side of circle
    right_x1 = cx + radius - 5
    right_x2 = min(w, cx + radius + 30)
    right_y1 = max(0, cy - radius)
    right_y2 = min(h, cy + radius)

    has_text_left = False
    has_text_right = False

    if left_x2 > left_x1 and left_y2 > left_y1:
        left_region = gray[left_y1:left_y2, left_x1:left_x2]
        if left_region.size > 0:
            dark_ratio = np.sum(left_region < 128) / left_region.size
            has_text_left = dark_ratio > 0.08  # Some dark pixels = text

    if right_x2 > right_x1 and right_y2 > right_y1:
        right_region = gray[right_y1:right_y2, right_x1:right_x2]
        if right_region.size > 0:
            dark_ratio = np.sum(right_region < 128) / right_region.size
            has_text_right = dark_ratio > 0.08

    # If text on BOTH sides, it's likely a letter in a word
    return has_text_left and has_text_right


def find_horizontal_line_inside(gray: np.ndarray, cx: int, cy: int, radius: int) -> Tuple[bool, Optional[int]]:
    """
    Find a horizontal dividing line inside the circle and return its Y position.
    Returns: (has_line, line_y_position_relative_to_circle_top)
    """
    # Extract region inside circle
    margin = 2
    x1 = max(0, cx - radius + margin)
    y1 = max(0, cy - radius + margin)
    x2 = min(gray.shape[1], cx + radius - margin)
    y2 = min(gray.shape[0], cy + radius - margin)

    if x2 <= x1 or y2 <= y1:
        return False, None

    region = gray[y1:y2, x1:x2]
    region_h, region_w = region.shape[:2]

    # Threshold and detect lines
    _, binary = cv2.threshold(region, 127, 255, cv2.THRESH_BINARY_INV)
    lines = cv2.HoughLinesP(binary, 1, np.pi/180, threshold=10,
                            minLineLength=int(radius * 0.5), maxLineGap=5)

    if lines is None:
        return False, None

    # Find horizontal lines and get their Y positions
    horizontal_lines = []
    for line in lines:
        x1_l, y1_l, x2_l, y2_l = line[0]
        angle = abs(np.arctan2(y2_l - y1_l, x2_l - x1_l) * 180 / np.pi)
        if angle < 15 or angle > 165:  # Near horizontal
            avg_y = (y1_l + y2_l) // 2
            # Line should be roughly in the middle third of the circle
            if region_h * 0.25 < avg_y < region_h * 0.75:
                horizontal_lines.append(avg_y)

    if not horizontal_lines:
        return False, None

    # Return the most central horizontal line
    center_y = region_h // 2
    best_line_y = min(horizontal_lines, key=lambda y: abs(y - center_y))

    # Return position relative to region top (which is cy - radius + margin)
    return True, y1 + best_line_y


def find_callout_triangles(gray: np.ndarray, min_area: int = 30, max_area: int = 600) -> List[Dict]:
    """
    Find small filled triangles that could be attached to callout circles.
    These are SMALLER than section-cut triangles and point upward.
    Typical area range: 30-600 pixels (much smaller than section-cut triangles which are 300-8000).
    Returns list of dicts with center, bbox, and direction info.
    """
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY_INV, 11, 4)
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    triangles = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not (min_area < area < max_area):
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue

        # Check if triangular
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

        # Check if filled (dark inside)
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        mean_val = cv2.mean(gray, mask=mask)[0]

        if mean_val > 100:  # Not filled enough
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        tri_cx = x + w // 2
        tri_cy = y + h // 2

        # Determine if triangle points upward (apex at top)
        # For upward-pointing triangle, the topmost point should be near center-x
        points = cnt.reshape(-1, 2)
        top_point = points[points[:, 1].argmin()]  # Point with smallest y (top)
        bottom_center_x = (points[:, 0].min() + points[:, 0].max()) / 2

        # Triangle points up if top point is near horizontal center
        points_up = abs(top_point[0] - bottom_center_x) < w * 0.3

        triangles.append({
            'bbox': (x, y, w, h),
            'center': (tri_cx, tri_cy),
            'bottom_center': (int(bottom_center_x), y + h),
            'points_up': points_up,
            'area': area,
            'contour': cnt
        })

    return triangles


def find_circle_below_triangle(
    gray: np.ndarray,
    triangle: Dict,
    min_radius: int = 15,
    max_radius: int = 50,
    max_gap: int = 10
) -> Optional[Tuple[int, int, int]]:
    """
    Look for a circle directly below a triangle (for elevation/section callouts).
    The triangle should be touching or very close to the top of the circle.
    """
    tx, ty, tw, th = triangle['bbox']
    tri_bottom_cx, tri_bottom_y = triangle['bottom_center']

    # Search region below triangle
    search_x1 = max(0, tri_bottom_cx - max_radius - 10)
    search_y1 = tri_bottom_y - 5  # Slight overlap
    search_x2 = min(gray.shape[1], tri_bottom_cx + max_radius + 10)
    search_y2 = min(gray.shape[0], tri_bottom_y + max_radius * 2 + max_gap)

    if search_x2 <= search_x1 or search_y2 <= search_y1:
        return None

    region = gray[search_y1:search_y2, search_x1:search_x2]

    # Try Hough circles in this region
    blurred = cv2.GaussianBlur(region, (9, 9), 2)
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1, minDist=20,
        param1=50, param2=25, minRadius=min_radius, maxRadius=max_radius
    )

    if circles is None:
        return None

    # Find circle whose top edge is close to triangle bottom
    best_circle = None
    best_dist = float('inf')

    for (cx, cy, r) in circles[0]:
        # Convert to global coordinates
        global_cx = int(search_x1 + cx)
        global_cy = int(search_y1 + cy)
        circle_top_y = global_cy - r

        # Check alignment: circle center should be below triangle center
        horizontal_offset = abs(global_cx - tri_bottom_cx)
        vertical_gap = circle_top_y - tri_bottom_y

        # Circle top should be close to triangle bottom, and horizontally aligned
        if horizontal_offset < r * 0.5 and -5 <= vertical_gap <= max_gap:
            dist = horizontal_offset + abs(vertical_gap)
            if dist < best_dist:
                best_dist = dist
                best_circle = (global_cx, global_cy, int(r))

    return best_circle


def find_detail_circles(gray: np.ndarray, min_radius: int = 15, max_radius: int = 50,
                        exclude_positions: List[Tuple[int, int]] = None) -> List[Tuple[int, int, int]]:
    """
    Find standalone circles that could be Detail callouts (no attached triangles).
    Uses strict circularity and interior density checks.
    """
    if exclude_positions is None:
        exclude_positions = []

    # Use contour-based detection for better circularity checking
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY_INV, 15, 5)
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    candidates = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        expected_min_area = np.pi * min_radius**2 * 0.5
        expected_max_area = np.pi * max_radius**2 * 1.5

        if not (expected_min_area < area < expected_max_area):
            continue

        # Strict circularity check (> 0.85)
        circularity = calculate_circularity(cnt)
        if circularity < 0.85:
            continue

        # Get circle parameters
        (cx, cy), radius = cv2.minEnclosingCircle(cnt)
        cx, cy, radius = int(cx), int(cy), int(radius)

        if not (min_radius <= radius <= max_radius):
            continue

        # Skip if too close to already-found elevation/section callouts
        is_excluded = any(
            np.hypot(cx - ex, cy - ey) < radius * 1.5
            for ex, ey in exclude_positions
        )
        if is_excluded:
            continue

        # Check interior density (must be mostly white)
        is_valid, whiteness = check_interior_density(gray, cx, cy, radius)
        if not is_valid:
            continue

        # Skip duplicates
        is_dup = any(
            np.hypot(cx - dx, cy - dy) < min(radius, dr) * 0.5
            for dx, dy, dr in candidates
        )
        if not is_dup:
            candidates.append((cx, cy, radius))

    return candidates


def find_elevation_section_circles(
    gray: np.ndarray,
    min_radius: int = 15,
    max_radius: int = 50
) -> List[Tuple[int, int, int, str]]:
    """
    Find circles with attached triangles (elevation/section callouts).

    Uses HoughCircles to find candidate circles, then checks for triangular
    dark regions above each circle.

    Returns: List of (cx, cy, radius, callout_type) tuples
    """
    # Use HoughCircles to find candidate circles
    circles = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1, minDist=30,
        param1=50, param2=30, minRadius=min_radius, maxRadius=max_radius
    )

    if circles is None:
        return []

    circles = np.round(circles[0, :]).astype(int)
    results = []

    for cx, cy, r in circles:
        # Check region above the circle for dark pixels (triangle indicator)
        tri_height = min(r, 20)
        y_above_start = max(0, cy - r - tri_height)
        y_above_end = cy - r + 3
        x_start = max(0, cx - r // 2)
        x_end = min(gray.shape[1], cx + r // 2)

        if y_above_end <= y_above_start:
            continue

        above_region = gray[y_above_start:y_above_end, x_start:x_end]
        if above_region.size == 0:
            continue

        dark_ratio = np.sum(above_region < 128) / above_region.size

        # Need at least 15% dark pixels above (indicates triangle)
        if dark_ratio < 0.15:
            continue

        # Check interior density (should be mostly white)
        is_valid, whiteness = check_interior_density(gray, cx, cy, r)

        # For elevation/section, allow lower whiteness since they have text
        if whiteness < 0.4:
            continue

        # Classify based on triangle size
        # Larger dark ratio above = section callout (bigger triangle)
        if dark_ratio > 0.35:
            callout_type = 'section'
        else:
            callout_type = 'elevation'

        results.append((cx, cy, r, callout_type))

    # Remove duplicates
    deduped = []
    for r in results:
        is_dup = any(
            np.hypot(r[0] - d[0], r[1] - d[1]) < min(r[2], d[2])
            for d in deduped
        )
        if not is_dup:
            deduped.append(r)

    return deduped


def find_small_triangles_near_circle(
    gray: np.ndarray,
    cx: int, cy: int, radius: int,
    search_margin: int = 20,
    min_tri_area: int = 50,
    max_tri_area: int = 800
) -> List[Dict]:
    """
    Find small filled triangles attached to or very close to a circle's perimeter.
    Returns list of dicts with position info ('top', 'left', 'right', 'bottom') and bbox.
    """
    triangles = []

    # Define search region around the circle
    search_r = radius + search_margin
    x1 = max(0, cx - search_r)
    y1 = max(0, cy - search_r)
    x2 = min(gray.shape[1], cx + search_r)
    y2 = min(gray.shape[0], cy + search_r)

    # Extract region
    region = gray[y1:y2, x1:x2]
    if region.size == 0:
        return triangles

    # Threshold to find dark shapes
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

        # Check if triangular
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

        # Get bounding box in region coords
        rx, ry, rw, rh = cv2.boundingRect(cnt)

        # Convert to global coords
        tri_cx = x1 + rx + rw // 2
        tri_cy = y1 + ry + rh // 2

        # Check distance from circle edge
        dist_from_center = np.hypot(tri_cx - cx, tri_cy - cy)
        dist_from_edge = abs(dist_from_center - radius)

        # Triangle should be close to circle edge (attached or nearby)
        if dist_from_edge > search_margin:
            continue

        # Check if filled (dark inside)
        mask = np.zeros(region.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        mean_val = cv2.mean(region, mask=mask)[0]

        if mean_val > 100:  # Not filled enough
            continue

        # Determine position relative to circle center
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

    # Deduplicate triangles in similar positions
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


def classify_circle_callout(triangle_count: int, positions: List[str]) -> str:
    """
    Classify callout type based on attached triangle count and positions.
    - 0 triangles → detail
    - 1 triangle (top) → elevation
    - 3 triangles (top + left + right) → section
    """
    if triangle_count == 0:
        return 'detail'
    elif triangle_count == 1 and 'top' in positions:
        return 'elevation'
    elif triangle_count >= 2:
        # Section callouts have triangles on sides (with or without top)
        has_sides = 'left' in positions or 'right' in positions
        if has_sides:
            return 'section'
        elif 'top' in positions:
            return 'elevation'
    elif triangle_count == 1:
        # Single triangle in any position - likely elevation variant
        return 'elevation'

    return 'detail'  # Default


def _ocr_region(image: np.ndarray, min_size: int = 150) -> Optional[str]:
    """OCR a single image region with upscaling."""
    if image.size == 0 or image.shape[0] < 5 or image.shape[1] < 5:
        return None

    try:
        # Upscale small crops for better OCR
        h, w = image.shape[:2]
        if h < min_size or w < min_size:
            scale_factor = max(min_size / h, min_size / w, 3.0)
            image = cv2.resize(image, None, fx=scale_factor, fy=scale_factor,
                              interpolation=cv2.INTER_CUBIC)

        ocr = get_ocr()
        result = ocr.ocr(image, det=False, cls=True)
        if result and result[0]:
            texts = []
            for line in result[0]:
                text, conf = line
                if conf > 0.4:
                    texts.append(text)
            return ' '.join(texts).strip() if texts else None
    except:
        return None
    return None


def extract_text_inside_circle(
    image: np.ndarray,
    cx: int, cy: int, radius: int,
    padding: int = 2
) -> Optional[str]:
    """
    Extract text from inside a circle using OCR.

    If a horizontal dividing line is detected, extracts text from top and
    bottom regions separately and combines them with '/'.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # Check for horizontal dividing line
    has_line, line_y = find_horizontal_line_inside(gray, cx, cy, radius)

    x1 = max(0, cx - radius + padding)
    x2 = min(image.shape[1], cx + radius - padding)

    if x2 <= x1:
        return None

    if has_line and line_y is not None:
        # Split into top and bottom regions at the dividing line
        top_y1 = max(0, cy - radius + padding)
        top_y2 = line_y - 2  # Stop just above the line
        bottom_y1 = line_y + 2  # Start just below the line
        bottom_y2 = min(image.shape[0], cy + radius - padding)

        top_text = None
        bottom_text = None

        # OCR top region
        if top_y2 > top_y1:
            top_crop = image[top_y1:top_y2, x1:x2]
            top_text = _ocr_region(top_crop)

        # OCR bottom region
        if bottom_y2 > bottom_y1:
            bottom_crop = image[bottom_y1:bottom_y2, x1:x2]
            bottom_text = _ocr_region(bottom_crop)

        # Combine with "/" if both parts have text
        if top_text and bottom_text:
            return f"{top_text}/{bottom_text}"
        elif top_text:
            return top_text
        elif bottom_text:
            return bottom_text
        return None
    else:
        # No dividing line - OCR the whole circle
        y1 = max(0, cy - radius + padding)
        y2 = min(image.shape[0], cy + radius - padding)

        if y2 <= y1:
            return None

        crop = image[y1:y2, x1:x2]
        return _ocr_region(crop)


def parse_callout_label(text: str) -> Dict:
    """
    Parse callout label into components.

    Formats:
    - Simple: "1", "A", "3"
    - With view ref: "1/A5", "A/X2", "3 / A5"
    - Full: "1" with "X1|X2" below (detected as "1 X1 X2" or similar)
    """
    if not text:
        return {'identifier': None, 'view_sheet': None, 'location_sheet': None}

    text = text.strip().upper()
    text = re.sub(r'\s+', ' ', text)  # Normalize whitespace

    result = {
        'identifier': None,
        'view_sheet': None,
        'location_sheet': None
    }

    # Pattern 1: "3/A5" or "A/X2" format
    match = re.match(r'^([A-Z0-9]{1,2})\s*/\s*([A-Z][0-9]{1,2})$', text)
    if match:
        result['identifier'] = match.group(1)
        result['view_sheet'] = match.group(2)
        return result

    # Pattern 2: Full format "1 X1 X2" or "A X1|X2"
    match = re.match(r'^([A-Z0-9]{1,2})\s+([A-Z][0-9]{1,2})\s*[|\s]\s*([A-Z][0-9]{1,2})$', text)
    if match:
        result['identifier'] = match.group(1)
        result['location_sheet'] = match.group(2)
        result['view_sheet'] = match.group(3)
        return result

    # Pattern 3: Simple identifier "1", "2", "A", "A1"
    match = re.match(r'^([A-Z]?[0-9]{1,2}|[A-Z])$', text)
    if match:
        result['identifier'] = match.group(1)
        return result

    # Pattern 4: Two-line format "1 A5" (identifier on top, view sheet below)
    match = re.match(r'^([A-Z0-9]{1,2})\s+([A-Z][0-9]{1,2})$', text)
    if match:
        result['identifier'] = match.group(1)
        result['view_sheet'] = match.group(2)
        return result

    # Fallback: just use the first recognizable token
    tokens = re.findall(r'[A-Z0-9]{1,3}', text)
    if tokens:
        result['identifier'] = tokens[0]
        if len(tokens) > 1 and re.match(r'^[A-Z][0-9]{1,2}$', tokens[-1]):
            result['view_sheet'] = tokens[-1]

    return result


def _is_rejected_text(text: str) -> bool:
    """Check if text matches known non-callout patterns."""
    reject_patterns = [
        r'NORTH', r'SCALE', r'TYP', r'SIM', r'REF', r'SEE',
        r'NOTE', r'DIM', r'SIZE', r'MIN', r'MAX', r'EXIST',
        r'NEW', r'VERIFY', r'FIELD', r'APPROX', r'ABOVE',
        r'BELOW', r'BEYOND', r'OVERALL', r'FOUND', r'OFFER',
        r'EQ', r'CLR', r'CONT', r'VARIES', r'MATCH',
        r'WINDOW', r'DOOR', r'WALL', r'FLOOR', r'CEILING',
        r'STAIR', r'ROOM', r'BATH', r'KITCHEN', r'BEDROOM',
        r'CLOSET', r'GARAGE', r'OFFICE', r'UTILITY',
        r'POST', r'BEAM', r'HEADER', r'JOIST', r'RAFTER',
        r'RIDGE', r'VALLEY', r'SLOPE', r'OVERHANG', r'ACCESS',
        r'SKYLIGHT', r'ATTIC', r'VENT', r'TRUSS', r'BRACING',
    ]
    for pattern in reject_patterns:
        if re.search(pattern, text):
            return True

    # Reject if contains 3+ consecutive letters (likely a word, not callout ID)
    if re.search(r'[A-Z]{3,}', text):
        return True

    # Reject if it looks like a dimension (number with unit or fraction)
    if re.search(r'\d+["\'-]', text) or re.search(r'\d+/\d+["\']', text):
        return True

    return False


def is_valid_detail_callout_label(text: Optional[str]) -> bool:
    """
    Validate DETAIL callout labels per PSPC standard.

    Detail callouts (circles WITHOUT triangles) use NUMBERS only:
    - Simple: "1", "2", "10" (1-2 digit number)
    - With view ref: "1/A5", "3/A5" (number / sheet)
    - Full ref: "1 A1 A5" (number + location + view sheet)

    Single letters like "A", "G" are NOT valid for detail callouts.
    Those require triangles to be section/elevation callouts.
    """
    if not text:
        return False

    text = text.strip().upper()

    if len(text) == 0 or len(text) > 12:
        return False

    if _is_rejected_text(text):
        return False

    # Valid pattern 1: Simple number "1", "2", "10", "12" (NOT "0" - OCR artifact)
    if re.match(r'^[1-9][0-9]?$', text):
        return True

    # Valid pattern 2: Number/sheet reference "3/A5", "1/A6", "2 / A5"
    # The TOP part (identifier) must be a NUMBER for detail callouts
    if re.match(r'^[1-9][0-9]?\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    # Valid pattern 3: Two-part "1 A5" (number + view sheet)
    if re.match(r'^[1-9][0-9]?\s+[A-Z][0-9]{1,2}$', text):
        return True

    # Valid pattern 4: Three-part "1 A1 A5" (number + location + view)
    if re.match(r'^[1-9][0-9]?\s+[A-Z][0-9]{1,2}\s+[A-Z][0-9]{1,2}$', text):
        return True

    return False


def is_valid_elevation_section_label(text: Optional[str]) -> bool:
    """
    Validate ELEVATION or SECTION callout labels per PSPC standard.

    These callouts (circles WITH triangles) can use numbers OR letters:
    - Elevation: "1", "2", "10" (numbers)
    - Section: "A", "B", "C" (SINGLE letters only per PSPC standard)
    - With view ref: "1/A5", "A/X2" (identifier / sheet)

    NOTE: Random two-letter combos like "TY", "GI", "ON" are NOT valid.
    Section IDs are single letters (A-Z), not arbitrary letter pairs.
    """
    if not text:
        return False

    text = text.strip().upper()

    if len(text) == 0 or len(text) > 12:
        return False

    if _is_rejected_text(text):
        return False

    # Valid pattern 1: Simple number "1", "2", "10"
    if re.match(r'^[1-9][0-9]?$', text):
        return True

    # Valid pattern 2: SINGLE letter only "A", "B", "C" (section identifiers)
    # Per PSPC standard, section ID is a single letter, not random pairs
    if re.match(r'^[A-Z]$', text):
        return True

    # Valid pattern 3: Number/sheet reference "3/A5", "1/A6"
    if re.match(r'^[1-9][0-9]?\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    # Valid pattern 4: Letter/sheet reference "A/X2", "B/A5" (single letter + sheet)
    if re.match(r'^[A-Z]\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    # Valid pattern 5: Two-part with number + sheet "1 A5"
    if re.match(r'^[1-9][0-9]?\s+[A-Z][0-9]{1,2}$', text):
        return True

    return False


def is_valid_circle_callout_label(text: Optional[str], callout_type: str = 'detail') -> bool:
    """
    Validate circle callout labels per PSPC standard.

    Routes to specific validator based on callout type:
    - 'detail': Only numbers (no triangles present)
    - 'title': Numbers or letters (per PSPC 2.4, same as detail/section identifiers)
    - 'elevation'/'section': Numbers or letters (triangles present)
    """
    if callout_type == 'detail':
        return is_valid_detail_callout_label(text)
    elif callout_type == 'title':
        # Title callouts per PSPC 2.4 can use numbers (detail/elevation) or letters (section)
        return is_valid_detail_callout_label(text) or is_valid_elevation_section_label(text)
    else:
        return is_valid_elevation_section_label(text)


def detect_circle_callouts(image: np.ndarray, dpi: int = 300) -> Tuple[List[CircleCallout], dict]:
    """
    Detect circle-based callouts (detail, elevation, section).

    Strategy (unified HoughCircles approach):
    1. Use HoughCircles to find ALL circle candidates
    2. Classify each circle by triangle presence:
       - Has dark pixels above (triangle) → elevation/section
       - No triangle → detail callout
    3. Apply OCR validation
    """
    scale = dpi / 300.0
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    debug_info = {
        'circles_found': 0,
        'detail_candidates': 0,
        'detail_callouts': 0,
        'elevation_callouts': 0,
        'section_callouts': 0,
        'invalid_labels': 0
    }

    callouts = []

    # Minimum radius filters out text letters (like "O" in "ROOF" which is r=16-17)
    # Real callout circles are typically r=30-40 at 300 DPI
    min_radius = int(22 * scale)
    max_radius = int(45 * scale)

    # ===== PHASE 1: Find ALL circles using HoughCircles =====
    circles = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1, minDist=30,
        param1=50, param2=30, minRadius=min_radius, maxRadius=max_radius
    )

    if circles is None:
        return [], debug_info

    circles = np.round(circles[0, :]).astype(int)
    debug_info['circles_found'] = len(circles)

    # ===== PHASE 2: Classify each circle =====
    for cx, cy, r in circles:
        # Check interior density first (most important filter)
        is_valid_interior, whiteness = check_interior_density(gray, cx, cy, r)

        # Skip circles with very dark interiors (likely not callouts)
        if whiteness < 0.4:
            continue

        # Use actual triangle shape detection near the circle
        # This is more robust than just checking dark pixel ratio
        nearby_triangles = find_small_triangles_near_circle(
            gray, cx, cy, r,
            search_margin=15,  # Look slightly outside circle perimeter
            min_tri_area=30,   # Small triangles for callout indicators
            max_tri_area=600
        )

        # Filter to triangles actually at 'top' position
        top_triangles = [t for t in nearby_triangles if t['position'] == 'top']
        side_triangles = [t for t in nearby_triangles if t['position'] in ('left', 'right')]

        has_top_triangle = len(top_triangles) > 0
        has_side_triangles = len(side_triangles) > 0

        if has_top_triangle or has_side_triangles:
            # Elevation or Section callout (has actual triangles)
            # Section callouts typically have triangles on sides, elevation on top only
            if has_side_triangles:
                callout_type = 'section'
            else:
                callout_type = 'elevation'

            triangle_positions = [t['position'] for t in nearby_triangles]
            tri_extension = int(r * 0.4)

            callouts.append(CircleCallout(
                x=float(cx),
                y=float(cy),
                radius=r,
                bbox={'x1': cx - r, 'y1': cy - r - tri_extension,
                      'x2': cx + r, 'y2': cy + r},
                label='',
                callout_type=callout_type,
                confidence=0.85,
                triangle_count=len(nearby_triangles),
                triangle_positions=triangle_positions
            ))

            if callout_type == 'elevation':
                debug_info['elevation_callouts'] += 1
            else:
                debug_info['section_callouts'] += 1
        else:
            # Potential detail callout (no triangle detected)
            # Check if it's actually a TITLE callout (has line extending right + title + scale)
            debug_info['detail_candidates'] += 1
            has_dividing_line = check_horizontal_line_inside(gray, cx, cy, r)
            has_title_pattern = check_is_title_callout(gray, cx, cy, r)

            # Title callouts have: circle + horizontal line extending right
            # Detail callouts are standalone circles
            if has_title_pattern:
                callout_type = 'title'
            else:
                callout_type = 'detail'

            callouts.append(CircleCallout(
                x=float(cx),
                y=float(cy),
                radius=r,
                bbox={'x1': cx - r, 'y1': cy - r,
                      'x2': cx + r, 'y2': cy + r},
                label='',
                callout_type=callout_type,
                confidence=0.90 if has_dividing_line else 0.75,
                triangle_count=0,
                triangle_positions=[]
            ))
            if callout_type == 'title':
                debug_info['title_callouts'] = debug_info.get('title_callouts', 0) + 1
            else:
                debug_info['detail_callouts'] += 1

    # ===== PHASE 3: OCR validation =====
    validated_callouts = []
    for c in callouts:
        text = extract_text_inside_circle(image, int(c.x), int(c.y), c.radius)

        # Use type-specific validation:
        # - Detail callouts: only numbers (no triangles = no letters allowed)
        # - Elevation/Section: numbers or letters (triangles present)
        if not is_valid_circle_callout_label(text, c.callout_type):
            debug_info['invalid_labels'] += 1
            continue

        parsed = parse_callout_label(text)
        c.label = text.strip().upper() if text else ''
        c.identifier = parsed['identifier']
        c.view_sheet = parsed['view_sheet']
        c.location_sheet = parsed['location_sheet']
        validated_callouts.append(c)

    # Deduplicate
    deduped = []
    for c in validated_callouts:
        is_dup = any(
            np.hypot(c.x - d.x, c.y - d.y) < 50 and c.label == d.label
            for d in deduped
        )
        if not is_dup:
            deduped.append(c)

    # Update final counts
    debug_info['detail_callouts'] = sum(1 for c in deduped if c.callout_type == 'detail')
    debug_info['elevation_callouts'] = sum(1 for c in deduped if c.callout_type == 'elevation')
    debug_info['section_callouts'] = sum(1 for c in deduped if c.callout_type == 'section')
    debug_info['title_callouts'] = sum(1 for c in deduped if c.callout_type == 'title')

    return deduped, debug_info


def get_text_search_regions(tri_x, tri_y, tri_w, tri_h, img_w, img_h) -> List[dict]:
    """Generate regions around triangle to search for text label."""
    pad = 10
    regions = []

    # Above triangle (most common for section callouts)
    text_h = max(40, tri_h)
    regions.append({
        'name': 'above',
        'x1': max(0, tri_x - pad),
        'y1': max(0, tri_y - text_h - pad),
        'x2': min(img_w, tri_x + tri_w + pad),
        'y2': tri_y
    })

    # Below triangle
    regions.append({
        'name': 'below',
        'x1': max(0, tri_x - pad),
        'y1': tri_y + tri_h,
        'x2': min(img_w, tri_x + tri_w + pad),
        'y2': min(img_h, tri_y + tri_h + text_h + pad)
    })

    # Left of triangle
    text_w = max(60, tri_w)
    regions.append({
        'name': 'left',
        'x1': max(0, tri_x - text_w - pad),
        'y1': max(0, tri_y - pad),
        'x2': tri_x,
        'y2': min(img_h, tri_y + tri_h + pad)
    })

    # Right of triangle
    regions.append({
        'name': 'right',
        'x1': tri_x + tri_w,
        'y1': max(0, tri_y - pad),
        'x2': min(img_w, tri_x + tri_w + text_w + pad),
        'y2': min(img_h, tri_y + tri_h + pad)
    })

    return regions


def extract_text_from_region(image: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> Optional[str]:
    """Extract text from a region using OCR."""
    if x2 <= x1 or y2 <= y1:
        return None

    crop = image[y1:y2, x1:x2]
    if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
        return None

    try:
        ocr = get_ocr()
        result = ocr.ocr(crop, cls=True)
        if result and result[0]:
            texts = [line[1][0] for line in result[0] if line[1][1] > 0.5]
            return ' '.join(texts).strip() if texts else None
    except:
        return None
    return None


def is_valid_section_callout_label(text: Optional[str]) -> bool:
    """
    Validate section callout labels.
    Valid: "3/A5", "1/A6", "2/B3", "A/1"
    Also valid: Simple identifiers like "1", "2", "A1"
    """
    if not text:
        return False
    text = text.strip().upper()

    if len(text) > 12:
        return False

    # Sheet reference pattern: "3/A5", "1/A6", "2/B3"
    if re.match(r'^[A-Z0-9]{1,2}\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    # Simple numbers: "1", "2", "3", "10", "12"
    if re.match(r'^[0-9]{1,2}$', text):
        return True

    # Letter + number: "A1", "B2"
    if re.match(r'^[A-Z][0-9]$', text):
        return True

    return False


def detect_section_callouts(image: np.ndarray, dpi: int = 300) -> Tuple[List[Callout], dict]:
    """
    Detect section callouts using triangle-first strategy.
    """
    scale = dpi / 300.0
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    debug_info = {
        'triangles_found': 0,
        'valid_labels': 0
    }

    # Find filled triangles
    min_area = int(300 * scale**2)
    max_area = int(8000 * scale**2)
    triangles = find_filled_triangles(gray, min_area, max_area)
    debug_info['triangles_found'] = len(triangles)

    callouts = []

    for tri_x, tri_y, tri_w, tri_h, tri_cnt in triangles:
        # Search for text near the triangle
        regions = get_text_search_regions(tri_x, tri_y, tri_w, tri_h, w, h)

        best_label = None
        best_region = None

        for region in regions:
            text = extract_text_from_region(image, region['x1'], region['y1'],
                                             region['x2'], region['y2'])
            if is_valid_section_callout_label(text):
                best_label = text.strip().upper()
                best_region = region
                break  # Found valid label

        if best_label:
            debug_info['valid_labels'] += 1

            # Center of callout is triangle center
            cx = tri_x + tri_w / 2
            cy = tri_y + tri_h / 2

            # Bounding box includes triangle and text region
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
                callout_type='section',
                confidence=0.95,
                triangle_pos=(tri_x, tri_y, tri_w, tri_h)
            ))

    # Deduplicate callouts that are very close together
    deduped = []
    for c in callouts:
        is_dup = any(
            np.hypot(c.x - d.x, c.y - d.y) < 50 and c.label == d.label
            for d in deduped
        )
        if not is_dup:
            deduped.append(c)

    return deduped, debug_info


def process_pdf(pdf_path: str, output_dir: str, dpi: int = 300, debug: bool = False):
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    num_pages = len(doc)
    doc.close()

    print(f"\nCallout Processor v3 - Multi-Type Callout Detection")
    print(f"PDF: {pdf_path.name}")
    print(f"Pages: {num_pages}, DPI: {dpi}")
    print("=" * 60)

    all_results = []

    for page_num in range(num_pages):
        sheet_dir = output_dir / f"sheet-{page_num}"
        sheet_dir.mkdir(exist_ok=True)

        print(f"\nSheet {page_num}:")

        image = render_pdf_page(str(pdf_path), page_num, dpi)
        h, w = image.shape[:2]
        print(f"  Rendered: {w}x{h}")

        cv2.imwrite(str(sheet_dir / "source.png"), image)

        # Detect triangle-based section cut markers
        triangle_callouts, triangle_debug = detect_section_callouts(image, dpi)
        print(f"  Triangle detection:")
        print(f"    Triangles found: {triangle_debug['triangles_found']}")
        print(f"    Section cuts: {len(triangle_callouts)}")

        # Detect circle-based callouts (detail, elevation, section)
        circle_callouts, circle_debug = detect_circle_callouts(image, dpi)
        print(f"  Circle detection:")
        print(f"    Circles found: {circle_debug['circles_found']}")
        print(f"    Details: {circle_debug['detail_callouts']}")
        print(f"    Elevations: {circle_debug['elevation_callouts']}")
        print(f"    Sections: {circle_debug['section_callouts']}")
        print(f"    Titles: {circle_debug.get('title_callouts', 0)}")

        # Create annotated image
        annotated = image.copy()

        # Colors for different callout types
        colors = {
            'section_cut': (0, 0, 255),   # Red - triangle-based section cuts
            'detail': (255, 0, 0),         # Blue - detail callouts
            'elevation': (0, 165, 255),    # Orange - elevation callouts
            'section': (128, 0, 128),      # Purple - circle-based sections
            'title': (0, 128, 0),          # Green - title callouts
        }

        # Draw triangle-based callouts
        for c in triangle_callouts:
            color = colors['section_cut']

            cv2.rectangle(annotated,
                         (c.bbox['x1'], c.bbox['y1']),
                         (c.bbox['x2'], c.bbox['y2']),
                         color, 2)

            tx, ty, tw, th = c.triangle_pos
            cv2.rectangle(annotated, (tx, ty), (tx+tw, ty+th), (0, 255, 0), 2)

            label = f"CUT:{c.label}"
            cv2.putText(annotated, label, (c.bbox['x1'], c.bbox['y1'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Draw circle-based callouts
        for c in circle_callouts:
            color = colors.get(c.callout_type, (0, 0, 255))

            # Draw circle
            cv2.circle(annotated, (int(c.x), int(c.y)), c.radius, color, 2)

            # Draw bounding box
            cv2.rectangle(annotated,
                         (c.bbox['x1'], c.bbox['y1']),
                         (c.bbox['x2'], c.bbox['y2']),
                         color, 1)

            # Type prefix and label
            type_prefix = c.callout_type[0].upper()  # D, E, or S
            label = f"{type_prefix}:{c.label}"
            cv2.putText(annotated, label, (c.bbox['x1'], c.bbox['y1'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        cv2.imwrite(str(sheet_dir / "annotated.png"), annotated)

        # Save markers (combine both detection types)
        markers = []
        marker_idx = 0

        # Add triangle-based section cuts
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
                'confidence': c.confidence
            })
            marker_idx += 1

        # Add circle-based callouts
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
                'radius': int(c.radius),
                'triangleCount': int(c.triangle_count),
                'trianglePositions': c.triangle_positions
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

        # Combine debug info
        combined_debug = {
            'triangle': triangle_debug,
            'circle': circle_debug
        }

        all_results.append({
            'sheet': page_num,
            'width': w,
            'height': h,
            'section_cuts': len(triangle_callouts),
            'detail_callouts': circle_debug['detail_callouts'],
            'elevation_callouts': circle_debug['elevation_callouts'],
            'section_callouts': circle_debug['section_callouts'],
            'title_callouts': circle_debug.get('title_callouts', 0),
            'total_callouts': len(triangle_callouts) + len(circle_callouts),
            'debug': combined_debug
        })

        # Print detected callouts
        if triangle_callouts:
            print(f"  Section cuts:")
            for c in triangle_callouts:
                print(f"    - {c.label} @ ({int(c.x)}, {int(c.y)})")
        if circle_callouts:
            print(f"  Circle callouts:")
            for c in circle_callouts:
                print(f"    - [{c.callout_type}] {c.label} @ ({int(c.x)}, {int(c.y)})")

    with open(output_dir / "summary.json", 'w') as f:
        json.dump(all_results, f, indent=2)

    # Print summary
    print("\n" + "=" * 60)
    total_section_cuts = sum(r['section_cuts'] for r in all_results)
    total_details = sum(r['detail_callouts'] for r in all_results)
    total_elevations = sum(r['elevation_callouts'] for r in all_results)
    total_sections = sum(r['section_callouts'] for r in all_results)
    total_titles = sum(r.get('title_callouts', 0) for r in all_results)
    print(f"Summary:")
    print(f"  Section cuts (triangle): {total_section_cuts}")
    print(f"  Detail callouts (circle): {total_details}")
    print(f"  Elevation callouts (circle): {total_elevations}")
    print(f"  Section callouts (circle): {total_sections}")
    print(f"  Title callouts (circle): {total_titles}")
    print("Done!")


def main():
    parser = argparse.ArgumentParser(description='Callout Processor v3 - Multi-Type Callout Detection')
    parser.add_argument('--pdf', required=True, help='Input PDF file')
    parser.add_argument('--output', required=True, help='Output directory')
    parser.add_argument('--dpi', type=int, default=300, help='Render DPI')
    parser.add_argument('--debug', action='store_true', help='Save debug images')

    args = parser.parse_args()
    process_pdf(args.pdf, args.output, args.dpi, args.debug)


if __name__ == '__main__':
    main()
