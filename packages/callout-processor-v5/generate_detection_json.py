#!/usr/bin/env python3
"""
Run v5 detection on specific pages and save JSON for validation.
"""
import sys
import cv2
import json
import numpy as np
from pathlib import Path
import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent / 'src'))
from sahi_tiling import tile_image, merge_detections, adjust_coordinates, TILE_SIZE, OVERLAP
from postprocess_filters import apply_all_filters

from ultralytics import YOLO

MODEL = 'runs/detect/v5_combined2/weights/best.pt'
CLASS_NAMES = ["detail", "elevation", "title"]

def render_pdf_page(pdf_path, page_num, dpi=72):
    """Render single PDF page to numpy array."""
    doc = fitz.open(pdf_path)
    page = doc[page_num - 1]  # 0-indexed

    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img_np = np.array(img)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    doc.close()
    return img_bgr

def detect_with_sahi(model, image, conf=0.25, iou=0.5, use_filters=True):
    """Run YOLO detection with SAHI tiling and optional post-processing filters."""
    tiles = tile_image(image, TILE_SIZE, OVERLAP)

    all_detections = []
    for i, (tile, offset) in enumerate(tiles):
        results = model.predict(tile, conf=conf, iou=iou, verbose=False)

        if results and len(results) > 0:
            result = results[0]
            if hasattr(result, 'boxes') and result.boxes is not None:
                for j in range(len(result.boxes)):
                    box = result.boxes[j]
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy

                    bbox = [float(x1), float(y1), float(x2-x1), float(y2-y1)]
                    bbox_global = adjust_coordinates(bbox, offset)

                    cls_id = int(box.cls[0])
                    callout_type = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}"

                    all_detections.append({
                        'bbox': bbox_global,
                        'confidence': float(box.conf[0]),
                        'class': callout_type,
                        'callout_type': callout_type,
                    })

    merged = merge_detections(all_detections, iou_threshold=0.5)

    # Apply post-processing filters
    if use_filters:
        filter_result = apply_all_filters(merged, verbose=False)
        return filter_result['filtered_detections']

    return merged

def main():
    if len(sys.argv) != 5:
        print("Usage: python generate_detection_json.py <pdf_path> <page_num> <output_json> <output_image>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2])
    output_json = sys.argv[3]
    output_image = sys.argv[4]

    print(f"Loading model {MODEL}...")
    model = YOLO(MODEL)

    print(f"Rendering page {page_num}...")
    image = render_pdf_page(pdf_path, page_num, dpi=72)
    print(f"Image size: {image.shape[1]}x{image.shape[0]}")

    print("Running detection with SAHI...")
    detections = detect_with_sahi(model, image)

    print(f"Found {len(detections)} detections")
    for cls in CLASS_NAMES:
        count = sum(1 for d in detections if d['class'] == cls)
        if count > 0:
            print(f"  {cls}: {count}")

    # Save JSON
    result = {'detections': detections}
    with open(output_json, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Saved JSON to {output_json}")

    # Save raw image (no annotations) for validation script
    cv2.imwrite(output_image, image)
    print(f"Saved image to {output_image}")

if __name__ == "__main__":
    main()
