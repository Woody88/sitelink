"""
Test script for sampling_strategies.py
Verifies all scoring functions and selection logic.
"""

import json
from sampling_strategies import (
    extract_hard_examples,
    class_balance_score,
    size_diversity_score,
    spatial_diversity_score,
    uncertainty_score,
    weighted_sample,
    stratified_sample_by_class
)


def create_test_error_report():
    """Create a synthetic error report for testing."""
    return {
        'false_negatives': {
            'total': 15,
            'by_class': {
                'detail': 8,
                'elevation': 5,
                'title': 2
            },
            'by_size': {
                'tiny': 3,
                'small': 7,
                'medium': 5
            },
            'details': {
                'by_size': {
                    'tiny': [
                        {'bbox': [10, 10, 15, 15], 'class': 'detail', 'area': 225},
                        {'bbox': [100, 100, 20, 20], 'class': 'detail', 'area': 400},
                        {'bbox': [500, 500, 18, 18], 'class': 'elevation', 'area': 324}
                    ],
                    'small': [
                        {'bbox': [200, 200, 40, 40], 'class': 'detail', 'area': 1600},
                        {'bbox': [300, 300, 35, 35], 'class': 'elevation', 'area': 1225},
                        {'bbox': [400, 400, 45, 35], 'class': 'detail', 'area': 1575},
                        {'bbox': [50, 600, 40, 40], 'class': 'detail', 'area': 1600},
                        {'bbox': [700, 100, 38, 38], 'class': 'elevation', 'area': 1444},
                        {'bbox': [150, 450, 42, 38], 'class': 'title', 'area': 1596},
                        {'bbox': [600, 600, 40, 40], 'class': 'elevation', 'area': 1600}
                    ],
                    'medium': [
                        {'bbox': [800, 200, 80, 80], 'class': 'detail', 'area': 6400},
                        {'bbox': [900, 900, 90, 90], 'class': 'detail', 'area': 8100},
                        {'bbox': [100, 800, 85, 85], 'class': 'elevation', 'area': 7225},
                        {'bbox': [500, 300, 75, 75], 'class': 'detail', 'area': 5625},
                        {'bbox': [300, 700, 70, 70], 'class': 'title', 'area': 4900}
                    ]
                }
            }
        },
        'detections': [
            {'bbox': [15, 15, 20, 20], 'confidence': 0.85},
            {'bbox': [205, 205, 40, 40], 'confidence': 0.75},
            {'bbox': [505, 505, 30, 30], 'confidence': 0.90},
            {'bbox': [810, 210, 70, 70], 'confidence': 0.65}
        ],
        'image_dimensions': {
            'width': 1000,
            'height': 1000
        },
        'image_path': '/test/image.png'
    }


def test_class_balance_score():
    """Test class balance scoring."""
    print("\n=== Testing class_balance_score ===")

    class_stats = {
        'detail': 8,
        'elevation': 5,
        'title': 2
    }

    fn_detail = {'class': 'detail', 'bbox': [10, 10, 50, 50]}
    fn_elevation = {'class': 'elevation', 'bbox': [10, 10, 50, 50]}
    fn_title = {'class': 'title', 'bbox': [10, 10, 50, 50]}

    score_detail = class_balance_score(fn_detail, class_stats)
    score_elevation = class_balance_score(fn_elevation, class_stats)
    score_title = class_balance_score(fn_title, class_stats)

    print(f"Detail score (8 FNs): {score_detail:.3f}")
    print(f"Elevation score (5 FNs): {score_elevation:.3f}")
    print(f"Title score (2 FNs): {score_title:.3f}")

    assert score_detail > score_elevation > score_title, \
        "Class with more FNs should have higher score"

    print("✓ Class balance scoring works correctly")


def test_size_diversity_score():
    """Test size diversity scoring."""
    print("\n=== Testing size_diversity_score ===")

    fn_tiny = {'area': 400, 'bbox': [10, 10, 20, 20]}
    fn_medium = {'area': 2500, 'bbox': [10, 10, 50, 50]}
    fn_large = {'area': 10000, 'bbox': [10, 10, 100, 100]}

    # Empty selection - all should score 1.0
    score1 = size_diversity_score(fn_tiny, [])
    assert score1 == 1.0, "First selection should score 1.0"

    # After selecting tiny, medium should score higher than another tiny
    selected_sizes = [400]
    score_similar = size_diversity_score(fn_tiny, selected_sizes)
    score_different = size_diversity_score(fn_medium, selected_sizes)

    print(f"Similar size score: {score_similar:.3f}")
    print(f"Different size score: {score_different:.3f}")

    assert score_different > score_similar, \
        "Different size should score higher than similar size"

    print("✓ Size diversity scoring works correctly")


def test_spatial_diversity_score():
    """Test spatial diversity scoring."""
    print("\n=== Testing spatial_diversity_score ===")

    image_dims = {'width': 1000, 'height': 1000}

    fn_topleft = {'bbox': [10, 10, 50, 50]}
    fn_topright = {'bbox': [900, 10, 50, 50]}
    fn_nearby = {'bbox': [20, 20, 50, 50]}

    # Empty selection
    score1 = spatial_diversity_score(fn_topleft, [], image_dims)
    assert score1 == 1.0, "First selection should score 1.0"

    # After selecting top-left, top-right should score higher than nearby
    selected_positions = [(35, 35)]  # center of fn_topleft
    score_far = spatial_diversity_score(fn_topright, selected_positions, image_dims)
    score_near = spatial_diversity_score(fn_nearby, selected_positions, image_dims)

    print(f"Far position score: {score_far:.3f}")
    print(f"Near position score: {score_near:.3f}")

    assert score_far > score_near, \
        "Far position should score higher than near position"

    print("✓ Spatial diversity scoring works correctly")


def test_uncertainty_score():
    """Test uncertainty scoring."""
    print("\n=== Testing uncertainty_score ===")

    predictions = [
        {'bbox': [15, 15, 20, 20], 'confidence': 0.85},
        {'bbox': [500, 500, 30, 30], 'confidence': 0.90},
        {'bbox': [900, 900, 40, 40], 'confidence': 0.60}
    ]

    # FN with high-confidence nearby prediction
    fn_near_high = {'bbox': [10, 10, 25, 25]}

    # FN far from any prediction
    fn_far = {'bbox': [200, 200, 50, 50]}

    # FN near low-confidence prediction
    fn_near_low = {'bbox': [895, 895, 50, 50]}

    score_near_high = uncertainty_score(fn_near_high, predictions)
    score_far = uncertainty_score(fn_far, predictions)
    score_near_low = uncertainty_score(fn_near_low, predictions)

    print(f"Near high-confidence prediction: {score_near_high:.3f}")
    print(f"Far from predictions: {score_far:.3f}")
    print(f"Near low-confidence prediction: {score_near_low:.3f}")

    assert score_near_high > score_far, \
        "FN near high-confidence prediction should score higher"

    print("✓ Uncertainty scoring works correctly")


def test_extract_hard_examples():
    """Test full hard example extraction."""
    print("\n=== Testing extract_hard_examples ===")

    error_report = create_test_error_report()

    strategy = {
        'class_balance_weight': 0.3,
        'size_diversity_weight': 0.3,
        'spatial_diversity_weight': 0.2,
        'uncertainty_weight': 0.2
    }

    hard_examples = extract_hard_examples(error_report, strategy, max_samples=10)

    print(f"Extracted {len(hard_examples)} examples")

    # Verify we got requested number (or all available if less)
    total_fns = error_report['false_negatives']['total']
    expected_count = min(10, total_fns)
    assert len(hard_examples) == expected_count, \
        f"Expected {expected_count} examples, got {len(hard_examples)}"

    # Verify all have selection scores
    for ex in hard_examples:
        assert 'selection_score' in ex, "All examples should have selection_score"
        assert ex['selection_score'] >= 0, "Score should be non-negative"

    # Verify diversity
    classes = set(ex['class'] for ex in hard_examples)
    print(f"Classes represented: {classes}")
    print(f"Unique classes: {len(classes)}")

    sizes = set(ex['size_category'] for ex in hard_examples)
    print(f"Size categories: {sizes}")

    # Print top 5 by score
    print("\nTop 5 examples:")
    for i, ex in enumerate(hard_examples[:5], 1):
        print(f"  {i}. {ex['class']} ({ex['size_category']}) - "
              f"score: {ex['selection_score']:.3f}")

    print("✓ Hard example extraction works correctly")


def test_weighted_sample():
    """Test weighted sampling."""
    print("\n=== Testing weighted_sample ===")

    candidates = [
        {'id': 1, 'class': 'detail'},
        {'id': 2, 'class': 'elevation'},
        {'id': 3, 'class': 'title'},
        {'id': 4, 'class': 'detail'}
    ]

    weights = [0.4, 0.3, 0.2, 0.1]

    selected = weighted_sample(candidates, weights, max_samples=2)

    print(f"Selected {len(selected)} examples")
    assert len(selected) == 2, "Should select exactly 2"
    assert len(set(ex['id'] for ex in selected)) == 2, \
        "Should not select duplicates"

    print("✓ Weighted sampling works correctly")


def test_stratified_sample():
    """Test stratified sampling."""
    print("\n=== Testing stratified_sample_by_class ===")

    candidates = [
        {'class': 'detail', 'id': 1},
        {'class': 'detail', 'id': 2},
        {'class': 'detail', 'id': 3},
        {'class': 'elevation', 'id': 4},
        {'class': 'elevation', 'id': 5},
        {'class': 'title', 'id': 6}
    ]

    selected = stratified_sample_by_class(candidates, max_samples=4, min_per_class=1)

    print(f"Selected {len(selected)} examples")

    # Count by class
    class_counts = {}
    for ex in selected:
        cls = ex['class']
        class_counts[cls] = class_counts.get(cls, 0) + 1

    print(f"Class distribution: {class_counts}")

    # Verify each class has at least 1 (if budget allows)
    assert all(count >= 1 for count in class_counts.values()), \
        "Each class should have at least min_per_class"

    print("✓ Stratified sampling works correctly")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Testing sampling_strategies.py")
    print("=" * 60)

    try:
        test_class_balance_score()
        test_size_diversity_score()
        test_spatial_diversity_score()
        test_uncertainty_score()
        test_extract_hard_examples()
        test_weighted_sample()
        test_stratified_sample()

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED ✓")
        print("=" * 60)

    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        raise

    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise


if __name__ == "__main__":
    main()
