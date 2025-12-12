#!/usr/bin/env python3
"""
Create verification crops around each detected callout dot.
These will be sent to LLM to verify if the dot is centered on a callout symbol.
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


def create_verification_crops(image_path: str, callouts: list, output_dir: str, crop_size: int = 80):
    """
    Create small cropped images centered on each callout dot for LLM verification.
    
    Args:
        image_path: Path to the original image
        callouts: List of callouts with x, y coordinates and ref
        output_dir: Directory to save verification crops
        crop_size: Size of the verification crop (default 80px - small, focused)
    
    Returns:
        List of verification crop info
    """
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        return {"error": f"Could not load image: {image_path}"}
    
    h, w = image.shape[:2]
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    verification_crops = []
    
    for i, callout in enumerate(callouts):
        x = int(callout.get('x', 0))
        y = int(callout.get('y', 0))
        ref = callout.get('ref', '')
        
        # Calculate crop bounds (centered on the dot)
        half = crop_size // 2
        x1 = max(0, x - half)
        y1 = max(0, y - half)
        x2 = min(w, x + half)
        y2 = min(h, y + half)
        
        # Crop the region
        crop = image[y1:y2, x1:x2].copy()
        
        # Draw a small red dot at the center to show where we detected
        local_x = x - x1
        local_y = y - y1
        cv2.circle(crop, (local_x, local_y), 5, (0, 0, 255), -1)
        cv2.circle(crop, (local_x, local_y), 5, (255, 255, 255), 1)
        
        # Save the crop
        crop_filename = f"verify_{i+1}_{ref.replace('/', '_')}.png"
        crop_path = os.path.join(output_dir, crop_filename)
        cv2.imwrite(crop_path, crop)
        
        verification_crops.append({
            "index": i,
            "ref": ref,
            "x": x,
            "y": y,
            "crop_path": crop_path
        })
    
    return {
        "success": True,
        "crops": verification_crops,
        "total": len(verification_crops)
    }


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python3 verifyCallouts.py <image_path> <callouts_json> <output_dir>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    callouts_json = sys.argv[2]
    output_dir = sys.argv[3]
    
    try:
        callouts = json.loads(callouts_json)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    
    result = create_verification_crops(image_path, callouts, output_dir)
    print(json.dumps(result))

