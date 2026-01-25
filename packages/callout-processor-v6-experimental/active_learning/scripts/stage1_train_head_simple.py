#!/usr/bin/env python3
"""
Stage 1: Train detection head only with frozen backbone.

Uses Ultralytics 'freeze' parameter to freeze first 10 layers.
"""

from ultralytics import YOLO

# Configuration
BASE_MODEL = 'yolo26n.pt'
DATASET = '../dataset_combined/data.yaml'
EPOCHS = 25
FREEZE_LAYERS = 10  # Freeze first 10 layers (backbone)

print("="*70)
print("STAGE 1: Training Detection Head Only")
print("="*70)
print(f"Base Model: {BASE_MODEL}")
print(f"Freezing: First {FREEZE_LAYERS} layers (backbone)")
print(f"Epochs: {EPOCHS}")
print("="*70)
print()

# Load and train
model = YOLO(BASE_MODEL)

results = model.train(
    data=DATASET,
    epochs=EPOCHS,
    imgsz=2048,
    batch=2,
    lr0=0.001,
    freeze=FREEZE_LAYERS,  # Freeze first 10 layers
    project='iterations',
    name='iteration_3_stage1',
    device=0,
    exist_ok=True,
    # Augmentation
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
    patience=10,
    save_period=5,
    val=True,
    plots=True,
    verbose=True,
    workers=0,
)

print()
print("="*70)
print("Stage 1 Complete!")
print("Weights: iterations/iteration_3_stage1/weights/best.pt")
print("="*70)
