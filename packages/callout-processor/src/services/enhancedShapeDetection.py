#!/usr/bin/env python3
"""
Enhanced Shape Detection for Construction Plan Callouts

This module detects callout symbols (circles, triangles, section flags) in
construction drawing images using multiple computer vision techniques:

1. Hough Circle Transform - Precise circle detection
2. Contour Analysis - Triangles, section flags, and irregular shapes
3. Text Block Detection - Borderless "XX/00" style callouts

Detection results are passed to an LLM for semantic validation and OCR.

Usage:
    python enhancedShapeDetection.py <image_path> [dpi] [output_dir]

Output:
    JSON with detected shapes, bounding boxes, and confidence scores
"""

import sys
import json
import os
import traceback

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OpenCV/NumPy not installed. Run: pip install opencv-python numpy"}))
    sys.exit(1)


# =============================================================================
# Debug Visualization Colors (BGR format for OpenCV)
# =============================================================================

COLOR_CIRCLE = (255, 0, 0)          # Blue - standard circles
COLOR_DETAIL_MARKER = (255, 128, 0) # Light blue - circles with horizontal line
COLOR_TRIANGLE = (0, 255, 255)      # Yellow - triangular markers
COLOR_SECTION_FLAG = (0, 255, 0)    # Green - circle+triangle compound
COLOR_TEXT_CALLOUT = (255, 0, 255)  # Magenta - borderless text callouts
COLOR_UNKNOWN = (128, 128, 128)     # Gray - unclassified shapes


def get_shape_color(shape_type: str) -> tuple:
    """
    Get the debug visualization color for a shape type.

    Args:
        shape_type: One of 'circle', 'detail_marker', 'triangle',
                    'section_flag', 'text_callout', or 'unknown'

    Returns:
        BGR color tuple for OpenCV drawing functions
    """
    color_map = {
        "circle": COLOR_CIRCLE,
        "detail_marker": COLOR_DETAIL_MARKER,
        "triangle": COLOR_TRIANGLE,
        "section_flag": COLOR_SECTION_FLAG,
        "text_callout": COLOR_TEXT_CALLOUT,
    }
    return color_map.get(shape_type, COLOR_UNKNOWN)


def preprocess_image(image: np.ndarray) -> tuple:
    """
    Preprocess an image for shape detection.

    Applies grayscale conversion, adaptive thresholding, and morphological
    operations to prepare the image for contour and circle detection.

    Args:
        image: Input BGR image as numpy array

    Returns:
        Tuple of (grayscale, thresholded, cleaned) images where:
        - grayscale: Single-channel grayscale image
        - thresholded: Binary image after adaptive thresholding
        - cleaned: Binary image after morphological cleanup
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # Adaptive threshold with block size tuned for architectural line weights
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 7
    )

    # Morphological operations to clean up noise and connect broken lines
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)

    return gray, thresh, cleaned


def check_horizontal_line(gray: np.ndarray, bbox: dict) -> bool:
    """
    Check if a region contains a horizontal dividing line.

    Detail markers in construction drawings typically have a horizontal line
    dividing the circle into top (detail number) and bottom (sheet reference).

    Args:
        gray: Grayscale image
        bbox: Bounding box dict with keys 'x1', 'y1', 'x2', 'y2'

    Returns:
        True if a horizontal line is detected, False otherwise
    """
    x1 = max(0, bbox["x1"])
    y1 = max(0, bbox["y1"])
    x2 = bbox["x2"]
    y2 = bbox["y2"]

    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    # Edge detection and line finding
    edges = cv2.Canny(roi, 50, 150)
    min_line_length = int(roi.shape[1] * 0.4)  # 40% of ROI width
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180,
        threshold=10, minLineLength=min_line_length, maxLineGap=5
    )

    if lines is not None:
        for line in lines:
            x1_l, y1_l, x2_l, y2_l = line[0]
            # Check if line is approximately horizontal (< 5px vertical difference)
            if abs(y1_l - y2_l) < 5:
                return True

    return False


def detect_text_blocks(thresh: np.ndarray, dpi: int = 300) -> list:
    """
    Detect potential borderless text callouts (XX/00 pattern).

    Uses morphological smearing to group text characters, then filters
    by size and aspect ratio to find callout-sized text blocks.

    Args:
        thresh: Binary thresholded image
        dpi: Image DPI for size scaling

    Returns:
        List of shape dicts for detected text blocks
    """
    scale = dpi / 300.0

    # Horizontal smearing to connect characters in text
    k_width = int(22 * scale)
    k_height = int(5 * scale)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_width, k_height))
    smeared = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(smeared, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    blocks = []
    min_area = int(500 * scale ** 2)
    max_area = int(6000 * scale ** 2)

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        aspect = w / float(h) if h > 0 else 0

        # Filter for callout-sized text blocks with typical aspect ratio
        if min_area < area < max_area and 1.1 < aspect < 5.0:
            blocks.append({
                "type": "text_callout",
                "method": "blob",
                "centerX": x + w // 2,
                "centerY": y + h // 2,
                "bbox": {"x1": x, "y1": y, "x2": x + w, "y2": y + h},
                "confidence": 0.65
            })

    return blocks


def detect_all(image_path: str, dpi: int = 300, output_dir: str = None) -> dict:
    """
    Main detection function - finds all callout shapes in an image.

    Combines multiple detection techniques:
    1. Hough circles for precise circle detection
    2. Contour analysis for triangles and compound section flags
    3. Text block detection for borderless callouts

    Results are deduplicated and prioritized by shape type specificity.

    Args:
        image_path: Path to input image file
        dpi: Image DPI for size-aware detection thresholds
        output_dir: Optional directory to save debug visualization

    Returns:
        Dict with keys:
        - shapes: List of detected shape dicts
        - imageWidth, imageHeight: Image dimensions
        - totalDetections: Count of shapes found
        - byMethod: Breakdown by detection method
        - error: Error message if detection failed
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"error": f"Failed to load image: {image_path}", "shapes": []}

    h, w = img.shape[:2]
    gray, thresh, cleaned = preprocess_image(img)
    scale = dpi / 300.0

    found = []

    # -------------------------------------------------------------------------
    # 1. Hough Circle Detection (most precise for circles)
    # -------------------------------------------------------------------------
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    min_radius = int(12 * scale)
    max_radius = int(50 * scale)
    min_dist = int(40 * scale)

    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, 1, min_dist,
        param1=50, param2=30,
        minRadius=min_radius, maxRadius=max_radius
    )

    if circles is not None:
        for cx, cy, r in circles[0, :]:
            found.append({
                "type": "circle",
                "method": "hough",
                "centerX": int(cx),
                "centerY": int(cy),
                "bbox": {
                    "x1": int(cx - r),
                    "y1": int(cy - r),
                    "x2": int(cx + r),
                    "y2": int(cy + r)
                },
                "confidence": 0.85,
                "radius": int(r)
            })

    # -------------------------------------------------------------------------
    # 2. Contour Detection (triangles, section flags, irregular circles)
    # -------------------------------------------------------------------------
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = int(600 * scale ** 2)
    max_area = int(8500 * scale ** 2)  # Increased for circle+triangle compounds

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not (min_area < area < max_area):
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)
        perimeter = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)

        # Circularity: 1.0 = perfect circle, lower = more irregular
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0

        shape_type = None

        if circularity > 0.65:
            # High circularity = circle
            shape_type = "circle"
        elif len(approx) == 3:
            # Exactly 3 vertices = triangle
            shape_type = "triangle"
        elif circularity < 0.6 and len(approx) > 4:
            # Low circularity + many vertices = possibly section flag (circle + triangle)
            aspect_ratio = bw / bh if bh > 0 else 0
            if 0.6 < aspect_ratio < 1.6:
                shape_type = "section_flag"

        if shape_type:
            found.append({
                "type": shape_type,
                "method": "contour",
                "centerX": x + bw // 2,
                "centerY": y + bh // 2,
                "bbox": {"x1": x, "y1": y, "x2": x + bw, "y2": y + bh},
                "confidence": 0.75
            })

    # -------------------------------------------------------------------------
    # 3. Text Block Detection (borderless XX/00 callouts)
    # -------------------------------------------------------------------------
    found.extend(detect_text_blocks(thresh, dpi))

    # -------------------------------------------------------------------------
    # 4. Post-processing: Deduplication and Detail Marker Detection
    # -------------------------------------------------------------------------
    final = []

    # Prioritize more specific shape types during deduplication
    type_priority = {
        "section_flag": 0,   # Most specific - compound shape
        "detail_marker": 1,  # Circle with horizontal line
        "circle": 2,         # Generic circle
        "triangle": 3,       # Standalone triangle
        "text_callout": 4    # Borderless text
    }
    found.sort(key=lambda x: type_priority.get(x['type'], 99))

    dedup_radius = 35  # Pixels - shapes closer than this are considered duplicates

    for shape in found:
        # Upgrade circles with horizontal lines to detail_marker
        if shape['type'] == 'circle' and check_horizontal_line(gray, shape['bbox']):
            shape['type'] = 'detail_marker'
            shape['hasHorizontalLine'] = True

        # Deduplicate: skip if too close to an already-added shape
        is_duplicate = any(
            np.hypot(shape['centerX'] - f['centerX'], shape['centerY'] - f['centerY']) < dedup_radius
            for f in final
        )

        if not is_duplicate:
            # Expand bbox slightly for LLM context
            pad = 5
            shape['bbox']['x1'] = max(0, shape['bbox']['x1'] - pad)
            shape['bbox']['y1'] = max(0, shape['bbox']['y1'] - pad)
            shape['bbox']['x2'] = min(w, shape['bbox']['x2'] + pad)
            shape['bbox']['y2'] = min(h, shape['bbox']['y2'] + pad)
            final.append(shape)

    # -------------------------------------------------------------------------
    # 5. Statistics and Debug Output
    # -------------------------------------------------------------------------
    stats = {
        "contour": len([s for s in final if s['method'] == 'contour']),
        "hough": len([s for s in final if s['method'] == 'hough']),
        "blob": len([s for s in final if s['method'] == 'blob'])
    }

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        debug_img = img.copy()

        for shape in final:
            color = get_shape_color(shape['type'])
            bbox = shape['bbox']

            # Draw bounding box
            cv2.rectangle(
                debug_img,
                (bbox['x1'], bbox['y1']),
                (bbox['x2'], bbox['y2']),
                color, 2
            )

            # Draw label with background for readability
            label = shape['type']
            label_pos = (bbox['x1'], bbox['y1'] - 5)
            cv2.putText(
                debug_img, label, label_pos,
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1
            )

            # Draw center point
            cv2.circle(
                debug_img,
                (shape['centerX'], shape['centerY']),
                3, color, -1
            )

        debug_path = os.path.join(output_dir, "cv_detection_debug.png")
        cv2.imwrite(debug_path, debug_img)

    return {
        "shapes": final,
        "imageWidth": w,
        "imageHeight": h,
        "totalDetections": len(final),
        "byMethod": stats
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "Usage: enhancedShapeDetection.py <image_path> [dpi] [output_dir]"}))
            sys.exit(1)

        image_path = sys.argv[1]
        dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 300
        output_dir = sys.argv[3] if len(sys.argv) > 3 else None

        result = detect_all(image_path, dpi, output_dir)
        print(json.dumps(result))

    except Exception:
        print(json.dumps({"error": traceback.format_exc()}))
        sys.exit(1)
