"""
Standalone demo of sampling_strategies.py

Demonstrates hard example extraction without requiring error_analysis dependencies.
"""

import json
import numpy as np
from sampling_strategies import (
    extract_hard_examples,
    class_balance_score,
    size_diversity_score,
    spatial_diversity_score,
    uncertainty_score
)
from collections import Counter


def create_synthetic_error_report():
    """Create a realistic synthetic error report."""
    print("Creating synthetic error report with 30 false negatives...")

    fns_by_size = {
        'tiny': [],
        'small': [],
        'medium': []
    }

    # Generate diverse FNs
    np.random.seed(42)  # For reproducibility

    # Tiny detail callouts (hard to detect)
    for i in range(5):
        x = np.random.randint(50, 900)
        y = np.random.randint(50, 900)
        w = np.random.randint(15, 22)
        h = np.random.randint(15, 22)
        fns_by_size['tiny'].append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'class': 'detail',
            'area': float(w * h)
        })

    # Small callouts (various classes)
    classes = ['detail', 'detail', 'detail', 'elevation', 'elevation', 'title', 'detail', 'elevation']
    for i, cls in enumerate(classes):
        x = np.random.randint(50, 900)
        y = np.random.randint(50, 900)
        w = np.random.randint(35, 45)
        h = np.random.randint(35, 45)
        fns_by_size['small'].append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'class': cls,
            'area': float(w * h)
        })

    # Medium callouts
    classes = ['detail', 'detail', 'elevation', 'elevation', 'title', 'detail', 'detail']
    for i, cls in enumerate(classes):
        x = np.random.randint(100, 800)
        y = np.random.randint(100, 800)
        w = np.random.randint(70, 95)
        h = np.random.randint(70, 95)
        fns_by_size['medium'].append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'class': cls,
            'area': float(w * h)
        })

    # Count by class
    all_fns = fns_by_size['tiny'] + fns_by_size['small'] + fns_by_size['medium']
    class_counts = Counter(fn['class'] for fn in all_fns)

    # Generate predictions for uncertainty scoring
    predictions = []
    for i in range(40):
        x = np.random.randint(50, 900)
        y = np.random.randint(50, 900)
        w = np.random.randint(30, 80)
        h = np.random.randint(30, 80)
        conf = np.random.uniform(0.6, 0.95)
        predictions.append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'confidence': float(conf),
            'class': np.random.choice(['detail', 'elevation', 'title'])
        })

    error_report = {
        'false_negatives': {
            'total': len(all_fns),
            'by_class': dict(class_counts),
            'by_size': {
                'tiny': len(fns_by_size['tiny']),
                'small': len(fns_by_size['small']),
                'medium': len(fns_by_size['medium'])
            },
            'by_position': {
                'edge': 8,
                'corner': 5,
                'center': 7
            },
            'low_contrast_count': 4,
            'unusual_aspect_count': 3,
            'overlapping_count': 2,
            'details': {
                'by_size': fns_by_size
            }
        },
        'detections': predictions,
        'image_dimensions': {
            'width': 1000,
            'height': 1000
        },
        'image_path': '/synthetic/validation_image.png'
    }

    return error_report


def demonstrate_scoring():
    """Demonstrate individual scoring functions."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING SCORING FUNCTIONS")
    print("=" * 60)

    # Class balance score
    print("\n1. Class Balance Score (prioritize underperforming classes)")
    print("-" * 60)
    class_stats = {
        'detail': 15,      # Most FNs - highest priority
        'elevation': 8,
        'title': 4
    }

    for cls in ['detail', 'elevation', 'title']:
        fn = {'class': cls, 'bbox': [10, 10, 50, 50]}
        score = class_balance_score(fn, class_stats)
        print(f"  {cls:12s}: {score:.3f} ({class_stats[cls]} FNs)")

    # Size diversity score
    print("\n2. Size Diversity Score (avoid size clustering)")
    print("-" * 60)
    selected_sizes = [400, 8000]  # One tiny, one medium
    print(f"  Already selected: tiny (400 px²), medium (8000 px²)")

    test_sizes = [
        (450, "tiny"),
        (1500, "small"),
        (7500, "medium")
    ]

    for area, label in test_sizes:
        fn = {'area': area, 'bbox': [10, 10, 50, 50]}
        score = size_diversity_score(fn, selected_sizes)
        print(f"  {label:12s} ({area:5d} px²): {score:.3f}")

    # Spatial diversity score
    print("\n3. Spatial Diversity Score (distribute across image)")
    print("-" * 60)
    selected_positions = [(100, 100)]  # Top-left
    image_dims = {'width': 1000, 'height': 1000}
    print(f"  Already selected: top-left (100, 100)")

    test_positions = [
        ([110, 110, 50, 50], "nearby (110, 110)"),
        ([500, 500, 50, 50], "center (500, 500)"),
        ([900, 900, 50, 50], "opposite corner (900, 900)")
    ]

    for bbox, label in test_positions:
        fn = {'bbox': bbox}
        score = spatial_diversity_score(fn, selected_positions, image_dims)
        print(f"  {label:30s}: {score:.3f}")

    # Uncertainty score
    print("\n4. Uncertainty Score (near high-confidence predictions)")
    print("-" * 60)
    predictions = [
        {'bbox': [105, 105, 40, 40], 'confidence': 0.85},  # Near test FN
        {'bbox': [600, 600, 50, 50], 'confidence': 0.90}   # Far from test FN
    ]
    print(f"  Predictions: (105, 105, conf=0.85), (600, 600, conf=0.90)")

    test_fns = [
        ([100, 100, 50, 50], "overlapping with high-conf pred"),
        ([300, 300, 50, 50], "between predictions"),
        ([800, 800, 50, 50], "far from all predictions")
    ]

    for bbox, label in test_fns:
        fn = {'bbox': bbox}
        score = uncertainty_score(fn, predictions)
        print(f"  {label:35s}: {score:.3f}")


def demonstrate_extraction(error_report):
    """Demonstrate hard example extraction."""
    print("\n" + "=" * 60)
    print("DEMONSTRATING HARD EXAMPLE EXTRACTION")
    print("=" * 60)

    fn_data = error_report['false_negatives']

    print(f"\nError Report Summary:")
    print(f"  Total FNs: {fn_data['total']}")
    print(f"  By class: {fn_data['by_class']}")
    print(f"  By size: {fn_data['by_size']}")

    # Test different strategies
    strategies = [
        {
            'name': 'Balanced (default)',
            'weights': {
                'class_balance_weight': 0.3,
                'size_diversity_weight': 0.3,
                'spatial_diversity_weight': 0.2,
                'uncertainty_weight': 0.2
            }
        },
        {
            'name': 'Class-focused',
            'weights': {
                'class_balance_weight': 0.6,
                'size_diversity_weight': 0.2,
                'spatial_diversity_weight': 0.1,
                'uncertainty_weight': 0.1
            }
        },
        {
            'name': 'Size-focused',
            'weights': {
                'class_balance_weight': 0.2,
                'size_diversity_weight': 0.5,
                'spatial_diversity_weight': 0.2,
                'uncertainty_weight': 0.1
            }
        }
    ]

    for strategy_config in strategies:
        print(f"\n{'=' * 60}")
        print(f"Strategy: {strategy_config['name']}")
        print(f"{'=' * 60}")

        weights = strategy_config['weights']
        print(f"Weights: {weights}")

        hard_examples = extract_hard_examples(
            error_report,
            weights,
            max_samples=15
        )

        print(f"\nSelected {len(hard_examples)} examples")

        # Distribution analysis
        class_counts = Counter(ex['class'] for ex in hard_examples)
        size_counts = Counter(ex['size_category'] for ex in hard_examples)

        print(f"\nClass distribution:")
        for cls, count in sorted(class_counts.items()):
            pct = count / len(hard_examples) * 100
            print(f"  {cls:12s}: {count:2d} ({pct:5.1f}%)")

        print(f"\nSize distribution:")
        for size, count in sorted(size_counts.items()):
            pct = count / len(hard_examples) * 100
            print(f"  {size:12s}: {count:2d} ({pct:5.1f}%)")

        scores = [ex['selection_score'] for ex in hard_examples]
        print(f"\nScore statistics:")
        print(f"  Min:  {min(scores):.3f}")
        print(f"  Max:  {max(scores):.3f}")
        print(f"  Mean: {sum(scores)/len(scores):.3f}")

        print(f"\nTop 5 examples:")
        for i, ex in enumerate(hard_examples[:5], 1):
            bbox = [int(v) for v in ex['bbox']]
            print(f"  {i}. {ex['class']:10s} ({ex['size_category']:6s}) - "
                  f"score: {ex['selection_score']:.3f} - "
                  f"bbox: {bbox}")


def compare_strategies(error_report):
    """Compare different sampling strategies side-by-side."""
    print("\n" + "=" * 60)
    print("STRATEGY COMPARISON")
    print("=" * 60)

    strategies = {
        'Default': {
            'class_balance_weight': 0.3,
            'size_diversity_weight': 0.3,
            'spatial_diversity_weight': 0.2,
            'uncertainty_weight': 0.2
        },
        'Class-Only': {
            'class_balance_weight': 1.0,
            'size_diversity_weight': 0.0,
            'spatial_diversity_weight': 0.0,
            'uncertainty_weight': 0.0
        },
        'Size-Only': {
            'class_balance_weight': 0.0,
            'size_diversity_weight': 1.0,
            'spatial_diversity_weight': 0.0,
            'uncertainty_weight': 0.0
        },
        'Uncertainty-Only': {
            'class_balance_weight': 0.0,
            'size_diversity_weight': 0.0,
            'spatial_diversity_weight': 0.0,
            'uncertainty_weight': 1.0
        }
    }

    results = {}
    for name, weights in strategies.items():
        hard_examples = extract_hard_examples(error_report, weights, max_samples=15)
        results[name] = {
            'examples': hard_examples,
            'class_diversity': len(set(ex['class'] for ex in hard_examples)),
            'size_diversity': len(set(ex['size_category'] for ex in hard_examples)),
            'avg_score': sum(ex['selection_score'] for ex in hard_examples) / len(hard_examples)
        }

    print(f"\n{'Strategy':<20} {'Count':<8} {'Classes':<10} {'Sizes':<10} {'Avg Score':<10}")
    print("-" * 70)
    for name, data in results.items():
        print(f"{name:<20} {len(data['examples']):<8} "
              f"{data['class_diversity']:<10} {data['size_diversity']:<10} "
              f"{data['avg_score']:<10.3f}")

    print("\nObservation:")
    print("  - Default strategy provides balanced diversity across all dimensions")
    print("  - Single-dimension strategies sacrifice diversity for specialization")
    print("  - Use single-dimension when you have a specific problem to address")


def main():
    """Run complete demonstration."""
    print("=" * 60)
    print("SAMPLING STRATEGIES DEMONSTRATION")
    print("=" * 60)

    # Create synthetic data
    error_report = create_synthetic_error_report()

    # Demonstrate individual scoring functions
    demonstrate_scoring()

    # Demonstrate extraction with different strategies
    demonstrate_extraction(error_report)

    # Compare strategies
    compare_strategies(error_report)

    # Save example output
    print("\n" + "=" * 60)
    print("SAVING EXAMPLE OUTPUT")
    print("=" * 60)

    strategy = {
        'class_balance_weight': 0.3,
        'size_diversity_weight': 0.3,
        'spatial_diversity_weight': 0.2,
        'uncertainty_weight': 0.2
    }

    hard_examples = extract_hard_examples(error_report, strategy, max_samples=15)

    output_file = "demo_hard_examples.json"
    with open(output_file, 'w') as f:
        json.dump(hard_examples, f, indent=2)

    print(f"\n✓ Saved {len(hard_examples)} examples to {output_file}")

    print("\n" + "=" * 60)
    print("DEMONSTRATION COMPLETE")
    print("=" * 60)
    print("\nKey takeaways:")
    print("  1. Class balance prioritizes underperforming classes")
    print("  2. Size diversity prevents clustering by size")
    print("  3. Spatial diversity distributes across image regions")
    print("  4. Uncertainty finds examples near decision boundaries")
    print("  5. Combined strategy balances all dimensions for best coverage")


if __name__ == "__main__":
    main()
