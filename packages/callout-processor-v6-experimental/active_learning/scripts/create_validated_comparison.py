#!/usr/bin/env python3
"""
Create 3-panel comparison: Ground Truth | Detections | Validation
Shows TP (green), FP (red), FN (blue) like callout-processor-v5
"""

import cv2
import numpy as np
from pathlib import Path
import sys

from ultralytics import YOLO
from sahi import AutoDetectionModel
from sahi.predict import get_sliced_prediction

CLASS_NAMES = ['detail', 'elevation', 'title']
CLASS_COLORS = {
    'detail': (0, 255, 0),      # Green
    'elevation': (255, 0, 0),   # Blue
    'title': (0, 0, 255)        # Red
}


def parse_yolo_annotation(annotation_path, image_width, image_height, class_names):
    """Parse YOLO format annotation."""
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

            # Convert to pixel coordinates
            x_center_px = x_center * image_width
            y_center_px = y_center * image_height
            width_px = width * image_width
            height_px = height * image_height

            x1 = x_center_px - width_px / 2
            y1 = y_center_px - height_px / 2

            callouts.append({
                'bbox': [x1, y1, width_px, height_px],
                'class': class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"
            })

    return callouts


def calculate_iou(box1, box2):
    """Calculate IoU between two boxes in [x, y, w, h] format."""
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2

    xi1 = max(x1, x2)
    yi1 = max(y1, y2)
    xi2 = min(x1 + w1, x2 + w2)
    yi2 = min(y1 + h1, y2 + h2)

    inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    union_area = w1 * h1 + w2 * h2 - inter_area

    return inter_area / union_area if union_area > 0 else 0


def match_detections(detections, ground_truth, iou_threshold=0.5):
    """Match detections to ground truth."""
    gt_matched = [False] * len(ground_truth)
    det_matched = [False] * len(detections)

    true_positives = []

    for i, det in enumerate(detections):
        best_iou = 0
        best_gt_idx = -1

        for j, gt in enumerate(ground_truth):
            if gt_matched[j]:
                continue
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

    false_positives = [detections[i] for i, matched in enumerate(det_matched) if not matched]
    false_negatives = [ground_truth[i] for i, matched in enumerate(gt_matched) if not matched]

    return true_positives, false_positives, false_negatives


def visualize_ground_truth(image_path, annotation_path, output_path):
    """Draw ground truth annotations."""
    img = cv2.imread(image_path)
    h, w = img.shape[:2]

    gt_callouts = parse_yolo_annotation(annotation_path, w, h, CLASS_NAMES)

    count_by_class = {}
    for item in gt_callouts:
        cls = item['class']
        count_by_class[cls] = count_by_class.get(cls, 0) + 1

        x, y, width, height = [int(v) for v in item['bbox']]
        color = CLASS_COLORS.get(cls, (128, 128, 128))
        cv2.rectangle(img, (x, y), (x+width, y+height), color, 3)
        cv2.putText(img, cls, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Add summary
    total = len(gt_callouts)
    y_offset = 30
    cv2.putText(img, f"Ground Truth: {total} callouts", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 35

    for cls, count in count_by_class.items():
        text = f"{cls}: {count}"
        color = CLASS_COLORS[cls]
        cv2.putText(img, text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        y_offset += 30

    cv2.imwrite(output_path, img)
    return gt_callouts, count_by_class, total


def run_detection_sahi(model_path, image_path, conf_threshold=0.25):
    """Run SAHI detection."""
    detection_model = AutoDetectionModel.from_pretrained(
        model_type='yolov8',
        model_path=model_path,
        confidence_threshold=conf_threshold,
        device='cuda:0'
    )

    result = get_sliced_prediction(
        image_path,
        detection_model,
        slice_height=2048,
        slice_width=2048,
        overlap_height_ratio=0.2,
        overlap_width_ratio=0.2
    )

    detections = []
    for obj in result.object_prediction_list:
        bbox = obj.bbox.to_xyxy()
        detections.append({
            'bbox': [bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]],
            'class': obj.category.name,
            'confidence': obj.score.value
        })

    return detections


def visualize_detections(image_path, detections, output_path):
    """Draw detection boxes."""
    img = cv2.imread(image_path)

    count_by_class = {}
    for det in detections:
        cls = det['class']
        count_by_class[cls] = count_by_class.get(cls, 0) + 1

        x, y, w, h = [int(v) for v in det['bbox']]
        color = CLASS_COLORS.get(cls, (128, 128, 128))
        cv2.rectangle(img, (x, y), (x+w, y+h), color, 3)

        label = f"{cls} {det['confidence']:.2f}"
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Add summary
    total = len(detections)
    y_offset = 30
    cv2.putText(img, f"Detections: {total} callouts", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 35

    for cls, count in count_by_class.items():
        text = f"{cls}: {count}"
        color = CLASS_COLORS[cls]
        cv2.putText(img, text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        y_offset += 30

    cv2.imwrite(output_path, img)
    return count_by_class, total


def visualize_validation(image_path, tp, fp, fn, output_path, precision, recall, f1):
    """Draw validation with TP (green), FP (red), FN (blue)."""
    img = cv2.imread(image_path)

    # Draw false negatives (MISSED - blue)
    for item in fn:
        x, y, w, h = [int(v) for v in item['bbox']]
        cv2.rectangle(img, (x, y), (x+w, y+h), (255, 0, 0), 3)
        label = f"MISSED {item['class']}"
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

    # Draw false positives (WRONG - red)
    for item in fp:
        x, y, w, h = [int(v) for v in item['bbox']]
        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 255), 3)
        label = f"WRONG {item['class']}"
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    # Draw true positives (CORRECT - green)
    for item in tp:
        x, y, w, h = [int(v) for v in item['detection']['bbox']]
        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 3)
        label = f"OK {item['detection']['class']}"
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Add summary with metrics
    y_offset = 30
    cv2.putText(img, f"Validation: P={precision:.1%} R={recall:.1%} F1={f1:.1%}",
                (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 35

    cv2.putText(img, f"TP: {len(tp)} (green)", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    y_offset += 30
    cv2.putText(img, f"FP: {len(fp)} (red)", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    y_offset += 30
    cv2.putText(img, f"FN: {len(fn)} (blue)", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)

    cv2.imwrite(output_path, img)


def create_3panel_comparison(gt_path, det_path, val_path, output_path, title):
    """Create 3-panel comparison: GT | Detections | Validation."""
    gt = cv2.imread(gt_path)
    det = cv2.imread(det_path)
    val = cv2.imread(val_path)

    if gt is None or det is None or val is None:
        print(f"Error loading images for {title}")
        return

    # Resize to same height
    h = min(gt.shape[0], det.shape[0], val.shape[0])
    gt = cv2.resize(gt, (int(gt.shape[1] * h / gt.shape[0]), h))
    det = cv2.resize(det, (int(det.shape[1] * h / det.shape[0]), h))
    val = cv2.resize(val, (int(val.shape[1] * h / val.shape[0]), h))

    # Add panel labels
    label_h = 50
    gt_labeled = np.zeros((h + label_h, gt.shape[1], 3), dtype=np.uint8)
    det_labeled = np.zeros((h + label_h, det.shape[1], 3), dtype=np.uint8)
    val_labeled = np.zeros((h + label_h, val.shape[1], 3), dtype=np.uint8)

    gt_labeled[label_h:] = gt
    det_labeled[label_h:] = det
    val_labeled[label_h:] = val

    cv2.putText(gt_labeled, "Ground Truth", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(det_labeled, "Iteration 4 Detections", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(val_labeled, "Validation (TP/FP/FN)", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)

    # Concatenate
    comparison = np.hstack([gt_labeled, det_labeled, val_labeled])

    # Add title
    title_h = 60
    final = np.zeros((comparison.shape[0] + title_h, comparison.shape[1], 3), dtype=np.uint8)
    final[title_h:] = comparison

    cv2.putText(final, title, (10, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)

    cv2.imwrite(output_path, final)
    print(f"Created 3-panel comparison: {output_path}")


def main(image_path, annotation_path, model_path, output_dir):
    """Main pipeline."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    image_name = Path(image_path).stem

    print(f"Processing: {image_name}")
    print(f"Image: {image_path}")
    print(f"Annotations: {annotation_path}")
    print(f"Model: {model_path}")
    print()

    # Step 1: Ground truth
    print("Step 1: Visualizing ground truth...")
    gt_output = output_dir / f"{image_name}_ground_truth.png"
    gt_callouts, gt_stats, gt_total = visualize_ground_truth(
        image_path, annotation_path, str(gt_output)
    )
    print(f"Ground truth: {gt_total} callouts - {gt_stats}")

    # Step 2: Detections
    print("\nStep 2: Running detections...")
    detections = run_detection_sahi(model_path, image_path)
    det_output = output_dir / f"{image_name}_detections.png"
    det_stats, det_total = visualize_detections(
        image_path, detections, str(det_output)
    )
    print(f"Detections: {det_total} callouts - {det_stats}")

    # Step 3: Validation
    print("\nStep 3: Matching and validating...")
    tp, fp, fn = match_detections(detections, gt_callouts, iou_threshold=0.5)

    precision = len(tp) / len(detections) if detections else 0
    recall = len(tp) / len(gt_callouts) if gt_callouts else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    print(f"TP: {len(tp)}, FP: {len(fp)}, FN: {len(fn)}")
    print(f"Precision: {precision:.1%}, Recall: {recall:.1%}, F1: {f1:.1%}")

    val_output = output_dir / f"{image_name}_validation.png"
    visualize_validation(image_path, tp, fp, fn, str(val_output),
                        precision, recall, f1)

    # Step 4: Create 3-panel comparison
    print("\nStep 4: Creating 3-panel comparison...")
    comparison_output = output_dir / f"{image_name}_comparison.png"
    title = f"{image_name}: P={precision:.1%} R={recall:.1%} F1={f1:.1%}"

    create_3panel_comparison(
        str(gt_output), str(det_output), str(val_output),
        str(comparison_output), title
    )

    print(f"\nDone! Comparison saved to: {comparison_output}")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python create_validated_comparison.py <image> <annotation> <model> <output_dir>")
        sys.exit(1)

    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
