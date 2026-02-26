#!/usr/bin/python3
"""
Validate DocLayout-YOLO fine-tuned model with side-by-side comparison.

Compares model predictions against ground truth annotations and generates
visual comparison images along with IoU metrics.

Usage:
    python validate_doclayout.py
"""

import os
import sys
from pathlib import Path

os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"

import cv2
import numpy as np
from PIL import Image
import fitz  # PyMuPDF

try:
    from doclayout_yolo import YOLOv10
except ImportError:
    print("ERROR: doclayout-yolo not installed.")
    print("Run: pip install doclayout-yolo")
    sys.exit(1)


WEIGHTS_PATH = Path("weights/doclayout_construction_v1.pt")
DATASET_PATH = Path("datasets/document-layout-construction")
TEST_IMAGES_PATH = DATASET_PATH / "test" / "images"
TEST_LABELS_PATH = DATASET_PATH / "test" / "labels"
OUTPUT_DIR = Path("validation_results")
PDF_PATH = Path("/home/woodson/Code/projects/sitelink/docs/plans/ca/examples/4-Structural-Drawings - 4pages.pdf")

CLASSES = ["legend", "notes", "schedule"]
CLASS_COLORS = {
    0: (0, 0, 255),    # legend - red (BGR)
    1: (0, 255, 0),    # notes - green (BGR)
    2: (255, 0, 0),    # schedule - blue (BGR)
}

IMGSZ = 1024
CONF_THRESHOLD = 0.25


def calculate_iou(box1, box2):
    """
    Calculate IoU between two boxes in xyxy format.
    box format: [x1, y1, x2, y2]
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_width = max(0, x2 - x1)
    inter_height = max(0, y2 - y1)
    inter_area = inter_width * inter_height

    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])

    union_area = box1_area + box2_area - inter_area

    if union_area == 0:
        return 0.0

    return inter_area / union_area


def yolo_to_xyxy(yolo_box, img_width, img_height):
    """
    Convert YOLO format (class, x_center, y_center, width, height) normalized
    to absolute xyxy format.
    """
    x_center = yolo_box[1] * img_width
    y_center = yolo_box[2] * img_height
    width = yolo_box[3] * img_width
    height = yolo_box[4] * img_height

    x1 = x_center - width / 2
    y1 = y_center - height / 2
    x2 = x_center + width / 2
    y2 = y_center + height / 2

    return [x1, y1, x2, y2]


def load_ground_truth(label_path, img_width, img_height):
    """Load ground truth annotations from YOLO format label file."""
    boxes = []
    with open(label_path, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                cls = int(parts[0])
                x_center = float(parts[1])
                y_center = float(parts[2])
                width = float(parts[3])
                height = float(parts[4])

                xyxy = yolo_to_xyxy([cls, x_center, y_center, width, height], img_width, img_height)
                boxes.append({
                    'class': cls,
                    'xyxy': xyxy,
                    'class_name': CLASSES[cls]
                })
    return boxes


def draw_boxes(img, boxes, title, is_prediction=False):
    """Draw bounding boxes on image with class colors and labels."""
    img_copy = img.copy()

    for box in boxes:
        cls = box['class']
        xyxy = box['xyxy']
        color = CLASS_COLORS[cls]

        x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])

        cv2.rectangle(img_copy, (x1, y1), (x2, y2), color, 3)

        label = box['class_name']
        if is_prediction and 'conf' in box:
            label = f"{label} {box['conf']:.2f}"

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.8
        thickness = 2
        (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)

        cv2.rectangle(img_copy, (x1, y1 - text_height - 10), (x1 + text_width + 5, y1), color, -1)
        cv2.putText(img_copy, label, (x1 + 2, y1 - 5), font, font_scale, (255, 255, 255), thickness)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img_copy, title, (20, 40), font, 1.0, (0, 0, 0), 3)
    cv2.putText(img_copy, title, (20, 40), font, 1.0, (255, 255, 255), 2)

    return img_copy


def create_side_by_side(gt_img, pred_img):
    """Create side-by-side comparison image."""
    height = max(gt_img.shape[0], pred_img.shape[0])

    if gt_img.shape[0] < height:
        padding = np.zeros((height - gt_img.shape[0], gt_img.shape[1], 3), dtype=np.uint8)
        gt_img = np.vstack([gt_img, padding])
    if pred_img.shape[0] < height:
        padding = np.zeros((height - pred_img.shape[0], pred_img.shape[1], 3), dtype=np.uint8)
        pred_img = np.vstack([pred_img, padding])

    divider = np.ones((height, 5, 3), dtype=np.uint8) * 200

    combined = np.hstack([gt_img, divider, pred_img])
    return combined


def match_predictions_to_gt(gt_boxes, pred_boxes, iou_threshold=0.5):
    """
    Match predictions to ground truth boxes by class and IoU.
    Returns list of (gt_box, pred_box, iou) tuples for matched pairs.
    """
    matches = []
    used_preds = set()

    for gt_box in gt_boxes:
        best_iou = 0
        best_pred_idx = None

        for i, pred_box in enumerate(pred_boxes):
            if i in used_preds:
                continue
            if pred_box['class'] != gt_box['class']:
                continue

            iou = calculate_iou(gt_box['xyxy'], pred_box['xyxy'])
            if iou > best_iou:
                best_iou = iou
                best_pred_idx = i

        if best_pred_idx is not None and best_iou >= iou_threshold:
            matches.append((gt_box, pred_boxes[best_pred_idx], best_iou))
            used_preds.add(best_pred_idx)
        else:
            matches.append((gt_box, None, 0.0))

    for i, pred_box in enumerate(pred_boxes):
        if i not in used_preds:
            matches.append((None, pred_box, 0.0))

    return matches


def run_inference(model, image_path):
    """Run model inference on an image."""
    results = model(str(image_path), imgsz=IMGSZ, conf=CONF_THRESHOLD, verbose=False)

    pred_boxes = []
    for result in results:
        for i, box in enumerate(result.boxes):
            cls = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].cpu().numpy().tolist()

            pred_boxes.append({
                'class': cls,
                'xyxy': xyxy,
                'class_name': CLASSES[cls],
                'conf': conf
            })

    return pred_boxes


def render_pdf_page(pdf_path, page_num=0, dpi=150):
    """Render a PDF page to an image."""
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num)

    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)

    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    doc.close()
    return img


def validate_on_pdf(model, pdf_path, output_dir):
    """Run inference on PDF page 1 and save result."""
    print(f"\n{'='*60}")
    print("PDF Inference Test")
    print(f"{'='*60}")
    print(f"PDF: {pdf_path}")

    img = render_pdf_page(pdf_path, page_num=0, dpi=150)
    print(f"Rendered page 1 at 150 DPI: {img.shape[1]}x{img.shape[0]}")

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb)

    temp_path = output_dir / "temp_pdf_page.jpg"
    pil_img.save(temp_path, quality=95)

    pred_boxes = run_inference(model, temp_path)

    temp_path.unlink()

    print(f"\nDetections found: {len(pred_boxes)}")
    for box in pred_boxes:
        print(f"  - {box['class_name']}: conf={box['conf']:.3f}")

    result_img = draw_boxes(img, pred_boxes, "Model Predictions", is_prediction=True)

    output_path = output_dir / "pdf_page1_detections.png"
    cv2.imwrite(str(output_path), result_img)
    print(f"\nSaved: {output_path}")

    return pred_boxes


def validate_on_test_set(model, test_images_path, test_labels_path, output_dir, num_samples=3):
    """Validate on test set with side-by-side comparison."""
    print(f"\n{'='*60}")
    print("Test Set Validation (Side-by-Side Comparison)")
    print(f"{'='*60}")

    all_matches = []
    class_metrics = {cls: {'tp': 0, 'fp': 0, 'fn': 0, 'ious': []} for cls in range(len(CLASSES))}

    image_files = sorted(test_images_path.glob("*.jpg"))[:num_samples]

    for img_path in image_files:
        print(f"\nProcessing: {img_path.name}")

        label_path = test_labels_path / (img_path.stem + ".txt")
        if not label_path.exists():
            print(f"  Warning: No label file found, skipping")
            continue

        img = cv2.imread(str(img_path))
        if img is None:
            print(f"  Warning: Could not read image, skipping")
            continue

        img_height, img_width = img.shape[:2]

        gt_boxes = load_ground_truth(label_path, img_width, img_height)
        pred_boxes = run_inference(model, img_path)

        print(f"  Ground truth: {len(gt_boxes)} boxes")
        print(f"  Predictions: {len(pred_boxes)} boxes")

        matches = match_predictions_to_gt(gt_boxes, pred_boxes, iou_threshold=0.3)

        for gt_box, pred_box, iou in matches:
            if gt_box is not None and pred_box is not None:
                cls = gt_box['class']
                class_metrics[cls]['tp'] += 1
                class_metrics[cls]['ious'].append(iou)
                print(f"  Match: {gt_box['class_name']} - IoU={iou:.3f}")
            elif gt_box is not None:
                cls = gt_box['class']
                class_metrics[cls]['fn'] += 1
                print(f"  Miss: {gt_box['class_name']} (not detected)")
            elif pred_box is not None:
                cls = pred_box['class']
                class_metrics[cls]['fp'] += 1
                print(f"  FP: {pred_box['class_name']} conf={pred_box['conf']:.2f}")

        gt_img = draw_boxes(img, gt_boxes, "Ground Truth", is_prediction=False)
        pred_img = draw_boxes(img, pred_boxes, "Model Predictions", is_prediction=True)

        comparison = create_side_by_side(gt_img, pred_img)

        output_path = output_dir / f"test_comparison_{img_path.stem[:50]}.png"
        cv2.imwrite(str(output_path), comparison)
        print(f"  Saved: {output_path.name}")

    print(f"\n{'='*60}")
    print("Metrics Summary")
    print(f"{'='*60}")

    for cls, class_name in enumerate(CLASSES):
        metrics = class_metrics[cls]
        tp = metrics['tp']
        fp = metrics['fp']
        fn = metrics['fn']

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        mean_iou = np.mean(metrics['ious']) if metrics['ious'] else 0

        print(f"\n{class_name.upper()}:")
        print(f"  TP={tp}, FP={fp}, FN={fn}")
        print(f"  Precision: {precision:.3f}")
        print(f"  Recall: {recall:.3f}")
        print(f"  Mean IoU: {mean_iou:.3f}")

    total_tp = sum(m['tp'] for m in class_metrics.values())
    total_fp = sum(m['fp'] for m in class_metrics.values())
    total_fn = sum(m['fn'] for m in class_metrics.values())
    all_ious = [iou for m in class_metrics.values() for iou in m['ious']]

    overall_precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0
    overall_recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0
    overall_mean_iou = np.mean(all_ious) if all_ious else 0

    print(f"\nOVERALL:")
    print(f"  Total TP={total_tp}, FP={total_fp}, FN={total_fn}")
    print(f"  Precision: {overall_precision:.3f}")
    print(f"  Recall: {overall_recall:.3f}")
    print(f"  Mean IoU: {overall_mean_iou:.3f}")

    return class_metrics


def draw_legend(output_dir):
    """Create a color legend image."""
    legend_img = np.ones((150, 300, 3), dtype=np.uint8) * 255

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(legend_img, "Color Legend", (10, 30), font, 0.8, (0, 0, 0), 2)

    y_offset = 60
    for cls, class_name in enumerate(CLASSES):
        color = CLASS_COLORS[cls]
        cv2.rectangle(legend_img, (10, y_offset), (40, y_offset + 25), color, -1)
        cv2.putText(legend_img, class_name, (50, y_offset + 20), font, 0.7, (0, 0, 0), 2)
        y_offset += 35

    cv2.imwrite(str(output_dir / "color_legend.png"), legend_img)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading model from: {WEIGHTS_PATH}")
    if not WEIGHTS_PATH.exists():
        print(f"ERROR: Model weights not found at {WEIGHTS_PATH}")
        sys.exit(1)

    model = YOLOv10(str(WEIGHTS_PATH))
    print("Model loaded successfully!")

    draw_legend(OUTPUT_DIR)
    print(f"Color legend saved to: {OUTPUT_DIR / 'color_legend.png'}")

    if PDF_PATH.exists():
        validate_on_pdf(model, PDF_PATH, OUTPUT_DIR)
    else:
        print(f"\nWARNING: PDF not found at {PDF_PATH}")

    if TEST_IMAGES_PATH.exists() and TEST_LABELS_PATH.exists():
        num_test_images = len(list(TEST_IMAGES_PATH.glob("*.jpg")))
        print(f"\nTest set has {num_test_images} images")
        validate_on_test_set(model, TEST_IMAGES_PATH, TEST_LABELS_PATH, OUTPUT_DIR, num_samples=5)
    else:
        print(f"\nWARNING: Test set not found at {TEST_IMAGES_PATH}")

    print(f"\n{'='*60}")
    print("Validation Complete!")
    print(f"Results saved to: {OUTPUT_DIR.resolve()}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
