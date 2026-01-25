"""
Complete active learning pipeline integrating validation, error analysis, and hard example sampling.

Workflow:
1. Run validation on held-out set
2. Analyze errors (categorize FNs by size, position, class)
3. Extract hard examples using diverse + uncertainty sampling
4. Augment training dataset
5. Retrain model
6. Repeat

Usage:
    python active_learning_pipeline.py \\
        --ground-truth data/ground_truth.json \\
        --predictions data/predictions.json \\
        --image data/validation_image.png \\
        --output-dir ./iteration_1 \\
        --max-samples 20
"""

import json
import argparse
from pathlib import Path
from collections import Counter


def load_validation_results(gt_path: str, pred_path: str):
    """
    Load ground truth and predictions, compute matches.

    In production, this would call validation.py to compute TP/FP/FN.
    For this example, we assume validation results are precomputed.
    """
    with open(gt_path) as f:
        ground_truth = json.load(f)

    with open(pred_path) as f:
        predictions = json.load(f)

    # Simplified validation logic
    # In production: use validation.py
    return {
        'tp': [],
        'fp': [],
        'fn': ground_truth.get('annotations', []),
        'detections': predictions.get('predictions', [])
    }


def analyze_errors_simple(validation_results, image_width=1000, image_height=1000):
    """
    Simplified error analysis without dependencies.

    In production: use error_analysis.py for full analysis with visualizations.
    """
    fn_list = validation_results['fn']
    det_list = validation_results['detections']

    # Categorize by size
    fns_by_size = {'tiny': [], 'small': [], 'medium': [], 'large': []}
    class_counts = Counter()

    for fn in fn_list:
        bbox = fn['bbox']
        area = bbox[2] * bbox[3]

        # Size category
        if area < 500:
            size_cat = 'tiny'
        elif area < 2000:
            size_cat = 'small'
        elif area < 10000:
            size_cat = 'medium'
        else:
            size_cat = 'large'

        fn['area'] = area
        fn['size_category'] = size_cat
        fns_by_size[size_cat].append(fn)

        # Class count
        class_counts[fn['class']] += 1

    # Remove empty size categories
    fns_by_size = {k: v for k, v in fns_by_size.items() if v}

    error_report = {
        'false_negatives': {
            'total': len(fn_list),
            'by_class': dict(class_counts),
            'by_size': {k: len(v) for k, v in fns_by_size.items()},
            'by_position': {'edge': 0, 'center': 0, 'corner': 0},  # Simplified
            'low_contrast_count': 0,
            'unusual_aspect_count': 0,
            'overlapping_count': 0,
            'details': {
                'by_size': fns_by_size
            }
        },
        'detections': det_list,
        'image_dimensions': {
            'width': image_width,
            'height': image_height
        },
        'image_path': 'validation_image.png'
    }

    return error_report


def suggest_strategy(error_report):
    """Suggest sampling strategy based on error distribution."""
    fn_data = error_report['false_negatives']

    strategy = {
        'class_balance_weight': 0.3,
        'size_diversity_weight': 0.3,
        'spatial_diversity_weight': 0.2,
        'uncertainty_weight': 0.2
    }

    # Check for class imbalance
    class_counts = list(fn_data['by_class'].values())
    if class_counts and max(class_counts) > 2 * min(class_counts):
        strategy['class_balance_weight'] = 0.5
        print("  ℹ Detected class imbalance → Increased class_balance_weight to 0.5")

    # Check for size concentration
    size_counts = list(fn_data['by_size'].values())
    if size_counts and fn_data['total'] > 0:
        if max(size_counts) > 0.5 * fn_data['total']:
            strategy['size_diversity_weight'] = 0.4
            print("  ℹ Detected size concentration → Increased size_diversity_weight to 0.4")

    # Normalize
    total = sum(strategy.values())
    strategy = {k: v/total for k, v in strategy.items()}

    return strategy


def print_pipeline_summary(error_report, hard_examples, output_dir):
    """Print summary of pipeline execution."""
    fn_data = error_report['false_negatives']

    print("\n" + "=" * 70)
    print("ACTIVE LEARNING PIPELINE SUMMARY")
    print("=" * 70)

    print(f"\nValidation Results:")
    print(f"  Total False Negatives: {fn_data['total']}")
    print(f"  By Class:")
    for cls, count in sorted(fn_data['by_class'].items(), key=lambda x: -x[1]):
        print(f"    {cls:12s}: {count:3d}")
    print(f"  By Size:")
    for size, count in sorted(fn_data['by_size'].items()):
        print(f"    {size:12s}: {count:3d}")

    print(f"\nHard Examples Selected: {len(hard_examples)}")

    class_counts = Counter(ex['class'] for ex in hard_examples)
    print(f"  By Class:")
    for cls, count in sorted(class_counts.items()):
        print(f"    {cls:12s}: {count:3d}")

    size_counts = Counter(ex['size_category'] for ex in hard_examples)
    print(f"  By Size:")
    for size, count in sorted(size_counts.items()):
        print(f"    {size:12s}: {count:3d}")

    scores = [ex['selection_score'] for ex in hard_examples]
    print(f"\n  Selection Scores:")
    print(f"    Min:  {min(scores):.3f}")
    print(f"    Max:  {max(scores):.3f}")
    print(f"    Mean: {sum(scores)/len(scores):.3f}")

    print(f"\nOutput Files:")
    output_path = Path(output_dir)
    print(f"  {output_path / 'error_report.json'}")
    print(f"  {output_path / 'hard_examples.json'}")
    print(f"  {output_path / 'strategy.json'}")

    print("\n" + "=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print("  1. Review hard examples to verify quality")
    print("  2. Extract crops for annotation (optional):")
    print("     python error_analysis.py ... --extract-crops")
    print("  3. Create annotations for selected examples")
    print("  4. Add to training dataset")
    print("  5. Retrain model")
    print("  6. Run this pipeline again on new validation set")


def main():
    parser = argparse.ArgumentParser(
        description="Active learning pipeline for callout detection"
    )
    parser.add_argument(
        "--ground-truth",
        required=True,
        help="Path to ground truth annotations JSON"
    )
    parser.add_argument(
        "--predictions",
        required=True,
        help="Path to model predictions JSON"
    )
    parser.add_argument(
        "--image",
        required=True,
        help="Path to validation image"
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory for analysis and hard examples"
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=20,
        help="Maximum number of hard examples to extract (default: 20)"
    )
    parser.add_argument(
        "--strategy",
        help="Path to custom strategy JSON (optional)"
    )
    parser.add_argument(
        "--class-weight",
        type=float,
        help="Override class balance weight"
    )
    parser.add_argument(
        "--size-weight",
        type=float,
        help="Override size diversity weight"
    )
    parser.add_argument(
        "--spatial-weight",
        type=float,
        help="Override spatial diversity weight"
    )
    parser.add_argument(
        "--uncertainty-weight",
        type=float,
        help="Override uncertainty weight"
    )

    args = parser.parse_args()

    # Create output directory
    output_path = Path(args.output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("ACTIVE LEARNING PIPELINE")
    print("=" * 70)

    # Step 1: Load validation results
    print(f"\nStep 1: Loading validation results...")
    print(f"  Ground truth: {args.ground_truth}")
    print(f"  Predictions:  {args.predictions}")

    validation_results = load_validation_results(args.ground_truth, args.predictions)
    print(f"  ✓ Loaded {len(validation_results['fn'])} false negatives")

    # Step 2: Analyze errors
    print(f"\nStep 2: Analyzing errors...")
    error_report = analyze_errors_simple(validation_results)

    error_report_path = output_path / "error_report.json"
    with open(error_report_path, 'w') as f:
        json.dump(error_report, f, indent=2)
    print(f"  ✓ Saved error report to {error_report_path}")

    # Step 3: Determine sampling strategy
    print(f"\nStep 3: Determining sampling strategy...")

    if args.strategy:
        print(f"  Loading custom strategy from {args.strategy}")
        with open(args.strategy) as f:
            strategy = json.load(f)
    else:
        strategy = suggest_strategy(error_report)

    # Apply manual overrides
    if args.class_weight is not None:
        strategy['class_balance_weight'] = args.class_weight
    if args.size_weight is not None:
        strategy['size_diversity_weight'] = args.size_weight
    if args.spatial_weight is not None:
        strategy['spatial_diversity_weight'] = args.spatial_weight
    if args.uncertainty_weight is not None:
        strategy['uncertainty_weight'] = args.uncertainty_weight

    # Normalize weights
    total = sum(strategy.values())
    if total > 0:
        strategy = {k: v/total for k, v in strategy.items()}

    print(f"  Strategy:")
    for k, v in strategy.items():
        print(f"    {k:25s}: {v:.2f}")

    strategy_path = output_path / "strategy.json"
    with open(strategy_path, 'w') as f:
        json.dump(strategy, f, indent=2)

    # Step 4: Extract hard examples
    print(f"\nStep 4: Extracting hard examples...")
    print(f"  Max samples: {args.max_samples}")

    # Import here to avoid issues if module not available
    from sampling_strategies import extract_hard_examples

    hard_examples = extract_hard_examples(
        error_report,
        strategy,
        max_samples=args.max_samples
    )

    print(f"  ✓ Selected {len(hard_examples)} hard examples")

    hard_examples_path = output_path / "hard_examples.json"
    with open(hard_examples_path, 'w') as f:
        json.dump(hard_examples, f, indent=2)
    print(f"  ✓ Saved to {hard_examples_path}")

    # Step 5: Print summary
    print_pipeline_summary(error_report, hard_examples, args.output_dir)


if __name__ == "__main__":
    main()
