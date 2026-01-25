"""
Fine-tuned YOLOv8 Callout Detection with SAHI

Uses the trained YOLO model from v4 (supervised learning on 58 images)
with SAHI tiling for improved small object detection.

This serves as the baseline for comparison - v4 achieved 67% recall
at 72 DPI full-page inference with SAHI-like tiling.
"""

import json
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List
from ultralytics import YOLO

from sahi_tiling import tile_image, merge_detections, adjust_coordinates, TILE_SIZE, OVERLAP
from postprocess_filters import apply_all_filters


CLASS_NAMES = ["detail", "elevation", "title"]


def detect_callouts_finetuned(
    image_path: str,
    weights_path: str = "weights/callout_detector.pt",
    tile_size: int = TILE_SIZE,
    overlap: float = OVERLAP,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.5,
    output_path: str = None,
    use_filters: bool = True,
) -> Dict:
    """
    Detect callouts using fine-tuned YOLO with SAHI tiling.

    Args:
        image_path: Path to plan image
        weights_path: Path to fine-tuned weights (default: v4 weights)
        tile_size: Tile size in pixels (default: 2048)
        overlap: Overlap ratio 0-1 (default: 0.25)
        conf_threshold: Confidence threshold (default: 0.25)
        iou_threshold: IoU threshold for NMS (default: 0.5)
        output_path: Optional path to save annotated image

    Returns:
        Dictionary with detections and metadata
    """
    model = YOLO(weights_path)

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not load image: {image_path}")

    tiles = tile_image(image, tile_size, overlap)
    print(f"Generated {len(tiles)} tiles for fine-tuned YOLO detection")

    all_detections = []
    for i, (tile, offset) in enumerate(tiles):
        print(f"Processing tile {i+1}/{len(tiles)}...", end='\r')

        results = model.predict(tile, conf=conf_threshold, iou=iou_threshold, verbose=False)

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
                        'method': 'yolo_finetuned_sahi',
                        'image_path': image_path,
                        'tile_index': i
                    })

    print(f"\nDetected {len(all_detections)} callouts before NMS")

    merged = merge_detections(all_detections, iou_threshold=0.5)
    print(f"After NMS: {len(merged)} callouts")

    # Apply post-processing filters
    if use_filters:
        filter_result = apply_all_filters(merged, verbose=True)
        merged = filter_result['filtered_detections']
        filter_stats = filter_result['filter_stats']
    else:
        filter_stats = None

    if output_path:
        _save_annotated(image, merged, output_path)
        print(f"Annotated image saved: {output_path}")

    metadata = {
        "model": str(Path(weights_path).name),
        "method": "yolo_finetuned_sahi",
        "conf_threshold": conf_threshold,
        "iou_threshold": iou_threshold,
        "tile_size": tile_size,
        "overlap": overlap,
        "num_tiles": len(tiles),
        "num_detections": len(merged),
        "class_names": CLASS_NAMES,
        "post_processing_enabled": use_filters,
        "filter_stats": filter_stats
    }

    return {
        "detections": merged,
        "metadata": metadata,
    }


def _save_annotated(image: np.ndarray, detections: List[Dict], output_path: str):
    """Save annotated image with detection boxes."""
    vis = image.copy()

    colors = {
        'detail': (255, 0, 0),
        'elevation': (0, 255, 0),
        'section': (0, 0, 255),
        'title': (255, 165, 0)
    }

    for det in detections:
        x, y, w, h = det['bbox']
        x, y, w, h = int(x), int(y), int(w), int(h)

        color = colors.get(det['callout_type'], (255, 255, 255))

        cv2.rectangle(vis, (x, y), (x+w, y+h), color, 3)

        label = f"{det['callout_type']}: {det['confidence']:.2f}"
        cv2.putText(vis, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    cv2.imwrite(output_path, vis)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fine-tuned YOLO Callout Detection with SAHI")
    parser.add_argument("image", help="Path to plan image")
    parser.add_argument("--weights", default="weights/callout_detector.pt", help="Path to weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.5, help="IoU threshold")
    parser.add_argument("--output", help="Path to save annotated image")
    parser.add_argument("--output-json", help="Path to save detection JSON")
    parser.add_argument("--no-filters", action="store_true", help="Disable post-processing filters")

    args = parser.parse_args()

    results = detect_callouts_finetuned(
        args.image,
        weights_path=args.weights,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        output_path=args.output,
        use_filters=not args.no_filters
    )

    if args.output_json:
        with open(args.output_json, 'w') as f:
            json.dump(results, f, indent=2)

    print(f"\n=== Detection Summary ===")
    print(f"Total detections: {len(results['detections'])}")
    by_class = {}
    for det in results['detections']:
        cls = det['callout_type']
        by_class[cls] = by_class.get(cls, 0) + 1
    for cls, count in sorted(by_class.items()):
        print(f"  {cls}: {count}")
