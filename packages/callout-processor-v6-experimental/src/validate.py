"""
Validation script for comparing YOLO-26E detection results against ground truth annotations.

Calculates precision, recall, F1 score, and generates annotated comparison images.
"""

import argparse
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """
    Calculate Intersection over Union (IoU) between two bounding boxes.

    Args:
        box1: [x1, y1, x2, y2] coordinates
        box2: [x1, y1, x2, y2] coordinates

    Returns:
        IoU score between 0 and 1
    """
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2

    # Calculate intersection area
    x_left = max(x1_min, x2_min)
    y_top = max(y1_min, y2_min)
    x_right = min(x1_max, x2_max)
    y_bottom = min(y1_max, y2_max)

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)

    # Calculate union area
    box1_area = (x1_max - x1_min) * (y1_max - y1_min)
    box2_area = (x2_max - x2_min) * (y2_max - y2_min)
    union_area = box1_area + box2_area - intersection_area

    if union_area == 0:
        return 0.0

    return intersection_area / union_area


def match_predictions_to_ground_truth(
    predictions: List[Dict],
    ground_truth: List[Dict],
    iou_threshold: float
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Match predictions to ground truth using IoU threshold and best match selection.

    Args:
        predictions: List of prediction dicts with 'bbox' and 'callout_type'
        ground_truth: List of ground truth dicts with 'bbox' and 'callout_type'
        iou_threshold: Minimum IoU for a match

    Returns:
        Tuple of (true_positives, false_positives, false_negatives)
    """
    true_positives = []
    false_positives = []
    false_negatives = []

    matched_gt_indices = set()
    matched_pred_indices = set()

    # For each prediction, find best matching ground truth
    for pred_idx, pred in enumerate(predictions):
        pred_bbox = pred["bbox"]
        pred_type = pred.get("callout_type", "unknown")

        best_iou = 0.0
        best_gt_idx = -1

        for gt_idx, gt in enumerate(ground_truth):
            if gt_idx in matched_gt_indices:
                continue

            gt_bbox = gt["bbox"]
            gt_type = gt.get("callout_type", "unknown")

            # Only match if types are the same
            if pred_type != gt_type:
                continue

            iou = calculate_iou(pred_bbox, gt_bbox)

            if iou > best_iou:
                best_iou = iou
                best_gt_idx = gt_idx

        # Check if we found a valid match
        if best_iou >= iou_threshold and best_gt_idx != -1:
            matched_gt_indices.add(best_gt_idx)
            matched_pred_indices.add(pred_idx)
            true_positives.append({
                "prediction": pred,
                "ground_truth": ground_truth[best_gt_idx],
                "iou": best_iou
            })
        else:
            false_positives.append(pred)

    # Any unmatched ground truth are false negatives
    for gt_idx, gt in enumerate(ground_truth):
        if gt_idx not in matched_gt_indices:
            false_negatives.append(gt)

    return true_positives, false_positives, false_negatives


def calculate_metrics(
    true_positives: List[Dict],
    false_positives: List[Dict],
    false_negatives: List[Dict]
) -> Dict:
    """
    Calculate precision, recall, and F1 score from matches.

    Args:
        true_positives: List of TP matches
        false_positives: List of FP predictions
        false_negatives: List of FN ground truths

    Returns:
        Dict with precision, recall, f1_score, and counts
    """
    tp_count = len(true_positives)
    fp_count = len(false_positives)
    fn_count = len(false_negatives)

    precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0.0
    recall = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0.0
    f1_score = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1_score, 4),
        "true_positives": tp_count,
        "false_positives": fp_count,
        "false_negatives": fn_count
    }


def calculate_metrics_by_type(
    true_positives: List[Dict],
    false_positives: List[Dict],
    false_negatives: List[Dict]
) -> Dict[str, Dict]:
    """
    Calculate metrics broken down by callout type.

    Args:
        true_positives: List of TP matches
        false_positives: List of FP predictions
        false_negatives: List of FN ground truths

    Returns:
        Dict mapping callout_type to metrics dict
    """
    # Group by type
    types = set()

    for tp in true_positives:
        types.add(tp["prediction"].get("callout_type", "unknown"))

    for fp in false_positives:
        types.add(fp.get("callout_type", "unknown"))

    for fn in false_negatives:
        types.add(fn.get("callout_type", "unknown"))

    # Calculate metrics per type
    metrics_by_type = {}

    for callout_type in types:
        type_tp = [tp for tp in true_positives
                   if tp["prediction"].get("callout_type", "unknown") == callout_type]
        type_fp = [fp for fp in false_positives
                   if fp.get("callout_type", "unknown") == callout_type]
        type_fn = [fn for fn in false_negatives
                   if fn.get("callout_type", "unknown") == callout_type]

        metrics_by_type[callout_type] = calculate_metrics(type_tp, type_fp, type_fn)

    return metrics_by_type


def draw_annotations(
    image_path: str,
    predictions: List[Dict],
    ground_truth: List[Dict],
    true_positives: List[Dict],
    false_positives: List[Dict],
    false_negatives: List[Dict],
    output_path: str
) -> None:
    """
    Draw annotated comparison image with color-coded boxes.

    Args:
        image_path: Path to input image
        predictions: All predictions
        ground_truth: All ground truth annotations
        true_positives: TP matches
        false_positives: FP predictions
        false_negatives: FN ground truths
        output_path: Where to save annotated image
    """
    # Load image
    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)

    # Try to load a font, fall back to default if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    # Draw false negatives (missed ground truth) - Yellow
    for fn in false_negatives:
        bbox = fn["bbox"]
        callout_type = fn.get("callout_type", "unknown")

        draw.rectangle(bbox, outline="yellow", width=3)
        draw.text((bbox[0], bbox[1] - 20), f"MISSED: {callout_type}",
                  fill="yellow", font=font)

    # Draw false positives (incorrect predictions) - Red
    for fp in false_positives:
        bbox = fp["bbox"]
        callout_type = fp.get("callout_type", "unknown")
        confidence = fp.get("confidence", 0.0)

        draw.rectangle(bbox, outline="red", width=3)
        draw.text((bbox[0], bbox[1] - 20),
                  f"FP: {callout_type} ({confidence:.2f})",
                  fill="red", font=font)

    # Draw true positives (correct predictions) - Green
    for tp in true_positives:
        pred = tp["prediction"]
        bbox = pred["bbox"]
        callout_type = pred.get("callout_type", "unknown")
        confidence = pred.get("confidence", 0.0)
        iou = tp["iou"]

        draw.rectangle(bbox, outline="green", width=3)
        draw.text((bbox[0], bbox[1] - 35),
                  f"TP: {callout_type} ({confidence:.2f})",
                  fill="green", font=font)
        draw.text((bbox[0], bbox[1] - 18),
                  f"IoU: {iou:.2f}",
                  fill="green", font=small_font)

    # Add legend
    legend_x = 10
    legend_y = 10
    legend_spacing = 25

    draw.rectangle([legend_x, legend_y, legend_x + 20, legend_y + 20],
                   outline="green", width=3)
    draw.text((legend_x + 25, legend_y), "True Positive", fill="white", font=font)

    draw.rectangle([legend_x, legend_y + legend_spacing,
                    legend_x + 20, legend_y + legend_spacing + 20],
                   outline="red", width=3)
    draw.text((legend_x + 25, legend_y + legend_spacing),
              "False Positive", fill="white", font=font)

    draw.rectangle([legend_x, legend_y + 2 * legend_spacing,
                    legend_x + 20, legend_y + 2 * legend_spacing + 20],
                   outline="yellow", width=3)
    draw.text((legend_x + 25, legend_y + 2 * legend_spacing),
              "False Negative", fill="white", font=font)

    # Save annotated image
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path)
    print(f"Saved annotated image to {output_path}")


def save_metrics(metrics: Dict, output_path: str) -> None:
    """
    Save metrics to JSON file.

    Args:
        metrics: Metrics dict to save
        output_path: Where to save JSON file
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {output_path}")


def load_json_file(file_path: str) -> Dict:
    """
    Load and validate JSON file.

    Args:
        file_path: Path to JSON file

    Returns:
        Parsed JSON data

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If file is not valid JSON
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(file_path, 'r') as f:
        data = json.load(f)

    return data


def validate_single(
    predictions_path: str,
    ground_truth_path: str,
    image_path: str,
    output_dir: str,
    iou_threshold: float
) -> Dict:
    """
    Validate a single image's predictions against ground truth.

    Args:
        predictions_path: Path to predictions JSON
        ground_truth_path: Path to ground truth JSON
        image_path: Path to input image
        output_dir: Directory for output files
        iou_threshold: IoU threshold for matching

    Returns:
        Metrics dict
    """
    print(f"\nValidating: {os.path.basename(image_path)}")
    print(f"Predictions: {predictions_path}")
    print(f"Ground truth: {ground_truth_path}")

    # Load data
    predictions_data = load_json_file(predictions_path)
    ground_truth_data = load_json_file(ground_truth_path)

    # Extract detections (handle both old and new format)
    predictions = predictions_data.get("detections", predictions_data.get("callouts", []))
    ground_truth = ground_truth_data.get("detections", ground_truth_data.get("callouts", []))

    if not isinstance(predictions, list):
        predictions = []
    if not isinstance(ground_truth, list):
        ground_truth = []

    print(f"Predictions: {len(predictions)}, Ground truth: {len(ground_truth)}")

    # Validate image exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    # Match predictions to ground truth
    true_positives, false_positives, false_negatives = match_predictions_to_ground_truth(
        predictions, ground_truth, iou_threshold
    )

    # Calculate metrics
    overall_metrics = calculate_metrics(true_positives, false_positives, false_negatives)
    metrics_by_type = calculate_metrics_by_type(true_positives, false_positives, false_negatives)

    # Prepare output
    base_name = Path(image_path).stem
    annotated_image_path = os.path.join(output_dir, f"{base_name}_annotated.png")
    metrics_path = os.path.join(output_dir, f"{base_name}_metrics.json")

    # Draw annotations
    draw_annotations(
        image_path,
        predictions,
        ground_truth,
        true_positives,
        false_positives,
        false_negatives,
        annotated_image_path
    )

    # Prepare full metrics
    full_metrics = {
        "image": os.path.basename(image_path),
        "iou_threshold": iou_threshold,
        "overall": overall_metrics,
        "by_type": metrics_by_type
    }

    # Save metrics
    save_metrics(full_metrics, metrics_path)

    # Print summary
    print(f"\nResults:")
    print(f"  Precision: {overall_metrics['precision']:.4f}")
    print(f"  Recall: {overall_metrics['recall']:.4f}")
    print(f"  F1 Score: {overall_metrics['f1_score']:.4f}")
    print(f"  True Positives: {overall_metrics['true_positives']}")
    print(f"  False Positives: {overall_metrics['false_positives']}")
    print(f"  False Negatives: {overall_metrics['false_negatives']}")

    if metrics_by_type:
        print(f"\nBy Type:")
        for callout_type, type_metrics in metrics_by_type.items():
            print(f"  {callout_type}:")
            print(f"    Precision: {type_metrics['precision']:.4f}")
            print(f"    Recall: {type_metrics['recall']:.4f}")
            print(f"    F1 Score: {type_metrics['f1_score']:.4f}")

    return full_metrics


def validate_batch(
    predictions_dir: str,
    ground_truth_dir: str,
    images_dir: str,
    output_dir: str,
    iou_threshold: float
) -> Dict:
    """
    Validate multiple images in batch mode.

    Args:
        predictions_dir: Directory containing prediction JSON files
        ground_truth_dir: Directory containing ground truth JSON files
        images_dir: Directory containing input images
        output_dir: Directory for output files
        iou_threshold: IoU threshold for matching

    Returns:
        Aggregated metrics dict
    """
    print(f"\nBatch validation mode")
    print(f"Predictions dir: {predictions_dir}")
    print(f"Ground truth dir: {ground_truth_dir}")
    print(f"Images dir: {images_dir}")

    # Find all prediction files
    prediction_files = sorted([f for f in os.listdir(predictions_dir) if f.endswith('.json')])

    if not prediction_files:
        print(f"No JSON files found in {predictions_dir}")
        return {}

    print(f"Found {len(prediction_files)} prediction files")

    all_metrics = []

    for pred_file in prediction_files:
        base_name = pred_file.replace('.json', '')

        # Look for corresponding ground truth and image
        gt_file = f"{base_name}_annotations.json"
        gt_path = os.path.join(ground_truth_dir, gt_file)

        # Try different image extensions
        image_path = None
        for ext in ['.png', '.jpg', '.jpeg']:
            candidate = os.path.join(images_dir, f"{base_name}{ext}")
            if os.path.exists(candidate):
                image_path = candidate
                break

        if not os.path.exists(gt_path):
            print(f"Skipping {pred_file}: ground truth not found ({gt_file})")
            continue

        if not image_path:
            print(f"Skipping {pred_file}: image not found")
            continue

        # Validate this image
        try:
            metrics = validate_single(
                os.path.join(predictions_dir, pred_file),
                gt_path,
                image_path,
                output_dir,
                iou_threshold
            )
            all_metrics.append(metrics)
        except Exception as e:
            print(f"Error validating {pred_file}: {e}")

    # Calculate aggregate metrics
    if all_metrics:
        total_tp = sum(m["overall"]["true_positives"] for m in all_metrics)
        total_fp = sum(m["overall"]["false_positives"] for m in all_metrics)
        total_fn = sum(m["overall"]["false_negatives"] for m in all_metrics)

        aggregate_metrics = calculate_metrics(
            [{}] * total_tp,  # Just need counts
            [{}] * total_fp,
            [{}] * total_fn
        )

        aggregate_metrics["num_images"] = len(all_metrics)

        print(f"\n{'='*50}")
        print(f"AGGREGATE RESULTS ({len(all_metrics)} images)")
        print(f"{'='*50}")
        print(f"  Precision: {aggregate_metrics['precision']:.4f}")
        print(f"  Recall: {aggregate_metrics['recall']:.4f}")
        print(f"  F1 Score: {aggregate_metrics['f1_score']:.4f}")
        print(f"  Total True Positives: {total_tp}")
        print(f"  Total False Positives: {total_fp}")
        print(f"  Total False Negatives: {total_fn}")

        # Save aggregate metrics
        aggregate_path = os.path.join(output_dir, "aggregate_metrics.json")
        save_metrics({
            "aggregate": aggregate_metrics,
            "per_image": all_metrics
        }, aggregate_path)

        return aggregate_metrics
    else:
        print("\nNo images were successfully validated")
        return {}


def main():
    parser = argparse.ArgumentParser(
        description="Validate YOLO-26E detection results against ground truth annotations"
    )

    parser.add_argument(
        "--predictions",
        type=str,
        help="Path to predictions JSON file or directory"
    )

    parser.add_argument(
        "--ground-truth",
        type=str,
        help="Path to ground truth JSON file or directory"
    )

    parser.add_argument(
        "--image",
        type=str,
        help="Path to input image file or directory"
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default="tests/validation_output",
        help="Directory for output files (default: tests/validation_output)"
    )

    parser.add_argument(
        "--iou-threshold",
        type=float,
        default=0.5,
        help="IoU threshold for matching (default: 0.5)"
    )

    parser.add_argument(
        "--batch",
        action="store_true",
        help="Batch mode: validate multiple images"
    )

    args = parser.parse_args()

    if not args.predictions or not args.ground_truth or not args.image:
        parser.print_help()
        return

    try:
        if args.batch:
            validate_batch(
                args.predictions,
                args.ground_truth,
                args.image,
                args.output_dir,
                args.iou_threshold
            )
        else:
            validate_single(
                args.predictions,
                args.ground_truth,
                args.image,
                args.output_dir,
                args.iou_threshold
            )
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    main()
