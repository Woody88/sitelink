#!/usr/bin/env python3
"""
API script for callout detection using v5 model.
Designed to be called from sitelink-interpreter TypeScript code.

Usage:
    python api_detect.py --pdf <path> --page <num> --output <dir> [options]
    python api_detect.py --image <path> --output <dir> [options]

Output:
    Writes detections.json with format:
    {
      "detections": [
        {
          "bbox": [x, y, w, h],
          "class": "detail|elevation|title",
          "confidence": 0.87
        },
        ...
      ]
    }
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import fitz  # PyMuPDF
from ultralytics import YOLO

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))
from sahi_tiling import tile_image, merge_detections
from postprocess_filters import apply_all_filters

# Model path
MODEL_PATH = Path(__file__).parent.parent / "runs/detect/v5_combined2/weights/best.pt"

# Critical parameters - DO NOT CHANGE without retraining
DPI = 72
TILE_SIZE = 2048
OVERLAP = 0.2
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.5

CLASS_NAMES = ["detail", "elevation", "title"]


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = DPI) -> cv2.Mat:
    """Render PDF page to image at specified DPI."""
    doc = fitz.open(pdf_path)

    if page_num < 1 or page_num > len(doc):
        raise ValueError(f"Page {page_num} out of range (1-{len(doc)})")

    page = doc[page_num - 1]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    # Convert PyMuPDF pixmap (RGB) to OpenCV format (BGR)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    # If RGBA, drop alpha channel
    if pix.n == 4:
        img = img[:, :, :3]

    # Convert RGB to BGR for OpenCV
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    doc.close()
    return img


def detect_callouts(
    image: cv2.Mat,
    model: YOLO,
    conf: float = CONF_THRESHOLD,
    iou: float = IOU_THRESHOLD,
    use_filters: bool = True
) -> list[dict]:
    """
    Run SAHI-based detection on image.

    Returns:
        List of detections in format:
        [
          {"bbox": [x,y,w,h], "class": "detail", "confidence": 0.87},
          ...
        ]
    """
    # Tile image
    tiles = tile_image(image, TILE_SIZE, OVERLAP)

    all_detections = []

    for tile, (offset_x, offset_y) in tiles:
        results = model.predict(tile, conf=conf, iou=iou, verbose=False)

        for r in results:
            boxes = r.boxes
            for i in range(len(boxes)):
                box = boxes[i]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                # Adjust to global coordinates
                x1_global = x1 + offset_x
                y1_global = y1 + offset_y
                x2_global = x2 + offset_x
                y2_global = y2 + offset_y

                conf_score = float(box.conf[0])
                cls_id = int(box.cls[0])
                class_name = CLASS_NAMES[cls_id]

                all_detections.append({
                    'bbox': [
                        float(x1_global),
                        float(y1_global),
                        float(x2_global - x1_global),
                        float(y2_global - y1_global)
                    ],
                    'class': class_name,
                    'confidence': conf_score
                })

    # Merge overlapping detections
    merged = merge_detections(all_detections, iou_threshold=iou)

    # Apply post-processing filters
    if use_filters:
        filtered_result = apply_all_filters(merged, verbose=False)
        final_detections = filtered_result['filtered_detections']
    else:
        final_detections = merged

    return final_detections


def main():
    parser = argparse.ArgumentParser(
        description="Detect callouts using v5 model"
    )
    parser.add_argument("--pdf", help="Path to PDF file")
    parser.add_argument("--page", type=int, default=1, help="Page number (1-indexed)")
    parser.add_argument("--image", help="Path to image file")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--conf", type=float, default=CONF_THRESHOLD,
                        help=f"Confidence threshold (default: {CONF_THRESHOLD})")
    parser.add_argument("--no-filters", action="store_true",
                        help="Disable post-processing filters")

    args = parser.parse_args()

    if not args.pdf and not args.image:
        print("Error: Must provide either --pdf or --image", file=sys.stderr)
        sys.exit(1)

    if args.pdf and args.image:
        print("Error: Cannot provide both --pdf and --image", file=sys.stderr)
        sys.exit(1)

    # Load model
    if not MODEL_PATH.exists():
        print(f"Error: Model not found at {MODEL_PATH}", file=sys.stderr)
        sys.exit(1)

    model = YOLO(str(MODEL_PATH))

    # Load image
    if args.pdf:
        print(f"Rendering page {args.page} from {args.pdf} at {DPI} DPI...",
              file=sys.stderr)
        image = render_pdf_page(args.pdf, args.page, DPI)
    else:
        print(f"Loading image from {args.image}...", file=sys.stderr)
        image = cv2.imread(args.image)
        if image is None:
            print(f"Error: Could not load image from {args.image}", file=sys.stderr)
            sys.exit(1)

    print(f"Image size: {image.shape[1]}x{image.shape[0]}", file=sys.stderr)

    # Run detection
    print("Running detection...", file=sys.stderr)
    detections = detect_callouts(
        image,
        model,
        conf=args.conf,
        use_filters=not args.no_filters
    )

    print(f"Found {len(detections)} callouts", file=sys.stderr)

    # Save results
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / "detections.json"
    with open(output_file, 'w') as f:
        json.dump({"detections": detections}, f, indent=2)

    print(f"Saved detections to {output_file}", file=sys.stderr)

    # Print summary to stdout (parseable by TypeScript)
    print(json.dumps({
        "success": True,
        "detections_count": len(detections),
        "output_file": str(output_file),
        "by_class": {
            cls: sum(1 for d in detections if d['class'] == cls)
            for cls in CLASS_NAMES
        }
    }))


if __name__ == "__main__":
    main()
