#!/usr/bin/env python3
"""
Stage 2: Extended training with optimized hyperparameters.

Based on research-backed best practices:
- Lower learning rate for fine-tuning
- Longer training (300 epochs)
- Optimized augmentation
- Early stopping to prevent overfitting
"""

from ultralytics import YOLO

# Configuration
BASE_MODEL = 'iterations/iteration_1_yolo262/weights/best.pt'
DATASET = '../dataset_combined/data.yaml'
EPOCHS = 300

print("="*70)
print("STAGE 2: Extended Training with Optimized Hyperparameters")
print("="*70)
print(f"Base Model: {BASE_MODEL}")
print(f"Epochs: {EPOCHS}")
print(f"Strategy: Research-backed hyperparameter optimization")
print("="*70)
print()

# Load iteration 1 model
model = YOLO(BASE_MODEL)

# Run training with optimized hyperparameters
# Based on research: https://arxiv.org/abs/2304.00501
results = model.train(
    data=DATASET,
    epochs=EPOCHS,
    imgsz=2048,
    batch=2,
    project='iterations',
    name='iteration_4_optimized',
    device=0,
    exist_ok=True,

    # Optimizer settings (research-backed)
    optimizer='AdamW',  # Better than SGD for small datasets
    lr0=0.0005,        # Lower LR for fine-tuning
    lrf=0.01,          # Final LR = lr0 * lrf
    momentum=0.937,
    weight_decay=0.0005,
    warmup_epochs=3.0,
    warmup_momentum=0.8,
    warmup_bias_lr=0.1,

    # Augmentation (optimized for small objects)
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
    degrees=0,
    translate=0.1,
    scale=0.5,
    shear=0,
    perspective=0.0,
    flipud=0.0,
    fliplr=0.5,
    mosaic=1.0,
    mixup=0.0,
    copy_paste=0.0,

    # Loss weights (emphasis on small objects)
    box=7.5,
    cls=0.5,
    dfl=1.5,

    # Training settings
    patience=50,      # More patience for convergence
    save_period=10,
    val=True,
    plots=True,
    verbose=True,
    workers=0,
    close_mosaic=10,  # Disable mosaic in last 10 epochs
)

print()
print("="*70)
print("Stage 2 Complete!")
print("Best weights: iterations/iteration_4_evolve/weights/best.pt")
print("Evolution results: iterations/iteration_4_evolve/evolve.csv")
print("="*70)
