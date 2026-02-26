#!/usr/bin/env python3
"""
Train YOLO26n with grid_bubble class (4 classes total)

Fine-tunes from best_v5_balanced.pt to add grid_bubble while preserving
performance on existing classes (detail, elevation, title).

Dataset: callout-detection-combined v1
- 956 train / 78 valid images
- Classes: detail (3847), elevation (2553), grid_bubble (985), title (1870)
"""

from ultralytics import YOLO
import os

# Configuration
BASE_MODEL = '/home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/weights/best_v5_balanced.pt'
DATA_YAML = '/home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/datasets/callout-detection-combined/data.yaml'
EPOCHS = 150
IMG_SIZE = 2048
BATCH_SIZE = 2
PROJECT = 'runs/train'
NAME = 'grid_bubble_v1'

def train():
    model = YOLO(BASE_MODEL)

    print(f"\n{'='*60}")
    print(f"Training Configuration:")
    print(f"  Base Model: {BASE_MODEL}")
    print(f"  Dataset: {DATA_YAML}")
    print(f"  Epochs: {EPOCHS}")
    print(f"  Image Size: {IMG_SIZE}")
    print(f"  Batch Size: {BATCH_SIZE}")
    print(f"  Classes: detail, elevation, grid_bubble, title")
    print(f"{'='*60}\n")

    results = model.train(
        data=DATA_YAML,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        project=PROJECT,
        name=NAME,
        device=0,
        workers=0,
        # Construction drawing augmentation
        hsv_h=0.0,
        hsv_s=0.0,
        hsv_v=0.2,
        degrees=0,
        translate=0.1,
        scale=0.3,
        shear=0,
        perspective=0,
        flipud=0,
        fliplr=0.5,
        mosaic=0.5,
        mixup=0.0,
        copy_paste=0.0,
        # Training settings
        patience=20,
        save_period=10,
        val=True,
        plots=True,
        verbose=True
    )

    print(f"\n{'='*60}")
    print(f"Training Complete!")
    print(f"  Best weights: {PROJECT}/{NAME}/weights/best.pt")
    print(f"  Results: {PROJECT}/{NAME}/results.csv")
    print(f"{'='*60}\n")

    return results

if __name__ == '__main__':
    train()
