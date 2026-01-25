#!/usr/bin/env python3
"""
Test v5 model with SAHI tiling (v4's proven approach).
"""

import sys
import cv2
import numpy as np
from pathlib import Path
import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent / 'src'))
from sahi_tiling import tile_image, merge_detections, adjust_coordinates, TILE_SIZE, OVERLAP
from detect_yolo_finetuned import _save_annotated
from postprocess_filters import apply_all_filters

from ultralytics import YOLO

MODEL = 'runs/detect/v5_combined2/weights/best.pt'
PLAN_4PAGE = '/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf'
PLAN_8PAGE = '/home/woodson/Code/projects/sitelink/apps/RTA_DRAWRING_8_PAGE_PLAN.pdf'
OUTPUT_DIR = Path('test_v5_sahi_output')
DPI = 72  # v4's proven setting
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
    print(f"  Generated {len(tiles)} tiles")

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

    print(f"  Before NMS: {len(all_detections)} detections")

    merged = merge_detections(all_detections, iou_threshold=0.5)
    print(f"  After NMS: {len(merged)} detections")

    # Apply post-processing filters
    if use_filters:
        print(f"  Applying post-processing filters...")
        filter_result = apply_all_filters(merged, verbose=True)
        filtered = filter_result['filtered_detections']
        stats = filter_result['filter_stats']
        print(f"  After filters: {len(filtered)} detections")
        print(f"    Removed: {stats['original'] - stats['final']} "
              f"(size: {stats['removed_by_size']}, "
              f"aspect: {stats['removed_by_aspect']}, "
              f"area: {stats['removed_by_area']}, "
              f"class: {stats['removed_by_class']})")
        return filtered

    return merged

def test_plan(model, pdf_path, plan_name, start_page, end_page, output_dir):
    """Test model on PDF pages."""
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"{plan_name} (pages {start_page}-{end_page})")
    print(f"{'='*60}")

    total_detections = {'detail': 0, 'elevation': 0, 'title': 0}

    for page_num in range(start_page, end_page + 1):
        print(f"\nPage {page_num}:")

        image = render_pdf_page(pdf_path, page_num, DPI)
        print(f"  Rendered: {image.shape[1]}x{image.shape[0]}")

        detections = detect_with_sahi(model, image)

        for det in detections:
            cls = det['callout_type']
            total_detections[cls] = total_detections.get(cls, 0) + 1

        print(f"  Final: {len(detections)} total")
        print(f"    Detail: {sum(1 for d in detections if d['callout_type'] == 'detail')}")
        print(f"    Elevation: {sum(1 for d in detections if d['callout_type'] == 'elevation')}")
        print(f"    Title: {sum(1 for d in detections if d['callout_type'] == 'title')}")

        output_path = output_dir / f"page{page_num}_annotated.png"
        _save_annotated(image, detections, str(output_path))
        print(f"  Saved: {output_path.name}")

    return total_detections

def main():
    print("="*60)
    print("v5 Model Testing with SAHI (v4 approach)")
    print("="*60)
    print(f"Model: {MODEL}")
    print(f"DPI: {DPI}")
    print(f"Tile size: {TILE_SIZE}px")
    print(f"Overlap: {OVERLAP}")
    print(f"Confidence: 0.25")
    print("="*60)

    print("\nLoading model...")
    model = YOLO(MODEL)
    print("✓ Model loaded\n")

    # Test 4-page Canadian plan (pages 2-4)
    output_4page = OUTPUT_DIR / '4page_canadian'
    totals_4page = test_plan(
        model, PLAN_4PAGE, "4-Page Canadian Plan",
        2, 4, output_4page
    )

    # Test 8-page US plan (pages 2-8)
    output_8page = OUTPUT_DIR / '8page_us'
    totals_8page = test_plan(
        model, PLAN_8PAGE, "8-Page US Plan",
        2, 8, output_8page
    )

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"\n4-Page Canadian Plan (pages 2-4):")
    for cls, count in sorted(totals_4page.items()):
        print(f"  {cls}: {count}")
    print(f"  TOTAL: {sum(totals_4page.values())}")

    print(f"\n8-Page US Plan (pages 2-8):")
    for cls, count in sorted(totals_8page.items()):
        print(f"  {cls}: {count}")
    print(f"  TOTAL: {sum(totals_8page.values())}")

    print(f"\nResults saved to: {OUTPUT_DIR.absolute()}")

if __name__ == '__main__':
    main()
