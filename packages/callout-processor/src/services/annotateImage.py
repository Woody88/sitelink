#!/usr/bin/env python3
"""
Annotate image with red contours around detected callouts.
"""

import sys
import json
import os

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OpenCV/NumPy not installed"}))
    sys.exit(1)


def annotate_callouts(image_path: str, callouts: list, output_path: str, style: str = "contour"):
    """
    Draw annotations around detected callouts.
    
    Args:
        image_path: Path to the original image
        callouts: List of callouts with x, y coordinates and bbox
        output_path: Path to save annotated image
        style: "contour" (outline only, preserves inside) or "dot" (filled circle)
    """
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        return {"error": f"Could not load image: {image_path}"}
    
    h, w = image.shape[:2]
    
    for callout in callouts:
        x = int(callout.get('x', 0))
        y = int(callout.get('y', 0))
        ref = callout.get('ref', '')
        bbox = callout.get('bbox', None)
        
        if style == "contour" and bbox:
            # Draw the exact bounding box from CV detection
            # This is accurate because it's what CV actually detected
            x1 = int(bbox.get('x1', x - 25))
            y1 = int(bbox.get('y1', y - 25))
            x2 = int(bbox.get('x2', x + 25))
            y2 = int(bbox.get('y2', y + 25))
            
            # Add small padding
            padding = 5
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(w, x2 + padding)
            y2 = min(h, y2 + padding)
            
            # Draw rectangle outline (exact bounding box from CV detection)
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 0, 255), 2)  # Red rectangle outline
            
            # NO dot at center - keeps inside completely visible!
        else:
            # Fallback: draw dot at center
            cv2.circle(image, (x, y), 8, (0, 0, 255), -1)  # Filled red circle
            cv2.circle(image, (x, y), 8, (255, 255, 255), 2)  # White outline
        
        # Draw label
        label = ref
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 2
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        
        # Label position (offset from shape)
        if bbox:
            label_x = int(bbox.get('x2', x)) + 5
            label_y = int(bbox.get('y1', y)) + text_h
        else:
            label_x = x + 15
            label_y = y + text_h // 2
        
        # Ensure label is within image bounds
        if label_x + text_w > w:
            label_x = max(0, int(bbox.get('x1', x) if bbox else x) - text_w - 5)
        if label_y - text_h < 0:
            label_y = int(bbox.get('y2', y) if bbox else y) + text_h + 5
        
        # Draw white background for label
        cv2.rectangle(image, 
                      (label_x - 2, label_y - text_h - 2),
                      (label_x + text_w + 2, label_y + 4),
                      (255, 255, 255), -1)
        
        # Draw red text
        cv2.putText(image, label, (label_x, label_y), font, font_scale, (0, 0, 255), thickness)
    
    # Save annotated image
    cv2.imwrite(output_path, image)
    
    return {
        "success": True,
        "output_path": output_path,
        "callouts_annotated": len(callouts),
        "style": style
    }


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python3 annotateImage.py <image_path> <callouts_json> <output_path>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    callouts_json = sys.argv[2]
    output_path = sys.argv[3]
    
    try:
        callouts = json.loads(callouts_json)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    
    result = annotate_callouts(image_path, callouts, output_path)
    print(json.dumps(result))

