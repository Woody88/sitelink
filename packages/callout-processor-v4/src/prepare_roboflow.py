#!/usr/bin/env python3
"""
Prepare dataset for Roboflow upload.

1. Convert PDFs to images
2. Run CV detection to get initial bounding boxes
3. Export in Roboflow-compatible format (images + YOLO labels)
"""

import argparse
import json
import os
from pathlib import Path
from typing import List, Dict, Tuple

import cv2
import fitz  # PyMuPDF
import numpy as np

from detect import (
    find_circles_widened,
    check_interior_density,
    check_has_outline,
    check_is_letter_in_word,
    find_small_triangles_near_circle,
    extract_text_inside_circle,
)

CLASS_MAP = {
    'detail': 0,
    'section': 1,
    'elevation': 2,
    'title': 3,
}


def render_pdf_to_images(pdf_path: Path, output_dir: Path, dpi: int = 150) -> List[Path]:
    """Convert PDF pages to images."""
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    image_paths = []

    pdf_name = pdf_path.stem.replace(' ', '_').replace('-', '_')

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Render at specified DPI
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)

        # Convert to numpy array
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)

        # Convert RGB to BGR for OpenCV
        if pix.n == 4:  # RGBA
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:  # RGB
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        # Save image
        image_name = f"{pdf_name}_page_{page_num:02d}.png"
        image_path = output_dir / image_name
        cv2.imwrite(str(image_path), img)
        image_paths.append(image_path)

        print(f"  Rendered page {page_num}: {pix.w}x{pix.h}")

    doc.close()
    return image_paths


def detect_callouts_cv(image: np.ndarray, dpi: int = 150) -> List[Dict]:
    """
    Detect callout candidates using CV only (no LLM).
    Returns bounding boxes with heuristic classification.
    """
    scale = dpi / 300.0
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    detections = []

    # Find circles
    circles = find_circles_widened(gray, dpi)

    for cx, cy, r in circles:
        # Basic filters
        is_valid_interior, whiteness = check_interior_density(gray, cx, cy, r)
        if whiteness < 0.40:
            continue

        has_outline, _ = check_has_outline(gray, cx, cy, r)
        if not has_outline:
            continue

        if check_is_letter_in_word(gray, cx, cy, r):
            continue

        # Find nearby triangles
        nearby_triangles = find_small_triangles_near_circle(
            gray, cx, cy, r,
            search_margin=int(15 * scale),
            min_tri_area=int(40 * scale**2),
            max_tri_area=int(800 * scale**2)
        )

        # Heuristic classification based on triangles
        has_triangles = len(nearby_triangles) > 0
        triangle_positions = [t['position'] for t in nearby_triangles]

        # Simple heuristic:
        # - Triangles pointing up/down = section
        # - Triangle pointing up only = elevation
        # - No triangles = detail
        if has_triangles:
            if 'top' in triangle_positions and 'bottom' in triangle_positions:
                callout_type = 'section'
            elif 'top' in triangle_positions:
                callout_type = 'elevation'
            elif 'bottom' in triangle_positions:
                callout_type = 'section'
            else:
                callout_type = 'section'
        else:
            callout_type = 'detail'

        # OCR for label
        text, conf = extract_text_inside_circle(image, cx, cy, r)

        # Create bounding box with padding
        padding = 1.5
        box_size = r * 2 * padding
        x1 = max(0, int(cx - box_size / 2))
        y1 = max(0, int(cy - box_size / 2))
        x2 = min(w, int(cx + box_size / 2))
        y2 = min(h, int(cy + box_size / 2))

        detections.append({
            'class': callout_type,
            'class_id': CLASS_MAP[callout_type],
            'x1': x1,
            'y1': y1,
            'x2': x2,
            'y2': y2,
            'cx': cx,
            'cy': cy,
            'radius': r,
            'has_triangles': has_triangles,
            'triangle_positions': triangle_positions,
            'ocr_text': text,
            'ocr_confidence': conf,
        })

    return detections


def save_yolo_labels(detections: List[Dict], image_path: Path, labels_dir: Path, img_w: int, img_h: int):
    """Save detections in YOLO format."""
    label_path = labels_dir / f"{image_path.stem}.txt"

    with open(label_path, 'w') as f:
        for det in detections:
            # Convert to normalized YOLO format
            cx = (det['x1'] + det['x2']) / 2 / img_w
            cy = (det['y1'] + det['y2']) / 2 / img_h
            w = (det['x2'] - det['x1']) / img_w
            h = (det['y2'] - det['y1']) / img_h

            f.write(f"{det['class_id']} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")


def process_pdf(pdf_path: Path, output_dir: Path, dpi: int = 150) -> Dict:
    """Process a single PDF: render pages and detect callouts."""
    pdf_name = pdf_path.stem.replace(' ', '_').replace('-', '_')

    images_dir = output_dir / "images"
    labels_dir = output_dir / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nProcessing: {pdf_path.name}")

    # Render PDF to images
    print("  Rendering pages...")
    image_paths = render_pdf_to_images(pdf_path, images_dir, dpi)

    # Detect callouts in each image
    stats = {
        'pdf': pdf_path.name,
        'pages': len(image_paths),
        'total_detections': 0,
        'by_class': {name: 0 for name in CLASS_MAP.keys()},
    }

    for image_path in image_paths:
        print(f"  Detecting in {image_path.name}...")
        image = cv2.imread(str(image_path))
        h, w = image.shape[:2]

        detections = detect_callouts_cv(image, dpi)

        # Save YOLO labels
        save_yolo_labels(detections, image_path, labels_dir, w, h)

        stats['total_detections'] += len(detections)
        for det in detections:
            stats['by_class'][det['class']] += 1

        print(f"    Found {len(detections)} callouts")

    return stats


def create_classes_file(output_dir: Path):
    """Create classes.txt for Roboflow."""
    classes_file = output_dir / "classes.txt"
    with open(classes_file, 'w') as f:
        for name in ['detail', 'section', 'elevation', 'title']:
            f.write(f"{name}\n")


def main():
    parser = argparse.ArgumentParser(description='Prepare dataset for Roboflow')
    parser.add_argument('--pdf-dirs', nargs='+', required=True,
                        help='Directories containing PDFs')
    parser.add_argument('--output', required=True,
                        help='Output directory for Roboflow dataset')
    parser.add_argument('--dpi', type=int, default=150,
                        help='Render DPI (default: 150)')

    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Preparing Dataset for Roboflow")
    print("=" * 60)

    all_stats = []

    # Find all PDFs
    for pdf_dir in args.pdf_dirs:
        pdf_dir = Path(pdf_dir)
        if not pdf_dir.exists():
            print(f"Warning: {pdf_dir} does not exist")
            continue

        for pdf_path in sorted(pdf_dir.glob("*.pdf")):
            stats = process_pdf(pdf_path, output_dir, args.dpi)
            all_stats.append(stats)

    # Create classes.txt
    create_classes_file(output_dir)

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_pages = sum(s['pages'] for s in all_stats)
    total_detections = sum(s['total_detections'] for s in all_stats)

    print(f"PDFs processed: {len(all_stats)}")
    print(f"Total pages: {total_pages}")
    print(f"Total detections: {total_detections}")

    # Aggregate by class
    by_class = {name: 0 for name in CLASS_MAP.keys()}
    for s in all_stats:
        for name, count in s['by_class'].items():
            by_class[name] += count

    print("\nBy class:")
    for name, count in by_class.items():
        print(f"  {name}: {count}")

    print(f"\nOutput directory: {output_dir}")
    print(f"  images/  - {total_pages} PNG images")
    print(f"  labels/  - {total_pages} YOLO label files")
    print(f"  classes.txt - class names")

    print("\n" + "=" * 60)
    print("Ready for Roboflow Upload!")
    print("=" * 60)
    print("""
Next steps:
1. Go to https://roboflow.com
2. Create new project → Object Detection
3. Upload the 'images/' folder
4. Import annotations: labels/ folder (YOLO format)
5. Review and correct labels using Annotation tool
6. Export as 'YOLO v8' format
""")


if __name__ == '__main__':
    main()
