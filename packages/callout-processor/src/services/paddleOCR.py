#!/usr/bin/env python3
"""
PaddleOCR wrapper for extracting text with bounding boxes from images.
Returns results in a format compatible with TesseractWord interface.
"""

import sys
import json
import os
from pathlib import Path

# Suppress PaddleOCR's connectivity check messages
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'

try:
    from paddleocr import PaddleOCR
except ImportError:
    print(json.dumps({"error": "PaddleOCR not installed. Run: pip install paddleocr"}, indent=2), file=sys.stderr)
    sys.exit(1)


def extract_text_with_boxes(image_path: str) -> list:
    """
    Extract text with bounding boxes using PaddleOCR.
    
    Returns list of words with format:
    {
        "left": int,
        "top": int,
        "width": int,
        "height": int,
        "conf": float (0-100),
        "text": str
    }
    """
    try:
        # Initialize PaddleOCR (use_angle_cls=True for better accuracy on rotated text)
        ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        
        # Run OCR
        result = ocr.ocr(image_path, cls=True)
        
        words = []
        if result and result[0]:
            for line in result[0]:
                if line:
                    # PaddleOCR returns: [[[x1, y1], [x2, y2], [x3, y3], [x4, y4]], (text, confidence)]
                    box = line[0]  # [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                    text_info = line[1]  # (text, confidence)
                    
                    text = text_info[0]
                    confidence = text_info[1]
                    
                    # Calculate bounding box from 4 corner points
                    x_coords = [point[0] for point in box]
                    y_coords = [point[1] for point in box]
                    
                    left = int(min(x_coords))
                    top = int(min(y_coords))
                    right = int(max(x_coords))
                    bottom = int(max(y_coords))
                    
                    width = right - left
                    height = bottom - top
                    
                    # Convert confidence from 0-1 to 0-100 to match Tesseract format
                    conf = int(confidence * 100)
                    
                    words.append({
                        "left": left,
                        "top": top,
                        "width": width,
                        "height": height,
                        "conf": conf,
                        "text": text
                    })
        
        return words
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2), file=sys.stderr)
        return []


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 paddleOCR.py <image_path>"}, indent=2), file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not Path(image_path).exists():
        print(json.dumps({"error": f"Image not found: {image_path}"}, indent=2), file=sys.stderr)
        sys.exit(1)
    
    words = extract_text_with_boxes(image_path)
    print(json.dumps(words, indent=2))

