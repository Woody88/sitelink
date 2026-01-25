"""
Validate detection results against Roboflow ground truth annotations.

Parses YOLO format annotations and calculates precision/recall/F1.
Generates TP/FP/FN visualizations and can extract FNs for retraining.
"""

import json
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple


def parse_yolo_annotation(annotation_path: str, image_width: int, image_height: int, class_names: List[str]) -> List[Dict]:
    """
    Parse YOLO format annotation file.

    YOLO format: <class_id> <x_center> <y_center> <width> <height>
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
            x_center = float(parts[1])
            y_center = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])

            # Convert from normalized center coords to pixel xyxy
            x_center_px = x_center * image_width
            y_center_px = y_center * image_height
            width_px = width * image_width
            height_px = height * image_height

            x1 = x_center_px - width_px / 2
            y1 = y_center_px - height_px / 2

            # Convert to [x, y, w, h] format
            bbox = [x1, y1, width_px, height_px]

            callout_type = class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"

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


def match_detections(detections: List[Dict], ground_truth: List[Dict], iou_threshold: float = 0.5) -> Tuple[List, List, List]:
    """
    Match detections to ground truth.

    Returns:
        (true_positives, false_positives, false_negatives)
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


def visualize_validation(image_path: str, tp: List, fp: List, fn: List, output_path: str):
    """
    Create validation visualization with color-coded boxes.

    Green = True Positives (correct detections)
    Red = False Positives (wrong detections)
    Blue = False Negatives (missed callouts)
    """
    image = cv2.imread(image_path)

    # Draw false negatives (missed - blue)
    for item in fn:
        x, y, w, h = [int(v) for v in item['bbox']]
        cv2.rectangle(image, (x, y), (x+w, y+h), (255, 0, 0), 3)
        label = f"MISSED {item['class']}"
        cv2.putText(image, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

    # Draw false positives (wrong - red)
    for item in fp:
        x, y, w, h = [int(v) for v in item['bbox']]
        cv2.rectangle(image, (x, y), (x+w, y+h), (0, 0, 255), 3)
        label = f"FALSE {item['class']}"
        cv2.putText(image, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

    # Draw true positives (correct - green)
    for item in tp:
        det = item['detection']
        x, y, w, h = [int(v) for v in det['bbox']]
        cv2.rectangle(image, (x, y), (x+w, y+h), (0, 255, 0), 2)
        label = f"OK {det['class']} ({item['iou']:.2f})"
        cv2.putText(image, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

    cv2.imwrite(output_path, image)


def extract_false_negatives(image_path: str, fn: List, output_dir: str):
    """
    Crops and saves false negative regions from an image for data augmentation.
    """
    image = cv2.imread(image_path)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\nExtracting {len(fn)} false negatives to '{output_dir}'...")

    for i, item in enumerate(fn):
        x, y, w, h = [int(v) for v in item['bbox']]

        # Add some padding to the crop to ensure context is captured
        padding = int(max(w, h) * 0.2) # 20% padding
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(image.shape[1], x + w + padding)
        y2 = min(image.shape[0], y + h + padding)

        cropped_image = image[y1:y2, x1:x2]

        # Construct a meaningful filename
        class_name = item['class']
        image_stem = Path(image_path).stem
        output_filename = f"{image_stem}_fn_{i}_{class_name}_({x},{y},{w},{h}).png"

        save_path = output_path / output_filename
        cv2.imwrite(str(save_path), cropped_image)

    print(f"Successfully extracted {len(fn)} images.")


def validate_detection(
    image_path: str,
    detection_json: str,
    annotation_path: str,
    class_names: List[str],
    output_path: str = None,
    extract_fn_dir: str = None
) -> Dict:
    """
    Validate detection results against ground truth.

    Args:
        image_path: Path to image
        detection_json: Path to detection results JSON
        annotation_path: Path to YOLO format annotation file
        class_names: List of class names ['detail', 'elevation', 'title']
        output_path: Optional path to save validation visualization
        extract_fn_dir: Optional directory to save false negative crops

    Returns:
        Metrics dict with precision, recall, F1, counts
    """
    # Load image to get dimensions
    image = cv2.imread(image_path)
    height, width = image.shape[:2]

    # Load ground truth
    ground_truth = parse_yolo_annotation(annotation_path, width, height, class_names)

    # Load detections
    with open(detection_json) as f:
        results = json.load(f)
    detections = results['detections']

    # Match
    tp, fp, fn = match_detections(detections, ground_truth, iou_threshold=0.5)

    # Calculate metrics
    tp_count = len(tp)
    fp_count = len(fp)
    fn_count = len(fn)

    precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0
    recall = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    # Per-class metrics
    by_class = {}
    for class_name in class_names:
        class_tp = [t for t in tp if t['detection']['class'] == class_name]
        class_fp = [f for f in fp if f['class'] == class_name]
        class_fn = [f for f in fn if f['class'] == class_name]

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

    # Generate visualization
    if output_path:
        visualize_validation(image_path, tp, fp, fn, output_path)

    # Extract false negatives for retraining
    if extract_fn_dir:
        extract_false_negatives(image_path, fn, extract_fn_dir)

    return {
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'tp': tp_count,
        'fp': fp_count,
        'fn': fn_count,
        'gt_total': len(ground_truth),
        'det_total': len(detections),
        'by_class': by_class
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Validate detection against ground truth")
    parser.add_argument("image", help="Path to image")
    parser.add_argument("detection_json", help="Path to detection JSON")
    parser.add_argument("annotation", help="Path to YOLO annotation file")
    parser.add_argument("--output", help="Path to save validation visualization")
    parser.add_argument("--extract-fn", help="Directory to save false negative crops for retraining")

    args = parser.parse_args()

    class_names = ['detail', 'elevation', 'title']

    metrics = validate_detection(
        args.image,
        args.detection_json,
        args.annotation,
        class_names,
        args.output,
        args.extract_fn
    )

    print("\n" + "=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)
    print(f"\nGround Truth: {metrics['gt_total']} callouts")
    print(f"Detected: {metrics['det_total']} callouts")
    print(f"\nTrue Positives: {metrics['tp']}")
    print(f"False Positives: {metrics['fp']}")
    print(f"False Negatives: {metrics['fn']}")
    print(f"\nPrecision: {metrics['precision']:.1%}")
    print(f"Recall: {metrics['recall']:.1%}")
    print(f"F1 Score: {metrics['f1']:.1%}")

    print(f"\n{'Class':<12} {'Precision':<12} {'Recall':<12} {'F1':<12} {'TP':<6} {'FP':<6} {'FN':<6} {'GT':<6}")
    print("-" * 80)

    for class_name, class_metrics in metrics['by_class'].items():
        print(f"{class_name:<12} "
              f"{class_metrics['precision']:<12.1%} "
              f"{class_metrics['recall']:<12.1%} "
              f"{class_metrics['f1']:<12.1%} "
              f"{class_metrics['tp']:<6} "
              f"{class_metrics['fp']:<6} "
              f"{class_metrics['fn']:<6} "
              f"{class_metrics['gt_count']:<6}")

    if args.output:
        print(f"\nValidation visualization saved: {args.output}")
