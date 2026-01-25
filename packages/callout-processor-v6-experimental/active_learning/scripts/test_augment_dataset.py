#!/usr/bin/env python3
"""
Test suite for augment_dataset.py module.

Validates crop extraction, metadata generation, and Roboflow workflow.
"""

import os
import json
import csv
import cv2
import numpy as np
import tempfile
import shutil
from pathlib import Path

from augment_dataset import (
    extract_crop_with_padding,
    augment_dataset_manual,
    generate_annotation_csv,
    extract_hard_examples_from_error_report,
    merge_datasets
)


def create_test_image(width=1000, height=800, output_path=None):
    """Create a test image with some patterns."""
    image = np.ones((height, width, 3), dtype=np.uint8) * 255

    cv2.rectangle(image, (100, 100), (300, 200), (0, 0, 255), -1)
    cv2.rectangle(image, (400, 300), (600, 500), (0, 255, 0), -1)
    cv2.rectangle(image, (700, 600), (900, 750), (255, 0, 0), -1)

    if output_path:
        cv2.imwrite(output_path, image)

    return image


def create_test_error_report(output_path=None):
    """Create mock error_report.json for testing."""
    error_report = {
        'false_negatives': {
            'total': 10,
            'by_size': {
                'tiny': 3,
                'small': 4,
                'medium': 2,
                'large': 1
            },
            'by_class': {
                'detail': 4,
                'elevation': 3,
                'title': 3
            },
            'low_contrast_count': 2,
            'unusual_aspect_count': 1,
            'details': {
                'by_size': {
                    'tiny': [
                        {'bbox': [50, 50, 30, 30], 'class': 'detail'},
                        {'bbox': [150, 150, 25, 25], 'class': 'title'},
                        {'bbox': [250, 250, 35, 35], 'class': 'elevation'}
                    ],
                    'small': [
                        {'bbox': [100, 100, 50, 50], 'class': 'detail'},
                        {'bbox': [200, 200, 45, 45], 'class': 'elevation'},
                        {'bbox': [300, 300, 55, 55], 'class': 'title'},
                        {'bbox': [400, 400, 48, 48], 'class': 'detail'}
                    ],
                    'medium': [
                        {'bbox': [500, 500, 100, 100], 'class': 'elevation'},
                        {'bbox': [650, 650, 90, 90], 'class': 'title'}
                    ],
                    'large': [
                        {'bbox': [700, 600, 150, 150], 'class': 'detail'}
                    ]
                },
                'low_contrast': [
                    {'bbox': [100, 100, 50, 50], 'class': 'detail', 'contrast': 15.2},
                    {'bbox': [200, 200, 45, 45], 'class': 'elevation', 'contrast': 18.5}
                ],
                'unusual_aspect': [
                    {'bbox': [300, 300, 150, 30], 'class': 'title', 'aspect_ratio': 5.0}
                ]
            }
        },
        'false_positives': {
            'total': 5
        },
        'image_path': '/tmp/test_image.png',
        'image_dimensions': {'width': 1000, 'height': 800}
    }

    if output_path:
        with open(output_path, 'w') as f:
            json.dump(error_report, f, indent=2)

    return error_report


def test_extract_crop_with_padding():
    """Test crop extraction with padding."""
    print("\n=== Testing extract_crop_with_padding ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        image_path = os.path.join(tmpdir, 'test.png')
        create_test_image(output_path=image_path)

        bbox = [100, 100, 50, 50]
        padding = 20

        crop = extract_crop_with_padding(image_path, bbox, padding=padding)

        expected_height = 50 + 2 * padding
        expected_width = 50 + 2 * padding

        assert crop.shape[0] == expected_height, f"Expected height {expected_height}, got {crop.shape[0]}"
        assert crop.shape[1] == expected_width, f"Expected width {expected_width}, got {crop.shape[1]}"
        assert crop.shape[2] == 3, "Expected 3 color channels"

        print(f"✓ Crop extracted: {crop.shape}")
        print(f"✓ Padding applied correctly")


def test_edge_case_crops():
    """Test crop extraction near image boundaries."""
    print("\n=== Testing edge case crops ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        image_path = os.path.join(tmpdir, 'test.png')
        create_test_image(width=500, height=400, output_path=image_path)

        edge_bbox = [10, 10, 50, 50]
        crop = extract_crop_with_padding(image_path, edge_bbox, padding=50)

        assert crop.shape[0] > 0, "Crop should be non-empty"
        assert crop.shape[1] > 0, "Crop should be non-empty"
        print(f"✓ Edge crop handled: {crop.shape}")

        corner_bbox = [450, 350, 40, 40]
        crop = extract_crop_with_padding(image_path, corner_bbox, padding=50)

        assert crop.shape[0] > 0, "Crop should be non-empty"
        assert crop.shape[1] > 0, "Crop should be non-empty"
        print(f"✓ Corner crop handled: {crop.shape}")


def test_augment_dataset_manual():
    """Test manual augmentation workflow."""
    print("\n=== Testing augment_dataset_manual ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        image_path = os.path.join(tmpdir, 'test.png')
        create_test_image(output_path=image_path)

        hard_examples = [
            {'bbox': [100, 100, 50, 50], 'class': 'detail', 'confidence': 0.0},
            {'bbox': [200, 200, 45, 45], 'class': 'elevation', 'confidence': 0.0},
            {'bbox': [300, 300, 55, 55], 'class': 'title', 'confidence': 0.0}
        ]

        annotation_dir = augment_dataset_manual(
            hard_examples,
            iteration_num=1,
            output_dir=tmpdir,
            image_path=image_path
        )

        assert os.path.exists(annotation_dir), f"Annotation dir should exist: {annotation_dir}"

        crops = list(Path(annotation_dir).glob('*.jpg'))
        assert len(crops) == 3, f"Expected 3 crops, found {len(crops)}"
        print(f"✓ Extracted {len(crops)} crops")

        csv_path = Path(annotation_dir) / 'metadata.csv'
        assert csv_path.exists(), "Metadata CSV should exist"

        with open(csv_path) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            assert len(rows) == 3, f"Expected 3 CSV rows, found {len(rows)}"

            first_row = rows[0]
            assert 'filename' in first_row
            assert 'ground_truth_class' in first_row
            assert 'bbox_x' in first_row
            assert 'iteration' in first_row
            print(f"✓ Metadata CSV generated with {len(rows)} rows")


def test_generate_annotation_csv():
    """Test CSV metadata generation."""
    print("\n=== Testing generate_annotation_csv ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        crops_metadata = [
            {
                'filename': 'fn_001_001_detail.jpg',
                'original_image': '/path/to/image.png',
                'ground_truth_class': 'detail',
                'bbox_x': 100,
                'bbox_y': 100,
                'bbox_w': 50,
                'bbox_h': 50,
                'confidence': 0.0,
                'iteration': 1,
                'crop_timestamp': '2026-01-23T12:00:00'
            }
        ]

        csv_path = os.path.join(tmpdir, 'test_metadata.csv')
        generate_annotation_csv(crops_metadata, csv_path)

        assert os.path.exists(csv_path), "CSV should be created"

        with open(csv_path) as f:
            reader = csv.DictReader(f)
            rows = list(reader)

            assert len(rows) == 1
            assert rows[0]['filename'] == 'fn_001_001_detail.jpg'
            assert rows[0]['ground_truth_class'] == 'detail'
            assert rows[0]['bbox_x'] == '100'
            print("✓ CSV generated correctly")


def test_extract_hard_examples_from_error_report():
    """Test hard example extraction from error report."""
    print("\n=== Testing extract_hard_examples_from_error_report ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        error_report_path = os.path.join(tmpdir, 'error_report.json')
        create_test_error_report(output_path=error_report_path)

        hard_examples = extract_hard_examples_from_error_report(
            error_report_path,
            min_severity='all'
        )

        assert len(hard_examples) >= 10, f"Expected at least 10 examples, got {len(hard_examples)}"
        print(f"✓ Extracted {len(hard_examples)} hard examples")

        tiny_only = extract_hard_examples_from_error_report(
            error_report_path,
            min_severity='tiny'
        )

        print(f"✓ Tiny filter: {len(tiny_only)} examples")


def test_merge_datasets():
    """Test dataset merging functionality."""
    print("\n=== Testing merge_datasets ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        orig_dataset = Path(tmpdir) / 'original'
        new_dataset = Path(tmpdir) / 'new'
        merged_dataset = Path(tmpdir) / 'merged'

        for dataset in [orig_dataset, new_dataset]:
            for split in ['train', 'val']:
                (dataset / split / 'images').mkdir(parents=True)
                (dataset / split / 'labels').mkdir(parents=True)

                img_path = dataset / split / 'images' / f'{dataset.name}_{split}_001.png'
                create_test_image(output_path=str(img_path))

                label_path = dataset / split / 'labels' / f'{dataset.name}_{split}_001.txt'
                with open(label_path, 'w') as f:
                    f.write('0 0.5 0.5 0.1 0.1\n')

        data_yaml = orig_dataset / 'data.yaml'
        with open(data_yaml, 'w') as f:
            f.write('train: train/images\nval: val/images\nnc: 3\nnames: [detail, elevation, title]\n')

        merged_path = merge_datasets(
            str(orig_dataset),
            str(new_dataset),
            str(merged_dataset)
        )

        assert os.path.exists(merged_path), "Merged dataset should exist"

        for split in ['train', 'val']:
            split_path = Path(merged_path) / split
            assert split_path.exists(), f"{split} split should exist"

            images = list((split_path / 'images').glob('*'))
            labels = list((split_path / 'labels').glob('*'))

            assert len(images) == 2, f"Expected 2 images in {split}, got {len(images)}"
            assert len(labels) == 2, f"Expected 2 labels in {split}, got {len(labels)}"

            print(f"✓ {split} split merged: {len(images)} images, {len(labels)} labels")

        assert (Path(merged_path) / 'data.yaml').exists(), "data.yaml should be copied"
        print("✓ Dataset merge successful")


def test_invalid_inputs():
    """Test error handling for invalid inputs."""
    print("\n=== Testing invalid input handling ===")

    try:
        extract_crop_with_padding('/nonexistent/image.png', [0, 0, 10, 10])
        assert False, "Should raise ValueError for nonexistent image"
    except ValueError:
        print("✓ Handles nonexistent image correctly")

    try:
        augment_dataset_manual([], 1, '/tmp', '/tmp/test.png')
        assert False, "Should raise ValueError for empty hard examples"
    except ValueError:
        print("✓ Handles empty hard examples correctly")


def run_all_tests():
    """Run all test functions."""
    print("\n" + "=" * 70)
    print("AUGMENT_DATASET.PY TEST SUITE")
    print("=" * 70)

    tests = [
        test_extract_crop_with_padding,
        test_edge_case_crops,
        test_augment_dataset_manual,
        test_generate_annotation_csv,
        test_extract_hard_examples_from_error_report,
        test_merge_datasets,
        test_invalid_inputs
    ]

    passed = 0
    failed = 0

    for test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"\n✗ FAILED: {test_func.__name__}")
            print(f"  Error: {e}")
            failed += 1
        except Exception as e:
            print(f"\n✗ ERROR: {test_func.__name__}")
            print(f"  Exception: {e}")
            failed += 1

    print("\n" + "=" * 70)
    print(f"TEST RESULTS: {passed} passed, {failed} failed")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    import sys
    success = run_all_tests()
    sys.exit(0 if success else 1)
