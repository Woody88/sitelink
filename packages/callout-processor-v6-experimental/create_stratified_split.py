#!/usr/bin/env python3
"""
Create stratified train/valid/test split for YOLO dataset.

Roboflow exported all 727 images to train/ with 0 in valid/test.
This script creates a 70/20/10 split while maintaining class balance.

Classes: legend (0), notes (1), schedule (2)
"""

import os
import random
import shutil
from collections import defaultdict
from pathlib import Path

DATASET_DIR = Path("datasets/document-layout-construction")
TRAIN_RATIO = 0.70
VALID_RATIO = 0.20
TEST_RATIO = 0.10

SEED = 42


def get_image_classes(label_path: Path) -> set[int]:
    """Parse YOLO label file and return set of class IDs present."""
    classes = set()
    if label_path.exists():
        with open(label_path) as f:
            for line in f:
                parts = line.strip().split()
                if parts:
                    classes.add(int(parts[0]))
    return classes


def main():
    random.seed(SEED)

    train_images_dir = DATASET_DIR / "train" / "images"
    train_labels_dir = DATASET_DIR / "train" / "labels"

    images = sorted(train_images_dir.glob("*.[jJ][pP][gG]"))
    images.extend(sorted(train_images_dir.glob("*.[pP][nN][gG]")))

    print(f"Total images found: {len(images)}")

    # Group images by primary class (first class in label file)
    # For stratification, we use the dominant class (most annotations) in each image
    class_to_images = defaultdict(list)
    image_to_classes = {}

    for img_path in images:
        label_name = img_path.stem + ".txt"
        label_path = train_labels_dir / label_name

        classes = get_image_classes(label_path)
        image_to_classes[img_path] = classes

        if classes:
            # Count occurrences of each class in this label file
            class_counts = defaultdict(int)
            with open(label_path) as f:
                for line in f:
                    parts = line.strip().split()
                    if parts:
                        class_counts[int(parts[0])] += 1
            # Use the most frequent class as the stratification key
            dominant_class = max(class_counts.keys(), key=lambda c: class_counts[c])
            class_to_images[dominant_class].append(img_path)
        else:
            # No annotations - put in "empty" group
            class_to_images[-1].append(img_path)

    print("\nImages per dominant class:")
    class_names = {0: "legend", 1: "notes", 2: "schedule", -1: "empty"}
    for cls_id, imgs in sorted(class_to_images.items()):
        print(f"  {class_names.get(cls_id, cls_id)}: {len(imgs)}")

    # Create output directories
    for split in ["train", "valid", "test"]:
        (DATASET_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (DATASET_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    # Stratified split for each class
    train_images = []
    valid_images = []
    test_images = []

    for cls_id, imgs in class_to_images.items():
        random.shuffle(imgs)
        n = len(imgs)
        n_train = int(n * TRAIN_RATIO)
        n_valid = int(n * VALID_RATIO)
        # Test gets the rest

        train_images.extend(imgs[:n_train])
        valid_images.extend(imgs[n_train:n_train + n_valid])
        test_images.extend(imgs[n_train + n_valid:])

    print(f"\nSplit sizes:")
    print(f"  Train: {len(train_images)} ({len(train_images)/len(images)*100:.1f}%)")
    print(f"  Valid: {len(valid_images)} ({len(valid_images)/len(images)*100:.1f}%)")
    print(f"  Test:  {len(test_images)} ({len(test_images)/len(images)*100:.1f}%)")

    # Move files
    def move_files(img_paths: list[Path], target_split: str):
        target_img_dir = DATASET_DIR / target_split / "images"
        target_lbl_dir = DATASET_DIR / target_split / "labels"

        for img_path in img_paths:
            # Skip if already in correct location
            if target_split == "train":
                continue  # Keep train images where they are (for now we'll reorganize)

            # Move image
            target_img = target_img_dir / img_path.name
            shutil.move(str(img_path), str(target_img))

            # Move label
            label_name = img_path.stem + ".txt"
            label_path = train_labels_dir / label_name
            if label_path.exists():
                target_lbl = target_lbl_dir / label_name
                shutil.move(str(label_path), str(target_lbl))

    # Move valid and test files out of train
    print("\nMoving files...")
    move_files(valid_images, "valid")
    move_files(test_images, "test")

    # Verify final counts
    print("\nFinal counts:")
    for split in ["train", "valid", "test"]:
        img_count = len(list((DATASET_DIR / split / "images").glob("*")))
        lbl_count = len(list((DATASET_DIR / split / "labels").glob("*")))
        print(f"  {split}: {img_count} images, {lbl_count} labels")

    # Count class distribution in each split
    print("\nClass distribution per split:")
    for split in ["train", "valid", "test"]:
        class_counts = defaultdict(int)
        labels_dir = DATASET_DIR / split / "labels"
        for label_file in labels_dir.glob("*.txt"):
            with open(label_file) as f:
                for line in f:
                    parts = line.strip().split()
                    if parts:
                        class_counts[int(parts[0])] += 1

        print(f"  {split}:")
        for cls_id in sorted(class_counts.keys()):
            print(f"    {class_names.get(cls_id, cls_id)}: {class_counts[cls_id]}")


if __name__ == "__main__":
    main()
