#!/usr/bin/env python3
"""
Convert YOLO bounding box format to segmentation mask format.

For each .txt file in the dataset, this converts bounding boxes to
segmentation polygons by creating a rectangle around the box.

YOLO Box Format: class_id x_center y_center width height
YOLO Seg Format: class_id x1 y1 x2 y2 x3 y3 x4 y4

The segmentation polygon is a simple rectangle with 4 corner points.
"""

import os
from pathlib import Path
import argparse


def box_to_polygon(class_id, x_center, y_center, width, height):
    """
    Convert YOLO box format to segmentation polygon format.

    Args:
        class_id: Class ID
        x_center: X center coordinate (normalized 0-1)
        y_center: Y center coordinate (normalized 0-1)
        width: Box width (normalized 0-1)
        height: Box height (normalized 0-1)

    Returns:
        String in YOLO segmentation format
    """
    # Calculate corners
    x1 = x_center - width / 2
    y1 = y_center - height / 2
    x2 = x_center + width / 2
    y2 = y_center - height / 2
    x3 = x_center + width / 2
    y3 = y_center + height / 2
    x4 = x_center - width / 2
    y4 = y_center + height / 2

    # Format as polygon (4 points, clockwise from top-left)
    return f"{class_id} {x1} {y1} {x2} {y2} {x3} {y3} {x4} {y4}"


def convert_file(input_file):
    """
    Convert a single YOLO detection label file to segmentation format.

    Args:
        input_file: Path to input .txt file
    """
    with open(input_file, 'r') as f:
        lines = f.readlines()

    converted_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue

        parts = line.split()
        if len(parts) == 5:  # Box format: class x_c y_c w h
            class_id = parts[0]
            x_center = float(parts[1])
            y_center = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])

            polygon_line = box_to_polygon(class_id, x_center, y_center, width, height)
            converted_lines.append(polygon_line)
        else:
            # Already in polygon format or invalid, keep as-is
            converted_lines.append(line)

    # Write back to file
    with open(input_file, 'w') as f:
        f.write('\n'.join(converted_lines) + '\n')


def convert_dataset(dataset_dir):
    """
    Convert all label files in a dataset directory.

    Args:
        dataset_dir: Path to dataset root directory
    """
    dataset_path = Path(dataset_dir)

    # Find all label files
    label_files = []
    for split in ['train', 'val', 'test']:
        labels_dir = dataset_path / split / 'labels'
        if labels_dir.exists():
            label_files.extend(labels_dir.glob('*.txt'))

    if not label_files:
        print(f"No label files found in {dataset_dir}")
        return

    print(f"Converting {len(label_files)} label files to segmentation format...")

    for label_file in label_files:
        convert_file(label_file)

    print(f"✓ Converted {len(label_files)} files")


def main():
    parser = argparse.ArgumentParser(
        description='Convert YOLO detection boxes to segmentation polygons'
    )
    parser.add_argument(
        'dataset_dir',
        help='Path to dataset directory containing train/val/test splits'
    )

    args = parser.parse_args()

    if not os.path.exists(args.dataset_dir):
        print(f"Error: Dataset directory not found: {args.dataset_dir}")
        return 1

    convert_dataset(args.dataset_dir)
    return 0


if __name__ == '__main__':
    exit(main())
