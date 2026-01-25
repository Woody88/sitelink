"""
Compare all detection methods side by side.

Tests:
1. YOLO-26E + SAHI (zero-shot text prompts)
2. Fine-tuned YOLOv8 + SAHI (supervised, v4 baseline)

Generates comparison visualizations and metrics.
"""

import json
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List
import sys

sys.path.insert(0, 'src')

from detect_yoloe import detect_callouts_text_sahi
from detect_yolo_finetuned import detect_callouts_finetuned


def create_comparison_grid(image_paths: Dict[str, str], output_path: str):
    """Create side-by-side comparison of detection results."""
    images = []
    titles = []

    for title, path in image_paths.items():
        img = cv2.imread(path)
        if img is not None:
            height = 800
            width = int(img.shape[1] * (height / img.shape[0]))
            img_resized = cv2.resize(img, (width, height))

            cv2.putText(img_resized, title, (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            images.append(img_resized)
            titles.append(title)

    if len(images) == 2:
        grid = np.hstack(images)
    else:
        grid = images[0]

    cv2.imwrite(output_path, grid)
    print(f"Comparison grid saved: {output_path}")


def compare_all_methods(image_path: str, prompts_path: str, output_dir: str = "test_output"):
    """Run all detection methods and generate comparison."""

    Path(output_dir).mkdir(exist_ok=True)

    with open(prompts_path) as f:
        prompts = json.load(f)

    print("=" * 60)
    print("CALLOUT DETECTION METHOD COMPARISON")
    print("=" * 60)
    print(f"Input image: {image_path}\n")

    results = {}

    print("\n[1/2] YOLO-26E + SAHI (Zero-Shot)")
    print("-" * 60)
    try:
        yoloe_results = detect_callouts_text_sahi(
            image_path,
            prompts,
            conf_threshold=0.05,
            output_path=f"{output_dir}/comparison_yoloe_sahi.png"
        )
        results['YOLO-26E + SAHI'] = yoloe_results
        print(f"✓ Detected {len(yoloe_results['detections'])} callouts")
    except Exception as e:
        print(f"✗ Error: {e}")
        results['YOLO-26E + SAHI'] = None

    print("\n[2/2] Fine-tuned YOLOv8 + SAHI (Supervised)")
    print("-" * 60)
    try:
        finetuned_results = detect_callouts_finetuned(
            image_path,
            conf_threshold=0.01,
            output_path=f"{output_dir}/comparison_yolo_finetuned.png"
        )
        results['Fine-tuned YOLO'] = finetuned_results
        print(f"✓ Detected {len(finetuned_results['detections'])} callouts")
    except Exception as e:
        print(f"✗ Error: {e}")
        results['Fine-tuned YOLO'] = None

    print("\n" + "=" * 60)
    print("COMPARISON SUMMARY")
    print("=" * 60)

    summary = {}
    for method, result in results.items():
        if result:
            detections = result['detections']
            by_class = {}
            for det in detections:
                cls = det.get('callout_type', det.get('class', 'unknown'))
                by_class[cls] = by_class.get(cls, 0) + 1

            summary[method] = {
                'total': len(detections),
                'by_class': by_class
            }
        else:
            summary[method] = {
                'total': 0,
                'by_class': {}
            }

    print(f"\n{'Method':<30} {'Total':<10} {'Detail':<10} {'Elevation':<12} {'Section':<10} {'Title':<10}")
    print("-" * 90)

    for method, data in summary.items():
        by_class = data['by_class']
        print(f"{method:<30} {data['total']:<10} "
              f"{by_class.get('detail', 0):<10} "
              f"{by_class.get('elevation', 0):<12} "
              f"{by_class.get('section', 0):<10} "
              f"{by_class.get('title', 0):<10}")

    print("\n" + "=" * 60)

    image_paths = {}
    if results.get('YOLO-26E + SAHI'):
        image_paths['YOLO-26E + SAHI'] = f"{output_dir}/comparison_yoloe_sahi.png"
    if results.get('Fine-tuned YOLO'):
        image_paths['Fine-tuned YOLO'] = f"{output_dir}/comparison_yolo_finetuned.png"

    if len(image_paths) >= 2:
        create_comparison_grid(image_paths, f"{output_dir}/comparison_grid.png")

    summary_path = f"{output_dir}/comparison_summary.json"
    with open(summary_path, 'w') as f:
        json.dump({
            'input_image': image_path,
            'methods': summary,
            'full_results': {k: v for k, v in results.items() if v is not None}
        }, f, indent=2)
    print(f"\nSummary saved: {summary_path}")

    return results, summary


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Compare callout detection methods")
    parser.add_argument("image", help="Path to plan image")
    parser.add_argument("--prompts", default="prompts/us_ncs.json", help="Path to prompts JSON")
    parser.add_argument("--output-dir", default="test_output", help="Output directory")

    args = parser.parse_args()

    results, summary = compare_all_methods(args.image, args.prompts, args.output_dir)

    print("\n✓ Comparison complete!")
    print(f"  - Annotated images: {args.output_dir}/comparison_*.png")
    print(f"  - Comparison grid: {args.output_dir}/comparison_grid.png")
    print(f"  - JSON summary: {args.output_dir}/comparison_summary.json")
