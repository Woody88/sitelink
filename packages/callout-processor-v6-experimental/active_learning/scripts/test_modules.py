"""
Test script to verify error_analysis.py and convergence_tracker.py modules.
"""

import json
import tempfile
from pathlib import Path
import numpy as np
import cv2

# Import the modules
from error_analysis import (
    analyze_errors,
    extract_fn_crops,
    generate_error_visualizations,
    suggest_prompt_improvements
)
from convergence_tracker import (
    check_convergence,
    update_tracking,
    load_tracking_history,
    generate_convergence_plots,
    generate_convergence_report
)


def create_test_image(width=1000, height=800):
    """Create a test image."""
    image = np.ones((height, width, 3), dtype=np.uint8) * 255
    return image


def create_test_validation_results():
    """Create mock validation results for testing."""
    return {
        'precision': 0.85,
        'recall': 0.78,
        'f1': 0.81,
        'tp': 85,
        'fp': 15,
        'fn': 24,
        'gt_total': 109,
        'det_total': 100,
        'tp': [
            {
                'detection': {'bbox': [100, 100, 50, 50], 'class': 'detail'},
                'ground_truth': {'bbox': [98, 98, 52, 52], 'class': 'detail'},
                'iou': 0.85
            }
        ],
        'fp': [
            {'bbox': [200, 200, 40, 40], 'class': 'elevation'},
            {'bbox': [300, 300, 60, 60], 'class': 'title'}
        ],
        'fn': [
            {'bbox': [10, 10, 30, 30], 'class': 'detail'},  # tiny, corner
            {'bbox': [400, 400, 80, 80], 'class': 'elevation'},  # small, center
            {'bbox': [900, 10, 50, 50], 'class': 'title'},  # small, corner
            {'bbox': [500, 500, 120, 20], 'class': 'detail'},  # unusual aspect ratio
        ],
        'detections': [
            {'bbox': [100, 100, 50, 50], 'class': 'detail'},
            {'bbox': [200, 200, 40, 40], 'class': 'elevation'}
        ],
        'by_class': {
            'detail': {'precision': 0.88, 'recall': 0.75, 'f1': 0.81, 'tp': 30, 'fp': 4, 'fn': 10, 'gt_count': 40},
            'elevation': {'precision': 0.82, 'recall': 0.80, 'f1': 0.81, 'tp': 32, 'fp': 7, 'fn': 8, 'gt_count': 40},
            'title': {'precision': 0.85, 'recall': 0.79, 'f1': 0.82, 'tp': 23, 'fp': 4, 'fn': 6, 'gt_count': 29}
        }
    }


def test_error_analysis():
    """Test error analysis module."""
    print("\n" + "=" * 60)
    print("Testing error_analysis.py")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # Create test image
        image_path = tmpdir / "test_image.png"
        test_image = create_test_image()
        cv2.imwrite(str(image_path), test_image)

        # Create test validation results
        validation_results = create_test_validation_results()

        # Test analyze_errors
        print("\n1. Testing analyze_errors()...")
        output_dir = tmpdir / "error_analysis"
        error_report = analyze_errors(validation_results, str(image_path), str(output_dir))

        assert error_report['false_negatives']['total'] == 4
        assert 'by_size' in error_report['false_negatives']
        assert 'by_position' in error_report['false_negatives']
        print("✓ analyze_errors() passed")

        # Test extract_fn_crops
        print("\n2. Testing extract_fn_crops()...")
        extract_fn_crops(error_report, str(output_dir))

        crops_dir = output_dir / "fn_crops"
        assert crops_dir.exists()
        crop_files = list(crops_dir.glob("*.png"))
        assert len(crop_files) == 4
        print(f"✓ extract_fn_crops() passed - extracted {len(crop_files)} crops")

        # Test generate_error_visualizations
        print("\n3. Testing generate_error_visualizations()...")
        generate_error_visualizations(error_report, str(output_dir))

        assert (output_dir / "fn_size_distribution.png").exists()
        assert (output_dir / "fn_position_distribution.png").exists()
        assert (output_dir / "error_heatmap.png").exists()
        print("✓ generate_error_visualizations() passed")

        # Test suggest_prompt_improvements
        print("\n4. Testing suggest_prompt_improvements()...")
        current_prompts = {
            'detail': 'detail callout symbol',
            'elevation': 'elevation marker',
            'title': 'title block'
        }

        suggestions = suggest_prompt_improvements(error_report, current_prompts)

        assert 'detail' in suggestions
        assert len(suggestions['detail']['suggestions']) > 0
        print(f"✓ suggest_prompt_improvements() passed - {len(suggestions)} classes with suggestions")

        print("\n✓ All error_analysis tests passed!")


def test_convergence_tracker():
    """Test convergence tracker module."""
    print("\n" + "=" * 60)
    print("Testing convergence_tracker.py")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        csv_path = tmpdir / "convergence_tracking.csv"

        # Create test metrics for multiple iterations
        iterations_data = [
            {
                'val_f1': 0.75, 'val_precision': 0.78, 'val_recall': 0.72,
                'val_tp': 72, 'val_fp': 20, 'val_fn': 28,
                'train_f1': 0.80, 'dataset_size': 100, 'epochs': 50,
                'by_class': {
                    'detail': {'f1': 0.73, 'precision': 0.75, 'recall': 0.71, 'fn': 12},
                    'elevation': {'f1': 0.76, 'precision': 0.80, 'recall': 0.73, 'fn': 10},
                    'title': {'f1': 0.77, 'precision': 0.79, 'recall': 0.75, 'fn': 6}
                }
            },
            {
                'val_f1': 0.82, 'val_precision': 0.84, 'val_recall': 0.80,
                'val_tp': 80, 'val_fp': 15, 'val_fn': 20,
                'train_f1': 0.86, 'dataset_size': 150, 'epochs': 50,
                'by_class': {
                    'detail': {'f1': 0.80, 'precision': 0.82, 'recall': 0.78, 'fn': 8},
                    'elevation': {'f1': 0.83, 'precision': 0.85, 'recall': 0.81, 'fn': 7},
                    'title': {'f1': 0.84, 'precision': 0.86, 'recall': 0.82, 'fn': 5}
                }
            },
            {
                'val_f1': 0.89, 'val_precision': 0.90, 'val_recall': 0.88,
                'val_tp': 88, 'val_fp': 10, 'val_fn': 12,
                'train_f1': 0.92, 'dataset_size': 200, 'epochs': 50,
                'by_class': {
                    'detail': {'f1': 0.87, 'precision': 0.88, 'recall': 0.86, 'fn': 5},
                    'elevation': {'f1': 0.90, 'precision': 0.91, 'recall': 0.89, 'fn': 4},
                    'title': {'f1': 0.91, 'precision': 0.92, 'recall': 0.90, 'fn': 3}
                }
            }
        ]

        # Test update_tracking
        print("\n1. Testing update_tracking()...")
        for i, metrics in enumerate(iterations_data, 1):
            update_tracking(i, metrics, str(csv_path))

        assert csv_path.exists()
        print(f"✓ update_tracking() passed - created {csv_path}")

        # Test load_tracking_history
        print("\n2. Testing load_tracking_history()...")
        history = load_tracking_history(str(csv_path))

        assert len(history) == 3
        assert history[0]['iteration'] == 1
        assert history[2]['f1'] == 0.89
        print(f"✓ load_tracking_history() passed - loaded {len(history)} iterations")

        # Test check_convergence
        print("\n3. Testing check_convergence()...")

        config = {
            'target_f1': 0.98,
            'plateau_threshold': 0.005,
            'plateau_iterations': 3,
            'overfitting_threshold': 0.05,
            'max_iterations': 10
        }

        # Test continuing (not converged)
        current_metrics = iterations_data[2]
        result = check_convergence(current_metrics, history[:-1], config)
        assert result['should_stop'] == False
        print("✓ check_convergence() - continue training")

        # Test plateau detection
        plateau_metrics = {'val_f1': 0.891, 'train_f1': 0.92}
        plateau_history = history + [plateau_metrics]
        result = check_convergence(plateau_metrics, plateau_history, config)
        print(f"  Plateau check: {result['reason']}")

        # Test target achieved
        target_metrics = {'val_f1': 0.99, 'train_f1': 0.99}
        result = check_convergence(target_metrics, history, config)
        assert result['should_stop'] == True
        assert 'Target F1 achieved' in result['reason']
        print("✓ check_convergence() - target achieved")

        # Test overfitting detection
        overfitting_metrics = {'val_f1': 0.85, 'train_f1': 0.95}
        result = check_convergence(overfitting_metrics, history, config)
        assert result['should_stop'] == True
        assert 'Overfitting' in result['reason']
        print("✓ check_convergence() - overfitting detected")

        # Test generate_convergence_plots
        print("\n4. Testing generate_convergence_plots()...")
        output_dir = tmpdir / "convergence_plots"
        generate_convergence_plots(str(csv_path), str(output_dir))

        assert (output_dir / "f1_trend.png").exists()
        assert (output_dir / "metrics_trend.png").exists()
        assert (output_dir / "counts_trend.png").exists()
        assert (output_dir / "per_class_f1_trend.png").exists()
        print("✓ generate_convergence_plots() passed")

        # Test generate_convergence_report
        print("\n5. Testing generate_convergence_report()...")
        generate_convergence_report(str(csv_path), str(output_dir))

        assert (output_dir / "convergence_report.json").exists()

        with open(output_dir / "convergence_report.json") as f:
            report = json.load(f)

        assert report['total_iterations'] == 3
        assert report['initial_f1'] == 0.75
        assert report['final_f1'] == 0.89
        assert report['best_f1'] == 0.89
        print("✓ generate_convergence_report() passed")

        print("\n✓ All convergence_tracker tests passed!")


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("TESTING MODULES")
    print("=" * 60)

    try:
        test_error_analysis()
        test_convergence_tracker()

        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
