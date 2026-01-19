#!/usr/bin/env python3
"""
Tile large images into smaller patches for small object detection.

This helps YOLOv8 detect small callouts by making them larger relative to the tile size.
"""

import argparse
import json
import shutil
from pathlib import Path
from typing import List, Tuple, Dict
import random

import cv2
import numpy as np


def parse_yolo_label(label_path: Path) -> List[Tuple[int, float, float, float, float]]:
    """Parse YOLO format labels."""
    labels = []
    if not label_path.exists():
        return labels

    with open(label_path) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                cls = int(parts[0])
                cx, cy, w, h = map(float, parts[1:5])
                labels.append((cls, cx, cy, w, h))
    return labels


def box_in_tile(
    cx: float, cy: float, w: float, h: float,
    tile_x1: float, tile_y1: float, tile_x2: float, tile_y2: float,
    min_visibility: float = 0.5
) -> Tuple[bool, float, float, float, float]:
    """
    Check if a box is within a tile and convert coordinates.

    Args:
        cx, cy, w, h: Normalized box coordinates (0-1)
        tile_x1, tile_y1, tile_x2, tile_y2: Tile bounds in normalized coords
        min_visibility: Minimum fraction of box that must be visible

    Returns:
        (is_valid, new_cx, new_cy, new_w, new_h) in tile-relative coords
    """
    tile_w = tile_x2 - tile_x1
    tile_h = tile_y2 - tile_y1

    # Box bounds
    bx1 = cx - w / 2
    by1 = cy - h / 2
    bx2 = cx + w / 2
    by2 = cy + h / 2

    # Clip to tile
    clipped_x1 = max(bx1, tile_x1)
    clipped_y1 = max(by1, tile_y1)
    clipped_x2 = min(bx2, tile_x2)
    clipped_y2 = min(by2, tile_y2)

    # Check if box intersects tile
    if clipped_x1 >= clipped_x2 or clipped_y1 >= clipped_y2:
        return False, 0, 0, 0, 0

    # Calculate visibility
    original_area = w * h
    clipped_w = clipped_x2 - clipped_x1
    clipped_h = clipped_y2 - clipped_y1
    clipped_area = clipped_w * clipped_h

    visibility = clipped_area / original_area if original_area > 0 else 0

    if visibility < min_visibility:
        return False, 0, 0, 0, 0

    # Convert to tile-relative coordinates
    new_cx = ((clipped_x1 + clipped_x2) / 2 - tile_x1) / tile_w
    new_cy = ((clipped_y1 + clipped_y2) / 2 - tile_y1) / tile_h
    new_w = clipped_w / tile_w
    new_h = clipped_h / tile_h

    # Clamp to valid range
    new_cx = max(0.001, min(0.999, new_cx))
    new_cy = max(0.001, min(0.999, new_cy))
    new_w = min(new_w, min(new_cx, 1 - new_cx) * 2 * 0.99)
    new_h = min(new_h, min(new_cy, 1 - new_cy) * 2 * 0.99)

    return True, new_cx, new_cy, new_w, new_h


def tile_image(
    image_path: Path,
    label_path: Path,
    output_images_dir: Path,
    output_labels_dir: Path,
    tile_size: int = 640,
    overlap: float = 0.25,
    min_labels_per_tile: int = 1
) -> Dict:
    """
    Tile an image and its labels.

    Args:
        image_path: Path to source image
        label_path: Path to YOLO label file
        output_images_dir: Where to save tiles
        output_labels_dir: Where to save tile labels
        tile_size: Size of each tile in pixels
        overlap: Overlap fraction between tiles
        min_labels_per_tile: Minimum labels to keep a tile

    Returns:
        Stats dict
    """
    image = cv2.imread(str(image_path))
    if image is None:
        return {'error': f'Failed to load {image_path}'}

    h, w = image.shape[:2]
    labels = parse_yolo_label(label_path)

    # Calculate stride
    stride = int(tile_size * (1 - overlap))

    # Generate tile positions
    tiles_generated = 0
    labels_generated = 0
    empty_tiles = 0

    base_name = image_path.stem

    for ty, y in enumerate(range(0, h - tile_size + 1, stride)):
        for tx, x in enumerate(range(0, w - tile_size + 1, stride)):
            # Tile bounds in pixel coords
            x1, y1 = x, y
            x2, y2 = x + tile_size, y + tile_size

            # Tile bounds in normalized coords
            tile_x1_norm = x1 / w
            tile_y1_norm = y1 / h
            tile_x2_norm = x2 / w
            tile_y2_norm = y2 / h

            # Find labels in this tile
            tile_labels = []
            for cls, cx, cy, bw, bh in labels:
                valid, new_cx, new_cy, new_w, new_h = box_in_tile(
                    cx, cy, bw, bh,
                    tile_x1_norm, tile_y1_norm, tile_x2_norm, tile_y2_norm
                )
                if valid:
                    tile_labels.append((cls, new_cx, new_cy, new_w, new_h))

            # Skip tiles with too few labels
            if len(tile_labels) < min_labels_per_tile:
                empty_tiles += 1
                continue

            # Extract tile
            tile = image[y1:y2, x1:x2]

            # Save tile
            tile_name = f"{base_name}_tile_{ty}_{tx}"
            tile_image_path = output_images_dir / f"{tile_name}.png"
            tile_label_path = output_labels_dir / f"{tile_name}.txt"

            cv2.imwrite(str(tile_image_path), tile)

            with open(tile_label_path, 'w') as f:
                for cls, cx, cy, bw, bh in tile_labels:
                    f.write(f"{cls} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")

            tiles_generated += 1
            labels_generated += len(tile_labels)

    # Also include edge tiles to cover bottom-right
    # Right edge
    if w > tile_size:
        x = w - tile_size
        for ty, y in enumerate(range(0, h - tile_size + 1, stride)):
            x1, y1 = x, y
            x2, y2 = x + tile_size, y + tile_size

            tile_x1_norm = x1 / w
            tile_y1_norm = y1 / h
            tile_x2_norm = x2 / w
            tile_y2_norm = y2 / h

            tile_labels = []
            for cls, cx, cy, bw, bh in labels:
                valid, new_cx, new_cy, new_w, new_h = box_in_tile(
                    cx, cy, bw, bh,
                    tile_x1_norm, tile_y1_norm, tile_x2_norm, tile_y2_norm
                )
                if valid:
                    tile_labels.append((cls, new_cx, new_cy, new_w, new_h))

            if len(tile_labels) >= min_labels_per_tile:
                tile = image[y1:y2, x1:x2]
                tile_name = f"{base_name}_tile_{ty}_edge_r"
                cv2.imwrite(str(output_images_dir / f"{tile_name}.png"), tile)
                with open(output_labels_dir / f"{tile_name}.txt", 'w') as f:
                    for cls, cx, cy, bw, bh in tile_labels:
                        f.write(f"{cls} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")
                tiles_generated += 1
                labels_generated += len(tile_labels)

    # Bottom edge
    if h > tile_size:
        y = h - tile_size
        for tx, x in enumerate(range(0, w - tile_size + 1, stride)):
            x1, y1 = x, y
            x2, y2 = x + tile_size, y + tile_size

            tile_x1_norm = x1 / w
            tile_y1_norm = y1 / h
            tile_x2_norm = x2 / w
            tile_y2_norm = y2 / h

            tile_labels = []
            for cls, cx, cy, bw, bh in labels:
                valid, new_cx, new_cy, new_w, new_h = box_in_tile(
                    cx, cy, bw, bh,
                    tile_x1_norm, tile_y1_norm, tile_x2_norm, tile_y2_norm
                )
                if valid:
                    tile_labels.append((cls, new_cx, new_cy, new_w, new_h))

            if len(tile_labels) >= min_labels_per_tile:
                tile = image[y1:y2, x1:x2]
                tile_name = f"{base_name}_tile_edge_b_{tx}"
                cv2.imwrite(str(output_images_dir / f"{tile_name}.png"), tile)
                with open(output_labels_dir / f"{tile_name}.txt", 'w') as f:
                    for cls, cx, cy, bw, bh in tile_labels:
                        f.write(f"{cls} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")
                tiles_generated += 1
                labels_generated += len(tile_labels)

    return {
        'source_size': (w, h),
        'tiles_generated': tiles_generated,
        'labels_generated': labels_generated,
        'empty_tiles_skipped': empty_tiles,
        'original_labels': len(labels),
    }


def create_tiled_dataset(
    source_dir: Path,
    output_dir: Path,
    tile_size: int = 640,
    overlap: float = 0.25,
    train_split: float = 0.8
):
    """Create a tiled dataset from full images."""

    source_images = source_dir / "images"
    source_labels = source_dir / "labels"

    # Create output structure
    train_images = output_dir / "train" / "images"
    train_labels = output_dir / "train" / "labels"
    val_images = output_dir / "val" / "images"
    val_labels = output_dir / "val" / "labels"

    for d in [train_images, train_labels, val_images, val_labels]:
        d.mkdir(parents=True, exist_ok=True)

    # Get all images
    images = sorted(source_images.glob("*.png"))

    print("=" * 60)
    print(f"Tiling Dataset")
    print("=" * 60)
    print(f"Source: {source_dir}")
    print(f"Output: {output_dir}")
    print(f"Tile size: {tile_size}px, Overlap: {overlap*100:.0f}%")
    print(f"Images: {len(images)}")
    print("=" * 60)

    # Split into train/val
    random.seed(42)
    random.shuffle(images)
    split_idx = int(len(images) * train_split)
    train_images_list = images[:split_idx]
    val_images_list = images[split_idx:]

    total_stats = {
        'train': {'tiles': 0, 'labels': 0},
        'val': {'tiles': 0, 'labels': 0},
    }

    # Process train images
    print(f"\nProcessing {len(train_images_list)} train images...")
    for img_path in train_images_list:
        label_path = source_labels / f"{img_path.stem}.txt"
        stats = tile_image(
            img_path, label_path,
            train_images, train_labels,
            tile_size, overlap
        )
        if 'error' not in stats:
            total_stats['train']['tiles'] += stats['tiles_generated']
            total_stats['train']['labels'] += stats['labels_generated']
            print(f"  {img_path.name}: {stats['tiles_generated']} tiles, {stats['labels_generated']} labels")

    # Process val images
    print(f"\nProcessing {len(val_images_list)} val images...")
    for img_path in val_images_list:
        label_path = source_labels / f"{img_path.stem}.txt"
        stats = tile_image(
            img_path, label_path,
            val_images, val_labels,
            tile_size, overlap
        )
        if 'error' not in stats:
            total_stats['val']['tiles'] += stats['tiles_generated']
            total_stats['val']['labels'] += stats['labels_generated']
            print(f"  {img_path.name}: {stats['tiles_generated']} tiles, {stats['labels_generated']} labels")

    # Create dataset.yaml
    yaml_content = f"""# Callout Detection Dataset (Tiled)
# Tile size: {tile_size}px, Overlap: {overlap*100:.0f}%

path: {output_dir.absolute()}
train: train/images
val: val/images

names:
  0: detail
  1: section
  2: elevation
  3: title

nc: 4
"""

    with open(output_dir / "dataset.yaml", 'w') as f:
        f.write(yaml_content)

    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  Train: {total_stats['train']['tiles']} tiles, {total_stats['train']['labels']} labels")
    print(f"  Val: {total_stats['val']['tiles']} tiles, {total_stats['val']['labels']} labels")
    print(f"  Dataset YAML: {output_dir / 'dataset.yaml'}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='Tile dataset for small object detection')
    parser.add_argument('--source', required=True, help='Source dataset directory')
    parser.add_argument('--output', required=True, help='Output directory for tiled dataset')
    parser.add_argument('--tile-size', type=int, default=640, help='Tile size in pixels')
    parser.add_argument('--overlap', type=float, default=0.25, help='Overlap fraction')
    parser.add_argument('--train-split', type=float, default=0.8, help='Train split fraction')

    args = parser.parse_args()

    create_tiled_dataset(
        Path(args.source),
        Path(args.output),
        args.tile_size,
        args.overlap,
        args.train_split
    )


if __name__ == '__main__':
    main()
