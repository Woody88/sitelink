"""
Post-processing filters to improve detection precision.

Filters out false positives based on:
- Size constraints (callouts are small, 20-80px typically)
- Aspect ratio (callouts are roughly square)
- Area constraints (avoid large text blocks)
"""

from typing import List, Dict


def filter_by_size(detections: List[Dict], min_size: int = 12, max_size: int = 150) -> List[Dict]:
    """
    Filter detections by bounding box size.

    Callouts are typically 20-80px, but title callouts can be as small as 12px.
    Large boxes (>150px) are usually text areas, schedules, or title blocks.

    Args:
        detections: List of detection dicts with 'bbox' key
        min_size: Minimum width or height in pixels (12px to allow title callouts)
        max_size: Maximum width or height in pixels

    Returns:
        Filtered detections
    """
    filtered = []

    for det in detections:
        x, y, w, h = det['bbox']

        # Reject if either dimension is outside bounds
        if w < min_size or h < min_size:
            continue
        if w > max_size or h > max_size:
            continue

        filtered.append(det)

    return filtered


def filter_by_aspect_ratio(detections: List[Dict], min_ratio: float = 0.3, max_ratio: float = 3.0) -> List[Dict]:
    """
    Filter detections by aspect ratio.

    Callouts are roughly square or slightly rectangular.
    Very wide/tall boxes are usually dimension lines or text.

    Args:
        detections: List of detection dicts with 'bbox' key
        min_ratio: Minimum aspect ratio (height/width)
        max_ratio: Maximum aspect ratio (height/width)

    Returns:
        Filtered detections
    """
    filtered = []

    for det in detections:
        x, y, w, h = det['bbox']

        if w == 0 or h == 0:
            continue

        aspect_ratio = h / w

        # Reject if too wide (< min_ratio) or too tall (> max_ratio)
        if aspect_ratio < min_ratio or aspect_ratio > max_ratio:
            continue

        filtered.append(det)

    return filtered


def filter_by_area(detections: List[Dict], min_area: int = 400, max_area: int = 15000) -> List[Dict]:
    """
    Filter detections by bounding box area.

    Callouts are typically 400-8000 px² at 72 DPI.
    Very large areas (>15000 px²) are usually text blocks.

    Args:
        detections: List of detection dicts with 'bbox' key
        min_area: Minimum area in square pixels
        max_area: Maximum area in square pixels

    Returns:
        Filtered detections
    """
    filtered = []

    for det in detections:
        x, y, w, h = det['bbox']
        area = w * h

        if area < min_area or area > max_area:
            continue

        filtered.append(det)

    return filtered


def filter_by_class_specific_rules(detections: List[Dict]) -> List[Dict]:
    """
    Apply class-specific filtering rules.

    Different callout types have different characteristics:
    - Detail: Very strict (20-60px, square)
    - Elevation: Medium (30-80px, may have triangle)
    - Title: Very small (15-40px, square)

    Args:
        detections: List of detection dicts with 'bbox' and 'class' keys

    Returns:
        Filtered detections
    """
    filtered = []

    for det in detections:
        x, y, w, h = det['bbox']
        callout_type = det.get('class', det.get('callout_type', 'unknown'))

        # Detail callouts: strict filtering
        if callout_type == 'detail':
            # Must be small and square
            if w > 100 or h > 100:
                continue
            if w < 20 or h < 20:
                continue
            aspect_ratio = h / w if w > 0 else 0
            if aspect_ratio < 0.5 or aspect_ratio > 2.0:
                continue

        # Elevation callouts: medium filtering
        elif callout_type == 'elevation':
            # Can be slightly larger (includes triangle)
            if w > 120 or h > 120:
                continue
            if w < 25 or h < 25:
                continue

        # Title callouts: very permissive (can be wide text boxes 200-300px)
        elif callout_type == 'title':
            # Allow very wide boxes (text labels on detail sheets)
            # Only filter out extremely large boxes (likely title blocks/schedules)
            if w > 500 or h > 200:
                continue
            # Minimum size check
            if w < 12 or h < 12:
                continue
            # Very permissive aspect ratio (allow wide text boxes)
            aspect_ratio = h / w if w > 0 else 0
            if aspect_ratio < 0.05 or aspect_ratio > 5.0:
                continue

        filtered.append(det)

    return filtered


def apply_all_filters(
    detections: List[Dict],
    use_size_filter: bool = True,
    use_aspect_filter: bool = True,
    use_area_filter: bool = True,
    use_class_specific: bool = True,
    verbose: bool = False
) -> Dict:
    """
    Apply all post-processing filters sequentially.

    IMPORTANT: Title callouts skip general filters as they can be very wide (200-300px)
    text boxes that would be incorrectly filtered.

    Args:
        detections: List of detection dicts
        use_size_filter: Apply size filtering
        use_aspect_filter: Apply aspect ratio filtering
        use_area_filter: Apply area filtering
        use_class_specific: Apply class-specific rules
        verbose: Print filtering statistics

    Returns:
        Dict with 'filtered_detections' and 'filter_stats'
    """
    original_count = len(detections)
    current = detections.copy()

    stats = {
        'original': original_count,
        'removed_by_size': 0,
        'removed_by_aspect': 0,
        'removed_by_area': 0,
        'removed_by_class': 0,
        'final': 0
    }

    # Split title callouts from other callouts
    # Title callouts can be very wide text boxes (200-300px) and should skip general filters
    title_callouts = [d for d in current if d.get('class', d.get('callout_type')) == 'title']
    other_callouts = [d for d in current if d.get('class', d.get('callout_type')) != 'title']

    if verbose and len(title_callouts) > 0:
        print(f"Skipping general filters for {len(title_callouts)} title callouts (can be wide text boxes)")

    # Apply filters to non-title callouts
    current = other_callouts

    if use_size_filter:
        before = len(current)
        current = filter_by_size(current)
        after = len(current)
        stats['removed_by_size'] = before - after
        if verbose:
            print(f"Size filter: {before} → {after} ({before - after} removed)")

    if use_aspect_filter:
        before = len(current)
        current = filter_by_aspect_ratio(current)
        after = len(current)
        stats['removed_by_aspect'] = before - after
        if verbose:
            print(f"Aspect filter: {before} → {after} ({before - after} removed)")

    if use_area_filter:
        before = len(current)
        current = filter_by_area(current)
        after = len(current)
        stats['removed_by_area'] = before - after
        if verbose:
            print(f"Area filter: {before} → {after} ({before - after} removed)")

    if use_class_specific:
        before = len(current)
        current = filter_by_class_specific_rules(current)
        after = len(current)
        stats['removed_by_class'] = before - after
        if verbose:
            print(f"Class-specific filter: {before} → {after} ({before - after} removed)")

    # Apply class-specific filter to title callouts (they skip general filters)
    if use_class_specific and len(title_callouts) > 0:
        before_title = len(title_callouts)
        title_callouts = filter_by_class_specific_rules(title_callouts)
        after_title = len(title_callouts)
        stats['removed_by_class'] += (before_title - after_title)
        if verbose:
            print(f"Title-specific filter: {before_title} → {after_title} ({before_title - after_title} removed)")

    # Merge back title callouts with other callouts
    current = current + title_callouts

    stats['final'] = len(current)

    if verbose:
        print(f"\nTotal: {original_count} → {stats['final']} "
              f"({original_count - stats['final']} removed, "
              f"{stats['final']/original_count*100:.1f}% retained)")

    return {
        'filtered_detections': current,
        'filter_stats': stats
    }


if __name__ == "__main__":
    import json
    import argparse

    parser = argparse.ArgumentParser(description="Apply post-processing filters to detections")
    parser.add_argument("input_json", help="Path to detection JSON")
    parser.add_argument("--output", help="Path to save filtered detections")
    parser.add_argument("--no-size", action="store_true", help="Disable size filter")
    parser.add_argument("--no-aspect", action="store_true", help="Disable aspect filter")
    parser.add_argument("--no-area", action="store_true", help="Disable area filter")
    parser.add_argument("--no-class", action="store_true", help="Disable class-specific filter")

    args = parser.parse_args()

    # Load detections
    with open(args.input_json) as f:
        data = json.load(f)

    detections = data['detections']

    # Apply filters
    result = apply_all_filters(
        detections,
        use_size_filter=not args.no_size,
        use_aspect_filter=not args.no_aspect,
        use_area_filter=not args.no_area,
        use_class_specific=not args.no_class,
        verbose=True
    )

    # Save filtered results
    if args.output:
        data['detections'] = result['filtered_detections']
        data['metadata']['post_processing'] = result['filter_stats']

        with open(args.output, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"\nFiltered detections saved: {args.output}")

    # Print summary
    print("\n=== Filtering Summary ===")
    for key, value in result['filter_stats'].items():
        print(f"{key}: {value}")
