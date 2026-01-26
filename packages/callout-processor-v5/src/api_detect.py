#!/usr/bin/env python3
"""
API script for callout detection using v5 model.
Designed to be called from sitelink-interpreter TypeScript code.

Usage:
    python api_detect.py --pdf <path> --page <num> --output <dir> [options]
    python api_detect.py --image <path> --output <dir> [options]

Output:
    Writes detections.json with format:
    {
      "detections": [
        {
          "bbox": [x, y, w, h],
          "class": "detail|elevation|title",
          "confidence": 0.87
        },
        ...
      ]
    }
"""

import argparse
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
import fitz  # PyMuPDF
from ultralytics import YOLO

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))
from sahi_tiling import tile_image, merge_detections
from postprocess_filters import apply_all_filters

# Global OCR instance (lazy loaded)
_ocr = None


def get_ocr():
    """Lazy load PaddleOCR."""
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    return _ocr

# Model path
MODEL_PATH = Path(__file__).parent.parent.parent / "callout-processor-v6-experimental/weights/best.pt"

# Critical parameters - DO NOT CHANGE without retraining
DPI = 72
TILE_SIZE = 2048
OVERLAP = 0.2
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.5

CLASS_NAMES = ["detail", "elevation", "title"]  # v6 iteration 5: 3 classes (no section)

# Smart text detection parameters (at 72 DPI)
TEXT_SEARCH_RADIUS = 200  # pixels to search around symbol
TEXT_MIN_WIDTH = 30      # minimum text region width (reduced for small labels)
TEXT_MAX_WIDTH = 400     # maximum text region width
TEXT_MIN_HEIGHT = 10     # minimum text region height (reduced for small text)
TEXT_MAX_HEIGHT = 100    # maximum text region height (increased for larger labels)
TEXT_MIN_ASPECT = 1.0    # minimum aspect ratio (width/height) - allow squarer text
TEXT_MAX_ASPECT = 15.0   # maximum aspect ratio (allow very wide labels)

# Leader line detection parameters
LEADER_MIN_RADIUS = 30   # minimum distance from symbol center to search for lines
LEADER_MAX_RADIUS = 350  # maximum distance to search for lines
LEADER_MIN_LENGTH = 20   # minimum line length in pixels
LEADER_LINE_KERNEL_W = 25  # width of horizontal morphological kernel
LEADER_TEXT_ROI_W = 150  # width of text ROI at line endpoint
LEADER_TEXT_ROI_H = 50   # height of text ROI at line endpoint

# Callout circle detection parameters
CIRCLE_MIN_RADIUS = 20   # minimum circle radius in pixels (at 72 DPI)
CIRCLE_MAX_RADIUS = 80   # maximum circle radius in pixels
CIRCLE_SEARCH_EXPAND = 50  # pixels to expand search area beyond bbox


def find_and_ocr_callout_circle(
    image: np.ndarray,
    symbol_x: int,
    symbol_y: int,
    symbol_w: int,
    symbol_h: int,
    debug_dir: Path | None = None,
    detection_idx: int = 0
) -> tuple[str | None, float, str | None, str | None]:
    """
    Find callout circle near detected symbol and OCR text inside it.

    Construction plan callouts are circular bubbles containing:
    - Top line: Detail identifier (e.g., "A2", "C2", "A5, C5")
    - Horizontal dividing line
    - Bottom line: Sheet reference (e.g., "A-546", "A-543")

    Args:
        image: Full image (BGR format)
        symbol_x, symbol_y: Top-left corner of symbol bounding box
        symbol_w, symbol_h: Width and height of symbol bounding box
        debug_dir: Optional directory to save debug images
        detection_idx: Index for debug file naming

    Returns:
        (ocr_text, ocr_confidence, identifier, target_sheet) or (None, 0.0, None, None)
    """
    img_h, img_w = image.shape[:2]

    # Expand search area around the detected bbox
    expand = CIRCLE_SEARCH_EXPAND
    roi_x1 = max(0, symbol_x - expand)
    roi_y1 = max(0, symbol_y - expand)
    roi_x2 = min(img_w, symbol_x + symbol_w + expand)
    roi_y2 = min(img_h, symbol_y + symbol_h + expand)

    roi = image[roi_y1:roi_y2, roi_x1:roi_x2]

    if roi.size == 0:
        return None, 0.0, None, None

    # Convert to grayscale for circle detection
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi.copy()

    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Detect circles using Hough transform
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=30,
        param1=50,
        param2=30,
        minRadius=CIRCLE_MIN_RADIUS,
        maxRadius=CIRCLE_MAX_RADIUS
    )

    if circles is None:
        return None, 0.0, None, None

    circles = np.uint16(np.around(circles))

    # Symbol center relative to ROI
    sym_cx_rel = (symbol_x + symbol_w // 2) - roi_x1
    sym_cy_rel = (symbol_y + symbol_h // 2) - roi_y1

    # Find the circle closest to the symbol center
    best_circle = None
    best_dist = float('inf')

    for circle in circles[0, :]:
        cx, cy, r = circle
        dist = ((cx - sym_cx_rel) ** 2 + (cy - sym_cy_rel) ** 2) ** 0.5

        # Circle center should be close to symbol center (within the circle radius)
        if dist < best_dist and dist < r + 20:
            best_dist = dist
            best_circle = (int(cx), int(cy), int(r))

    if best_circle is None:
        return None, 0.0, None, None

    cx, cy, r = best_circle

    # Extract the circular region for OCR
    # Add small padding inside the circle to avoid the border
    inner_padding = 3
    crop_x1 = max(0, cx - r + inner_padding)
    crop_y1 = max(0, cy - r + inner_padding)
    crop_x2 = min(roi.shape[1], cx + r - inner_padding)
    crop_y2 = min(roi.shape[0], cy + r - inner_padding)

    circle_crop = roi[crop_y1:crop_y2, crop_x1:crop_x2]

    if circle_crop.size == 0:
        return None, 0.0, None, None

    # Save debug image if requested
    if debug_dir:
        debug_img = roi.copy()
        # Draw detected circle (green)
        cv2.circle(debug_img, (cx, cy), r, (0, 255, 0), 2)
        # Draw center point (red)
        cv2.circle(debug_img, (cx, cy), 3, (0, 0, 255), -1)
        # Draw original bbox (blue)
        sym_x_rel = symbol_x - roi_x1
        sym_y_rel = symbol_y - roi_y1
        cv2.rectangle(debug_img, (sym_x_rel, sym_y_rel),
                     (sym_x_rel + symbol_w, sym_y_rel + symbol_h), (255, 0, 0), 1)
        # Draw crop region (yellow)
        cv2.rectangle(debug_img, (crop_x1, crop_y1), (crop_x2, crop_y2), (0, 255, 255), 1)

        debug_path = debug_dir / f"circle_detect_{detection_idx}.png"
        cv2.imwrite(str(debug_path), debug_img)

    # Preprocess for OCR
    if len(circle_crop.shape) == 3:
        circle_gray = cv2.cvtColor(circle_crop, cv2.COLOR_BGR2GRAY)
    else:
        circle_gray = circle_crop.copy()

    # Create circular mask to exclude text outside the circle
    crop_h, crop_w = circle_gray.shape[:2]
    mask = np.zeros((crop_h, crop_w), dtype=np.uint8)
    mask_cx = crop_w // 2
    mask_cy = crop_h // 2
    mask_r = min(mask_cx, mask_cy) - 2  # Slightly smaller than crop
    cv2.circle(mask, (mask_cx, mask_cy), mask_r, 255, -1)

    # Apply mask - set pixels outside circle to white (background)
    circle_gray_masked = circle_gray.copy()
    circle_gray_masked[mask == 0] = 255

    # Apply adaptive threshold
    circle_binary = cv2.adaptiveThreshold(
        circle_gray_masked, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    # Upscale for better OCR (circles are usually small)
    min_size = 150
    crop_h, crop_w = circle_binary.shape[:2]
    if crop_h < min_size or crop_w < min_size:
        scale_factor = max(min_size / crop_h, min_size / crop_w, 2.5)
        circle_binary = cv2.resize(circle_binary, None, fx=scale_factor, fy=scale_factor,
                                   interpolation=cv2.INTER_CUBIC)

    # Run OCR
    try:
        ocr = get_ocr()
        # Use det=True to detect text boxes within the circle
        result = ocr.ocr(circle_binary, det=True, cls=True)

        if result and result[0]:
            # Collect all text lines with their positions
            text_lines = []
            for line in result[0]:
                bbox = line[0]
                text = line[1][0]
                conf = line[1][1]
                # Get vertical position (y center of text box)
                y_center = (bbox[0][1] + bbox[2][1]) / 2
                text_lines.append((y_center, text, conf))

            if text_lines:
                # Sort by vertical position (top to bottom)
                text_lines.sort(key=lambda x: x[0])

                # Combine texts (top line is identifier, bottom is sheet reference)
                texts = [t[1] for t in text_lines]
                confs = [t[2] for t in text_lines]

                combined_text = ' / '.join(texts).strip()
                avg_conf = sum(confs) / len(confs) if confs else 0.0

                # Common OCR error corrections
                def fix_ocr_errors(text: str) -> str:
                    text = text.replace('$', 'S')  # $ often misread for S
                    text = text.replace('§', 'S')  # § often misread for S
                    text = re.sub(r'^0([A-Z])', r'O\1', text)  # Leading 0 before letter -> O
                    return text

                # Apply OCR corrections to all texts for display
                corrected_texts = [fix_ocr_errors(t.strip().upper()) for t in texts]
                combined_text = ' / '.join(corrected_texts).strip()

                # Parse the callout format
                identifier = None
                target_sheet = None

                # Sheet reference pattern: typically S + number (S2.0, S20) or letter-number (A-546)
                # More specific to avoid matching detail numbers like T8, A2
                sheet_ref_pattern = re.compile(
                    r'^S\d+\.?\d*$|'    # S2.0, S20, S1.0 (most common)
                    r'^[A-Z]-\d+$|'     # A-546, B-123
                    r'^[A-Z]\d{2,}$'    # Must have 2+ digits if just letter+number (A12, not A2)
                )

                # Detail number pattern: typically short (1-3 chars), number or letter+single digit
                # Examples: 1, 10, 18, A, B, A2, T8, etc.
                detail_num_pattern = re.compile(r'^\d{1,2}$|^[A-Z]$|^[A-Z]\d$')

                # Filter out noise - text that's clearly not callout content
                def is_valid_callout_text(t):
                    clean = t.replace(' ', '')
                    if len(clean) > 10:  # Too long to be callout text
                        return False
                    if len(clean) < 1:
                        return False
                    # Filter common noise patterns
                    noise_patterns = ['SDF', 'SDR', 'USOF', 'FROS', 'EXTE', 'ENTOF']
                    if clean in noise_patterns:
                        return False
                    return True

                # Filter texts to only valid callout content
                valid_texts = [t for t in corrected_texts if is_valid_callout_text(t)]

                if len(valid_texts) >= 2:
                    first_text = valid_texts[0].replace(' ', '')

                    # Check if first text looks like a sheet reference (S2.0, S20)
                    # If so, the order might be reversed or it's capturing wrong text
                    if sheet_ref_pattern.match(first_text):
                        # First text is sheet ref - look for detail number in other texts
                        target_sheet = first_text
                        for t in valid_texts[1:]:
                            clean_t = t.replace(' ', '')
                            if detail_num_pattern.match(clean_t):
                                identifier = clean_t
                                break
                        # If no detail number found, check if second text is numeric
                        if identifier is None and len(valid_texts) >= 2:
                            second = valid_texts[1].replace(' ', '')
                            if second.isdigit() or (len(second) <= 3 and any(c.isdigit() for c in second)):
                                identifier = second
                    else:
                        # Normal case: first text is identifier
                        identifier = first_text

                        # Find sheet reference in remaining texts
                        for t in valid_texts[1:]:
                            clean_t = t.replace(' ', '')
                            if sheet_ref_pattern.match(clean_t):
                                target_sheet = clean_t
                                break

                        # Fallback: use second text if it looks like a sheet ref
                        if target_sheet is None and len(valid_texts) >= 2:
                            second_text = valid_texts[1].replace(' ', '')
                            if len(second_text) >= 2 and any(c.isdigit() for c in second_text):
                                target_sheet = second_text

                elif len(valid_texts) == 1:
                    text = valid_texts[0].replace(' ', '')
                    # Check if it looks like a sheet reference
                    if sheet_ref_pattern.match(text):
                        target_sheet = text
                    else:
                        identifier = text

                return combined_text, avg_conf, identifier, target_sheet

    except Exception as e:
        print(f"Circle OCR error: {e}", file=sys.stderr)

    return None, 0.0, None, None


def find_leader_line_and_text(
    image: np.ndarray,
    symbol_x: int,
    symbol_y: int,
    symbol_w: int,
    symbol_h: int,
    debug_dir: Path | None = None,
    detection_idx: int = 0
) -> tuple[int, int, int, int] | None:
    """
    Find text by following the leader line from a callout symbol.

    Leader lines are thin horizontal lines connecting callout symbols to their
    text labels. This function detects these lines using morphological operations
    and returns an ROI at the line's endpoint where text is likely located.

    Args:
        image: Full image (BGR format)
        symbol_x, symbol_y: Top-left corner of symbol bounding box
        symbol_w, symbol_h: Width and height of symbol bounding box
        debug_dir: Optional directory to save debug images
        detection_idx: Index for debug file naming

    Returns:
        (x, y, w, h) tuple for the text ROI, or None if no leader line found
    """
    img_h, img_w = image.shape[:2]

    symbol_cx = symbol_x + symbol_w // 2
    symbol_cy = symbol_y + symbol_h // 2

    # Define search annulus (ring) around symbol
    roi_x1 = max(0, symbol_cx - LEADER_MAX_RADIUS)
    roi_y1 = max(0, symbol_cy - LEADER_MAX_RADIUS)
    roi_x2 = min(img_w, symbol_cx + LEADER_MAX_RADIUS)
    roi_y2 = min(img_h, symbol_cy + LEADER_MAX_RADIUS)

    roi = image[roi_y1:roi_y2, roi_x1:roi_x2]

    if roi.size == 0:
        return None

    # Convert to grayscale
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi.copy()

    # Use adaptive threshold to handle both light-on-dark and dark-on-light
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5
    )

    # Create horizontal kernel to detect horizontal lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (LEADER_LINE_KERNEL_W, 1))

    # Apply morphological closing to connect broken line segments
    horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, horizontal_kernel, iterations=2)

    # Apply opening to remove noise while keeping lines
    horizontal_lines = cv2.morphologyEx(horizontal_lines, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)

    # Find contours of horizontal line candidates
    contours, _ = cv2.findContours(horizontal_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Relative position of symbol center in ROI
    sym_rel_cx = symbol_cx - roi_x1
    sym_rel_cy = symbol_cy - roi_y1

    # Filter and score line candidates
    line_candidates = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        # Lines should be much wider than tall
        if w < LEADER_MIN_LENGTH:
            continue
        if h > 10:  # Lines should be thin
            continue
        aspect = w / h if h > 0 else 0
        if aspect < 3:  # Strong horizontal bias
            continue

        # Get the line center
        line_cx = x + w // 2
        line_cy = y + h // 2

        # Calculate distance from symbol center to line center
        dist_to_symbol = ((line_cx - sym_rel_cx) ** 2 + (line_cy - sym_rel_cy) ** 2) ** 0.5

        # Line should be in the search annulus (not too close, not too far)
        if dist_to_symbol < LEADER_MIN_RADIUS or dist_to_symbol > LEADER_MAX_RADIUS:
            continue

        # Determine which end of the line is furthest from symbol (that's where text is)
        left_end = (x, line_cy)
        right_end = (x + w, line_cy)

        dist_left = ((left_end[0] - sym_rel_cx) ** 2 + (left_end[1] - sym_rel_cy) ** 2) ** 0.5
        dist_right = ((right_end[0] - sym_rel_cx) ** 2 + (right_end[1] - sym_rel_cy) ** 2) ** 0.5

        if dist_left > dist_right:
            text_end = left_end
            text_direction = "left"
            max_dist = dist_left
        else:
            text_end = right_end
            text_direction = "right"
            max_dist = dist_right

        # Score: prefer lines that extend further from symbol
        score = max_dist

        line_candidates.append({
            'bbox': (x, y, w, h),
            'text_end': text_end,
            'direction': text_direction,
            'score': score,
            'dist': dist_to_symbol
        })

    if not line_candidates:
        return None

    # Sort by score (furthest extending line wins)
    line_candidates.sort(key=lambda c: c['score'], reverse=True)
    best_line = line_candidates[0]

    # Define text ROI at the line endpoint
    text_end_x, text_end_y = best_line['text_end']

    # Position ROI based on direction
    if best_line['direction'] == 'left':
        # Text is to the left of the line end
        text_roi_x = text_end_x - LEADER_TEXT_ROI_W
        text_roi_y = text_end_y - LEADER_TEXT_ROI_H // 2
    else:
        # Text is to the right of the line end
        text_roi_x = text_end_x
        text_roi_y = text_end_y - LEADER_TEXT_ROI_H // 2

    # Convert ROI coordinates to global
    global_roi_x = int(text_roi_x + roi_x1)
    global_roi_y = int(text_roi_y + roi_y1)

    # Clamp to image bounds
    global_roi_x = max(0, global_roi_x)
    global_roi_y = max(0, global_roi_y)
    global_roi_w = min(LEADER_TEXT_ROI_W, img_w - global_roi_x)
    global_roi_h = min(LEADER_TEXT_ROI_H, img_h - global_roi_y)

    # Save debug image if requested
    if debug_dir:
        debug_img = roi.copy()

        # Draw symbol bounding box (red)
        sym_rel_x = symbol_x - roi_x1
        sym_rel_y = symbol_y - roi_y1
        cv2.rectangle(debug_img, (sym_rel_x, sym_rel_y),
                     (sym_rel_x + symbol_w, sym_rel_y + symbol_h), (0, 0, 255), 2)

        # Draw all detected horizontal lines (gray)
        for candidate in line_candidates[1:5]:  # Show top 5
            lx, ly, lw, lh = candidate['bbox']
            cv2.rectangle(debug_img, (lx, ly), (lx + lw, ly + lh), (128, 128, 128), 1)

        # Draw best line (green)
        lx, ly, lw, lh = best_line['bbox']
        cv2.rectangle(debug_img, (lx, ly), (lx + lw, ly + lh), (0, 255, 0), 2)

        # Draw line endpoint (cyan circle)
        cv2.circle(debug_img, (int(text_end_x), int(text_end_y)), 5, (255, 255, 0), -1)

        # Draw text ROI (blue)
        roi_rel_x = int(text_roi_x)
        roi_rel_y = int(text_roi_y)
        cv2.rectangle(debug_img, (roi_rel_x, roi_rel_y),
                     (roi_rel_x + LEADER_TEXT_ROI_W, roi_rel_y + LEADER_TEXT_ROI_H), (255, 0, 0), 2)

        # Add labels
        cv2.putText(debug_img, f"Line: {best_line['direction']}", (10, 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        cv2.putText(debug_img, f"Dist: {best_line['dist']:.0f}px", (10, 40),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        debug_path = debug_dir / f"leader_line_{detection_idx}.png"
        cv2.imwrite(str(debug_path), debug_img)

    return (global_roi_x, global_roi_y, global_roi_w, global_roi_h)


def find_text_regions_near_symbol(
    image: np.ndarray,
    symbol_x: int,
    symbol_y: int,
    symbol_w: int,
    symbol_h: int,
    search_radius: int = TEXT_SEARCH_RADIUS,
    debug_dir: Path | None = None,
    detection_idx: int = 0
) -> list[tuple[int, int, int, int]]:
    """
    Find text regions near a detected callout symbol using OpenCV.

    Text labels for callouts are typically adjacent to the symbol, not inside
    the YOLO bounding box. This function searches a region around the symbol
    for text-like contours.

    Args:
        image: Full image (BGR format)
        symbol_x, symbol_y: Top-left corner of symbol bounding box
        symbol_w, symbol_h: Width and height of symbol bounding box
        search_radius: Pixels to search around symbol center
        debug_dir: Optional directory to save debug images
        detection_idx: Index for debug file naming

    Returns:
        List of (x, y, w, h) tuples for candidate text regions, sorted by
        distance from symbol center (closest first). Returns at most 5 candidates.
    """
    img_h, img_w = image.shape[:2]

    symbol_cx = symbol_x + symbol_w // 2
    symbol_cy = symbol_y + symbol_h // 2

    roi_x1 = max(0, symbol_cx - search_radius)
    roi_y1 = max(0, symbol_cy - search_radius)
    roi_x2 = min(img_w, symbol_cx + search_radius)
    roi_y2 = min(img_h, symbol_cy + search_radius)

    roi = image[roi_y1:roi_y2, roi_x1:roi_x2]

    if roi.size == 0:
        return []

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi.copy()

    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    dilated = cv2.dilate(binary, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        if w < TEXT_MIN_WIDTH or w > TEXT_MAX_WIDTH:
            continue
        if h < TEXT_MIN_HEIGHT or h > TEXT_MAX_HEIGHT:
            continue

        aspect = w / h if h > 0 else 0
        if aspect < TEXT_MIN_ASPECT or aspect > TEXT_MAX_ASPECT:
            continue

        global_x = x + roi_x1
        global_y = y + roi_y1

        sym_rel_x1 = symbol_x - roi_x1
        sym_rel_y1 = symbol_y - roi_y1
        sym_rel_x2 = sym_rel_x1 + symbol_w
        sym_rel_y2 = sym_rel_y1 + symbol_h

        if (x < sym_rel_x2 and x + w > sym_rel_x1 and
            y < sym_rel_y2 and y + h > sym_rel_y1):
            continue

        cx = global_x + w // 2
        cy = global_y + h // 2
        dist = ((cx - symbol_cx) ** 2 + (cy - symbol_cy) ** 2) ** 0.5

        candidates.append((dist, global_x, global_y, w, h))

    candidates.sort(key=lambda c: c[0])

    if debug_dir:
        debug_img = roi.copy()
        cv2.rectangle(
            debug_img,
            (symbol_x - roi_x1, symbol_y - roi_y1),
            (symbol_x - roi_x1 + symbol_w, symbol_y - roi_y1 + symbol_h),
            (0, 0, 255), 2
        )
        for i, (dist, gx, gy, w, h) in enumerate(candidates[:5]):
            color = (0, 255, 0) if i == 0 else (255, 165, 0)
            cv2.rectangle(debug_img, (gx - roi_x1, gy - roi_y1),
                         (gx - roi_x1 + w, gy - roi_y1 + h), color, 2)
            cv2.putText(debug_img, f"{int(dist)}px", (gx - roi_x1, gy - roi_y1 - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        debug_path = debug_dir / f"text_search_{detection_idx}.png"
        cv2.imwrite(str(debug_path), debug_img)

    return [(gx, gy, w, h) for (dist, gx, gy, w, h) in candidates[:5]]


def ocr_text_region(
    image: np.ndarray,
    x: int, y: int, w: int, h: int,
    min_size: int = 200
) -> tuple[str | None, float]:
    """
    Run OCR on a specific text region with preprocessing.

    Args:
        image: Full image (BGR format)
        x, y, w, h: Bounding box of text region
        min_size: Minimum dimension to upscale to

    Returns:
        (ocr_text, confidence) or (None, 0.0) if OCR fails
    """
    if w < 5 or h < 5:
        return None, 0.0

    img_h, img_w = image.shape[:2]
    x1 = max(0, x - 5)
    y1 = max(0, y - 5)
    x2 = min(img_w, x + w + 5)
    y2 = min(img_h, y + h + 5)

    crop = image[y1:y2, x1:x2]

    if len(crop.shape) == 3:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    crop = cv2.adaptiveThreshold(
        crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    crop_h, crop_w = crop.shape[:2]
    if crop_h < min_size or crop_w < min_size:
        scale_factor = max(min_size / crop_h, min_size / crop_w, 3.0)
        crop = cv2.resize(crop, None, fx=scale_factor, fy=scale_factor,
                         interpolation=cv2.INTER_CUBIC)

    try:
        ocr = get_ocr()
        result = ocr.ocr(crop, det=False, cls=True)

        if result and result[0]:
            texts = []
            confidences = []
            for line in result[0]:
                text = line[0]
                conf = line[1]
                texts.append(text)
                confidences.append(conf)

            if texts:
                combined_text = ' '.join(texts).strip()
                avg_conf = sum(confidences) / len(confidences)
                return combined_text, avg_conf
    except Exception as e:
        print(f"OCR error: {e}", file=sys.stderr)

    return None, 0.0


def smart_ocr_for_detection(
    image: np.ndarray,
    x: int, y: int, w: int, h: int,
    class_name: str,
    search_radius: int = TEXT_SEARCH_RADIUS,
    debug_dir: Path | None = None,
    detection_idx: int = 0
) -> tuple[str | None, float, str | None, str | None]:
    """
    Smart OCR that searches for text regions near a symbol.

    Uses a four-stage approach:
    1. Circle detection: Find callout circles and OCR text inside (highest priority)
    2. Leader line detection: Find horizontal lines connecting to symbol, follow to text
    3. Contour-based search: Find text-like regions near symbol
    4. Fallback: Expanded bounding box method

    Args:
        image: Full image (BGR format)
        x, y, w, h: Symbol bounding box
        class_name: Detection class (detail, elevation, title)
        search_radius: Pixels to search around symbol
        debug_dir: Optional directory for debug output
        detection_idx: Index for debug file naming

    Returns:
        (ocr_text, ocr_confidence, identifier, target_sheet)
    """
    best_result = (None, 0.0, None, None)

    # Stage 1: Try circle detection first (for detail/elevation callout bubbles only)
    # Skip circle detection for "title" class which are rectangular text blocks
    if class_name in ('detail', 'elevation'):
        circle_debug_dir = debug_dir / "circles" if debug_dir else None
        if circle_debug_dir:
            circle_debug_dir.mkdir(exist_ok=True)

        circle_result = find_and_ocr_callout_circle(
            image, x, y, w, h, circle_debug_dir, detection_idx
        )

        if circle_result[0] is not None and circle_result[1] > 0.3:
            ocr_text, ocr_conf, identifier, target_sheet = circle_result
            if identifier or target_sheet:
                return circle_result
            # Keep as best result if confidence is good
            if ocr_conf > best_result[1]:
                best_result = circle_result

    # Stage 2: Try leader line detection
    leader_debug_dir = debug_dir / "leader_lines" if debug_dir else None
    if leader_debug_dir:
        leader_debug_dir.mkdir(exist_ok=True)

    leader_roi = find_leader_line_and_text(
        image, x, y, w, h, leader_debug_dir, detection_idx
    )

    if leader_roi:
        roi_x, roi_y, roi_w, roi_h = leader_roi
        ocr_text, ocr_conf = ocr_text_region(image, roi_x, roi_y, roi_w, roi_h)

        if ocr_text and ocr_conf > 0.2:  # Lower threshold for leader line (more confident region)
            identifier, target_sheet = parse_callout_text(ocr_text, class_name)

            if identifier or target_sheet:
                return (ocr_text, ocr_conf, identifier, target_sheet)
            # Even if parsing fails, keep as best result if confidence is good
            if ocr_conf > best_result[1]:
                best_result = (ocr_text, ocr_conf, identifier, target_sheet)

    # Stage 3: Try contour-based text region search
    text_regions = find_text_regions_near_symbol(
        image, x, y, w, h, search_radius, debug_dir, detection_idx
    )

    for region_x, region_y, region_w, region_h in text_regions:
        ocr_text, ocr_conf = ocr_text_region(image, region_x, region_y, region_w, region_h)

        if ocr_text and ocr_conf > 0.3:
            identifier, target_sheet = parse_callout_text(ocr_text, class_name)

            if identifier or target_sheet:
                if ocr_conf > best_result[1]:
                    best_result = (ocr_text, ocr_conf, identifier, target_sheet)

    # Return if we found a good result from stages 1 or 2
    if best_result[0] is not None and (best_result[2] or best_result[3]):
        return best_result

    # Stage 3: Fallback to expanded bounding box method
    ocr_text, ocr_conf = ocr_crop_fallback(image, x, y, w, h)
    identifier, target_sheet = parse_callout_text(ocr_text, class_name)

    # Return fallback only if it's better than what we have
    if ocr_conf > best_result[1] or best_result[0] is None:
        return ocr_text, ocr_conf, identifier, target_sheet

    return best_result


def ocr_crop_fallback(
    image: np.ndarray,
    x: int, y: int, w: int, h: int,
    min_size: int = 200,
    padding_factor: float = 1.5
) -> tuple[str | None, float]:
    """
    Fallback OCR using expanded bounding box (original method).

    Args:
        image: Full image
        x, y, w, h: Symbol bounding box
        min_size: Minimum dimension to upscale to
        padding_factor: Expand crop by this fraction

    Returns:
        (ocr_text, confidence) or (None, 0.0) if OCR fails
    """
    if w < 5 or h < 5:
        return None, 0.0

    img_h, img_w = image.shape[:2]
    pad_w = int(w * padding_factor)
    pad_h = int(h * padding_factor)

    x1 = max(0, x - pad_w)
    y1 = max(0, y - pad_h)
    x2 = min(img_w, x + w + pad_w)
    y2 = min(img_h, y + h + pad_h)

    crop = image[y1:y2, x1:x2]

    if len(crop.shape) == 3:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    crop = cv2.adaptiveThreshold(
        crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    crop_h, crop_w = crop.shape[:2]
    if crop_h < min_size or crop_w < min_size:
        scale_factor = max(min_size / crop_h, min_size / crop_w, 3.0)
        crop = cv2.resize(crop, None, fx=scale_factor, fy=scale_factor,
                         interpolation=cv2.INTER_CUBIC)

    try:
        ocr = get_ocr()
        result = ocr.ocr(crop, det=False, cls=True)

        if result and result[0]:
            texts = []
            confidences = []
            for line in result[0]:
                text = line[0]
                conf = line[1]
                texts.append(text)
                confidences.append(conf)

            if texts:
                combined_text = ' '.join(texts).strip()
                avg_conf = sum(confidences) / len(confidences)
                return combined_text, avg_conf
    except Exception as e:
        print(f"OCR error: {e}", file=sys.stderr)

    return None, 0.0


def ocr_crop(image: cv2.Mat, x: int, y: int, w: int, h: int, min_size: int = 200, padding_factor: float = 1.5, return_debug: bool = False) -> tuple[str | None, float, np.ndarray | None]:
    """
    Run OCR on a cropped region with padding and preprocessing.

    Args:
        padding_factor: Expand crop by this fraction (1.5 = 150% larger)
        min_size: Minimum dimension to upscale to
        return_debug: If True, return the preprocessed crop for debugging

    Returns:
        (ocr_text, confidence, debug_crop) or (None, 0.0, None) if OCR fails
    """
    if w < 5 or h < 5:
        return (None, 0.0, None) if return_debug else (None, 0.0)

    # Expand bounding box to include text outside the symbol
    img_h, img_w = image.shape[:2]
    pad_w = int(w * padding_factor)
    pad_h = int(h * padding_factor)

    x1 = max(0, x - pad_w)
    y1 = max(0, y - pad_h)
    x2 = min(img_w, x + w + pad_w)
    y2 = min(img_h, y + h + pad_h)

    # Crop the expanded region
    crop = image[y1:y2, x1:x2]
    debug_crop = crop.copy() if return_debug else None

    # Preprocess for better OCR
    # Convert to grayscale
    if len(crop.shape) == 3:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Apply adaptive thresholding for better contrast
    crop = cv2.adaptiveThreshold(
        crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    # Upscale small regions for better OCR
    crop_h, crop_w = crop.shape[:2]
    if crop_h < min_size or crop_w < min_size:
        scale_factor = max(min_size / crop_h, min_size / crop_w, 3.0)
        crop = cv2.resize(crop, None, fx=scale_factor, fy=scale_factor, interpolation=cv2.INTER_CUBIC)
        if return_debug and debug_crop is not None:
            debug_crop = cv2.resize(debug_crop, None, fx=scale_factor, fy=scale_factor, interpolation=cv2.INTER_CUBIC)

    try:
        ocr = get_ocr()
        result = ocr.ocr(crop, det=False, cls=True)

        if result and result[0]:
            texts = []
            confidences = []
            for line in result[0]:
                text = line[0]
                conf = line[1]
                texts.append(text)
                confidences.append(conf)

            if texts:
                combined_text = ' '.join(texts).strip()
                avg_conf = sum(confidences) / len(confidences)
                if return_debug:
                    return combined_text, avg_conf, debug_crop
                return combined_text, avg_conf
    except Exception as e:
        print(f"OCR error: {e}", file=sys.stderr)

    if return_debug:
        return None, 0.0, debug_crop
    return None, 0.0


def parse_callout_text(ocr_text: str | None, class_name: str) -> tuple[str | None, str | None]:
    """
    Parse OCR text to extract identifier and target_sheet.

    For detail callouts: identifier = detail number (e.g., "A6", "3", "11/S2.0")
    For elevation callouts: target_sheet = sheet reference (e.g., "A6", "S2.0")

    Returns:
        (identifier, target_sheet)
    """
    if not ocr_text:
        return None, None

    # Clean up OCR text - remove excessive whitespace but keep slashes
    text = ' '.join(ocr_text.split()).strip().upper()

    # Pattern 1: Complex format with slash (e.g., "17/S2.0", "11/A6", "A6/B2", "3/S1.0")
    match = re.search(r'([A-Z]?\d+)\s*[/\\]\s*([A-Z]?\d+\.?\d*)', text)
    if match:
        identifier = f"{match.group(1)}/{match.group(2)}"
        if class_name == 'detail':
            return identifier, match.group(2)  # Also set target_sheet for slash format
        elif class_name == 'elevation':
            return None, match.group(2)

    # Pattern 2: Letter-Number format (e.g., "A6", "B2", "S2", "AP", "Q")
    match = re.search(r'([A-Z]{1,2})[\s\-]?(\d+\.?\d*)', text)
    if match:
        identifier = f"{match.group(1)}{match.group(2)}"
        if class_name == 'detail':
            return identifier, None
        elif class_name == 'elevation':
            return None, identifier

    # Pattern 3: Just letters (e.g., "AP", "Q", "A")
    match = re.search(r'^([A-Z]{1,3})$', text)
    if match:
        identifier = match.group(1)
        if class_name == 'detail':
            return identifier, None
        elif class_name == 'elevation':
            return None, identifier

    # Pattern 4: Just a number (e.g., "3", "12", "2.0")
    match = re.search(r'(\d+\.?\d*)', text)
    if match:
        identifier = match.group(1)
        if class_name == 'detail':
            return identifier, None
        elif class_name == 'elevation':
            return None, identifier

    return None, None


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = DPI) -> cv2.Mat:
    """Render PDF page to image at specified DPI."""
    doc = fitz.open(pdf_path)

    if page_num < 1 or page_num > len(doc):
        raise ValueError(f"Page {page_num} out of range (1-{len(doc)})")

    page = doc[page_num - 1]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    # Convert PyMuPDF pixmap (RGB) to OpenCV format (BGR)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    # If RGBA, drop alpha channel
    if pix.n == 4:
        img = img[:, :, :3]

    # Convert RGB to BGR for OpenCV
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    doc.close()
    return img


def detect_callouts(
    image: cv2.Mat,
    model: YOLO,
    conf: float = CONF_THRESHOLD,
    iou: float = IOU_THRESHOLD,
    use_filters: bool = True,
    enable_ocr: bool = True,
    smart_text: bool = True,
    debug_dir: Path | None = None
) -> list[dict]:
    """
    Run SAHI-based detection on image with optional OCR.

    Args:
        image: Input image (BGR format)
        model: YOLO model
        conf: Confidence threshold
        iou: IoU threshold for NMS
        use_filters: Apply post-processing filters
        enable_ocr: Enable OCR text extraction
        smart_text: Use smart text region detection (default: True)
        debug_dir: Optional directory for debug output

    Returns:
        List of detections in format:
        [
          {
            "bbox": [x,y,w,h],
            "class": "detail",
            "confidence": 0.87,
            "ocr_text": "A6",
            "ocr_confidence": 0.92,
            "identifier": "A6",
            "target_sheet": null
          },
          ...
        ]
    """
    # Tile image
    tiles = tile_image(image, TILE_SIZE, OVERLAP)

    all_detections = []

    for tile, (offset_x, offset_y) in tiles:
        results = model.predict(tile, conf=conf, iou=iou, verbose=False)

        for r in results:
            boxes = r.boxes
            for i in range(len(boxes)):
                box = boxes[i]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                # Adjust to global coordinates
                x1_global = x1 + offset_x
                y1_global = y1 + offset_y
                x2_global = x2 + offset_x
                y2_global = y2 + offset_y

                conf_score = float(box.conf[0])
                cls_id = int(box.cls[0])
                class_name = CLASS_NAMES[cls_id]

                all_detections.append({
                    'bbox': [
                        float(x1_global),
                        float(y1_global),
                        float(x2_global - x1_global),
                        float(y2_global - y1_global)
                    ],
                    'class': class_name,
                    'confidence': conf_score
                })

    # Merge overlapping detections
    merged = merge_detections(all_detections, iou_threshold=iou)

    # Apply post-processing filters
    if use_filters:
        filtered_result = apply_all_filters(merged, verbose=False)
        final_detections = filtered_result['filtered_detections']
    else:
        final_detections = merged

    # Create debug directory for smart text if needed
    smart_debug_dir = None
    if debug_dir and smart_text:
        smart_debug_dir = debug_dir / "text_regions"
        smart_debug_dir.mkdir(exist_ok=True)

    # Add OCR to each detection
    if enable_ocr:
        for i, det in enumerate(final_detections):
            x, y, w, h = det['bbox']
            x, y, w, h = int(x), int(y), int(w), int(h)

            if smart_text:
                ocr_text, ocr_conf, identifier, target_sheet = smart_ocr_for_detection(
                    image, x, y, w, h, det['class'],
                    debug_dir=smart_debug_dir, detection_idx=i
                )
            else:
                ocr_text, ocr_conf, _ = ocr_crop(image, x, y, w, h, return_debug=True)
                identifier, target_sheet = parse_callout_text(ocr_text, det['class'])

            det['ocr_text'] = ocr_text
            det['ocr_confidence'] = ocr_conf
            det['identifier'] = identifier
            det['target_sheet'] = target_sheet
            det['debug_crop_path'] = f"debug_crop_{i}.png"
    else:
        # No OCR - add null values
        for det in final_detections:
            det['ocr_text'] = None
            det['ocr_confidence'] = 0.0
            det['identifier'] = None
            det['target_sheet'] = None

    return final_detections


def main():
    parser = argparse.ArgumentParser(
        description="Detect callouts using YOLOv8n iteration-5 model"
    )
    parser.add_argument("--pdf", help="Path to PDF file")
    parser.add_argument("--page", type=int, default=1, help="Page number (1-indexed)")
    parser.add_argument("--image", help="Path to image file")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--conf", type=float, default=CONF_THRESHOLD,
                        help=f"Confidence threshold (default: {CONF_THRESHOLD})")
    parser.add_argument("--no-filters", action="store_true",
                        help="Disable post-processing filters")
    parser.add_argument("--no-ocr", action="store_true",
                        help="Disable OCR text extraction")
    parser.add_argument("--smart-text", action="store_true", default=True,
                        help="Enable smart text region detection (default: enabled)")
    parser.add_argument("--no-smart-text", action="store_true",
                        help="Disable smart text region detection")

    args = parser.parse_args()

    if not args.pdf and not args.image:
        print("Error: Must provide either --pdf or --image", file=sys.stderr)
        sys.exit(1)

    if args.pdf and args.image:
        print("Error: Cannot provide both --pdf and --image", file=sys.stderr)
        sys.exit(1)

    # Load model
    if not MODEL_PATH.exists():
        print(f"Error: Model not found at {MODEL_PATH}", file=sys.stderr)
        sys.exit(1)

    model = YOLO(str(MODEL_PATH))

    # Load image
    if args.pdf:
        print(f"Rendering page {args.page} from {args.pdf} at {DPI} DPI...",
              file=sys.stderr)
        image = render_pdf_page(args.pdf, args.page, DPI)
    else:
        print(f"Loading image from {args.image}...", file=sys.stderr)
        image = cv2.imread(args.image)
        if image is None:
            print(f"Error: Could not load image from {args.image}", file=sys.stderr)
            sys.exit(1)

    print(f"Image size: {image.shape[1]}x{image.shape[0]}", file=sys.stderr)

    # Determine smart text setting
    use_smart_text = args.smart_text and not args.no_smart_text
    print(f"Smart text detection: {'enabled' if use_smart_text else 'disabled'}", file=sys.stderr)

    # Save results
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Run detection
    print("Running detection...", file=sys.stderr)
    detections = detect_callouts(
        image,
        model,
        conf=args.conf,
        use_filters=not args.no_filters,
        enable_ocr=not args.no_ocr,
        smart_text=use_smart_text,
        debug_dir=output_dir if not args.no_ocr else None
    )

    print(f"Found {len(detections)} callouts", file=sys.stderr)

    # Save debug crops if OCR was enabled
    if not args.no_ocr:
        debug_dir = output_dir / "debug_crops"
        debug_dir.mkdir(exist_ok=True)

        for i, det in enumerate(detections):
            x, y, w, h = det['bbox']
            x, y, w, h = int(x), int(y), int(w), int(h)

            # Re-run OCR with debug flag to get crop
            _, _, debug_crop = ocr_crop(image, x, y, w, h, return_debug=True)
            if debug_crop is not None:
                debug_path = debug_dir / f"crop_{i}_{det['class']}_conf{det['confidence']:.2f}.png"
                cv2.imwrite(str(debug_path), debug_crop)
                print(f"  Saved debug crop: {debug_path}", file=sys.stderr)

    output_file = output_dir / "detections.json"
    with open(output_file, 'w') as f:
        json.dump({"detections": detections}, f, indent=2)

    print(f"Saved detections to {output_file}", file=sys.stderr)

    # Print OCR statistics
    if not args.no_ocr:
        total = len(detections)
        with_text = sum(1 for d in detections if d['ocr_text'])
        with_id = sum(1 for d in detections if d['identifier'] or d['target_sheet'])
        print(f"OCR stats: {with_text}/{total} with text, {with_id}/{total} with parsed ID", file=sys.stderr)

    # Print summary to stdout (parseable by TypeScript)
    print(json.dumps({
        "success": True,
        "detections_count": len(detections),
        "output_file": str(output_file),
        "by_class": {
            cls: sum(1 for d in detections if d['class'] == cls)
            for cls in CLASS_NAMES
        },
        "ocr_stats": {
            "with_text": sum(1 for d in detections if d['ocr_text']),
            "with_identifier": sum(1 for d in detections if d['identifier'] or d['target_sheet'])
        } if not args.no_ocr else None
    }))


if __name__ == "__main__":
    main()
