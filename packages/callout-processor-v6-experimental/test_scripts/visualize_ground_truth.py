#!/usr/bin/env python3
"""
Visualize Roboflow ground truth annotations on images
"""
import cv2
import sys
from pathlib import Path

# Class mapping
CLASS_NAMES = {0: 'detail', 1: 'elevation', 2: 'title'}
CLASS_COLORS = {
    0: (255, 0, 0),    # Blue for detail
    1: (0, 255, 0),    # Green for elevation
    2: (0, 0, 255)     # Red for title
}

def visualize_ground_truth(image_path: str, annotation_path: str, output_path: str):
    """Draw ground truth annotations on image"""

    # Read image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image {image_path}")
        return

    h, w = img.shape[:2]

    # Read YOLO annotations
    with open(annotation_path, 'r') as f:
        lines = f.readlines()

    count_by_class = {0: 0, 1: 0, 2: 0}

    for line in lines:
        parts = line.strip().split()
        if len(parts) < 5:
            continue

        class_id = int(parts[0])
        x_center = float(parts[1])
        y_center = float(parts[2])
        width = float(parts[3])
        height = float(parts[4])

        # Convert YOLO format to pixel coordinates
        x1 = int((x_center - width/2) * w)
        y1 = int((y_center - height/2) * h)
        x2 = int((x_center + width/2) * w)
        y2 = int((y_center + height/2) * h)

        # Draw box
        color = CLASS_COLORS.get(class_id, (128, 128, 128))
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)

        # Draw label
        label = CLASS_NAMES.get(class_id, 'unknown')
        cv2.putText(img, label, (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        count_by_class[class_id] = count_by_class.get(class_id, 0) + 1

    # Add summary text
    y_offset = 30
    total = sum(count_by_class.values())
    cv2.putText(img, f"Ground Truth: {total} callouts", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 35

    for class_id, count in count_by_class.items():
        if count > 0:
            text = f"{CLASS_NAMES[class_id]}: {count}"
            color = CLASS_COLORS[class_id]
            cv2.putText(img, text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            y_offset += 30

    # Save
    cv2.imwrite(output_path, img)
    print(f"Saved ground truth visualization to {output_path}")
    print(f"Total callouts: {total}")
    for class_id, count in count_by_class.items():
        if count > 0:
            print(f"  {CLASS_NAMES[class_id]}: {count}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python visualize_ground_truth.py <image_path> <annotation_path> <output_path>")
        sys.exit(1)

    visualize_ground_truth(sys.argv[1], sys.argv[2], sys.argv[3])
