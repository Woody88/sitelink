"""
Error categorization and analysis for false negatives/positives.

Analyzes validation results to categorize errors by size, position, visual characteristics,
and class-specific patterns. Generates visualizations and suggests prompt improvements.
"""

import json
import cv2
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict


def calculate_area(bbox: List[float]) -> float:
    """Calculate bbox area from [x, y, w, h] format."""
    return bbox[2] * bbox[3]


def categorize_size(area: float) -> str:
    """Categorize bbox by area in pixels²."""
    if area < 500:
        return "tiny"
    elif area < 2000:
        return "small"
    elif area < 10000:
        return "medium"
    else:
        return "large"


def calculate_contrast(image: np.ndarray, bbox: List[float]) -> float:
    """Calculate local contrast ratio for a bbox region."""
    x, y, w, h = [int(v) for v in bbox]

    # Clamp to image bounds
    x = max(0, x)
    y = max(0, y)
    w = min(w, image.shape[1] - x)
    h = min(h, image.shape[0] - y)

    if w <= 0 or h <= 0:
        return 0.0

    region = image[y:y+h, x:x+w]

    if region.size == 0:
        return 0.0

    # Convert to grayscale if needed
    if len(region.shape) == 3:
        region = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

    # Calculate standard deviation as proxy for contrast
    return float(np.std(region))


def categorize_position(bbox: List[float], image_width: int, image_height: int, edge_threshold: int = 100) -> str:
    """Categorize bbox by position (edge, corner, center)."""
    x, y, w, h = bbox

    # Check if near edges
    near_left = x < edge_threshold
    near_right = (x + w) > (image_width - edge_threshold)
    near_top = y < edge_threshold
    near_bottom = (y + h) > (image_height - edge_threshold)

    # Corner check
    if (near_left or near_right) and (near_top or near_bottom):
        return "corner"

    # Edge check
    if near_left or near_right or near_top or near_bottom:
        return "edge"

    return "center"


def calculate_aspect_ratio(bbox: List[float]) -> float:
    """Calculate aspect ratio (width/height)."""
    _, _, w, h = bbox
    if h == 0:
        return 0.0
    return w / h


def is_unusual_aspect_ratio(aspect_ratio: float, min_ratio: float = 0.2, max_ratio: float = 5.0) -> bool:
    """Check if aspect ratio is unusual (too narrow or wide)."""
    return aspect_ratio < min_ratio or aspect_ratio > max_ratio


def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """Calculate IoU between two boxes in [x, y, w, h] format."""
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


def check_overlapping(bbox: List[float], all_detections: List[Dict], iou_threshold: float = 0.3) -> bool:
    """Check if bbox overlaps significantly with any detection."""
    for det in all_detections:
        iou = calculate_iou(bbox, det['bbox'])
        if iou > iou_threshold:
            return True

    return False


def analyze_errors(validation_results: Dict, image_path: str, output_dir: str) -> Dict:
    """
    Categorize and analyze all false negatives and false positives.

    Args:
        validation_results: Dict with 'tp', 'fp', 'fn' lists
        image_path: Path to the validation image
        output_dir: Directory to save analysis results

    Returns:
        Dict with categorized errors and analysis
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Load image for contrast and position analysis
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")

    height, width = image.shape[:2]

    fn_list = validation_results.get('fn', [])
    fp_list = validation_results.get('fp', [])
    det_list = validation_results.get('detections', [])

    # Analyze false negatives
    fn_analysis = {
        'by_size': defaultdict(list),
        'by_position': defaultdict(list),
        'by_class': defaultdict(list),
        'low_contrast': [],
        'unusual_aspect': [],
        'overlapping': [],
        'total': len(fn_list)
    }

    for fn in fn_list:
        bbox = fn['bbox']
        class_name = fn['class']
        area = calculate_area(bbox)

        # Size categorization
        size_cat = categorize_size(area)
        fn_analysis['by_size'][size_cat].append(fn)

        # Position categorization
        pos_cat = categorize_position(bbox, width, height)
        fn_analysis['by_position'][pos_cat].append(fn)

        # Class categorization
        fn_analysis['by_class'][class_name].append(fn)

        # Visual characteristics
        contrast = calculate_contrast(image, bbox)
        if contrast < 30:  # Low contrast threshold
            fn_analysis['low_contrast'].append({**fn, 'contrast': contrast})

        # Aspect ratio
        aspect = calculate_aspect_ratio(bbox)
        if is_unusual_aspect_ratio(aspect):
            fn_analysis['unusual_aspect'].append({**fn, 'aspect_ratio': aspect})

        # Overlapping check
        if check_overlapping(bbox, det_list):
            fn_analysis['overlapping'].append(fn)

    # Analyze false positives
    fp_analysis = {
        'by_class': defaultdict(list),
        'by_size': defaultdict(list),
        'total': len(fp_list)
    }

    for fp in fp_list:
        bbox = fp['bbox']
        class_name = fp['class']
        area = calculate_area(bbox)

        # Size categorization
        size_cat = categorize_size(area)
        fp_analysis['by_size'][size_cat].append(fp)

        # Class categorization
        fp_analysis['by_class'][class_name].append(fp)

    # Convert defaultdicts to regular dicts for JSON serialization
    error_report = {
        'false_negatives': {
            'total': fn_analysis['total'],
            'by_size': {k: len(v) for k, v in fn_analysis['by_size'].items()},
            'by_position': {k: len(v) for k, v in fn_analysis['by_position'].items()},
            'by_class': {k: len(v) for k, v in fn_analysis['by_class'].items()},
            'low_contrast_count': len(fn_analysis['low_contrast']),
            'unusual_aspect_count': len(fn_analysis['unusual_aspect']),
            'overlapping_count': len(fn_analysis['overlapping']),
            'details': {
                'by_size': {k: [item for item in v] for k, v in fn_analysis['by_size'].items()},
                'low_contrast': fn_analysis['low_contrast'],
                'unusual_aspect': fn_analysis['unusual_aspect'],
                'overlapping': fn_analysis['overlapping']
            }
        },
        'false_positives': {
            'total': fp_analysis['total'],
            'by_class': {k: len(v) for k, v in fp_analysis['by_class'].items()},
            'by_size': {k: len(v) for k, v in fp_analysis['by_size'].items()},
            'details': {
                'by_class': {k: [item for item in v] for k, v in fp_analysis['by_class'].items()}
            }
        },
        'image_dimensions': {'width': width, 'height': height},
        'image_path': image_path
    }

    # Save error report
    report_path = output_path / "error_report.json"
    with open(report_path, 'w') as f:
        json.dump(error_report, f, indent=2)

    print(f"Error analysis saved to {report_path}")

    return error_report


def extract_fn_crops(error_report: Dict, output_dir: str, padding: int = 50):
    """
    Extract FN crops with context padding.

    Args:
        error_report: Error report dict from analyze_errors
        output_dir: Directory to save crops
        padding: Pixels of context padding around bbox
    """
    output_path = Path(output_dir) / "fn_crops"
    output_path.mkdir(parents=True, exist_ok=True)

    image_path = error_report['image_path']
    image = cv2.imread(image_path)

    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")

    fn_details = error_report['false_negatives']['details']

    # Extract from all size categories
    crop_count = 0
    for size_cat, fn_list in fn_details['by_size'].items():
        for i, fn in enumerate(fn_list):
            bbox = fn['bbox']
            x, y, w, h = [int(v) for v in bbox]

            # Add padding
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(image.shape[1], x + w + padding)
            y2 = min(image.shape[0], y + h + padding)

            cropped = image[y1:y2, x1:x2]

            # Generate filename
            class_name = fn['class']
            image_stem = Path(image_path).stem
            filename = f"{image_stem}_fn_{size_cat}_{i}_{class_name}.png"

            save_path = output_path / filename
            cv2.imwrite(str(save_path), cropped)
            crop_count += 1

    print(f"Extracted {crop_count} FN crops to {output_path}")


def generate_error_visualizations(error_report: Dict, output_dir: str):
    """
    Generate size distribution, heatmap, and other visualizations.

    Args:
        error_report: Error report dict from analyze_errors
        output_dir: Directory to save visualizations
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    fn_data = error_report['false_negatives']

    # 1. Size distribution histogram
    plt.figure(figsize=(10, 6))
    sizes = fn_data['by_size']
    if sizes:
        plt.bar(sizes.keys(), sizes.values())
        plt.xlabel('Size Category')
        plt.ylabel('Count')
        plt.title('False Negative Distribution by Size')
        plt.tight_layout()
        plt.savefig(output_path / "fn_size_distribution.png", dpi=150)
        plt.close()

    # 2. Position distribution
    plt.figure(figsize=(10, 6))
    positions = fn_data['by_position']
    if positions:
        plt.bar(positions.keys(), positions.values())
        plt.xlabel('Position Category')
        plt.ylabel('Count')
        plt.title('False Negative Distribution by Position')
        plt.tight_layout()
        plt.savefig(output_path / "fn_position_distribution.png", dpi=150)
        plt.close()

    # 3. Class distribution
    plt.figure(figsize=(10, 6))
    classes = fn_data['by_class']
    if classes:
        plt.bar(classes.keys(), classes.values())
        plt.xlabel('Class')
        plt.ylabel('Count')
        plt.title('False Negative Distribution by Class')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(output_path / "fn_class_distribution.png", dpi=150)
        plt.close()

    # 4. Error heatmap (spatial distribution)
    image_path = error_report['image_path']
    image = cv2.imread(image_path)
    height, width = image.shape[:2]

    # Create heatmap grid (downsampled for visualization)
    grid_size = 50
    heatmap = np.zeros((grid_size, grid_size))

    for size_cat, fn_list in fn_data['details']['by_size'].items():
        for fn in fn_list:
            bbox = fn['bbox']
            x, y, w, h = bbox

            # Center point
            cx = int((x + w/2) / width * grid_size)
            cy = int((y + h/2) / height * grid_size)

            # Clamp to grid
            cx = max(0, min(grid_size - 1, cx))
            cy = max(0, min(grid_size - 1, cy))

            heatmap[cy, cx] += 1

    plt.figure(figsize=(12, 10))
    sns.heatmap(heatmap, cmap='YlOrRd', cbar_kws={'label': 'FN Count'})
    plt.title('False Negative Spatial Heatmap')
    plt.xlabel('X Position (normalized)')
    plt.ylabel('Y Position (normalized)')
    plt.tight_layout()
    plt.savefig(output_path / "error_heatmap.png", dpi=150)
    plt.close()

    print(f"Generated visualizations in {output_path}")


def suggest_prompt_improvements(error_report: Dict, current_prompts: Dict) -> Dict:
    """
    Analyze errors and suggest prompt refinements.

    Args:
        error_report: Error report dict from analyze_errors
        current_prompts: Dict of current prompts by class

    Returns:
        Dict with suggested prompt improvements
    """
    fn_data = error_report['false_negatives']
    suggestions = {}

    # Analyze each class
    for class_name, count in fn_data['by_class'].items():
        class_suggestions = []

        # Check size distribution
        size_dist = fn_data['details']['by_size']
        tiny_count = sum(1 for item in size_dist.get('tiny', []) if item['class'] == class_name)
        small_count = sum(1 for item in size_dist.get('small', []) if item['class'] == class_name)

        if tiny_count > 0:
            class_suggestions.append({
                'issue': f"{tiny_count} tiny instances missed (<500 px²)",
                'suggestion': f"Add size modifier: 'small {class_name}' or 'tiny {class_name}' to prompt"
            })

        if small_count > 0:
            class_suggestions.append({
                'issue': f"{small_count} small instances missed (500-2000 px²)",
                'suggestion': f"Include scale descriptors: '{class_name} of various sizes' or 'both large and small {class_name}'"
            })

        # Check low contrast
        low_contrast = [item for item in fn_data['details'].get('low_contrast', [])
                       if item['class'] == class_name]
        if low_contrast:
            class_suggestions.append({
                'issue': f"{len(low_contrast)} low-contrast instances missed",
                'suggestion': f"Add visual descriptors: 'faded {class_name}' or '{class_name} with low contrast'"
            })

        # Check unusual aspect ratios
        unusual_aspect = [item for item in fn_data['details'].get('unusual_aspect', [])
                         if item['class'] == class_name]
        if unusual_aspect:
            class_suggestions.append({
                'issue': f"{len(unusual_aspect)} unusual aspect ratio instances missed",
                'suggestion': f"Include shape variations: 'elongated {class_name}' or '{class_name} of various proportions'"
            })

        # Check overlapping
        overlapping = [item for item in fn_data['details'].get('overlapping', [])
                      if item['class'] == class_name]
        if overlapping:
            class_suggestions.append({
                'issue': f"{len(overlapping)} overlapping instances missed",
                'suggestion': f"Add context: 'overlapping {class_name}' or 'clustered {class_name}'"
            })

        if class_suggestions:
            suggestions[class_name] = {
                'current_prompt': current_prompts.get(class_name, 'N/A'),
                'missed_count': count,
                'suggestions': class_suggestions
            }

    return suggestions


def main():
    """Example usage."""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze validation errors")
    parser.add_argument("validation_json", help="Path to validation results JSON")
    parser.add_argument("image", help="Path to validation image")
    parser.add_argument("--output-dir", required=True, help="Output directory for analysis")
    parser.add_argument("--extract-crops", action="store_true", help="Extract FN crops")
    parser.add_argument("--prompts", help="Path to current prompts JSON")

    args = parser.parse_args()

    # Load validation results
    with open(args.validation_json) as f:
        validation_results = json.load(f)

    # Analyze errors
    error_report = analyze_errors(validation_results, args.image, args.output_dir)

    # Extract crops if requested
    if args.extract_crops:
        extract_fn_crops(error_report, args.output_dir)

    # Generate visualizations
    generate_error_visualizations(error_report, args.output_dir)

    # Suggest prompt improvements
    if args.prompts:
        with open(args.prompts) as f:
            current_prompts = json.load(f)

        suggestions = suggest_prompt_improvements(error_report, current_prompts)

        # Save suggestions
        suggestions_path = Path(args.output_dir) / "prompt_suggestions.json"
        with open(suggestions_path, 'w') as f:
            json.dump(suggestions, f, indent=2)

        print(f"\nPrompt improvement suggestions saved to {suggestions_path}")

        # Print summary
        print("\n" + "=" * 60)
        print("PROMPT IMPROVEMENT SUGGESTIONS")
        print("=" * 60)
        for class_name, data in suggestions.items():
            print(f"\n{class_name.upper()}:")
            print(f"  Current: {data['current_prompt']}")
            print(f"  Missed: {data['missed_count']} instances")
            print(f"  Suggestions:")
            for i, sug in enumerate(data['suggestions'], 1):
                print(f"    {i}. {sug['issue']}")
                print(f"       → {sug['suggestion']}")


if __name__ == "__main__":
    main()
