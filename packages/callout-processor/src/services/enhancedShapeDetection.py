#!/usr/bin/env python3
"""
Enhanced shape detection for construction plan callouts.

Uses multiple techniques to find callout symbols:
1. Contour detection with smart filtering (catches compound shapes)
2. HoughCircles for circular elements
3. Blob detection for filled shapes (solid triangles)
4. Feature analysis (horizontal lines inside circles)
5. Merge nearby detections into single callouts

Outputs annotated debug image and detected shapes.
"""

import sys
import json
import os
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OpenCV/NumPy not installed. Run: pip install opencv-python numpy"}))
    sys.exit(1)


def preprocess_image(image):
    """Apply preprocessing to improve shape detection."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    # Adaptive thresholding handles varying contrast across the image
    thresh = cv2.adaptiveThreshold(
        gray, 255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 
        21, 5
    )
    
    # Morphological closing to connect nearby elements (compound shapes)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    # Remove small noise
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)
    
    return gray, thresh, cleaned


def detect_contours(cleaned, image_height, image_width, dpi=300):
    """
    Find shapes using contour detection with smart filtering.
    This catches compound shapes that aren't perfect circles/triangles.
    """
    contours, hierarchy = cv2.findContours(
        cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    
    shapes = []
    
    # Scale size thresholds based on DPI
    # At 300 DPI, callouts are typically 30-80 pixels diameter
    # Increased min_area to reduce false positives from small shapes
    scale = dpi / 300.0
    min_area = int(700 * scale * scale)   # ~700 pixels² at 300 DPI (~26px diameter circle)
    max_area = int(6000 * scale * scale)  # ~6000 pixels² at 300 DPI (~87px diameter circle)
    
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        
        if area < min_area or area > max_area:
            continue
        
        # Get bounding box
        x, y, w, h = cv2.boundingRect(contour)
        
        # Skip shapes at edges (likely title block elements)
        margin = 30
        if x < margin or y < margin:
            continue
        if x + w > image_width - margin or y + h > image_height - margin:
            continue
        
        # Aspect ratio filter (callouts are roughly square-ish, circles/triangles)
        aspect_ratio = w / h if h > 0 else 0
        if aspect_ratio < 0.5 or aspect_ratio > 2.0:  # Tightened from 0.3-3.0
            continue
        
        # Calculate circularity
        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
        
        # Calculate solidity (filled vs hollow)
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0
        
        # Approximate polygon vertices
        epsilon = 0.02 * perimeter
        approx = cv2.approxPolyDP(contour, epsilon, True)
        vertices = len(approx)
        
        # Determine shape type and filter non-callout shapes
        if circularity > 0.7:
            shape_type = "circle"
        elif vertices == 3 and circularity > 0.4:
            shape_type = "triangle"
        elif vertices == 4 and circularity > 0.5:
            # Only keep squares (potential callout backgrounds)
            shape_type = "rectangle"
        else:
            # Skip compound/irregular shapes - unlikely to be callouts
            # This significantly reduces false positives from lines, text, etc.
            continue
        
        # Center point
        M = cv2.moments(contour)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
        else:
            cx = x + w // 2
            cy = y + h // 2
        
        shapes.append({
            "type": shape_type,
            "method": "contour",
            "centerX": cx,
            "centerY": cy,
            "bbox": {"x1": x, "y1": y, "x2": x + w, "y2": y + h},
            "area": area,
            "circularity": round(circularity, 3),
            "solidity": round(solidity, 3),
            "vertices": vertices,
            "confidence": 0.7
        })
    
    return shapes


def detect_circles(gray, dpi=300):
    """Detect circles using HoughCircles."""
    shapes = []

    # Scale parameters based on DPI
    # Callout circles are typically 30-70 pixels diameter at 300 DPI
    scale = dpi / 300.0
    min_radius = int(15 * scale)   # Increased from 10 to reduce tiny false positives
    max_radius = int(45 * scale)   # Decreased from 50 to focus on callout-sized circles
    min_dist = int(40 * scale)     # Increased from 30 to reduce overlapping detections

    # Apply Gaussian blur for better circle detection
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=min_dist,
        param1=50,
        param2=40,  # Increased from 30 to reduce false positives (higher = fewer circles)
        minRadius=min_radius,
        maxRadius=max_radius
    )
    
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for circle in circles[0, :]:
            cx, cy, r = circle
            
            shapes.append({
                "type": "circle",
                "method": "hough",
                "centerX": int(cx),
                "centerY": int(cy),
                "radius": int(r),
                "bbox": {
                    "x1": int(cx - r),
                    "y1": int(cy - r),
                    "x2": int(cx + r),
                    "y2": int(cy + r)
                },
                "confidence": 0.8
            })
    
    return shapes


def detect_blobs(gray, dpi=300):
    """Detect filled shapes (like solid triangles) using blob detection."""
    shapes = []
    
    scale = dpi / 300.0
    
    # Configure blob detector
    params = cv2.SimpleBlobDetector_Params()
    
    # Filter by color (dark blobs)
    params.filterByColor = True
    params.blobColor = 0
    
    # Filter by area
    params.filterByArea = True
    params.minArea = int(200 * scale * scale)
    params.maxArea = int(5000 * scale * scale)
    
    # Don't filter by circularity (we want triangles too)
    params.filterByCircularity = False
    
    # Filter by convexity
    params.filterByConvexity = True
    params.minConvexity = 0.5
    
    # Filter by inertia (shape elongation)
    params.filterByInertia = True
    params.minInertiaRatio = 0.3
    
    detector = cv2.SimpleBlobDetector_create(params)
    
    # Invert image for blob detection (detect dark on light)
    inverted = cv2.bitwise_not(gray)
    keypoints = detector.detect(inverted)
    
    for kp in keypoints:
        cx, cy = int(kp.pt[0]), int(kp.pt[1])
        r = int(kp.size / 2)
        
        shapes.append({
            "type": "blob",
            "method": "blob",
            "centerX": cx,
            "centerY": cy,
            "radius": r,
            "bbox": {
                "x1": cx - r,
                "y1": cy - r,
                "x2": cx + r,
                "y2": cy + r
            },
            "confidence": 0.6
        })
    
    return shapes


def check_horizontal_line(gray, shape, dpi=300):
    """Check if a circle has a horizontal line through it (detail marker)."""
    bbox = shape["bbox"]
    x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
    
    # Ensure bounds are valid
    h, w = gray.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    
    if x2 <= x1 or y2 <= y1:
        return False
    
    # Crop region
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return False
    
    # Detect edges
    edges = cv2.Canny(roi, 50, 150)
    
    # Detect lines
    min_line_length = int((x2 - x1) * 0.5)  # At least 50% of width
    lines = cv2.HoughLinesP(
        edges, 1, np.pi/180, 
        threshold=10,
        minLineLength=min_line_length,
        maxLineGap=5
    )
    
    if lines is not None:
        for line in lines:
            x1_l, y1_l, x2_l, y2_l = line[0]
            # Check if horizontal (y difference < 5 pixels)
            if abs(y1_l - y2_l) < 5:
                return True
    
    return False


def merge_nearby_detections(shapes, distance_threshold=50):
    """Merge detections that are close together into single callouts."""
    if len(shapes) <= 1:
        return shapes
    
    merged = []
    used = set()
    
    for i, shape1 in enumerate(shapes):
        if i in used:
            continue
        
        # Find all shapes close to this one
        group = [shape1]
        used.add(i)
        
        for j, shape2 in enumerate(shapes):
            if j in used:
                continue
            
            # Calculate distance between centers
            dist = np.sqrt(
                (shape1["centerX"] - shape2["centerX"]) ** 2 +
                (shape1["centerY"] - shape2["centerY"]) ** 2
            )
            
            if dist < distance_threshold:
                group.append(shape2)
                used.add(j)
        
        # Merge group into single detection
        if len(group) == 1:
            merged.append(group[0])
        else:
            # Create merged bounding box
            min_x = min(s["bbox"]["x1"] for s in group)
            min_y = min(s["bbox"]["y1"] for s in group)
            max_x = max(s["bbox"]["x2"] for s in group)
            max_y = max(s["bbox"]["y2"] for s in group)
            
            # Use center of merged box
            cx = (min_x + max_x) // 2
            cy = (min_y + max_y) // 2
            
            # Determine type based on components
            types = [s["type"] for s in group]
            if "circle" in types and "triangle" in types:
                merged_type = "compound"
            elif "circle" in types:
                merged_type = "circle"
            else:
                merged_type = types[0]
            
            # Use highest confidence
            best_conf = max(s.get("confidence", 0.5) for s in group)
            
            merged.append({
                "type": merged_type,
                "method": "merged",
                "centerX": cx,
                "centerY": cy,
                "bbox": {"x1": min_x, "y1": min_y, "x2": max_x, "y2": max_y},
                "confidence": best_conf,
                "components": len(group)
            })
    
    return merged


def save_debug_image(image, shapes, output_path):
    """Save annotated debug image showing all detections."""
    debug = image.copy()
    
    colors = {
        "circle": (0, 255, 0),      # Green
        "triangle": (255, 0, 0),    # Blue
        "compound": (0, 255, 255),  # Yellow
        "blob": (255, 0, 255),      # Magenta
        "rectangle": (255, 255, 0), # Cyan
        "merged": (0, 165, 255),    # Orange
    }
    
    for i, shape in enumerate(shapes):
        color = colors.get(shape["type"], (128, 128, 128))
        bbox = shape["bbox"]
        
        # Draw bounding box
        cv2.rectangle(
            debug,
            (bbox["x1"], bbox["y1"]),
            (bbox["x2"], bbox["y2"]),
            color, 2
        )
        
        # Draw center point
        cv2.circle(debug, (shape["centerX"], shape["centerY"]), 3, color, -1)
        
        # Label with index and type
        label = f"{i+1}:{shape['type'][:3]}"
        cv2.putText(
            debug, label,
            (bbox["x1"], bbox["y1"] - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1
        )
    
    cv2.imwrite(output_path, debug)
    return output_path


def detect_callout_shapes(image_path, dpi=300, output_dir=None):
    """
    Main detection function using multiple techniques.
    
    Returns list of detected shapes with bounding boxes.
    """
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        return {"error": f"Could not load image: {image_path}", "shapes": []}
    
    h, w = image.shape[:2]
    
    # Preprocess
    gray, thresh, cleaned = preprocess_image(image)
    
    # Multi-technique detection
    all_shapes = []
    
    # 1. Contour detection (catches compound shapes)
    contour_shapes = detect_contours(cleaned, h, w, dpi)
    all_shapes.extend(contour_shapes)
    
    # 2. HoughCircles (precise circle detection)
    circle_shapes = detect_circles(gray, dpi)
    all_shapes.extend(circle_shapes)
    
    # 3. Blob detection (filled shapes like solid triangles)
    blob_shapes = detect_blobs(gray, dpi)
    all_shapes.extend(blob_shapes)
    
    # Merge nearby detections
    # Disable merging to keep all individual shape detections
    # This helps when callouts are very close together
    merged_shapes = all_shapes  # No merging
    
    # Check for horizontal lines in circles (detail markers)
    for shape in merged_shapes:
        if shape["type"] == "circle":
            has_line = check_horizontal_line(gray, shape, dpi)
            shape["hasHorizontalLine"] = has_line
            if has_line:
                shape["type"] = "detail_marker"
                shape["confidence"] = min(1.0, shape.get("confidence", 0.7) + 0.1)
    
    # Sort by position (top-left to bottom-right)
    merged_shapes.sort(key=lambda s: (s["centerY"], s["centerX"]))

    # Limit total shapes to prevent runaway LLM processing
    # Typical sheets have 5-30 callouts; 200 is a generous upper bound
    MAX_SHAPES = 200
    if len(merged_shapes) > MAX_SHAPES:
        # Keep shapes with highest confidence (detail_markers first, then by confidence)
        merged_shapes.sort(key=lambda s: (
            -1 if s["type"] == "detail_marker" else 0,
            -s.get("confidence", 0)
        ))
        merged_shapes = merged_shapes[:MAX_SHAPES]
        # Re-sort by position
        merged_shapes.sort(key=lambda s: (s["centerY"], s["centerX"]))

    # Save debug output
    if output_dir:
        debug_path = os.path.join(output_dir, "cv_detection_debug.png")
        save_debug_image(image, merged_shapes, debug_path)
        
        # Save preprocessed images for inspection
        cv2.imwrite(os.path.join(output_dir, "cv_thresh.png"), thresh)
        cv2.imwrite(os.path.join(output_dir, "cv_cleaned.png"), cleaned)
    
    return {
        "shapes": merged_shapes,
        "imageWidth": w,
        "imageHeight": h,
        "totalDetections": len(merged_shapes),
        "byMethod": {
            "contour": len(contour_shapes),
            "hough": len(circle_shapes),
            "blob": len(blob_shapes)
        }
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 enhancedShapeDetection.py <image_path> [dpi] [output_dir]"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    output_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"Image not found: {image_path}"}))
        sys.exit(1)
    
    result = detect_callout_shapes(image_path, dpi, output_dir)
    print(json.dumps(result, indent=2))

