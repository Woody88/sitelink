#!/usr/bin/env python3
"""
Extract sheet number from title block using OCR.
Title blocks are typically in the bottom-right corner of construction drawings.
"""

import sys
import json
import cv2
import numpy as np
import re
from pathlib import Path

_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    return _ocr


def extract_sheet_number(image_path: str) -> dict:
    """Extract sheet number from the title block region of a drawing."""
    img = cv2.imread(image_path)
    if img is None:
        return {"sheet_number": None, "error": f"Could not read image: {image_path}"}

    h, w = img.shape[:2]

    title_block_x = int(w * 0.75)
    title_block_y = int(h * 0.85)
    title_block = img[title_block_y:h, title_block_x:w]

    ocr = get_ocr()
    result = ocr.ocr(title_block, cls=True)

    texts = []
    if result and result[0]:
        for line in result[0]:
            text = line[1][0]
            texts.append(text)

    sheet_number = None
    full_text = ' '.join(texts)

    discipline_pattern = r'\b([SAEMPCGL]\d+(?:\.\d+)?)\b'
    discipline_match = re.search(discipline_pattern, full_text)
    if discipline_match:
        sheet_number = discipline_match.group(1).upper()
    else:
        sheet_patterns = [
            r'SHEET\s*(?:NO\.?)?\s*[:#]?\s*([A-Z]?\d+(?:\.\d+)?)',
            r'DWG\.?\s*(?:NO\.?)?\s*[:#]?\s*([A-Z]?\d+(?:\.\d+)?)',
            r'DRAWING\s+([A-Z]\d+(?:\.\d+)?)',
            r'\b([A-Z]\d+(?:\.\d+)?)\b',
        ]

        for pattern in sheet_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                sheet_number = match.group(1).upper()
                break

    if not sheet_number and texts:
        for text in reversed(texts):
            clean = text.strip().upper()
            if re.match(r'^[SAEMPCGL]\d+(?:\.\d+)?$', clean):
                sheet_number = clean
                break

    return {
        "sheet_number": sheet_number,
        "raw_texts": texts[:10],
        "full_text": full_text[:200] if full_text else None
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python extract_sheet_number.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    result = extract_sheet_number(image_path)
    print(json.dumps(result))
