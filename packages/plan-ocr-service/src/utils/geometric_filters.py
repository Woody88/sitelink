#!/usr/bin/env python3
"""
Advanced geometric filters for reducing false positives in Stage 1 detection

Implements shape quality metrics and context-aware filtering to reduce
false positives while maintaining high recall for true markers.
"""

import cv2
import numpy as np
from typing import List, Tuple
import sys


def calculate_circularity(contour: np.ndarray) -> float:
    """
    Calculate circularity metric for a contour

    Circularity = (4 * pi * area) / (perimeter^2)
    Perfect circle = 1.0, less circular shapes < 1.0

    Args:
        contour: OpenCV contour

    Returns:
        Circularity score (0.0 to 1.0)
    """
    area = cv2.contourArea(contour)
    perimeter = cv2.arcLength(contour, True)

    if perimeter == 0:
        return 0.0

    circularity = (4 * np.pi * area) / (perimeter ** 2)
    return min(circularity, 1.0)  # Cap at 1.0


def check_circle_fill(gray_region: np.ndarray, threshold: float = 0.95) -> bool:
    """
    Check if a circular region is mostly solid (likely false positive)

    Real markers have internal text/structure, not solid fills.

    Args:
        gray_region: Grayscale image of the circular region
        threshold: Fraction of pixels that must be similar to be considered solid

    Returns:
        True if region appears solid (reject), False if has internal structure (keep)
    """
    if gray_region.size == 0:
        return False

    # Create circular mask
    h, w = gray_region.shape
    center = (w // 2, h // 2)
    radius = min(w, h) // 2
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, center, radius, 255, -1)

    # Get pixels within circle
    circle_pixels = gray_region[mask > 0]

    if len(circle_pixels) == 0:
        return False

    # Check standard deviation (low std = solid fill)
    std_dev = np.std(circle_pixels)

    # Solid regions have very low variance
    return std_dev < 10  # Threshold determined empirically


def calculate_contrast(gray_region: np.ndarray, bbox: Tuple[int, int, int, int],
                       full_image: np.ndarray) -> float:
    """
    Calculate contrast between candidate region and surrounding area

    Real markers should have high contrast with background.

    Args:
        gray_region: Grayscale image of the candidate region
        bbox: (x, y, w, h) bounding box
        full_image: Full grayscale tile image

    Returns:
        Contrast score (0.0 to 1.0, higher = more contrast)
    """
    if gray_region.size == 0:
        return 0.0

    x, y, w, h = bbox
    img_h, img_w = full_image.shape

    # Expand bbox to get surrounding region (1.5x size)
    margin = max(w, h) // 4
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(img_w, x + w + margin)
    y2 = min(img_h, y + h + margin)

    surrounding = full_image[y1:y2, x1:x2]

    if surrounding.size == 0:
        return 0.0

    # Calculate mean intensity difference
    region_mean = np.mean(gray_region)
    surrounding_mean = np.mean(surrounding)

    # Normalize to 0-1 scale
    contrast = abs(region_mean - surrounding_mean) / 255.0

    return contrast


def check_edge_proximity(bbox: Tuple[int, int, int, int],
                         image_shape: Tuple[int, int],
                         margin: int = 20) -> bool:
    """
    Check if candidate is near tile edge (may be partial marker)

    Args:
        bbox: (x, y, w, h) bounding box
        image_shape: (height, width) of tile
        margin: Pixel margin from edge

    Returns:
        True if near edge, False otherwise
    """
    x, y, w, h = bbox
    img_h, img_w = image_shape

    # Check if any edge is within margin
    near_left = x < margin
    near_top = y < margin
    near_right = (x + w) > (img_w - margin)
    near_bottom = (y + h) > (img_h - margin)

    return near_left or near_top or near_right or near_bottom


def check_isolation(bbox: Tuple[int, int, int, int],
                    all_candidates: List,
                    min_distance: int = 50) -> bool:
    """
    Check if candidate is isolated from other candidates

    Real markers are usually isolated, not clustered with many others.

    Args:
        bbox: (x, y, w, h) bounding box of current candidate
        all_candidates: List of all candidate objects
        min_distance: Minimum distance to be considered isolated

    Returns:
        True if isolated, False if clustered
    """
    x, y, w, h = bbox
    center_x = x + w // 2
    center_y = y + h // 2

    nearby_count = 0

    for candidate in all_candidates:
        cx, cy, cw, ch = candidate.bbox
        cand_center_x = cx + cw // 2
        cand_center_y = cy + ch // 2

        # Calculate distance between centers
        distance = np.sqrt((center_x - cand_center_x)**2 +
                          (center_y - cand_center_y)**2)

        if 0 < distance < min_distance:
            nearby_count += 1

    # Allow up to 3 nearby candidates (for overlapping tiles)
    return nearby_count <= 3


def calculate_triangle_regularity(contour: np.ndarray) -> float:
    """
    Calculate how regular/equilateral a triangle is

    Args:
        contour: Triangle contour (should have 3 vertices)

    Returns:
        Regularity score (0.0 to 1.0, higher = more regular)
    """
    if len(contour) != 3:
        return 0.0

    # Get the three vertices
    pts = contour.reshape(-1, 2)

    # Calculate side lengths
    side1 = np.linalg.norm(pts[0] - pts[1])
    side2 = np.linalg.norm(pts[1] - pts[2])
    side3 = np.linalg.norm(pts[2] - pts[0])

    sides = [side1, side2, side3]

    # Calculate variation in side lengths
    mean_side = np.mean(sides)

    if mean_side == 0:
        return 0.0

    # Calculate coefficient of variation
    std_dev = np.std(sides)
    cv = std_dev / mean_side

    # Convert to regularity score (0 variation = 1.0, high variation = 0.0)
    regularity = max(0.0, 1.0 - (cv * 2))  # Scale cv to 0-1 range

    return regularity


def filter_circles(candidates: List, tile_image: np.ndarray,
                   strict: bool = True) -> Tuple[List, dict]:
    """
    Apply advanced filtering to circular candidates

    Uses multiple heuristics to score and filter candidates. Focus on
    rejecting false positives while preserving true markers.

    Args:
        candidates: List of circular SymbolCandidate objects
        tile_image: Grayscale tile image
        strict: If True, apply strict filtering. If False, minimal filtering

    Returns:
        Tuple of (filtered_candidates, filter_stats)
    """
    if not candidates:
        return [], {}

    stats = {
        'input_count': len(candidates),
        'rejected_size': 0,
        'rejected_edge': 0,
        'rejected_solid_white': 0,
        'rejected_solid_black': 0,
        'rejected_low_quality': 0,
        'output_count': 0
    }

    # Aggressive filtering to achieve 70-80% FP reduction
    if strict:
        edge_margin = 10  # Reject near-edge candidates
        min_area = 200    # Real markers are typically 15-60px diameter (225-3600 area)
        max_area = 10000  # Reject huge detections
        min_quality_score = 0.45  # More aggressive quality threshold
    else:
        edge_margin = 5
        min_area = 100
        max_area = 15000
        min_quality_score = 0.2

    filtered = []

    for candidate in candidates:
        x, y, w, h = candidate.bbox

        # Skip if bbox is invalid (completely outside image)
        if x + w <= 0 or y + h <= 0 or x >= tile_image.shape[1] or y >= tile_image.shape[0]:
            stats['rejected_edge'] += 1
            continue

        # Clip bbox to valid region
        x_clipped = max(0, x)
        y_clipped = max(0, y)
        x2_clipped = min(tile_image.shape[1], x + w)
        y2_clipped = min(tile_image.shape[0], y + h)

        w_clipped = x2_clipped - x_clipped
        h_clipped = y2_clipped - y_clipped

        if w_clipped <= 0 or h_clipped <= 0:
            stats['rejected_edge'] += 1
            continue

        # Extract region
        region = tile_image[y_clipped:y2_clipped, x_clipped:x2_clipped]

        # Check size bounds
        area = w * h
        if area < min_area or area > max_area:
            stats['rejected_size'] += 1
            continue

        # Check edge proximity (reject if mostly cut off by edge)
        if check_edge_proximity(candidate.bbox, tile_image.shape, edge_margin):
            # Only reject if region is very small (likely partial)
            if w_clipped < w * 0.7 or h_clipped < h * 0.7:
                stats['rejected_edge'] += 1
                continue

        # Reject completely solid white regions (likely background artifacts)
        mean_intensity = np.mean(region)
        if mean_intensity > 250:  # Nearly all white
            stats['rejected_solid_white'] += 1
            continue

        # Reject completely solid black regions (likely drawing artifacts)
        if mean_intensity < 5:  # Nearly all black
            stats['rejected_solid_black'] += 1
            continue

        # Calculate quality score (combination of multiple metrics)
        quality_score = 0.0
        num_metrics = 0

        # 1. Aspect ratio (circles should be roughly square)
        aspect_ratio = w / h if h > 0 else 0
        if 0.7 <= aspect_ratio <= 1.43:  # Allow some variation
            quality_score += 1.0
        elif 0.5 <= aspect_ratio <= 2.0:
            quality_score += 0.5
        num_metrics += 1

        # 2. Size consistency (real markers are typically 16-60px diameter)
        diameter = (w + h) / 2
        if 16 <= diameter <= 60:
            quality_score += 1.0
        elif 12 <= diameter <= 80:
            quality_score += 0.5
        num_metrics += 1

        # 3. Intensity variance (markers have text, not uniform)
        std_dev = np.std(region)
        if std_dev > 30:  # Good variance
            quality_score += 1.0
        elif std_dev > 15:
            quality_score += 0.5
        num_metrics += 1

        # 4. Edge strength (markers should have defined edges)
        edges = cv2.Canny(region, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        if edge_density > 0.15:
            quality_score += 1.0
        elif edge_density > 0.08:
            quality_score += 0.5
        num_metrics += 1

        # Normalize quality score
        quality_score = quality_score / num_metrics if num_metrics > 0 else 0.0

        # Reject if quality score too low
        if quality_score < min_quality_score:
            stats['rejected_low_quality'] += 1
            continue

        # Passed all filters - keep candidate
        filtered.append(candidate)

    stats['output_count'] = len(filtered)

    return filtered, stats


def filter_triangles(candidates: List, tile_image: np.ndarray,
                     strict: bool = True) -> Tuple[List, dict]:
    """
    Apply advanced filtering to triangular candidates

    Focus on rejecting clear false positives while preserving recall.

    Args:
        candidates: List of triangular SymbolCandidate objects
        tile_image: Grayscale tile image
        strict: If True, apply strict filtering. If False, minimal filtering

    Returns:
        Tuple of (filtered_candidates, filter_stats)
    """
    if not candidates:
        return [], {}

    stats = {
        'input_count': len(candidates),
        'rejected_size': 0,
        'rejected_edge': 0,
        'rejected_solid': 0,
        'output_count': 0
    }

    # Conservative filtering
    if strict:
        edge_margin = 8
        min_area = 100
        max_area = 15000
    else:
        edge_margin = 5
        min_area = 50
        max_area = 20000

    filtered = []

    for candidate in candidates:
        x, y, w, h = candidate.bbox

        # Skip if bbox is invalid
        if x + w <= 0 or y + h <= 0 or x >= tile_image.shape[1] or y >= tile_image.shape[0]:
            stats['rejected_edge'] += 1
            continue

        # Clip bbox
        x_clipped = max(0, x)
        y_clipped = max(0, y)
        x2_clipped = min(tile_image.shape[1], x + w)
        y2_clipped = min(tile_image.shape[0], y + h)

        w_clipped = x2_clipped - x_clipped
        h_clipped = y2_clipped - y_clipped

        if w_clipped <= 0 or h_clipped <= 0:
            stats['rejected_edge'] += 1
            continue

        region = tile_image[y_clipped:y2_clipped, x_clipped:x2_clipped]

        # Check size
        area = w * h
        if area < min_area or area > max_area:
            stats['rejected_size'] += 1
            continue

        # Check edge proximity
        if check_edge_proximity(candidate.bbox, tile_image.shape, edge_margin):
            if w_clipped < w * 0.7 or h_clipped < h * 0.7:
                stats['rejected_edge'] += 1
                continue

        # Reject solid regions
        mean_intensity = np.mean(region)
        if mean_intensity > 250 or mean_intensity < 5:
            stats['rejected_solid'] += 1
            continue

        # Passed all filters
        filtered.append(candidate)

    stats['output_count'] = len(filtered)

    return filtered, stats


def apply_geometric_filters(candidates: List, tile_image: np.ndarray,
                            strict_filtering: bool = True,
                            verbose: bool = False) -> Tuple[List, dict]:
    """
    Apply geometric filters to all candidates

    Separates candidates by type and applies type-specific filters.

    Args:
        candidates: List of SymbolCandidate objects
        tile_image: Grayscale tile image
        strict_filtering: Use strict thresholds (True) or relaxed (False)
        verbose: Print filtering statistics

    Returns:
        Tuple of (filtered_candidates, combined_stats)
    """
    # Separate by type
    circles = [c for c in candidates if c.symbol_type == 'circular']
    triangles = [c for c in candidates if c.symbol_type == 'triangular']

    # Apply filters
    filtered_circles, circle_stats = filter_circles(circles, tile_image, strict_filtering)
    filtered_triangles, triangle_stats = filter_triangles(triangles, tile_image, strict_filtering)

    # Combine results
    filtered_all = filtered_circles + filtered_triangles

    combined_stats = {
        'input_count': len(candidates),
        'output_count': len(filtered_all),
        'circles': circle_stats,
        'triangles': triangle_stats,
        'reduction_pct': ((len(candidates) - len(filtered_all)) / len(candidates) * 100) if candidates else 0
    }

    if verbose:
        print(f"\nGeometric Filtering:", file=sys.stderr)
        print(f"  Input: {combined_stats['input_count']} candidates", file=sys.stderr)
        print(f"  Output: {combined_stats['output_count']} candidates", file=sys.stderr)
        print(f"  Reduction: {combined_stats['reduction_pct']:.1f}%", file=sys.stderr)

        if circles:
            print(f"\n  Circles ({circle_stats['input_count']} → {circle_stats['output_count']}):", file=sys.stderr)
            print(f"    Rejected circularity: {circle_stats['rejected_circularity']}", file=sys.stderr)
            print(f"    Rejected solid fill: {circle_stats['rejected_solid_fill']}", file=sys.stderr)
            print(f"    Rejected low contrast: {circle_stats['rejected_low_contrast']}", file=sys.stderr)
            print(f"    Rejected edge: {circle_stats['rejected_edge']}", file=sys.stderr)

        if triangles:
            print(f"\n  Triangles ({triangle_stats['input_count']} → {triangle_stats['output_count']}):", file=sys.stderr)
            print(f"    Rejected regularity: {triangle_stats['rejected_regularity']}", file=sys.stderr)
            print(f"    Rejected low contrast: {triangle_stats['rejected_low_contrast']}", file=sys.stderr)
            print(f"    Rejected edge: {triangle_stats['rejected_edge']}", file=sys.stderr)

    return filtered_all, combined_stats
