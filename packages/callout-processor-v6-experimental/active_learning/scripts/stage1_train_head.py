#!/usr/bin/env python3
"""
Stage 1: Train detection head only with frozen backbone.

This prevents catastrophic forgetting by keeping pretrained COCO features intact
while adapting the detection head to callout detection task.
"""

from ultralytics import YOLO
import torch

# Configuration
BASE_MODEL = 'yolo26n.pt'  # COCO pretrained weights
DATASET = '../dataset_combined/data.yaml'
OUTPUT_DIR = 'iterations/iteration_3_stage1'
EPOCHS = 25
LEARNING_RATE = 0.001
IMG_SIZE = 2048
BATCH_SIZE = 2

# Augmentation (same as baseline)
AUGMENTATION = {
    'hsv_h': 0.0,
    'hsv_s': 0.0,
    'hsv_v': 0.2,
    'degrees': 0,
    'translate': 0.1,
    'scale': 0.3,
    'shear': 0,
    'perspective': 0,
    'flipud': 0,
    'fliplr': 0.5,
    'mosaic': 0.5,
    'mixup': 0.0,
    'copy_paste': 0.0,
}

# Training settings
TRAINING = {
    'patience': 10,
    'save_period': 5,
    'val': True,
    'plots': True,
    'verbose': True,
    'workers': 0,
}

def main():
    print("="*70)
    print("STAGE 1: Training Detection Head Only (Frozen Backbone)")
    print("="*70)
    print(f"Base Model: {BASE_MODEL}")
    print(f"Dataset: {DATASET}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Epochs: {EPOCHS}")
    print(f"Learning Rate: {LEARNING_RATE}")
    print(f"Strategy: Freeze backbone layers, train head only")
    print("="*70)
    print()

    # Load pretrained model
    print(f"Loading COCO pretrained model: {BASE_MODEL}...")
    model = YOLO(BASE_MODEL)

    # Freeze backbone layers (layers 0-9 in YOLO26n)
    # Detection head starts around layer 10
    print("Freezing backbone layers (0-9)...")
    freeze_layers = 10

    for i, (name, param) in enumerate(model.model.named_parameters()):
        if i < freeze_layers * 10:  # Approximate layer count per module
            param.requires_grad = False

    frozen_params = sum(1 for p in model.model.parameters() if not p.requires_grad)
    total_params = sum(1 for p in model.model.parameters())
    print(f"Frozen: {frozen_params}/{total_params} parameter groups")
    print(f"Training: {total_params - frozen_params} parameter groups")
    print()

    # Train with frozen backbone
    print("Starting Stage 1 training...")
    results = model.train(
        data=DATASET,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        lr0=LEARNING_RATE,
        project='iterations',
        name='iteration_3_stage1',
        device=0,
        exist_ok=True,
        **AUGMENTATION,
        **TRAINING
    )

    print()
    print("="*70)
    print("Stage 1 Complete!")
    print(f"Weights saved to: {OUTPUT_DIR}/weights/best.pt")
    print("Next: Run Stage 2 with hyperparameter evolution")
    print("="*70)

if __name__ == '__main__':
    main()
