"""
Dataset augmentation module for active learning pipeline.

Extracts false negative crops with context and prepares them for manual
annotation in Roboflow. Implements human-in-the-loop workflow for
dataset improvement.
"""

import json
import csv
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime


def extract_crop_with_padding(
    image_path: str,
    bbox: Tuple[int, int, int, int],
    padding: int = 50
) -> np.ndarray:
    """
    Extract crop with context padding around FN bbox.

    Args:
        image_path: Path to source image
        bbox: Bounding box as (x, y, w, h)
        padding: Pixels of context padding around bbox

    Returns:
        np.ndarray: Cropped image with padding

    Raises:
        ValueError: If image cannot be loaded
    """
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")

    x, y, w, h = [int(v) for v in bbox]

    x1 = max(0, x - padding)
    y1 = max(0, y - padding)
    x2 = min(image.shape[1], x + w + padding)
    y2 = min(image.shape[0], y + h + padding)

    cropped = image[y1:y2, x1:x2]

    if cropped.size == 0:
        raise ValueError(f"Invalid crop region: bbox={bbox}, padding={padding}")

    return cropped


def augment_dataset_manual(
    hard_examples: List[Dict],
    iteration_num: int,
    output_dir: str,
    image_path: str
) -> str:
    """
    Manual augmentation workflow with human-in-the-loop.

    Workflow:
    1. Extract FN crops with 50px padding (context window)
    2. Save to for_annotation/ folder
    3. Generate CSV with metadata (image, bbox, predicted_class)
    4. Prints instructions for Roboflow upload

    Args:
        hard_examples: List of false negative examples from error_report
        iteration_num: Current iteration number
        output_dir: Base output directory (e.g., error_analysis/iteration_N)
        image_path: Path to source image for cropping

    Returns:
        Path to for_annotation directory

    Raises:
        ValueError: If no hard examples provided or invalid paths
    """
    if not hard_examples:
        raise ValueError("No hard examples provided for augmentation")

    output_path = Path(output_dir) / "for_annotation"
    output_path.mkdir(parents=True, exist_ok=True)

    crops_metadata = []

    print(f"\nExtracting {len(hard_examples)} hard examples for manual annotation...")
    print(f"Output directory: {output_path}")

    for idx, example in enumerate(hard_examples):
        bbox = example.get('bbox')
        class_name = example.get('class', 'unknown')

        if not bbox:
            print(f"Warning: Skipping example {idx} - missing bbox")
            continue

        try:
            crop = extract_crop_with_padding(image_path, bbox, padding=50)

            filename = f"fn_{iteration_num:03d}_{idx:03d}_{class_name}.jpg"
            save_path = output_path / filename

            cv2.imwrite(str(save_path), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])

            crops_metadata.append({
                'filename': filename,
                'original_image': image_path,
                'ground_truth_class': class_name,
                'bbox_x': bbox[0],
                'bbox_y': bbox[1],
                'bbox_w': bbox[2],
                'bbox_h': bbox[3],
                'confidence': example.get('confidence', 0.0),
                'iteration': iteration_num,
                'crop_timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            print(f"Warning: Failed to extract crop {idx}: {e}")
            continue

    csv_path = output_path / "metadata.csv"
    generate_annotation_csv(crops_metadata, str(csv_path))

    print(f"\n✓ Extracted {len(crops_metadata)} crops")
    print(f"✓ Saved to: {output_path}")
    print(f"✓ Metadata: {csv_path}")

    print_roboflow_instructions(str(output_path), iteration_num)

    return str(output_path)


def generate_annotation_csv(
    crops_metadata: List[Dict],
    output_path: str
):
    """
    Generate metadata CSV for Roboflow.

    CSV columns:
    - filename: Crop image filename
    - original_image: Source image path
    - ground_truth_class: Expected class from ground truth
    - bbox_x, bbox_y, bbox_w, bbox_h: Original bbox coordinates
    - confidence: Model confidence (0.0 for FN)
    - iteration: Iteration number
    - crop_timestamp: When crop was extracted

    Args:
        crops_metadata: List of crop metadata dicts
        output_path: Path to save CSV file
    """
    if not crops_metadata:
        print("Warning: No metadata to save")
        return

    fieldnames = [
        'filename',
        'original_image',
        'ground_truth_class',
        'bbox_x',
        'bbox_y',
        'bbox_w',
        'bbox_h',
        'confidence',
        'iteration',
        'crop_timestamp'
    ]

    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(crops_metadata)

    print(f"✓ Generated metadata CSV: {output_path}")


def print_roboflow_instructions(annotation_dir: str, iteration_num: int):
    """
    Print step-by-step instructions for Roboflow workflow.

    Args:
        annotation_dir: Path to for_annotation directory
        iteration_num: Current iteration number
    """
    print("\n" + "=" * 70)
    print("ROBOFLOW ANNOTATION WORKFLOW")
    print("=" * 70)
    print("\nNEXT STEPS:")
    print(f"\n1. Upload crops to Roboflow:")
    print(f"   - Go to your Roboflow workspace")
    print(f"   - Upload all images from: {annotation_dir}")
    print(f"   - Tag with: iteration_{iteration_num:02d}_fn")
    print(f"\n2. Review and correct annotations:")
    print(f"   - Check if ground truth class is correct")
    print(f"   - Adjust bboxes if needed (crops have 50px padding)")
    print(f"   - Add missing annotations if multiple objects in crop")
    print(f"   - Fix any labeling errors")
    print(f"\n3. Export new dataset version:")
    print(f"   - Generate new version in Roboflow")
    print(f"   - Export as YOLOv11 format")
    print(f"   - Download to local directory")
    print(f"\n4. Merge with existing dataset:")
    print(f"   - Use merge_datasets() function")
    print(f"   - Or manually copy to dataset directory")
    print(f"\n5. Retrain model:")
    print(f"   - Run next iteration with augmented dataset")
    print(f"   - Monitor for improved recall on FN categories")
    print("\n" + "=" * 70)
    print("\nTIP: Focus on reviewing these common error patterns:")
    print("  • Tiny objects (<500 px²)")
    print("  • Low contrast regions")
    print("  • Edge/corner cases")
    print("  • Overlapping instances")
    print("  • Unusual aspect ratios")
    print("=" * 70 + "\n")


def merge_datasets(
    original_dataset: str,
    new_annotations: str,
    output_dataset: str
) -> str:
    """
    Merge new annotations with original dataset.

    Used after Roboflow export to combine new annotated images
    with the existing training dataset.

    Args:
        original_dataset: Path to original dataset root
        new_annotations: Path to Roboflow export directory
        output_dataset: Path to merged output dataset

    Returns:
        Path to merged dataset

    Raises:
        ValueError: If dataset paths are invalid
    """
    orig_path = Path(original_dataset)
    new_path = Path(new_annotations)
    out_path = Path(output_dataset)

    if not orig_path.exists():
        raise ValueError(f"Original dataset not found: {original_dataset}")

    if not new_path.exists():
        raise ValueError(f"New annotations not found: {new_annotations}")

    out_path.mkdir(parents=True, exist_ok=True)

    for split in ['train', 'val', 'test']:
        orig_split = orig_path / split
        new_split = new_path / split
        out_split = out_path / split

        if not orig_split.exists():
            print(f"Warning: Original {split} split not found, skipping")
            continue

        out_split.mkdir(parents=True, exist_ok=True)

        (out_split / 'images').mkdir(exist_ok=True)
        (out_split / 'labels').mkdir(exist_ok=True)

        print(f"\nMerging {split} split...")

        orig_images = list((orig_split / 'images').glob('*'))
        print(f"  Original images: {len(orig_images)}")

        for img_path in orig_images:
            img_dest = out_split / 'images' / img_path.name

            if not img_dest.exists():
                import shutil
                shutil.copy2(img_path, img_dest)

            label_path = orig_split / 'labels' / (img_path.stem + '.txt')
            if label_path.exists():
                label_dest = out_split / 'labels' / label_path.name
                if not label_dest.exists():
                    import shutil
                    shutil.copy2(label_path, label_dest)

        if new_split.exists():
            new_images = list((new_split / 'images').glob('*'))
            print(f"  New images: {len(new_images)}")

            for img_path in new_images:
                img_dest = out_split / 'images' / img_path.name

                if img_dest.exists():
                    print(f"    Warning: Duplicate image {img_path.name}, skipping")
                    continue

                import shutil
                shutil.copy2(img_path, img_dest)

                label_path = new_split / 'labels' / (img_path.stem + '.txt')
                if label_path.exists():
                    label_dest = out_split / 'labels' / label_path.name
                    shutil.copy2(label_path, label_dest)

        total_images = len(list((out_split / 'images').glob('*')))
        total_labels = len(list((out_split / 'labels').glob('*')))
        print(f"  Merged total: {total_images} images, {total_labels} labels")

    import shutil
    data_yaml_src = orig_path / 'data.yaml'
    if data_yaml_src.exists():
        shutil.copy2(data_yaml_src, out_path / 'data.yaml')
        print(f"\n✓ Copied data.yaml")

    print(f"\n✓ Dataset merged successfully")
    print(f"✓ Output: {out_path}")

    return str(out_path)


def extract_hard_examples_from_error_report(
    error_report_path: str,
    min_severity: str = 'all'
) -> List[Dict]:
    """
    Extract hard examples from error_report.json.

    Prioritizes examples based on difficulty:
    1. Tiny objects
    2. Low contrast
    3. Unusual aspect ratio
    4. Overlapping
    5. Edge cases

    Args:
        error_report_path: Path to error_report.json
        min_severity: Filter by category ('tiny', 'small', 'medium', 'large', 'all')

    Returns:
        List of hard example dicts with bbox and class
    """
    with open(error_report_path) as f:
        error_report = json.load(f)

    fn_data = error_report.get('false_negatives', {})
    fn_details = fn_data.get('details', {})

    hard_examples = []

    size_categories = ['tiny', 'small', 'medium', 'large']

    if min_severity == 'all':
        categories_to_extract = size_categories
    else:
        start_idx = size_categories.index(min_severity)
        categories_to_extract = size_categories[start_idx:]

    for size_cat in categories_to_extract:
        fn_list = fn_details.get('by_size', {}).get(size_cat, [])
        hard_examples.extend(fn_list)

    low_contrast = fn_details.get('low_contrast', [])
    for item in low_contrast:
        if item not in hard_examples:
            hard_examples.append(item)

    unusual_aspect = fn_details.get('unusual_aspect', [])
    for item in unusual_aspect:
        if item not in hard_examples:
            hard_examples.append(item)

    print(f"\nExtracted {len(hard_examples)} hard examples:")
    print(f"  - Size categories: {categories_to_extract}")
    print(f"  - Low contrast: {len(low_contrast)}")
    print(f"  - Unusual aspect: {len(unusual_aspect)}")

    return hard_examples


def main():
    """
    Example usage showing complete workflow.
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Augment dataset with hard examples for manual annotation"
    )
    parser.add_argument(
        "error_report",
        help="Path to error_report.json from error_analysis.py"
    )
    parser.add_argument(
        "image",
        help="Path to source image used in validation"
    )
    parser.add_argument(
        "--iteration",
        type=int,
        required=True,
        help="Current iteration number"
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory for annotation crops"
    )
    parser.add_argument(
        "--min-severity",
        default='all',
        choices=['tiny', 'small', 'medium', 'large', 'all'],
        help="Minimum size category to extract (default: all)"
    )
    parser.add_argument(
        "--merge",
        action='store_true',
        help="Merge mode: combine new annotations with original dataset"
    )
    parser.add_argument(
        "--original-dataset",
        help="Path to original dataset (for merge mode)"
    )
    parser.add_argument(
        "--new-annotations",
        help="Path to Roboflow export (for merge mode)"
    )
    parser.add_argument(
        "--merged-output",
        help="Path to merged output dataset (for merge mode)"
    )

    args = parser.parse_args()

    if args.merge:
        if not all([args.original_dataset, args.new_annotations, args.merged_output]):
            parser.error("Merge mode requires --original-dataset, --new-annotations, and --merged-output")

        print("\n" + "=" * 70)
        print("MERGING DATASETS")
        print("=" * 70)

        merged_path = merge_datasets(
            args.original_dataset,
            args.new_annotations,
            args.merged_output
        )

        print(f"\n✓ Merge complete: {merged_path}")
        print("\nNext steps:")
        print(f"  1. Update data.yaml if needed")
        print(f"  2. Run training with merged dataset:")
        print(f"     python train_active_learning.py --iteration {args.iteration + 1} --data {merged_path}/data.yaml")

    else:
        print("\n" + "=" * 70)
        print(f"EXTRACTING HARD EXAMPLES - ITERATION {args.iteration}")
        print("=" * 70)

        hard_examples = extract_hard_examples_from_error_report(
            args.error_report,
            min_severity=args.min_severity
        )

        if not hard_examples:
            print("\n⚠ No hard examples found to extract")
            return

        annotation_dir = augment_dataset_manual(
            hard_examples,
            args.iteration,
            args.output_dir,
            args.image
        )

        print(f"\n✓ Extraction complete")
        print(f"\n📁 Crops ready for annotation: {annotation_dir}")
        print(f"\n💡 Follow the printed instructions to complete the annotation workflow")


if __name__ == "__main__":
    main()
