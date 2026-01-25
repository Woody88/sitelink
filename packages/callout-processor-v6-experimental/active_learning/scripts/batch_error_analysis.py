#!/usr/bin/env python3
"""
Batch Error Analysis for Active Learning

Analyzes validation results to identify patterns in false negatives and false positives.
Categorizes errors by size, position, class, and visual characteristics.
Generates visualizations and reports for active learning iteration planning.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
import csv
from collections import defaultdict

def load_validation_report(report_path: str) -> Dict:
    """Load validation report JSON."""
    with open(report_path) as f:
        return json.load(f)

def analyze_per_image_errors(report: Dict) -> Dict[str, Any]:
    """
    Analyze error patterns across images.

    Returns analysis including:
    - Images with most FNs
    - Images with most FPs
    - Zero-detection images
    - Perfect detection images
    """
    per_image = report['per_image']

    # Sort by FN count
    by_fn = sorted(per_image, key=lambda x: x['fn'], reverse=True)
    by_fp = sorted(per_image, key=lambda x: x['fp'], reverse=True)

    zero_detections = [img for img in per_image if img['det_count'] == 0 and img['gt_count'] > 0]
    perfect = [img for img in per_image if img['f1'] == 1.0]

    # Calculate FN distribution
    fn_counts = defaultdict(int)
    for img in per_image:
        fn_counts[img['fn']] += 1

    return {
        'worst_fn_images': by_fn[:20],  # Top 20 images with most FNs
        'worst_fp_images': by_fp[:10],  # Top 10 images with most FPs
        'zero_detection_images': zero_detections,
        'perfect_images': perfect,
        'fn_distribution': dict(fn_counts),
        'total_images': len(per_image),
        'images_with_errors': len([img for img in per_image if img['fn'] > 0 or img['fp'] > 0])
    }

def generate_error_summary(report: Dict, image_analysis: Dict) -> str:
    """Generate human-readable error summary."""
    overall = report['overall']
    by_class = report['by_class']

    summary = []
    summary.append("=" * 80)
    summary.append("ERROR ANALYSIS SUMMARY")
    summary.append("=" * 80)
    summary.append("")

    summary.append("Overall Performance:")
    summary.append(f"  F1 Score: {overall['f1']:.1%}")
    summary.append(f"  Precision: {overall['precision']:.1%}")
    summary.append(f"  Recall: {overall['recall']:.1%}")
    summary.append(f"  False Negatives: {overall['fn']} ({overall['fn']/overall['gt_total']:.1%} of ground truth)")
    summary.append(f"  False Positives: {overall['fp']}")
    summary.append("")

    summary.append("Per-Class False Negatives:")
    for cls, metrics in by_class.items():
        fn_rate = metrics['fn'] / metrics['gt_count'] if metrics['gt_count'] > 0 else 0
        summary.append(f"  {cls:12s}: {metrics['fn']:3d} FNs ({fn_rate:.1%} missed)")
    summary.append("")

    summary.append("Image-Level Analysis:")
    summary.append(f"  Total images: {image_analysis['total_images']}")
    summary.append(f"  Images with errors: {image_analysis['images_with_errors']}")
    summary.append(f"  Perfect detections: {len(image_analysis['perfect_images'])}")
    summary.append(f"  Zero detections: {len(image_analysis['zero_detection_images'])}")
    summary.append("")

    summary.append("Worst Performing Images (by FN count):")
    for i, img in enumerate(image_analysis['worst_fn_images'][:10], 1):
        summary.append(f"  {i:2d}. {img['image'][:60]:60s} - {img['fn']} FNs (GT:{img['gt_count']} Det:{img['det_count']})")
    summary.append("")

    if image_analysis['zero_detection_images']:
        summary.append(f"Zero Detection Images ({len(image_analysis['zero_detection_images'])} images):")
        for img in image_analysis['zero_detection_images'][:10]:
            summary.append(f"  - {img['image'][:70]:70s} ({img['gt_count']} callouts)")
        summary.append("")

    summary.append("=" * 80)

    return "\n".join(summary)

def extract_hard_examples(image_analysis: Dict, max_samples: int = 50) -> List[Dict]:
    """
    Extract hard examples for active learning.

    Strategy:
    1. Include all zero-detection images (highest priority)
    2. Include images with high FN counts
    3. Diversify across images (avoid too many augmentations of same image)
    """
    hard_examples = []

    # Priority 1: Zero detection images (critical failures)
    for img in image_analysis['zero_detection_images']:
        hard_examples.append({
            'image': img['image'],
            'fn_count': img['fn'],
            'gt_count': img['gt_count'],
            'priority': 'critical',
            'reason': 'zero_detections'
        })

    # Priority 2: High FN count images
    for img in image_analysis['worst_fn_images']:
        if img['fn'] >= 3:  # At least 3 FNs
            # Check if we already have an augmentation of this base image
            base_name = img['image'].split('.rf.')[0] if '.rf.' in img['image'] else img['image']
            if not any(ex['image'].startswith(base_name) for ex in hard_examples):
                hard_examples.append({
                    'image': img['image'],
                    'fn_count': img['fn'],
                    'gt_count': img['gt_count'],
                    'priority': 'high',
                    'reason': 'high_fn_count'
                })

    # Limit to max_samples
    hard_examples = hard_examples[:max_samples]

    return hard_examples

def save_error_report(report: Dict, image_analysis: Dict, hard_examples: List[Dict], output_dir: Path):
    """Save comprehensive error analysis report."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save full analysis JSON
    analysis_data = {
        'overall_metrics': report['overall'],
        'by_class': report['by_class'],
        'image_analysis': {
            'total_images': image_analysis['total_images'],
            'images_with_errors': image_analysis['images_with_errors'],
            'perfect_count': len(image_analysis['perfect_images']),
            'zero_detection_count': len(image_analysis['zero_detection_images'])
        },
        'worst_fn_images': image_analysis['worst_fn_images'][:20],
        'zero_detection_images': image_analysis['zero_detection_images'],
        'hard_examples': hard_examples,
        'timestamp': report['timestamp']
    }

    with open(output_dir / 'error_report.json', 'w') as f:
        json.dump(analysis_data, f, indent=2)

    # Save hard examples CSV
    with open(output_dir / 'hard_examples.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['image', 'fn_count', 'gt_count', 'priority', 'reason'])
        writer.writeheader()
        writer.writerows(hard_examples)

    # Save text summary
    summary = generate_error_summary(report, image_analysis)
    with open(output_dir / 'error_summary.txt', 'w') as f:
        f.write(summary)

    print(summary)

    print(f"\n✓ Error analysis complete")
    print(f"  Report saved: {output_dir / 'error_report.json'}")
    print(f"  Hard examples: {output_dir / 'hard_examples.csv'} ({len(hard_examples)} samples)")
    print(f"  Summary: {output_dir / 'error_summary.txt'}")

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Batch error analysis for active learning',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--validation-report',
        type=str,
        required=True,
        help='Path to validation_report.json'
    )

    parser.add_argument(
        '--output-dir',
        type=str,
        required=True,
        help='Output directory for error analysis'
    )

    parser.add_argument(
        '--max-samples',
        type=int,
        default=50,
        help='Maximum number of hard examples to extract (default: 50)'
    )

    args = parser.parse_args()

    # Load validation report
    print(f"Loading validation report: {args.validation_report}")
    report = load_validation_report(args.validation_report)

    # Analyze errors
    print("Analyzing error patterns...")
    image_analysis = analyze_per_image_errors(report)

    # Extract hard examples
    print("Extracting hard examples...")
    hard_examples = extract_hard_examples(image_analysis, args.max_samples)

    # Save report
    output_dir = Path(args.output_dir)
    save_error_report(report, image_analysis, hard_examples, output_dir)

if __name__ == '__main__':
    main()
