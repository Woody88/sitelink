"""
Example usage of sampling_strategies.py with error_analysis.py

Demonstrates complete workflow from validation results to hard example extraction.
"""

import json
from pathlib import Path
from error_analysis import analyze_errors, extract_fn_crops, generate_error_visualizations
from sampling_strategies import extract_hard_examples, stratified_sample_by_class
from collections import Counter


def load_validation_results(validation_json_path: str):
    """Load validation results from JSON file."""
    with open(validation_json_path) as f:
        return json.load(f)


def analyze_error_distribution(error_report):
    """Print summary of error distribution."""
    fn_data = error_report['false_negatives']

    print("\n" + "=" * 60)
    print("ERROR DISTRIBUTION SUMMARY")
    print("=" * 60)

    print(f"\nTotal False Negatives: {fn_data['total']}")

    print("\nBy Class:")
    for cls, count in sorted(fn_data['by_class'].items(), key=lambda x: -x[1]):
        pct = (count / fn_data['total'] * 100) if fn_data['total'] > 0 else 0
        print(f"  {cls:12s}: {count:3d} ({pct:5.1f}%)")

    print("\nBy Size:")
    for size, count in sorted(fn_data['by_size'].items()):
        pct = (count / fn_data['total'] * 100) if fn_data['total'] > 0 else 0
        print(f"  {size:12s}: {count:3d} ({pct:5.1f}%)")

    print("\nBy Position:")
    for pos, count in sorted(fn_data['by_position'].items()):
        pct = (count / fn_data['total'] * 100) if fn_data['total'] > 0 else 0
        print(f"  {pos:12s}: {count:3d} ({pct:5.1f}%)")

    print(f"\nLow Contrast: {fn_data['low_contrast_count']}")
    print(f"Unusual Aspect Ratio: {fn_data['unusual_aspect_count']}")
    print(f"Overlapping: {fn_data['overlapping_count']}")


def suggest_strategy_adjustments(error_report):
    """Suggest sampling strategy adjustments based on error distribution."""
    fn_data = error_report['false_negatives']

    print("\n" + "=" * 60)
    print("RECOMMENDED STRATEGY ADJUSTMENTS")
    print("=" * 60)

    strategy = {
        'class_balance_weight': 0.3,
        'size_diversity_weight': 0.3,
        'spatial_diversity_weight': 0.2,
        'uncertainty_weight': 0.2
    }

    adjustments = []

    # Check class imbalance
    class_counts = list(fn_data['by_class'].values())
    if class_counts:
        max_class = max(class_counts)
        min_class = min(class_counts)
        if max_class > 2 * min_class:
            strategy['class_balance_weight'] = 0.5
            adjustments.append("High class imbalance detected → Increased class_balance_weight to 0.5")

    # Check size concentration
    size_counts = list(fn_data['by_size'].values())
    if size_counts and fn_data['total'] > 0:
        max_size = max(size_counts)
        if max_size > 0.5 * fn_data['total']:
            strategy['size_diversity_weight'] = 0.4
            adjustments.append("Errors concentrated in one size → Increased size_diversity_weight to 0.4")

    # Check position concentration
    pos_counts = list(fn_data['by_position'].values())
    if pos_counts and fn_data['total'] > 0:
        max_pos = max(pos_counts)
        if max_pos > 0.7 * fn_data['total']:
            strategy['spatial_diversity_weight'] = 0.4
            adjustments.append("Errors concentrated in one region → Increased spatial_diversity_weight to 0.4")

    # Normalize weights
    total = sum(strategy.values())
    strategy = {k: v/total for k, v in strategy.items()}

    if adjustments:
        print("\nSuggested adjustments:")
        for adj in adjustments:
            print(f"  - {adj}")
        print(f"\nRecommended strategy:")
        for k, v in strategy.items():
            print(f"  {k:25s}: {v:.2f}")
    else:
        print("\nNo adjustments needed - use default strategy:")
        for k, v in strategy.items():
            print(f"  {k:25s}: {v:.2f}")

    return strategy


def print_selection_summary(hard_examples):
    """Print summary of selected hard examples."""
    print("\n" + "=" * 60)
    print("HARD EXAMPLE SELECTION SUMMARY")
    print("=" * 60)

    print(f"\nTotal selected: {len(hard_examples)}")

    # Class distribution
    class_counts = Counter(ex['class'] for ex in hard_examples)
    print("\nClass distribution:")
    for cls, count in sorted(class_counts.items()):
        print(f"  {cls:12s}: {count:3d}")

    # Size distribution
    size_counts = Counter(ex['size_category'] for ex in hard_examples)
    print("\nSize distribution:")
    for size, count in sorted(size_counts.items()):
        print(f"  {size:12s}: {count:3d}")

    # Score statistics
    scores = [ex['selection_score'] for ex in hard_examples]
    print(f"\nSelection scores:")
    print(f"  Min:  {min(scores):.3f}")
    print(f"  Max:  {max(scores):.3f}")
    print(f"  Mean: {sum(scores)/len(scores):.3f}")

    # Top 10 examples
    print("\nTop 10 examples by score:")
    for i, ex in enumerate(hard_examples[:10], 1):
        bbox_str = f"[{int(ex['bbox'][0])}, {int(ex['bbox'][1])}, {int(ex['bbox'][2])}, {int(ex['bbox'][3])}]"
        print(f"  {i:2d}. {ex['class']:10s} ({ex['size_category']:6s}) - "
              f"score: {ex['selection_score']:.3f} - "
              f"bbox: {bbox_str}")


def main():
    """
    Complete example workflow.

    Usage:
        python example_usage.py

    Before running:
        1. Run validation to generate validation_results.json
        2. Ensure validation image is available
    """
    # Configuration
    validation_json = "validation_results.json"  # Path to validation results
    image_path = "validation_image.png"          # Path to validation image
    output_dir = "./active_learning_output"      # Output directory
    max_samples = 20                              # Number of hard examples to extract

    print("=" * 60)
    print("HARD EXAMPLE EXTRACTION WORKFLOW")
    print("=" * 60)

    # Check if files exist
    if not Path(validation_json).exists():
        print(f"\n⚠ Warning: {validation_json} not found")
        print("\nTo generate validation results:")
        print("  python validation.py <ground_truth.json> <predictions.json> <image.png> --output validation_results.json")
        print("\nUsing synthetic data for demonstration...")

        # Create synthetic validation results for demo
        validation_results = create_demo_validation_results()
        image_path = "demo_image.png"
    else:
        # Load actual validation results
        print(f"\nLoading validation results from {validation_json}...")
        validation_results = load_validation_results(validation_json)

    # Step 1: Analyze errors
    print(f"\nStep 1: Analyzing errors...")
    error_report = analyze_errors(validation_results, image_path, output_dir)

    # Step 2: Review error distribution
    analyze_error_distribution(error_report)

    # Step 3: Get strategy recommendations
    strategy = suggest_strategy_adjustments(error_report)

    # Step 4: Extract hard examples
    print(f"\nStep 4: Extracting up to {max_samples} hard examples...")
    hard_examples = extract_hard_examples(
        error_report,
        strategy,
        max_samples=max_samples
    )

    # Step 5: Print selection summary
    print_selection_summary(hard_examples)

    # Step 6: Save results
    output_path = Path(output_dir)
    hard_examples_path = output_path / "hard_examples.json"
    with open(hard_examples_path, 'w') as f:
        json.dump(hard_examples, f, indent=2)

    print(f"\n✓ Hard examples saved to {hard_examples_path}")

    # Step 7: Generate visualizations
    print(f"\nStep 7: Generating visualizations...")
    generate_error_visualizations(error_report, output_dir)

    # Step 8: Extract crops (optional)
    extract_crops = input("\nExtract FN crops for annotation? (y/n): ").lower().strip() == 'y'
    if extract_crops:
        print("Extracting crops...")
        # Create a modified error report with only the selected hard examples
        selected_report = {
            'image_path': error_report['image_path'],
            'false_negatives': {
                'details': {
                    'by_size': {
                        'selected': hard_examples
                    }
                }
            }
        }
        extract_fn_crops(selected_report, output_dir, padding=50)

    print("\n" + "=" * 60)
    print("WORKFLOW COMPLETE ✓")
    print("=" * 60)
    print(f"\nOutput files:")
    print(f"  - {output_path / 'error_report.json'}")
    print(f"  - {output_path / 'hard_examples.json'}")
    print(f"  - {output_path / 'fn_size_distribution.png'}")
    print(f"  - {output_path / 'fn_position_distribution.png'}")
    print(f"  - {output_path / 'fn_class_distribution.png'}")
    print(f"  - {output_path / 'error_heatmap.png'}")
    if extract_crops:
        print(f"  - {output_path / 'fn_crops/'}")

    print("\nNext steps:")
    print("  1. Review the selected hard examples")
    print("  2. Annotate the crops (if extracted)")
    print("  3. Add to training dataset")
    print("  4. Retrain model")
    print("  5. Repeat validation and active learning cycle")


def create_demo_validation_results():
    """Create synthetic validation results for demonstration."""
    import numpy as np

    print("\n[Demo Mode: Creating synthetic validation data]")

    # Generate synthetic FNs with diverse characteristics
    fns = []

    # Detail class - various sizes and positions
    for i in range(12):
        size = np.random.choice([300, 1200, 5000])  # tiny, small, medium
        x = np.random.randint(50, 800)
        y = np.random.randint(50, 800)
        w = int(np.sqrt(size))
        h = int(size / w)
        fns.append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'class': 'detail'
        })

    # Elevation class
    for i in range(6):
        size = np.random.choice([400, 1500, 6000])
        x = np.random.randint(50, 800)
        y = np.random.randint(50, 800)
        w = int(np.sqrt(size))
        h = int(size / w)
        fns.append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'class': 'elevation'
        })

    # Title class
    for i in range(3):
        size = np.random.choice([500, 1800])
        x = np.random.randint(50, 800)
        y = np.random.randint(50, 800)
        w = int(np.sqrt(size))
        h = int(size / w)
        fns.append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'class': 'title'
        })

    # Generate synthetic predictions (for uncertainty scoring)
    predictions = []
    for i in range(20):
        x = np.random.randint(50, 800)
        y = np.random.randint(50, 800)
        w = np.random.randint(30, 80)
        h = np.random.randint(30, 80)
        conf = np.random.uniform(0.5, 0.95)
        predictions.append({
            'bbox': [float(x), float(y), float(w), float(h)],
            'confidence': float(conf),
            'class': np.random.choice(['detail', 'elevation', 'title'])
        })

    return {
        'fn': fns,
        'fp': [],
        'tp': [],
        'detections': predictions
    }


if __name__ == "__main__":
    main()
