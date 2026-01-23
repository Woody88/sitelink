#!/usr/bin/env python3
"""
Generate Precision-Recall curves for YOLO models.

This helps identify the optimal confidence threshold to maximize recall
while maintaining acceptable precision.
"""

import argparse
from ultralytics import YOLO

def generate_pr_curve(model_path: str, model_name: str):
    """Generate PR curve for a model."""
    print(f"\n{'='*70}")
    print(f"Generating PR Curve: {model_name}")
    print(f"Model: {model_path}")
    print(f"{'='*70}\n")

    model = YOLO(model_path)

    # Run validation with plots enabled
    results = model.val(
        data='dataset_highres/data.yaml',
        save_json=True,
        plots=True,
        name=f'val_{model_name}',
        exist_ok=True,
    )

    # Print key metrics
    print(f"\n{'='*70}")
    print(f"Results for {model_name}:")
    print(f"{'='*70}")
    print(f"Precision: {results.results_dict['metrics/precision(B)']:.4f}")
    print(f"Recall:    {results.results_dict['metrics/recall(B)']:.4f}")
    print(f"mAP50:     {results.results_dict['metrics/mAP50(B)']:.4f}")
    print(f"mAP50-95:  {results.results_dict['metrics/mAP50-95(B)']:.4f}")
    print(f"\nPR curve saved to: runs/detect/val_{model_name}/PR_curve.png")
    print(f"Results saved to: runs/detect/val_{model_name}/")
    print(f"{'='*70}\n")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate PR curves for YOLO models')
    parser.add_argument('--model', default='weights/callout_detector.pt', help='Model path')
    parser.add_argument('--name', default='baseline', help='Model name for output')
    args = parser.parse_args()

    generate_pr_curve(args.model, args.name)
