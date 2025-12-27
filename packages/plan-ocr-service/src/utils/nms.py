#!/usr/bin/env python3
"""
Non-Maximum Suppression for removing duplicate detections
"""

import numpy as np


def compute_iou(box1, box2):
    """
    Compute Intersection over Union (IoU) between two bounding boxes

    Args:
        box1: (x, y, w, h) tuple
        box2: (x, y, w, h) tuple

    Returns:
        IoU score (0.0 to 1.0)
    """
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2

    # Compute intersection
    x_left = max(x1, x2)
    y_top = max(y1, y2)
    x_right = min(x1 + w1, x2 + w2)
    y_bottom = min(y1 + h1, y2 + h2)

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)

    # Compute union
    box1_area = w1 * h1
    box2_area = w2 * h2
    union_area = box1_area + box2_area - intersection_area

    if union_area == 0:
        return 0.0

    iou = intersection_area / union_area
    return iou


def non_maximum_suppression(candidates, iou_threshold=0.3):
    """
    Apply Non-Maximum Suppression to remove duplicate detections

    Args:
        candidates: List of SymbolCandidate objects
        iou_threshold: IoU threshold for considering boxes as duplicates

    Returns:
        Filtered list of candidates
    """
    if not candidates:
        return []

    # Sort by confidence (descending)
    sorted_candidates = sorted(candidates, key=lambda c: c.confidence, reverse=True)

    keep = []

    while sorted_candidates:
        # Keep the highest confidence candidate
        best = sorted_candidates.pop(0)
        keep.append(best)

        # Remove all overlapping candidates
        filtered = []
        for candidate in sorted_candidates:
            iou = compute_iou(best.bbox, candidate.bbox)
            if iou <= iou_threshold:
                # Not overlapping enough, keep it
                filtered.append(candidate)
            # else: overlapping, discard it

        sorted_candidates = filtered

    return keep


def nms_per_symbol_type(candidates, iou_threshold=0.3):
    """
    Apply NMS separately for each symbol type

    This prevents circular and triangular symbols from suppressing each other
    if they happen to be close together.

    Args:
        candidates: List of SymbolCandidate objects
        iou_threshold: IoU threshold

    Returns:
        Filtered list of candidates
    """
    # Group by symbol type
    by_type = {}
    for candidate in candidates:
        symbol_type = candidate.symbol_type
        if symbol_type not in by_type:
            by_type[symbol_type] = []
        by_type[symbol_type].append(candidate)

    # Apply NMS to each group
    result = []
    for symbol_type, group in by_type.items():
        filtered = non_maximum_suppression(group, iou_threshold)
        result.extend(filtered)

    return result
