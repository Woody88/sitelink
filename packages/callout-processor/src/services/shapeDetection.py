#!/usr/bin/env python3
"""
Shape detection using OpenCV
Detects circles and triangles in construction plan images
Returns bounding boxes for detected shapes
"""

import cv2
import json
import sys
from typing import List, Dict, Any

def detect_circles(image_path: str, min_radius: int = 15, max_radius: int = 50, dpi: int = 300) -> List[Dict[str, Any]]:
    """Detect circles using Hough Circle Transform - tuned for reference markers"""
    img = cv2.imread(image_path)
    if img is None:
        return []
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adjust parameters based on DPI
    # Higher DPI = larger shapes, adjust radius range
    # For callout symbols, they're typically 20-40px diameter at 300 DPI
    if dpi >= 300:
        min_radius = int(min_radius * 1.2)  # Reduced multiplier - callouts are small
        max_radius = int(max_radius * 1.2)
    elif dpi <= 150:
        min_radius = int(min_radius * 0.75)
        max_radius = int(max_radius * 0.75)
    
    # Apply Gaussian blur
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    
    # Detect circles - balanced for callout symbols (small circles with text)
    # Tuned to find callout markers without too many false positives
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,              # Inverse ratio of accumulator resolution
        minDist=35,        # Minimum distance between circle centers
        param1=110,        # Upper threshold for Canny edge detector
        param2=30,         # Threshold for center detection (balanced - not too sensitive)
        minRadius=min_radius,
        maxRadius=max_radius
    )
    
    results = []
    if circles is not None:
        circles = circles[0, :].astype(int)
        img_height, img_width = gray.shape
        margin = 20  # Reduced margin to catch callouts near edges
        
        for (x, y, r) in circles:
            # Filter by radius range
            if r < min_radius or r > max_radius:
                continue
            
            # Filter out circles too close to edges
            if x - r < margin or x + r > img_width - margin:
                continue
            if y - r < margin or y + r > img_height - margin:
                continue
            
            results.append({
                "type": "circle",
                "x": int(x - r),
                "y": int(y - r),
                "width": int(r * 2),
                "height": int(r * 2),
                "centerX": int(x),
                "centerY": int(y),
                "radius": int(r)
            })
    
    # Sort by position (top to bottom, left to right)
    results.sort(key=lambda p: (p["y"], p["x"]))
    
    return results

def detect_triangles(image_path: str, min_area: int = 200, max_area: int = 5000, dpi: int = 300) -> List[Dict[str, Any]]:
    """Detect triangles using contour analysis"""
    img = cv2.imread(image_path)
    if img is None:
        return []
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adjust area range based on DPI
    if dpi >= 300:
        min_area = int(min_area * 2.25)  # 1.5^2
        max_area = int(max_area * 2.25)
    elif dpi <= 150:
        min_area = int(min_area * 0.56)  # 0.75^2
        max_area = int(max_area * 0.56)
    
    # Apply threshold
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
    
    # Find contours
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    results = []
    for contour in contours:
        area = cv2.contourArea(contour)
        
        # Filter by area
        if area < min_area or area > max_area:
            continue
        
        # Approximate polygon
        epsilon = 0.04 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Check if it's a triangle (3 vertices)
        if len(approx) == 3:
            x, y, w, h = cv2.boundingRect(contour)
            results.append({
                "type": "triangle",
                "x": int(x),
                "y": int(y),
                "width": int(w),
                "height": int(h),
                "centerX": int(x + w / 2),
                "centerY": int(y + h / 2)
            })
    
    return results

def detect_shape_positions(image_path: str, dpi: int = 300) -> List[Dict[str, Any]]:
    """Detect all shapes (circles and triangles) in an image"""
    circles = detect_circles(image_path, dpi=dpi)
    triangles = detect_triangles(image_path, dpi=dpi)
    return circles + triangles

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Image path required"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    
    positions = detect_shape_positions(image_path, dpi=dpi)
    print(json.dumps(positions, indent=2))

