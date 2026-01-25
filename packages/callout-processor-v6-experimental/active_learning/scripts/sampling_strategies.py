"""
Sampling strategies for extracting hard examples from validation errors.

Implements diverse + uncertainty sampling to select 15-20 high-value false negatives
for dataset augmentation. Prioritizes class balance, size diversity, spatial diversity,
and uncertainty (FNs that were almost detected).
"""

import numpy as np
from typing import Dict, List, Tuple
from collections import defaultdict
import math


def extract_hard_examples(
    error_report: Dict,
    strategy: Dict,
    max_samples: int = 20
) -> List[Dict]:
    """
    Extract hard examples using diverse + uncertainty sampling strategy.

    Combines multiple scoring dimensions to select the most valuable false negatives:
    1. Class balance - Prioritize underperforming classes to balance training
    2. Size diversity - Select mix of tiny/small/medium to avoid clustering
    3. Spatial diversity - Distribute across image regions to avoid spatial bias
    4. Uncertainty - Prefer FNs with high-confidence nearby predictions

    Args:
        error_report: Error report from analyze_errors() containing:
            - false_negatives.details with FN lists by category
            - false_negatives.by_class with class statistics
            - image_dimensions for spatial normalization
        strategy: Sampling weights dict with keys:
            - class_balance_weight (default: 0.3)
            - size_diversity_weight (default: 0.3)
            - spatial_diversity_weight (default: 0.2)
            - uncertainty_weight (default: 0.2)
        max_samples: Maximum number of examples to extract (default: 20)

    Returns:
        List of selected FN dicts with added 'selection_score' field,
        sorted by importance (highest score first).

    Example:
        >>> error_report = analyze_errors(validation_results, image_path, output_dir)
        >>> strategy = {
        ...     'class_balance_weight': 0.3,
        ...     'size_diversity_weight': 0.3,
        ...     'spatial_diversity_weight': 0.2,
        ...     'uncertainty_weight': 0.2
        ... }
        >>> hard_examples = extract_hard_examples(error_report, strategy, max_samples=20)
        >>> print(f"Selected {len(hard_examples)} examples")
        >>> for ex in hard_examples[:5]:
        ...     print(f"  {ex['class']} - score: {ex['selection_score']:.3f}")
    """
    # Extract weights from strategy
    class_weight = strategy.get('class_balance_weight', 0.3)
    size_weight = strategy.get('size_diversity_weight', 0.3)
    spatial_weight = strategy.get('spatial_diversity_weight', 0.2)
    uncertainty_weight = strategy.get('uncertainty_weight', 0.2)

    # Normalize weights
    total_weight = class_weight + size_weight + spatial_weight + uncertainty_weight
    if total_weight > 0:
        class_weight /= total_weight
        size_weight /= total_weight
        spatial_weight /= total_weight
        uncertainty_weight /= total_weight

    fn_data = error_report['false_negatives']
    class_stats = fn_data['by_class']

    # Collect all FN candidates
    candidates = []
    for size_cat, fn_list in fn_data['details']['by_size'].items():
        for fn in fn_list:
            # Add size category and area for convenience
            fn['size_category'] = size_cat
            if 'area' not in fn:
                bbox = fn['bbox']
                fn['area'] = bbox[2] * bbox[3]
            candidates.append(fn)

    if not candidates:
        return []

    # Initialize tracking for diversity
    selected_examples = []
    selected_sizes = []
    selected_positions = []

    # Get predictions for uncertainty scoring
    predictions = error_report.get('detections', [])

    # Iteratively select examples
    for _ in range(min(max_samples, len(candidates))):
        if not candidates:
            break

        # Score all remaining candidates
        scores = []
        for fn in candidates:
            # Class balance score
            class_score = class_balance_score(fn, class_stats)

            # Size diversity score
            size_score = size_diversity_score(fn, selected_sizes)

            # Spatial diversity score
            spatial_score = spatial_diversity_score(
                fn,
                selected_positions,
                error_report['image_dimensions']
            )

            # Uncertainty score
            uncert_score = uncertainty_score(fn, predictions)

            # Weighted combination
            total_score = (
                class_weight * class_score +
                size_weight * size_score +
                spatial_weight * spatial_score +
                uncertainty_weight * uncert_score
            )

            scores.append(total_score)

        # Select highest scoring candidate
        best_idx = int(np.argmax(scores))
        best_fn = candidates.pop(best_idx)
        best_fn['selection_score'] = scores[best_idx]

        selected_examples.append(best_fn)
        selected_sizes.append(best_fn['area'])
        selected_positions.append(_get_center_position(best_fn['bbox']))

    return selected_examples


def class_balance_score(fn: Dict, class_stats: Dict) -> float:
    """
    Calculate class balance weight - prefer underperforming classes.

    Classes with more false negatives are weighted higher to help
    balance the dataset and improve performance on weak classes.

    Args:
        fn: False negative dict with 'class' field
        class_stats: Dict mapping class name to FN count

    Returns:
        Score in [0, 1] where higher = more underperforming class

    Example:
        >>> fn = {'class': 'detail', 'bbox': [10, 10, 50, 50]}
        >>> class_stats = {'detail': 15, 'elevation': 5, 'title': 3}
        >>> score = class_balance_score(fn, class_stats)
        >>> print(f"Score: {score:.3f}")  # Higher because detail has most FNs
    """
    if not class_stats:
        return 0.5

    class_name = fn['class']
    class_fn_count = class_stats.get(class_name, 0)

    if class_fn_count == 0:
        return 0.0

    # Normalize by total FN count
    total_fns = sum(class_stats.values())
    if total_fns == 0:
        return 0.0

    # Higher score for classes with more FNs
    return class_fn_count / total_fns


def size_diversity_score(fn: Dict, selected_sizes: List[float]) -> float:
    """
    Calculate size diversity weight - avoid clustering by size.

    Encourages selection of callouts with different sizes to ensure
    the hard example set covers the full size spectrum (tiny to large).

    Args:
        fn: False negative dict with 'area' field (bbox width * height)
        selected_sizes: List of areas already selected

    Returns:
        Score in [0, 1] where higher = more different from selected sizes

    Example:
        >>> fn = {'area': 1000, 'bbox': [10, 10, 50, 20]}
        >>> selected_sizes = [500, 5000]  # One small, one large
        >>> score = size_diversity_score(fn, selected_sizes)
        >>> # Medium size (1000) is between the two, so moderate diversity
    """
    if not selected_sizes:
        return 1.0

    fn_area = fn['area']

    # Calculate minimum relative difference to any selected size
    min_relative_diff = float('inf')
    for selected_area in selected_sizes:
        # Use log scale to handle wide range of sizes
        if fn_area > 0 and selected_area > 0:
            log_diff = abs(math.log10(fn_area) - math.log10(selected_area))
            min_relative_diff = min(min_relative_diff, log_diff)

    if min_relative_diff == float('inf'):
        return 1.0

    # Normalize: 0 log diff = 0 score, 2+ log diff = 1 score
    # (2 log diff = 100x size difference)
    score = min(min_relative_diff / 2.0, 1.0)

    return score


def spatial_diversity_score(
    fn: Dict,
    selected_positions: List[Tuple[float, float]],
    image_dimensions: Dict
) -> float:
    """
    Calculate spatial diversity weight - distribute across image regions.

    Ensures hard examples are selected from different parts of the image
    to avoid spatial bias (e.g., only selecting edge callouts).

    Args:
        fn: False negative dict with 'bbox' field [x, y, w, h]
        selected_positions: List of (x, y) center positions already selected
        image_dimensions: Dict with 'width' and 'height' keys

    Returns:
        Score in [0, 1] where higher = more spatially distant from selected

    Example:
        >>> fn = {'bbox': [100, 100, 50, 50]}
        >>> selected_positions = [(50, 50), (800, 600)]
        >>> image_dims = {'width': 1000, 'height': 800}
        >>> score = spatial_diversity_score(fn, selected_positions, image_dims)
    """
    if not selected_positions:
        return 1.0

    # Get center position of FN
    fn_center = _get_center_position(fn['bbox'])

    # Normalize to [0, 1] range
    width = image_dimensions['width']
    height = image_dimensions['height']

    fn_x_norm = fn_center[0] / width
    fn_y_norm = fn_center[1] / height

    # Calculate minimum normalized distance to any selected position
    min_distance = float('inf')
    for sel_pos in selected_positions:
        sel_x_norm = sel_pos[0] / width
        sel_y_norm = sel_pos[1] / height

        # Euclidean distance in normalized space
        distance = math.sqrt(
            (fn_x_norm - sel_x_norm) ** 2 +
            (fn_y_norm - sel_y_norm) ** 2
        )
        min_distance = min(min_distance, distance)

    if min_distance == float('inf'):
        return 1.0

    # Normalize: 0 distance = 0 score, sqrt(2) distance (diagonal) = 1 score
    max_distance = math.sqrt(2)
    score = min(min_distance / max_distance, 1.0)

    return score


def uncertainty_score(fn: Dict, predictions: List[Dict]) -> float:
    """
    Calculate uncertainty weight - prefer FNs that were almost detected.

    Higher score for FNs that have high-confidence predictions nearby,
    indicating the model was uncertain about this region. These are
    valuable examples at the decision boundary.

    Args:
        fn: False negative dict with 'bbox' field [x, y, w, h]
        predictions: List of prediction dicts with 'bbox' and 'confidence'

    Returns:
        Score in [0, 1] where higher = more uncertainty (higher nearby confidence)

    Example:
        >>> fn = {'bbox': [100, 100, 50, 50]}
        >>> predictions = [
        ...     {'bbox': [120, 120, 50, 50], 'confidence': 0.8},
        ...     {'bbox': [500, 500, 50, 50], 'confidence': 0.9}
        ... ]
        >>> score = uncertainty_score(fn, predictions)
        >>> # First prediction overlaps/nearby with high confidence -> high score
    """
    if not predictions:
        return 0.5

    fn_bbox = fn['bbox']
    fn_center = _get_center_position(fn_bbox)

    # Find nearby predictions with high confidence
    max_weighted_confidence = 0.0

    for pred in predictions:
        pred_bbox = pred['bbox']
        pred_confidence = pred.get('confidence', 0.0)

        # Calculate distance between centers
        pred_center = _get_center_position(pred_bbox)
        distance = math.sqrt(
            (fn_center[0] - pred_center[0]) ** 2 +
            (fn_center[1] - pred_center[1]) ** 2
        )

        # Calculate IoU for overlap check
        iou = _calculate_iou(fn_bbox, pred_bbox)

        # Weight confidence by proximity
        # High score if: high IoU OR close distance + high confidence
        if iou > 0:
            # Overlapping predictions are strong uncertainty signals
            weighted_conf = pred_confidence * (1.0 + iou)
        else:
            # Nearby predictions weighted by distance (closer = higher weight)
            # Use exponential decay: weight = exp(-distance / scale)
            # Scale = average bbox size
            fn_size = math.sqrt(fn_bbox[2] * fn_bbox[3])
            scale = max(fn_size * 2, 50)  # At least 50px scale
            proximity_weight = math.exp(-distance / scale)
            weighted_conf = pred_confidence * proximity_weight

        max_weighted_confidence = max(max_weighted_confidence, weighted_conf)

    # Normalize to [0, 1]
    # High confidence nearby (0.8+) after weighting indicates strong uncertainty
    score = min(max_weighted_confidence / 1.5, 1.0)

    return score


def weighted_sample(
    candidates: List[Dict],
    weights: List[float],
    max_samples: int
) -> List[Dict]:
    """
    Perform weighted sampling without replacement.

    Alternative sampling method that uses probability-based selection
    instead of iterative greedy selection. Can be used if you want
    more randomness in the selection process.

    Args:
        candidates: List of candidate dicts to sample from
        weights: List of weights (same length as candidates)
        max_samples: Maximum number of samples to select

    Returns:
        List of selected candidates (without replacement)

    Example:
        >>> candidates = [
        ...     {'id': 1, 'class': 'detail'},
        ...     {'id': 2, 'class': 'elevation'},
        ...     {'id': 3, 'class': 'title'}
        ... ]
        >>> weights = [0.5, 0.3, 0.2]
        >>> selected = weighted_sample(candidates, weights, max_samples=2)
    """
    if not candidates or not weights:
        return []

    if len(candidates) != len(weights):
        raise ValueError("candidates and weights must have same length")

    # Normalize weights to probabilities
    weights_array = np.array(weights)
    if weights_array.sum() == 0:
        weights_array = np.ones(len(weights))

    probs = weights_array / weights_array.sum()

    # Sample without replacement
    n_samples = min(max_samples, len(candidates))
    selected_indices = np.random.choice(
        len(candidates),
        size=n_samples,
        replace=False,
        p=probs
    )

    selected = [candidates[i] for i in selected_indices]

    return selected


def _get_center_position(bbox: List[float]) -> Tuple[float, float]:
    """
    Get center position of bbox.

    Args:
        bbox: [x, y, w, h] format

    Returns:
        (center_x, center_y) tuple
    """
    x, y, w, h = bbox
    return (x + w / 2, y + h / 2)


def _calculate_iou(box1: List[float], box2: List[float]) -> float:
    """
    Calculate IoU between two boxes in [x, y, w, h] format.

    Args:
        box1: [x, y, w, h]
        box2: [x, y, w, h]

    Returns:
        IoU in [0, 1]
    """
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2

    # Convert to xyxy
    x1_max = x1 + w1
    y1_max = y1 + h1
    x2_max = x2 + w2
    y2_max = y2 + h2

    # Intersection
    xi1 = max(x1, x2)
    yi1 = max(y1, y2)
    xi2 = min(x1_max, x2_max)
    yi2 = min(y1_max, y2_max)

    inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)

    # Union
    box1_area = w1 * h1
    box2_area = w2 * h2
    union_area = box1_area + box2_area - inter_area

    return inter_area / union_area if union_area > 0 else 0


def stratified_sample_by_class(
    candidates: List[Dict],
    max_samples: int,
    min_per_class: int = 1
) -> List[Dict]:
    """
    Perform stratified sampling to ensure class representation.

    Useful as a preprocessing step before diverse sampling to guarantee
    each class has minimum representation.

    Args:
        candidates: List of candidate dicts with 'class' field
        max_samples: Total number of samples to select
        min_per_class: Minimum samples per class (default: 1)

    Returns:
        List of stratified samples

    Example:
        >>> candidates = [
        ...     {'class': 'detail', 'id': 1},
        ...     {'class': 'detail', 'id': 2},
        ...     {'class': 'elevation', 'id': 3},
        ...     {'class': 'title', 'id': 4},
        ... ]
        >>> stratified = stratified_sample_by_class(candidates, max_samples=3, min_per_class=1)
        >>> # Guarantees at least 1 from each class if possible
    """
    if not candidates:
        return []

    # Group by class
    by_class = defaultdict(list)
    for cand in candidates:
        by_class[cand['class']].append(cand)

    n_classes = len(by_class)

    # Allocate samples per class
    if max_samples < n_classes * min_per_class:
        # Not enough budget for min_per_class
        samples_per_class = {cls: min(len(items), 1)
                           for cls, items in by_class.items()}
    else:
        # Reserve min_per_class for each, distribute rest proportionally
        reserved = n_classes * min_per_class
        remaining = max_samples - reserved

        samples_per_class = {}
        class_sizes = {cls: len(items) for cls, items in by_class.items()}
        total_size = sum(class_sizes.values())

        for cls, items in by_class.items():
            # Proportional allocation
            proportion = len(items) / total_size if total_size > 0 else 0
            extra = int(remaining * proportion)
            samples_per_class[cls] = min_per_class + extra

            # Cap at available items
            samples_per_class[cls] = min(samples_per_class[cls], len(items))

    # Sample from each class
    selected = []
    for cls, n_samples in samples_per_class.items():
        class_candidates = by_class[cls]

        # Random sample
        if n_samples >= len(class_candidates):
            selected.extend(class_candidates)
        else:
            indices = np.random.choice(len(class_candidates), size=n_samples, replace=False)
            selected.extend([class_candidates[i] for i in indices])

    return selected


def main():
    """Example usage demonstrating hard example extraction."""
    import json
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser(
        description="Extract hard examples from error analysis"
    )
    parser.add_argument(
        "error_report",
        help="Path to error_report.json from analyze_errors"
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=20,
        help="Maximum number of hard examples to extract (default: 20)"
    )
    parser.add_argument(
        "--output",
        help="Output path for selected examples JSON (default: hard_examples.json)"
    )
    parser.add_argument(
        "--class-weight",
        type=float,
        default=0.3,
        help="Weight for class balance (default: 0.3)"
    )
    parser.add_argument(
        "--size-weight",
        type=float,
        default=0.3,
        help="Weight for size diversity (default: 0.3)"
    )
    parser.add_argument(
        "--spatial-weight",
        type=float,
        default=0.2,
        help="Weight for spatial diversity (default: 0.2)"
    )
    parser.add_argument(
        "--uncertainty-weight",
        type=float,
        default=0.2,
        help="Weight for uncertainty (default: 0.2)"
    )

    args = parser.parse_args()

    # Load error report
    with open(args.error_report) as f:
        error_report = json.load(f)

    # Configure strategy
    strategy = {
        'class_balance_weight': args.class_weight,
        'size_diversity_weight': args.size_weight,
        'spatial_diversity_weight': args.spatial_weight,
        'uncertainty_weight': args.uncertainty_weight
    }

    # Extract hard examples
    print(f"Extracting up to {args.max_samples} hard examples...")
    print(f"Strategy weights: {strategy}")

    hard_examples = extract_hard_examples(
        error_report,
        strategy,
        max_samples=args.max_samples
    )

    print(f"\nSelected {len(hard_examples)} hard examples")

    # Print summary statistics
    class_counts = defaultdict(int)
    size_counts = defaultdict(int)

    for ex in hard_examples:
        class_counts[ex['class']] += 1
        size_counts[ex['size_category']] += 1

    print("\nClass distribution:")
    for cls, count in sorted(class_counts.items()):
        print(f"  {cls}: {count}")

    print("\nSize distribution:")
    for size, count in sorted(size_counts.items()):
        print(f"  {size}: {count}")

    print("\nTop 10 examples by score:")
    for i, ex in enumerate(hard_examples[:10], 1):
        print(f"  {i}. {ex['class']} ({ex['size_category']}) - "
              f"score: {ex['selection_score']:.3f} - "
              f"bbox: {[int(v) for v in ex['bbox']]}")

    # Save results
    output_path = args.output or "hard_examples.json"
    with open(output_path, 'w') as f:
        json.dump(hard_examples, f, indent=2)

    print(f"\nHard examples saved to {output_path}")


if __name__ == "__main__":
    main()
