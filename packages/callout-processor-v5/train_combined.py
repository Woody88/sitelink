#!/usr/bin/env python3
"""
Train YOLOv8 on combined dataset (v5 + v6)

Dataset stats:
- 1063 detail annotations (36.2%)
- 1005 elevation annotations (34.3%)
- 865 title annotations (29.5%)
- Total: 2933 annotations across 269 images
"""

from ultralytics import YOLO
import os

# Configuration
DATA_YAML = 'dataset_combined/data.yaml'
MODEL_SIZE = 'n'  # nano for fast training
EPOCHS = 150
IMG_SIZE = 2048  # Match dataset resolution (detail circles ~18px at this size)
BATCH_SIZE = 2    # Small batch for large images (v4 approach)
PROJECT = 'runs/train'
NAME = 'combined_v5_v6'

def train():
    # Initialize model (start from scratch or use pretrained)
    model = YOLO(f'yolo26{MODEL_SIZE}.pt')  # Use YOLO26n pretrained weights

    print(f"\n{'='*60}")
    print(f"Training Configuration:")
    print(f"  Model: YOLO26{MODEL_SIZE}")
    print(f"  Dataset: {DATA_YAML}")
    print(f"  Epochs: {EPOCHS}")
    print(f"  Image Size: {IMG_SIZE}")
    print(f"  Batch Size: {BATCH_SIZE}")
    print(f"  Classes: detail, elevation, title")
    print(f"  Annotations: 2933 (detail: 1063, elevation: 1005, title: 865)")
    print(f"{'='*60}\n")

    # Train (v4-style config for construction drawings)
    results = model.train(
        data=DATA_YAML,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        project=PROJECT,
        name=NAME,
        device=0,  # GPU
        workers=0,  # Single process mode to avoid multiprocessing issues
        # Data augmentation - tuned for construction drawings (from v4)
        hsv_h=0.0,      # No hue shift (drawings are black/white)
        hsv_s=0.0,      # No saturation shift
        hsv_v=0.2,      # Slight brightness variation
        degrees=0,      # No rotation (drawings are axis-aligned)
        translate=0.1,  # Slight translation
        scale=0.3,      # Scale augmentation
        shear=0,        # No shear
        perspective=0,  # No perspective
        flipud=0,       # No vertical flip
        fliplr=0.5,     # Horizontal flip (drawings can be mirrored)
        mosaic=0.5,     # Reduced mosaic (preserve drawing context)
        mixup=0.0,      # No mixup
        copy_paste=0.0, # No copy-paste
        # Training settings
        patience=20,    # Early stopping
        save_period=10, # Save every 10 epochs
        val=True,       # Validate during training
        plots=True,     # Generate plots
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
