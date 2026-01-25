#!/usr/bin/env python3
"""
Fine-tuning script for iteration 2.

Uses YOLO26 baseline weights with fine-tuning parameters:
- Lower learning rate (0.0005)
- Shorter training (100 epochs)
- Same augmentation as baseline
"""

import sys
from pathlib import Path
from ultralytics import YOLO

# Configuration
BASE_MODEL = 'iterations/iteration_0_baseline/weights/best.pt'
DATASET = '../dataset_combined/data.yaml'
OUTPUT_DIR = 'iterations/iteration_2_finetune'
EPOCHS = 100
LEARNING_RATE = 0.0005
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
    'patience': 20,
    'save_period': 10,
    'val': True,
    'plots': True,
    'verbose': True,
    'workers': 0,
}

def main():
    print("="*70)
    print("Iteration 2: Fine-tuning from Baseline")
    print("="*70)
    print(f"Base Model: {BASE_MODEL}")
    print(f"Dataset: {DATASET}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Epochs: {EPOCHS}")
    print(f"Learning Rate: {LEARNING_RATE}")
    print(f"Image Size: {IMG_SIZE}")
    print(f"Batch Size: {BATCH_SIZE}")
    print("="*70)
    print()

    # Load model from baseline weights
    print(f"Loading model from {BASE_MODEL}...")
    model = YOLO(BASE_MODEL)

    # Train with fine-tuning parameters
    print("Starting fine-tuning training...")
    results = model.train(
        data=DATASET,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        lr0=LEARNING_RATE,
        project='iterations',
        name='iteration_2_finetune',
        device=0,
        exist_ok=True,
        **AUGMENTATION,
        **TRAINING
    )

    print()
    print("="*70)
    print("Fine-tuning Complete!")
    print(f"Weights saved to: {OUTPUT_DIR}/weights/best.pt")
    print("="*70)

if __name__ == '__main__':
    main()
