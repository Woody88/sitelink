#!/usr/bin/env python3
"""
Generate side-by-side comparison of ground truth vs model predictions.
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import sys

# Configuration - can be overridden by command line args
DATASET_PATH = Path("/home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/datasets/callout-detection-combined")
MODEL_PATH = Path("/home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/runs/detect/runs/train/grid_bubble_v15/weights/best.pt")
OUTPUT_PATH = Path("/home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/comparison_output.png")

CLASS_NAMES = ['detail', 'elevation', 'grid_bubble', 'title']
COLORS = {
    0: (255, 0, 0),    # detail - blue (BGR)
    1: (0, 255, 0),    # elevation - green
    2: (0, 165, 255),  # grid_bubble - orange
    3: (0, 0, 255),    # title - red
}

def load_yolo_labels(label_path, img_width, img_height):
    """Load YOLO format labels and convert to pixel coordinates."""
    boxes = []
    if not label_path.exists():
        return boxes

    with open(label_path, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                cls_id = int(parts[0])
                x_center = float(parts[1]) * img_width
                y_center = float(parts[2]) * img_height
                width = float(parts[3]) * img_width
                height = float(parts[4]) * img_height

                x1 = int(x_center - width / 2)
                y1 = int(y_center - height / 2)
                x2 = int(x_center + width / 2)
                y2 = int(y_center + height / 2)

                boxes.append((cls_id, x1, y1, x2, y2))
    return boxes

def draw_boxes(img, boxes, is_prediction=False):
    """Draw bounding boxes on image."""
    img_copy = img.copy()
    thickness = 2 if is_prediction else 3

    for box in boxes:
        if is_prediction:
            cls_id, x1, y1, x2, y2, conf = box
            label = f"{CLASS_NAMES[cls_id]} {conf:.2f}"
        else:
            cls_id, x1, y1, x2, y2 = box
            label = CLASS_NAMES[cls_id]

        color = COLORS.get(cls_id, (128, 128, 128))
        cv2.rectangle(img_copy, (x1, y1), (x2, y2), color, thickness)

        # Add label
        font_scale = 0.5
        font_thickness = 1
        (text_width, text_height), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
        )
        cv2.rectangle(img_copy, (x1, y1 - text_height - 5), (x1 + text_width, y1), color, -1)
        cv2.putText(img_copy, label, (x1, y1 - 3), cv2.FONT_HERSHEY_SIMPLEX,
                    font_scale, (255, 255, 255), font_thickness)

    return img_copy

def main():
    # Load model
    print(f"Loading model from {MODEL_PATH}")
    model = YOLO(str(MODEL_PATH))

    # Check for command line argument for specific image
    specific_image = None
    if len(sys.argv) > 1:
        specific_image = sys.argv[1]

    # Get a validation image
    valid_images = list((DATASET_PATH / "valid" / "images").glob("*.jpg"))
    if not valid_images:
        print("No validation images found!")
        return

    # Pick an image - either specified or one with grid_bubbles
    img_path = valid_images[0]

    if specific_image:
        # Use specified image
        for img in valid_images:
            if specific_image in img.name:
                img_path = img
                break
    else:
        # Try to find an image with grid_bubble (class 2)
        for img in valid_images:
            label_path = DATASET_PATH / "valid" / "labels" / (img.stem + ".txt")
            if label_path.exists():
                with open(label_path) as f:
                    content = f.read()
                    if content.startswith("2 ") or "\n2 " in content:  # Has grid_bubble
                        img_path = img
                        break

    print(f"Using image: {img_path.name}")

    # Load image
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"Failed to load image: {img_path}")
        return

    h, w = img.shape[:2]

    # Load ground truth labels
    label_path = DATASET_PATH / "valid" / "labels" / (img_path.stem + ".txt")
    gt_boxes = load_yolo_labels(label_path, w, h)
    print(f"Ground truth boxes: {len(gt_boxes)}")

    # Run inference
    results = model(img, conf=0.25)[0]
    pred_boxes = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        pred_boxes.append((cls_id, int(x1), int(y1), int(x2), int(y2), conf))
    print(f"Predicted boxes: {len(pred_boxes)}")

    # Draw boxes on images
    gt_img = draw_boxes(img, gt_boxes, is_prediction=False)
    pred_img = draw_boxes(img, pred_boxes, is_prediction=True)

    # Add titles
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(gt_img, "Ground Truth", (10, 30), font, 1, (0, 255, 255), 2)
    cv2.putText(pred_img, "Model Predictions", (10, 30), font, 1, (0, 255, 255), 2)

    # Create side-by-side comparison
    comparison = np.hstack([gt_img, pred_img])

    # Save output
    cv2.imwrite(str(OUTPUT_PATH), comparison)
    print(f"Saved comparison to: {OUTPUT_PATH}")

    # Also print stats
    print(f"\n=== Detection Stats ===")
    print(f"Image: {img_path.name}")
    print(f"Ground truth: {len(gt_boxes)} objects")
    print(f"Predictions: {len(pred_boxes)} objects")
    for cls_id, name in enumerate(CLASS_NAMES):
        gt_count = sum(1 for b in gt_boxes if b[0] == cls_id)
        pred_count = sum(1 for b in pred_boxes if b[0] == cls_id)
        print(f"  {name}: GT={gt_count}, Pred={pred_count}")

if __name__ == "__main__":
    main()
