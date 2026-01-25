#!/usr/bin/env python3
"""
Comprehensive batch validation for YOLO and YOLOE models.

Validates models against ground truth annotations with:
- SAHI tiling (2048px tiles, 0.2 overlap)
- Production post-processing filters
- IoU-based matching (threshold: 0.5)
- YOLOE support with text prompts
- Per-class, per-image, and overall metrics
- Confusion matrix generation
"""

import sys
import json
import csv
import cv2
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'src'))
from sahi_tiling import tile_image, merge_detections, adjust_coordinates, TILE_SIZE, OVERLAP
from postprocess_filters import apply_all_filters

from ultralytics import YOLO


CLASS_NAMES = ["detail", "elevation", "title"]


def parse_yolo_annotation(annotation_path: str, image_width: int, image_height: int) -> List[Dict]:
    """
    Parse YOLO format annotation file.

    Supports two formats:
    - Bbox format: <class_id> <x_center> <y_center> <width> <height>
    - Polygon format: <class_id> <x1> <y1> <x2> <y2> <x3> <y3> <x4> <y4> ...

    All values normalized (0-1)

    Returns:
        List of {'bbox': [x, y, w, h], 'class': str}
    """
    callouts = []

    with open(annotation_path) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue

            class_id = int(parts[0])
            coords = [float(p) for p in parts[1:]]

            # Detect format: bbox has 4 values, polygon has 8+ values
            if len(coords) == 4:
                # Bbox format: x_center, y_center, width, height
                x_center, y_center, width, height = coords

                # Convert from normalized center coords to pixel xywh
                x_center_px = x_center * image_width
                y_center_px = y_center * image_height
                width_px = width * image_width
                height_px = height * image_height

                x1 = x_center_px - width_px / 2
                y1 = y_center_px - height_px / 2

                bbox = [x1, y1, width_px, height_px]

            else:
                # Polygon format: x1, y1, x2, y2, x3, y3, ...
                # Extract x and y coordinates
                xs = [coords[i] * image_width for i in range(0, len(coords), 2)]
                ys = [coords[i] * image_height for i in range(1, len(coords), 2)]

                # Calculate bounding box from polygon
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)

                x1 = x_min
                y1 = y_min
                width_px = x_max - x_min
                height_px = y_max - y_min

                bbox = [x1, y1, width_px, height_px]

            callout_type = CLASS_NAMES[class_id] if class_id < len(CLASS_NAMES) else f"class_{class_id}"

            callouts.append({
                'bbox': bbox,
                'class': callout_type
            })

    return callouts


def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """Calculate IoU between two boxes in [x, y, w, h] format."""
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2

    # Convert to xyxy
    x1_max = x1 + w1
    y1_max = y1 + h1
    x2_max = x2 + w2
    y2_max = y2 + h2

    # Intersection
    xi1 = max(x1, x2)
    yi1 = max(y1, y2)
    xi2 = min(x1_max, x2_max)
    yi2 = min(y1_max, y2_max)

    inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)

    # Union
    box1_area = w1 * h1
    box2_area = w2 * h2
    union_area = box1_area + box2_area - inter_area

    return inter_area / union_area if union_area > 0 else 0


def match_detections(
    detections: List[Dict],
    ground_truth: List[Dict],
    iou_threshold: float = 0.5
) -> Tuple[List, List, List]:
    """
    Match detections to ground truth.

    Returns:
        (true_positives, false_positives, false_negatives)
        Each TP contains: {'detection': det, 'ground_truth': gt, 'iou': iou}
    """
    gt_matched = [False] * len(ground_truth)
    det_matched = [False] * len(detections)

    true_positives = []

    # Match detections to GT
    for i, det in enumerate(detections):
        best_iou = 0
        best_gt_idx = -1

        for j, gt in enumerate(ground_truth):
            if gt_matched[j]:
                continue

            # Only match same class
            if det['class'] != gt['class']:
                continue

            iou = calculate_iou(det['bbox'], gt['bbox'])
            if iou > best_iou:
                best_iou = iou
                best_gt_idx = j

        if best_iou >= iou_threshold:
            gt_matched[best_gt_idx] = True
            det_matched[i] = True
            true_positives.append({
                'detection': det,
                'ground_truth': ground_truth[best_gt_idx],
                'iou': best_iou
            })

    # Unmatched detections = false positives
    false_positives = [detections[i] for i, matched in enumerate(det_matched) if not matched]

    # Unmatched GT = false negatives
    false_negatives = [ground_truth[i] for i, matched in enumerate(gt_matched) if not matched]

    return true_positives, false_positives, false_negatives


def run_yolo_inference(
    model: YOLO,
    image: np.ndarray,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.5,
    use_sahi: bool = True,
    use_filters: bool = True
) -> List[Dict]:
    """
    Run YOLO inference with optional SAHI tiling and post-processing.

    Args:
        model: YOLO model instance
        image: Input image (BGR numpy array)
        conf_threshold: Confidence threshold
        iou_threshold: IoU threshold for NMS
        use_sahi: Whether to use SAHI tiling
        use_filters: Whether to apply post-processing filters

    Returns:
        List of detections with 'bbox', 'confidence', 'class'
    """
    if not use_sahi:
        # Direct inference without tiling
        results = model.predict(image, conf=conf_threshold, iou=iou_threshold, verbose=False)

        detections = []
        if results and len(results) > 0:
            result = results[0]
            if hasattr(result, 'boxes') and result.boxes is not None:
                for j in range(len(result.boxes)):
                    box = result.boxes[j]
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy

                    bbox = [float(x1), float(y1), float(x2-x1), float(y2-y1)]

                    cls_id = int(box.cls[0])
                    callout_type = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}"

                    detections.append({
                        'bbox': bbox,
                        'confidence': float(box.conf[0]),
                        'class': callout_type,
                        'callout_type': callout_type,
                    })
    else:
        # SAHI tiling approach
        tiles = tile_image(image, TILE_SIZE, OVERLAP)

        all_detections = []
        for i, (tile, offset) in enumerate(tiles):
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
                        })

        detections = merge_detections(all_detections, iou_threshold=0.5)

    # Apply post-processing filters
    if use_filters:
        filter_result = apply_all_filters(detections, verbose=False)
        detections = filter_result['filtered_detections']

    return detections


def run_yoloe_inference(
    model: YOLO,
    image: np.ndarray,
    text_prompts: Dict[str, str],
    conf_threshold: float = 0.05,
    iou_threshold: float = 0.5,
    use_sahi: bool = True,
    use_filters: bool = True
) -> List[Dict]:
    """
    Run YOLOE inference with text prompts.

    Args:
        model: YOLOE model instance
        image: Input image (BGR numpy array)
        text_prompts: Dict mapping class names to text descriptions
        conf_threshold: Confidence threshold
        iou_threshold: IoU threshold for NMS
        use_sahi: Whether to use SAHI tiling
        use_filters: Whether to apply post-processing filters

    Returns:
        List of detections with 'bbox', 'confidence', 'class'
    """
    class_names = list(text_prompts.keys())
    text_descriptions = [text_prompts[cls] for cls in class_names]

    # Set classes with text prompts
    model.set_classes(class_names, model.get_text_pe(text_descriptions))

    if not use_sahi:
        # Direct inference without tiling
        results = model.predict(image, conf=conf_threshold, iou=iou_threshold, verbose=False)

        detections = []
        if results and len(results) > 0:
            result = results[0]
            if hasattr(result, 'boxes') and result.boxes is not None:
                for j in range(len(result.boxes)):
                    box = result.boxes[j]
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy

                    bbox = [float(x1), float(y1), float(x2-x1), float(y2-y1)]

                    cls_id = int(box.cls[0])
                    callout_type = class_names[cls_id] if cls_id < len(class_names) else "unknown"

                    detections.append({
                        'bbox': bbox,
                        'confidence': float(box.conf[0]),
                        'class': callout_type,
                        'callout_type': callout_type,
                    })
    else:
        # SAHI tiling approach
        tiles = tile_image(image, TILE_SIZE, OVERLAP)

        all_detections = []
        for i, (tile, offset) in enumerate(tiles):
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
                        callout_type = class_names[cls_id] if cls_id < len(class_names) else "unknown"

                        all_detections.append({
                            'bbox': bbox_global,
                            'confidence': float(box.conf[0]),
                            'class': callout_type,
                            'callout_type': callout_type,
                        })

        detections = merge_detections(all_detections, iou_threshold=0.5)

    # Apply post-processing filters
    if use_filters:
        filter_result = apply_all_filters(detections, verbose=False)
        detections = filter_result['filtered_detections']

    return detections


def calculate_metrics(matches: List, ground_truth: List, predictions: List) -> Dict:
    """
    Calculate comprehensive metrics from matches.

    Args:
        matches: List of (tp, fp, fn) tuples per image
        ground_truth: All ground truth boxes across images
        predictions: All prediction boxes across images

    Returns:
        Dict with overall and per-class metrics
    """
    # Aggregate all matches
    all_tp = []
    all_fp = []
    all_fn = []

    for tp, fp, fn in matches:
        all_tp.extend(tp)
        all_fp.extend(fp)
        all_fn.extend(fn)

    # Overall metrics
    tp_count = len(all_tp)
    fp_count = len(all_fp)
    fn_count = len(all_fn)

    precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0
    recall = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    # Per-class metrics
    by_class = {}
    for class_name in CLASS_NAMES:
        class_tp = [t for t in all_tp if t['detection']['class'] == class_name]
        class_fp = [f for f in all_fp if f['class'] == class_name]
        class_fn = [f for f in all_fn if f['class'] == class_name]

        class_tp_count = len(class_tp)
        class_fp_count = len(class_fp)
        class_fn_count = len(class_fn)

        class_precision = class_tp_count / (class_tp_count + class_fp_count) if (class_tp_count + class_fp_count) > 0 else 0
        class_recall = class_tp_count / (class_tp_count + class_fn_count) if (class_tp_count + class_fn_count) > 0 else 0
        class_f1 = 2 * class_precision * class_recall / (class_precision + class_recall) if (class_precision + class_recall) > 0 else 0

        by_class[class_name] = {
            'precision': class_precision,
            'recall': class_recall,
            'f1': class_f1,
            'tp': class_tp_count,
            'fp': class_fp_count,
            'fn': class_fn_count,
            'gt_count': class_tp_count + class_fn_count
        }

    return {
        'overall': {
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'tp': tp_count,
            'fp': fp_count,
            'fn': fn_count,
            'gt_total': len(ground_truth),
            'det_total': len(predictions)
        },
        'by_class': by_class
    }


def generate_confusion_matrix(matches: List, output_path: str):
    """
    Generate and save confusion matrix visualization.

    Args:
        matches: List of (tp, fp, fn) tuples per image
        output_path: Path to save confusion matrix PNG
    """
    # Aggregate all matches
    all_tp = []
    all_fp = []
    all_fn = []

    for tp, fp, fn in matches:
        all_tp.extend(tp)
        all_fp.extend(fp)
        all_fn.extend(fn)

    # Build confusion matrix
    # Rows = Ground Truth, Cols = Predictions
    # Add "None" for FP/FN cases
    classes = CLASS_NAMES + ["None"]
    n_classes = len(classes)

    confusion = np.zeros((n_classes, n_classes), dtype=int)

    # True positives - diagonal entries
    for tp in all_tp:
        gt_class = tp['ground_truth']['class']
        pred_class = tp['detection']['class']
        gt_idx = CLASS_NAMES.index(gt_class) if gt_class in CLASS_NAMES else -1
        pred_idx = CLASS_NAMES.index(pred_class) if pred_class in CLASS_NAMES else -1

        if gt_idx >= 0 and pred_idx >= 0:
            confusion[gt_idx, pred_idx] += 1

    # False negatives - last column (predicted as None)
    for fn in all_fn:
        gt_class = fn['class']
        gt_idx = CLASS_NAMES.index(gt_class) if gt_class in CLASS_NAMES else -1

        if gt_idx >= 0:
            confusion[gt_idx, -1] += 1

    # False positives - last row (ground truth is None)
    for fp in all_fp:
        pred_class = fp['class']
        pred_idx = CLASS_NAMES.index(pred_class) if pred_class in CLASS_NAMES else -1

        if pred_idx >= 0:
            confusion[-1, pred_idx] += 1

    # Create visualization
    fig, ax = plt.subplots(figsize=(10, 8))

    # Create heatmap
    im = ax.imshow(confusion, cmap='Blues', aspect='auto')

    # Add colorbar
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Count', rotation=270, labelpad=20)

    # Set ticks and labels
    ax.set_xticks(np.arange(n_classes))
    ax.set_yticks(np.arange(n_classes))
    ax.set_xticklabels(classes)
    ax.set_yticklabels(classes)

    # Rotate x labels
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    # Add text annotations
    for i in range(n_classes):
        for j in range(n_classes):
            text = ax.text(j, i, confusion[i, j],
                          ha="center", va="center",
                          color="white" if confusion[i, j] > confusion.max() / 2 else "black")

    ax.set_xlabel('Predicted')
    ax.set_ylabel('Ground Truth')
    ax.set_title('Confusion Matrix')
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"Confusion matrix saved: {output_path}")


def discover_validation_images(dataset_path: str) -> List[Tuple[str, str]]:
    """
    Auto-discover validation images with ground truth annotations.

    Args:
        dataset_path: Path to dataset directory with train/ subdirectory

    Returns:
        List of (image_path, annotation_path) tuples
    """
    dataset_path = Path(dataset_path)

    # Check for train/images and train/labels
    images_dir = dataset_path / 'train' / 'images'
    labels_dir = dataset_path / 'train' / 'labels'

    if not images_dir.exists() or not labels_dir.exists():
        raise FileNotFoundError(f"Expected train/images and train/labels in {dataset_path}")

    pairs = []

    for img_file in sorted(images_dir.glob('*.jpg')):
        # Find corresponding label file
        label_file = labels_dir / f"{img_file.stem}.txt"

        if label_file.exists():
            pairs.append((str(img_file), str(label_file)))

    return pairs


def run_batch_validation(
    model_path: str,
    dataset_path: str,
    output_dir: str,
    use_prompts: bool = False,
    prompts: Optional[Dict[str, str]] = None,
    iteration: Optional[int] = None,
    conf_threshold: float = 0.25,
    use_sahi: bool = True,
    use_filters: bool = True,
    max_images: Optional[int] = None
) -> Dict:
    """
    Run batch validation across all images.

    Args:
        model_path: Path to YOLO/YOLOE model weights
        dataset_path: Path to dataset directory
        output_dir: Output directory for metrics
        use_prompts: Whether to use YOLOE with text prompts
        prompts: Dict mapping class names to text descriptions (for YOLOE)
        iteration: Iteration number for output organization
        conf_threshold: Confidence threshold
        use_sahi: Whether to use SAHI tiling
        use_filters: Whether to apply post-processing filters
        max_images: Optional limit on number of images to validate

    Returns:
        Dict with comprehensive metrics
    """
    print(f"\n{'='*80}")
    print(f"BATCH VALIDATION")
    print(f"{'='*80}")
    print(f"Model: {model_path}")
    print(f"Dataset: {dataset_path}")
    print(f"Method: {'YOLOE (text prompts)' if use_prompts else 'YOLO'}")
    print(f"SAHI: {use_sahi}, Filters: {use_filters}")
    print(f"Confidence threshold: {conf_threshold}")
    print(f"{'='*80}\n")

    # Load model
    print("Loading model...")
    model = YOLO(model_path)

    # Discover validation images
    print("Discovering validation images...")
    image_annotation_pairs = discover_validation_images(dataset_path)

    if max_images:
        image_annotation_pairs = image_annotation_pairs[:max_images]

    print(f"Found {len(image_annotation_pairs)} images with annotations\n")

    # Run validation on each image
    matches = []
    per_image_metrics = []
    all_ground_truth = []
    all_predictions = []

    for idx, (image_path, annotation_path) in enumerate(image_annotation_pairs):
        print(f"[{idx+1}/{len(image_annotation_pairs)}] Processing {Path(image_path).name}...", end=' ')

        # Load image
        image = cv2.imread(image_path)
        if image is None:
            print("ERROR: Could not load image")
            continue

        height, width = image.shape[:2]

        # Load ground truth
        ground_truth = parse_yolo_annotation(annotation_path, width, height)
        all_ground_truth.extend(ground_truth)

        # Run inference
        if use_prompts and prompts:
            detections = run_yoloe_inference(
                model, image, prompts,
                conf_threshold=conf_threshold,
                iou_threshold=0.5,
                use_sahi=use_sahi,
                use_filters=use_filters
            )
        else:
            detections = run_yolo_inference(
                model, image,
                conf_threshold=conf_threshold,
                iou_threshold=0.5,
                use_sahi=use_sahi,
                use_filters=use_filters
            )

        all_predictions.extend(detections)

        # Match detections
        tp, fp, fn = match_detections(detections, ground_truth, iou_threshold=0.5)
        matches.append((tp, fp, fn))

        # Per-image metrics
        tp_count = len(tp)
        fp_count = len(fp)
        fn_count = len(fn)

        precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0
        recall = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

        per_image_metrics.append({
            'image': Path(image_path).name,
            'gt_count': len(ground_truth),
            'det_count': len(detections),
            'tp': tp_count,
            'fp': fp_count,
            'fn': fn_count,
            'precision': precision,
            'recall': recall,
            'f1': f1
        })

        print(f"GT:{len(ground_truth)} Det:{len(detections)} TP:{tp_count} FP:{fp_count} FN:{fn_count} P:{precision:.1%} R:{recall:.1%} F1:{f1:.1%}")

    # Calculate overall metrics
    print("\nCalculating overall metrics...")
    metrics = calculate_metrics(matches, all_ground_truth, all_predictions)

    # Add timestamp and configuration
    metrics['timestamp'] = datetime.now().isoformat()
    metrics['config'] = {
        'model_path': model_path,
        'dataset_path': dataset_path,
        'use_prompts': use_prompts,
        'prompts': prompts if use_prompts else None,
        'conf_threshold': conf_threshold,
        'use_sahi': use_sahi,
        'use_filters': use_filters,
        'num_images': len(image_annotation_pairs)
    }
    metrics['per_image'] = per_image_metrics

    # Create output directory
    output_path = Path(output_dir)
    if iteration is not None:
        output_path = output_path / f"iteration_{iteration}"
    output_path.mkdir(parents=True, exist_ok=True)

    # Save validation report JSON
    report_path = output_path / 'validation_report.json'
    with open(report_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"\nValidation report saved: {report_path}")

    # Save per-image metrics CSV
    csv_path = output_path / 'per_image_metrics.csv'
    with open(csv_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['image', 'gt_count', 'det_count', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1'])
        writer.writeheader()
        writer.writerows(per_image_metrics)
    print(f"Per-image metrics saved: {csv_path}")

    # Generate confusion matrix
    confusion_path = output_path / 'confusion_matrix.png'
    generate_confusion_matrix(matches, str(confusion_path))

    # Print summary
    print(f"\n{'='*80}")
    print("VALIDATION SUMMARY")
    print(f"{'='*80}")
    print(f"\nOverall Metrics:")
    print(f"  Precision: {metrics['overall']['precision']:.1%}")
    print(f"  Recall:    {metrics['overall']['recall']:.1%}")
    print(f"  F1 Score:  {metrics['overall']['f1']:.1%}")
    print(f"\n  TP: {metrics['overall']['tp']}, FP: {metrics['overall']['fp']}, FN: {metrics['overall']['fn']}")
    print(f"  Ground Truth: {metrics['overall']['gt_total']}, Predictions: {metrics['overall']['det_total']}")

    print(f"\nPer-Class Metrics:")
    print(f"  {'Class':<12} {'Precision':<12} {'Recall':<12} {'F1':<12} {'TP':<6} {'FP':<6} {'FN':<6} {'GT':<6}")
    print(f"  {'-'*78}")

    for class_name, class_metrics in metrics['by_class'].items():
        print(f"  {class_name:<12} "
              f"{class_metrics['precision']:<12.1%} "
              f"{class_metrics['recall']:<12.1%} "
              f"{class_metrics['f1']:<12.1%} "
              f"{class_metrics['tp']:<6} "
              f"{class_metrics['fp']:<6} "
              f"{class_metrics['fn']:<6} "
              f"{class_metrics['gt_count']:<6}")

    print(f"\n{'='*80}\n")

    return metrics


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Batch validation for YOLO/YOLOE models")
    parser.add_argument("model", help="Path to model weights (.pt)")
    parser.add_argument("dataset", help="Path to dataset directory")
    parser.add_argument("--output", default="metrics", help="Output directory for metrics")
    parser.add_argument("--iteration", type=int, help="Iteration number for output organization")
    parser.add_argument("--yoloe", action="store_true", help="Use YOLOE with text prompts")
    parser.add_argument("--prompts-json", help="Path to JSON file with text prompts for YOLOE")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--no-sahi", action="store_true", help="Disable SAHI tiling")
    parser.add_argument("--no-filters", action="store_true", help="Disable post-processing filters")
    parser.add_argument("--max-images", type=int, help="Maximum number of images to validate")

    args = parser.parse_args()

    # Load text prompts if using YOLOE
    prompts = None
    if args.yoloe:
        if not args.prompts_json:
            print("ERROR: --prompts-json required when using --yoloe")
            sys.exit(1)

        with open(args.prompts_json) as f:
            prompts_data = json.load(f)

        # Extract text prompts from JSON
        prompts = {}
        for class_name, class_data in prompts_data.get('callout_types', {}).items():
            prompts[class_name] = class_data.get('text_prompt', class_name)

    # Run batch validation
    metrics = run_batch_validation(
        model_path=args.model,
        dataset_path=args.dataset,
        output_dir=args.output,
        use_prompts=args.yoloe,
        prompts=prompts,
        iteration=args.iteration,
        conf_threshold=args.conf,
        use_sahi=not args.no_sahi,
        use_filters=not args.no_filters,
        max_images=args.max_images
    )
