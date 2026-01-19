#!/usr/bin/env python3
"""
Run YOLO inference on test images with SAHI-style tiled inference.

This handles large images by:
1. Tiling the image into overlapping patches
2. Running inference on each patch
3. Merging detections with NMS
"""

import argparse
import json
from pathlib import Path
from typing import List, Dict, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

CLASS_NAMES = ['detail', 'section', 'elevation', 'title']
CLASS_COLORS = {
    'detail': (255, 0, 0),      # Blue
    'section': (128, 0, 128),   # Purple
    'elevation': (0, 165, 255), # Orange
    'title': (0, 128, 0),       # Green
}


def tile_inference(
    model: YOLO,
    image: np.ndarray,
    tile_size: int = 640,
    overlap: float = 0.25,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.5
) -> List[Dict]:
    """
    Run tiled inference on a large image.
    """
    h, w = image.shape[:2]
    stride = int(tile_size * (1 - overlap))

    all_detections = []

    # Generate tiles
    for y in range(0, max(1, h - tile_size + 1), stride):
        for x in range(0, max(1, w - tile_size + 1), stride):
            # Extract tile
            tile = image[y:y+tile_size, x:x+tile_size]

            # Run inference
            results = model(tile, conf=conf_threshold, verbose=False)

            # Extract detections
            for r in results:
                boxes = r.boxes
                for i in range(len(boxes)):
                    box = boxes[i]
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy()

                    # Convert to full image coordinates
                    x1, y1, x2, y2 = xyxy
                    x1 += x
                    y1 += y
                    x2 += x
                    y2 += y

                    all_detections.append({
                        'class': cls,
                        'class_name': CLASS_NAMES[cls],
                        'confidence': conf,
                        'x1': int(x1),
                        'y1': int(y1),
                        'x2': int(x2),
                        'y2': int(y2),
                    })

    # Also include edge tiles
    if w > tile_size:
        x = w - tile_size
        for y in range(0, max(1, h - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]
            results = model(tile, conf=conf_threshold, verbose=False)
            for r in results:
                boxes = r.boxes
                for i in range(len(boxes)):
                    box = boxes[i]
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy
                    x1 += x
                    y1 += y
                    x2 += x
                    y2 += y
                    all_detections.append({
                        'class': cls,
                        'class_name': CLASS_NAMES[cls],
                        'confidence': conf,
                        'x1': int(x1),
                        'y1': int(y1),
                        'x2': int(x2),
                        'y2': int(y2),
                    })

    if h > tile_size:
        y = h - tile_size
        for x in range(0, max(1, w - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]
            results = model(tile, conf=conf_threshold, verbose=False)
            for r in results:
                boxes = r.boxes
                for i in range(len(boxes)):
                    box = boxes[i]
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy
                    x1 += x
                    y1 += y
                    x2 += x
                    y2 += y
                    all_detections.append({
                        'class': cls,
                        'class_name': CLASS_NAMES[cls],
                        'confidence': conf,
                        'x1': int(x1),
                        'y1': int(y1),
                        'x2': int(x2),
                        'y2': int(y2),
                    })

    # Apply NMS to remove duplicates
    if not all_detections:
        return []

    # Group by class
    by_class = {}
    for det in all_detections:
        cls = det['class']
        if cls not in by_class:
            by_class[cls] = []
        by_class[cls].append(det)

    # NMS per class
    final_detections = []
    for cls, dets in by_class.items():
        boxes = np.array([[d['x1'], d['y1'], d['x2'], d['y2']] for d in dets])
        scores = np.array([d['confidence'] for d in dets])

        # Use OpenCV NMS
        indices = cv2.dnn.NMSBoxes(
            boxes.tolist(),
            scores.tolist(),
            conf_threshold,
            iou_threshold
        )

        if len(indices) > 0:
            indices = indices.flatten()
            for idx in indices:
                final_detections.append(dets[idx])

    return final_detections


def draw_detections(
    image: np.ndarray,
    detections: List[Dict],
    line_thickness: int = 2
) -> np.ndarray:
    """Draw detections on image."""
    annotated = image.copy()

    for det in detections:
        cls_name = det['class_name']
        conf = det['confidence']
        x1, y1, x2, y2 = det['x1'], det['y1'], det['x2'], det['y2']

        color = CLASS_COLORS.get(cls_name, (0, 0, 255))

        # Draw box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, line_thickness)

        # Draw label
        label = f"{cls_name} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x1, y1 - th - 4), (x1 + tw, y1), color, -1)
        cv2.putText(annotated, label, (x1, y1 - 2),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    return annotated


def main():
    parser = argparse.ArgumentParser(description='YOLO inference with tiling')
    parser.add_argument('--model', default='weights/callout_detector.pt',
                        help='Model weights path')
    parser.add_argument('--image', required=True, help='Input image path')
    parser.add_argument('--output', default=None, help='Output image path')
    parser.add_argument('--tile-size', type=int, default=640, help='Tile size')
    parser.add_argument('--overlap', type=float, default=0.25, help='Overlap fraction')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    parser.add_argument('--iou', type=float, default=0.5, help='NMS IoU threshold')
    parser.add_argument('--json', default=None, help='Output JSON path for detections')

    args = parser.parse_args()

    # Load model
    print(f"Loading model: {args.model}")
    model = YOLO(args.model)

    # Load image
    print(f"Loading image: {args.image}")
    image = cv2.imread(args.image)
    if image is None:
        print(f"Error: Could not load image {args.image}")
        return

    h, w = image.shape[:2]
    print(f"Image size: {w}x{h}")

    # Run inference
    print(f"Running tiled inference (tile={args.tile_size}, overlap={args.overlap})...")
    detections = tile_inference(
        model, image,
        tile_size=args.tile_size,
        overlap=args.overlap,
        conf_threshold=args.conf,
        iou_threshold=args.iou
    )

    print(f"\nDetected {len(detections)} callouts:")

    # Count by class
    by_class = {}
    for det in detections:
        cls = det['class_name']
        by_class[cls] = by_class.get(cls, 0) + 1

    for cls, count in sorted(by_class.items()):
        print(f"  {cls}: {count}")

    # Draw and save
    if args.output:
        annotated = draw_detections(image, detections)
        cv2.imwrite(args.output, annotated)
        print(f"\nAnnotated image saved to: {args.output}")

    # Save JSON
    if args.json:
        # Convert to serializable format
        output_data = {
            'image': args.image,
            'width': w,
            'height': h,
            'detections': detections,
            'summary': by_class,
        }
        with open(args.json, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"Detections saved to: {args.json}")


if __name__ == '__main__':
    main()
