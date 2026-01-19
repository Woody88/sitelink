#!/usr/bin/env python3
"""
Export existing CV+LLM detections to YOLO format for training.

YOLO format (per line in .txt file):
class_id center_x center_y width height

All coordinates are normalized to [0, 1] range.
"""

import argparse
import json
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

# Class mapping: string type -> integer class ID
CLASS_MAP = {
    'detail': 0,
    'section': 1,
    'elevation': 2,
    'title': 3,
    'section_cut': 1,  # Map section_cut to section class
}

CLASS_NAMES = ['detail', 'section', 'elevation', 'title']


def marker_to_yolo(
    marker: Dict,
    img_width: int,
    img_height: int,
    box_padding: float = 1.5
) -> Tuple[int, float, float, float, float]:
    """
    Convert a marker dict to YOLO format.

    Args:
        marker: Detection dict with pixelX, pixelY, radius OR bbox, type
        img_width: Image width in pixels
        img_height: Image height in pixels
        box_padding: Multiplier for radius to get bounding box (1.5 = 50% padding)

    Returns:
        Tuple of (class_id, center_x, center_y, width, height) all normalized
    """
    callout_type = marker.get('type', 'detail')
    class_id = CLASS_MAP.get(callout_type, 0)

    # Handle two formats: radius-based or bbox-based
    if 'bbox' in marker:
        bbox = marker['bbox']
        x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        box_width = (x2 - x1) * box_padding
        box_height = (y2 - y1) * box_padding
    else:
        cx = marker['pixelX']
        cy = marker['pixelY']
        radius = marker['radius']
        # Bounding box is a square around the circle with padding
        box_width = radius * 2 * box_padding
        box_height = radius * 2 * box_padding

    # Normalize to [0, 1]
    center_x = cx / img_width
    center_y = cy / img_height
    width = box_width / img_width
    height = box_height / img_height

    # Clamp to valid range
    center_x = max(0, min(1, center_x))
    center_y = max(0, min(1, center_y))
    width = min(width, min(center_x, 1 - center_x) * 2)
    height = min(height, min(center_y, 1 - center_y) * 2)

    return class_id, center_x, center_y, width, height


def export_sheet_labels(
    sheet_dir: Path,
    output_images_dir: Path,
    output_labels_dir: Path,
    prefix: str = ""
) -> Dict:
    """
    Export labels for a single sheet.

    Returns:
        Dict with counts per class
    """
    markers_file = sheet_dir / "markers.json"
    source_image = sheet_dir / "source.png"

    if not markers_file.exists() or not source_image.exists():
        return {'skipped': True, 'reason': 'missing files'}

    with open(markers_file) as f:
        markers = json.load(f)

    if not markers:
        return {'skipped': True, 'reason': 'no markers'}

    # Get image dimensions from first marker or parent summary
    summary_file = sheet_dir.parent / "summary.json"
    if summary_file.exists():
        with open(summary_file) as f:
            summary = json.load(f)

        sheet_num = int(sheet_dir.name.split('-')[1])
        for s in summary:
            if s.get('sheet') == sheet_num:
                img_width = s['width']
                img_height = s['height']
                break
        else:
            # Fallback: use first marker's normalized coords
            m = markers[0]
            img_width = int(m['pixelX'] / m['x'])
            img_height = int(m['pixelY'] / m['y'])
    else:
        m = markers[0]
        img_width = int(m['pixelX'] / m['x'])
        img_height = int(m['pixelY'] / m['y'])

    # Generate output filename
    sheet_name = f"{prefix}{sheet_dir.name}"
    image_out = output_images_dir / f"{sheet_name}.png"
    label_out = output_labels_dir / f"{sheet_name}.txt"

    # Copy image
    shutil.copy(source_image, image_out)

    # Write labels
    counts = {name: 0 for name in CLASS_NAMES}

    with open(label_out, 'w') as f:
        for marker in markers:
            class_id, cx, cy, w, h = marker_to_yolo(marker, img_width, img_height)
            f.write(f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")
            counts[CLASS_NAMES[class_id]] += 1

    return {
        'skipped': False,
        'markers': len(markers),
        'counts': counts,
        'image': str(image_out),
        'labels': str(label_out),
    }


def export_pipeline_output(
    output_dir: Path,
    yolo_dir: Path,
    prefix: str = ""
) -> Dict:
    """
    Export all sheets from a pipeline output directory to YOLO format.
    """
    images_dir = yolo_dir / "images"
    labels_dir = yolo_dir / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    results = []
    total_counts = {name: 0 for name in CLASS_NAMES}

    # Find all sheet directories
    sheet_dirs = sorted(output_dir.glob("sheet-*"))

    for sheet_dir in sheet_dirs:
        result = export_sheet_labels(sheet_dir, images_dir, labels_dir, prefix)
        results.append({
            'sheet': sheet_dir.name,
            **result
        })

        if not result.get('skipped'):
            for name in CLASS_NAMES:
                total_counts[name] += result['counts'].get(name, 0)

    return {
        'sheets': results,
        'total_counts': total_counts,
        'total_markers': sum(total_counts.values()),
    }


def create_dataset_yaml(yolo_dir: Path, train_split: float = 0.8):
    """
    Create YOLO dataset configuration file and split data into train/val.
    """
    images_dir = yolo_dir / "images"
    labels_dir = yolo_dir / "labels"

    # Get all images
    images = sorted(images_dir.glob("*.png"))

    # Split into train/val
    import random
    random.seed(42)
    random.shuffle(images)

    split_idx = int(len(images) * train_split)
    train_images = images[:split_idx]
    val_images = images[split_idx:]

    # Create train/val directories
    train_images_dir = yolo_dir / "train" / "images"
    train_labels_dir = yolo_dir / "train" / "labels"
    val_images_dir = yolo_dir / "val" / "images"
    val_labels_dir = yolo_dir / "val" / "labels"

    for d in [train_images_dir, train_labels_dir, val_images_dir, val_labels_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Move files to train/val
    for img in train_images:
        label = labels_dir / f"{img.stem}.txt"
        shutil.copy(img, train_images_dir / img.name)
        if label.exists():
            shutil.copy(label, train_labels_dir / label.name)

    for img in val_images:
        label = labels_dir / f"{img.stem}.txt"
        shutil.copy(img, val_images_dir / img.name)
        if label.exists():
            shutil.copy(label, val_labels_dir / label.name)

    # Create dataset.yaml
    yaml_content = f"""# Callout Detection Dataset
# Generated from CV+LLM pipeline output

path: {yolo_dir.absolute()}
train: train/images
val: val/images

# Classes
names:
  0: detail
  1: section
  2: elevation
  3: title

# Number of classes
nc: 4
"""

    yaml_file = yolo_dir / "dataset.yaml"
    with open(yaml_file, 'w') as f:
        f.write(yaml_content)

    return {
        'train_images': len(train_images),
        'val_images': len(val_images),
        'yaml_file': str(yaml_file),
    }


def main():
    parser = argparse.ArgumentParser(
        description='Export CV+LLM detections to YOLO format'
    )
    parser.add_argument('--output-dirs', nargs='+', required=True,
                        help='Pipeline output directories to export')
    parser.add_argument('--prefixes', nargs='+', default=None,
                        help='Prefixes for each output dir (to avoid name collisions)')
    parser.add_argument('--yolo-dir', required=True,
                        help='Output directory for YOLO dataset')
    parser.add_argument('--train-split', type=float, default=0.8,
                        help='Fraction of data for training (default: 0.8)')

    args = parser.parse_args()

    yolo_dir = Path(args.yolo_dir)
    yolo_dir.mkdir(parents=True, exist_ok=True)

    prefixes = args.prefixes or [''] * len(args.output_dirs)
    if len(prefixes) != len(args.output_dirs):
        print("Error: Number of prefixes must match number of output directories")
        return

    print("=" * 60)
    print("Exporting CV+LLM Detections to YOLO Format")
    print("=" * 60)

    all_results = []
    grand_total = {name: 0 for name in CLASS_NAMES}

    for output_dir, prefix in zip(args.output_dirs, prefixes):
        output_dir = Path(output_dir)
        print(f"\nExporting: {output_dir.name}")
        print(f"  Prefix: '{prefix}'")

        result = export_pipeline_output(output_dir, yolo_dir, prefix)
        all_results.append(result)

        print(f"  Sheets processed: {len(result['sheets'])}")
        print(f"  Total markers: {result['total_markers']}")
        print(f"  By class:")
        for name, count in result['total_counts'].items():
            print(f"    {name}: {count}")
            grand_total[name] += count

    print("\n" + "=" * 60)
    print("Creating train/val split...")
    split_result = create_dataset_yaml(yolo_dir, args.train_split)

    print(f"  Train images: {split_result['train_images']}")
    print(f"  Val images: {split_result['val_images']}")
    print(f"  Dataset YAML: {split_result['yaml_file']}")

    print("\n" + "=" * 60)
    print("Grand Total:")
    print(f"  Total markers: {sum(grand_total.values())}")
    for name, count in grand_total.items():
        print(f"    {name}: {count}")

    print(f"\nYOLO dataset saved to: {yolo_dir}")
    print("Done!")


if __name__ == '__main__':
    main()
