"""
Track metrics across iterations and detect convergence/plateau/overfitting.

Maintains CSV of metrics per iteration and generates trend visualizations.
Implements convergence logic for stopping criteria.
"""

import csv
import json
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional


def check_convergence(current_metrics: Dict, history: List[Dict], config: Dict) -> Dict:
    """
    Check if training should stop based on convergence criteria.

    Args:
        current_metrics: Latest validation metrics
        history: List of metrics dicts from previous iterations
        config: Configuration dict with thresholds

    Returns:
        Dict with convergence decision and reason
    """
    # Default config values
    target_f1 = config.get('target_f1', 0.98)
    plateau_threshold = config.get('plateau_threshold', 0.005)  # 0.5%
    plateau_iterations = config.get('plateau_iterations', 3)
    overfitting_threshold = config.get('overfitting_threshold', 0.05)  # 5%
    max_iterations = config.get('max_iterations', 10)

    current_iteration = len(history) + 1
    current_f1 = current_metrics.get('val_f1', 0.0)
    train_f1 = current_metrics.get('train_f1', None)

    result = {
        'should_stop': False,
        'reason': None,
        'iteration': current_iteration
    }

    # 1. Target achieved
    if current_f1 >= target_f1:
        result['should_stop'] = True
        result['reason'] = f"Target F1 achieved: {current_f1:.4f} >= {target_f1:.4f}"
        return result

    # 2. Max iterations reached
    if current_iteration >= max_iterations:
        result['should_stop'] = True
        result['reason'] = f"Maximum iterations reached: {current_iteration}/{max_iterations}"
        return result

    # 3. Check plateau (need at least plateau_iterations of history)
    if len(history) >= plateau_iterations:
        recent_f1_scores = [h.get('val_f1', 0.0) for h in history[-plateau_iterations:]]
        recent_f1_scores.append(current_f1)

        # Calculate improvement rate
        improvements = []
        for i in range(1, len(recent_f1_scores)):
            improvement = recent_f1_scores[i] - recent_f1_scores[i-1]
            improvements.append(improvement)

        max_improvement = max(improvements) if improvements else 0.0

        if max_improvement < plateau_threshold:
            result['should_stop'] = True
            result['reason'] = f"Plateau detected: max improvement {max_improvement:.4f} < {plateau_threshold:.4f} over last {plateau_iterations} iterations"
            return result

    # 4. Check overfitting (if train metrics available)
    if train_f1 is not None:
        gap = train_f1 - current_f1
        if gap > overfitting_threshold:
            result['should_stop'] = True
            result['reason'] = f"Overfitting detected: train F1 ({train_f1:.4f}) - val F1 ({current_f1:.4f}) = {gap:.4f} > {overfitting_threshold:.4f}"
            return result

    # Continue training
    result['reason'] = f"Continue training: F1={current_f1:.4f}, target={target_f1:.4f}"
    return result


def update_tracking(iteration: int, metrics: Dict, csv_path: str):
    """
    Append metrics to convergence_tracking.csv.

    Args:
        iteration: Current iteration number
        metrics: Metrics dict to append
        csv_path: Path to tracking CSV file
    """
    csv_file = Path(csv_path)

    # Prepare row data
    row = {
        'iteration': iteration,
        'f1': metrics.get('val_f1', 0.0),
        'precision': metrics.get('val_precision', 0.0),
        'recall': metrics.get('val_recall', 0.0),
        'tp': metrics.get('val_tp', 0),
        'fp': metrics.get('val_fp', 0),
        'fn': metrics.get('val_fn', 0),
        'train_f1': metrics.get('train_f1', None),
        'train_precision': metrics.get('train_precision', None),
        'train_recall': metrics.get('train_recall', None),
        'dataset_size': metrics.get('dataset_size', None),
        'training_time': metrics.get('training_time', None),
        'epochs': metrics.get('epochs', None)
    }

    # Add per-class metrics
    by_class = metrics.get('by_class', {})
    for class_name, class_metrics in by_class.items():
        row[f'{class_name}_f1'] = class_metrics.get('f1', 0.0)
        row[f'{class_name}_precision'] = class_metrics.get('precision', 0.0)
        row[f'{class_name}_recall'] = class_metrics.get('recall', 0.0)
        row[f'{class_name}_fn'] = class_metrics.get('fn', 0)

    # Check if file exists to determine if we need to write headers
    file_exists = csv_file.exists()

    # Write to CSV
    with open(csv_file, 'a', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())

        if not file_exists:
            writer.writeheader()

        writer.writerow(row)

    print(f"Updated tracking CSV: {csv_path}")


def load_tracking_history(csv_path: str) -> List[Dict]:
    """
    Load tracking history from CSV.

    Args:
        csv_path: Path to tracking CSV file

    Returns:
        List of metrics dicts
    """
    csv_file = Path(csv_path)

    if not csv_file.exists():
        return []

    history = []

    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Convert numeric fields
            metrics = {}
            for key, value in row.items():
                if value == '' or value is None:
                    metrics[key] = None
                elif key == 'iteration' or key.endswith('_tp') or key.endswith('_fp') or key.endswith('_fn'):
                    metrics[key] = int(value) if value else None
                else:
                    try:
                        metrics[key] = float(value)
                    except (ValueError, TypeError):
                        metrics[key] = value

            history.append(metrics)

    return history


def generate_convergence_plots(csv_path: str, output_dir: str):
    """
    Generate F1 over iterations, per-class trends, etc.

    Args:
        csv_path: Path to tracking CSV file
        output_dir: Directory to save plots
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    history = load_tracking_history(csv_path)

    if not history:
        print("No tracking history found")
        return

    iterations = [h['iteration'] for h in history]

    # 1. Overall F1 trend
    plt.figure(figsize=(12, 6))
    f1_scores = [h.get('f1', 0.0) for h in history]
    train_f1_scores = [h.get('train_f1') for h in history if h.get('train_f1') is not None]
    train_iterations = [h['iteration'] for h in history if h.get('train_f1') is not None]

    plt.plot(iterations, f1_scores, marker='o', linewidth=2, label='Validation F1')

    if train_f1_scores:
        plt.plot(train_iterations, train_f1_scores, marker='s', linewidth=2, linestyle='--', label='Training F1')

    plt.xlabel('Iteration', fontsize=12)
    plt.ylabel('F1 Score', fontsize=12)
    plt.title('F1 Score Over Iterations', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=10)
    plt.tight_layout()
    plt.savefig(output_path / "f1_trend.png", dpi=150)
    plt.close()

    # 2. Precision and Recall trends
    plt.figure(figsize=(12, 6))
    precision_scores = [h.get('precision', 0.0) for h in history]
    recall_scores = [h.get('recall', 0.0) for h in history]

    plt.plot(iterations, precision_scores, marker='o', linewidth=2, label='Precision')
    plt.plot(iterations, recall_scores, marker='s', linewidth=2, label='Recall')
    plt.plot(iterations, f1_scores, marker='^', linewidth=2, label='F1')

    plt.xlabel('Iteration', fontsize=12)
    plt.ylabel('Score', fontsize=12)
    plt.title('Precision, Recall, F1 Over Iterations', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=10)
    plt.tight_layout()
    plt.savefig(output_path / "metrics_trend.png", dpi=150)
    plt.close()

    # 3. TP/FP/FN counts
    plt.figure(figsize=(12, 6))
    tp_counts = [h.get('tp', 0) for h in history]
    fp_counts = [h.get('fp', 0) for h in history]
    fn_counts = [h.get('fn', 0) for h in history]

    plt.plot(iterations, tp_counts, marker='o', linewidth=2, label='True Positives', color='green')
    plt.plot(iterations, fp_counts, marker='s', linewidth=2, label='False Positives', color='red')
    plt.plot(iterations, fn_counts, marker='^', linewidth=2, label='False Negatives', color='blue')

    plt.xlabel('Iteration', fontsize=12)
    plt.ylabel('Count', fontsize=12)
    plt.title('Detection Counts Over Iterations', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=10)
    plt.tight_layout()
    plt.savefig(output_path / "counts_trend.png", dpi=150)
    plt.close()

    # 4. Per-class F1 trends
    # Extract class names from first entry
    class_names = set()
    for h in history:
        for key in h.keys():
            if key.endswith('_f1') and not key.startswith('train'):
                class_name = key.replace('_f1', '')
                if class_name != 'f1':  # Skip overall f1
                    class_names.add(class_name)

    if class_names:
        plt.figure(figsize=(12, 6))

        for class_name in sorted(class_names):
            class_f1_key = f'{class_name}_f1'
            class_f1_scores = [h.get(class_f1_key, 0.0) for h in history]
            plt.plot(iterations, class_f1_scores, marker='o', linewidth=2, label=class_name)

        plt.xlabel('Iteration', fontsize=12)
        plt.ylabel('F1 Score', fontsize=12)
        plt.title('Per-Class F1 Over Iterations', fontsize=14)
        plt.grid(True, alpha=0.3)
        plt.legend(fontsize=10)
        plt.tight_layout()
        plt.savefig(output_path / "per_class_f1_trend.png", dpi=150)
        plt.close()

        # 5. Per-class FN trends
        plt.figure(figsize=(12, 6))

        for class_name in sorted(class_names):
            class_fn_key = f'{class_name}_fn'
            class_fn_counts = [h.get(class_fn_key, 0) for h in history]
            plt.plot(iterations, class_fn_counts, marker='o', linewidth=2, label=class_name)

        plt.xlabel('Iteration', fontsize=12)
        plt.ylabel('False Negatives', fontsize=12)
        plt.title('Per-Class False Negatives Over Iterations', fontsize=14)
        plt.grid(True, alpha=0.3)
        plt.legend(fontsize=10)
        plt.tight_layout()
        plt.savefig(output_path / "per_class_fn_trend.png", dpi=150)
        plt.close()

    # 6. Dataset size trend (if available)
    dataset_sizes = [h.get('dataset_size') for h in history if h.get('dataset_size') is not None]
    if dataset_sizes:
        dataset_iterations = [h['iteration'] for h in history if h.get('dataset_size') is not None]

        plt.figure(figsize=(12, 6))
        plt.plot(dataset_iterations, dataset_sizes, marker='o', linewidth=2, color='purple')
        plt.xlabel('Iteration', fontsize=12)
        plt.ylabel('Dataset Size', fontsize=12)
        plt.title('Dataset Size Over Iterations', fontsize=14)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_path / "dataset_size_trend.png", dpi=150)
        plt.close()

    print(f"Generated convergence plots in {output_path}")


def generate_convergence_report(csv_path: str, output_dir: str):
    """
    Generate a comprehensive convergence report.

    Args:
        csv_path: Path to tracking CSV file
        output_dir: Directory to save report
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    history = load_tracking_history(csv_path)

    if not history:
        print("No tracking history found")
        return

    # Calculate improvement metrics
    report = {
        'total_iterations': len(history),
        'initial_f1': history[0].get('f1', 0.0) if history else 0.0,
        'final_f1': history[-1].get('f1', 0.0) if history else 0.0,
        'best_f1': max([h.get('f1', 0.0) for h in history]),
        'best_iteration': max(range(len(history)), key=lambda i: history[i].get('f1', 0.0)) + 1 if history else 0,
        'total_improvement': (history[-1].get('f1', 0.0) - history[0].get('f1', 0.0)) if len(history) > 0 else 0.0,
        'iterations': []
    }

    # Per-iteration details
    for i, h in enumerate(history):
        iteration_data = {
            'iteration': h['iteration'],
            'f1': h.get('f1', 0.0),
            'precision': h.get('precision', 0.0),
            'recall': h.get('recall', 0.0),
            'tp': h.get('tp', 0),
            'fp': h.get('fp', 0),
            'fn': h.get('fn', 0)
        }

        # Calculate improvement from previous
        if i > 0:
            prev_f1 = history[i-1].get('f1', 0.0)
            iteration_data['improvement'] = h.get('f1', 0.0) - prev_f1
            iteration_data['improvement_pct'] = (iteration_data['improvement'] / prev_f1 * 100) if prev_f1 > 0 else 0.0
        else:
            iteration_data['improvement'] = 0.0
            iteration_data['improvement_pct'] = 0.0

        report['iterations'].append(iteration_data)

    # Save report
    report_path = output_path / "convergence_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"Convergence report saved to {report_path}")

    # Print summary
    print("\n" + "=" * 60)
    print("CONVERGENCE SUMMARY")
    print("=" * 60)
    print(f"Total Iterations: {report['total_iterations']}")
    print(f"Initial F1: {report['initial_f1']:.4f}")
    print(f"Final F1: {report['final_f1']:.4f}")
    print(f"Best F1: {report['best_f1']:.4f} (Iteration {report['best_iteration']})")
    print(f"Total Improvement: {report['total_improvement']:.4f} ({report['total_improvement']*100:.2f}%)")


def main():
    """Example usage."""
    import argparse

    parser = argparse.ArgumentParser(description="Track convergence and generate plots")
    parser.add_argument("--csv", required=True, help="Path to convergence tracking CSV")
    parser.add_argument("--output-dir", required=True, help="Output directory for plots")
    parser.add_argument("--update", help="Path to metrics JSON to append")
    parser.add_argument("--iteration", type=int, help="Iteration number (required with --update)")
    parser.add_argument("--check-convergence", action="store_true", help="Check convergence criteria")
    parser.add_argument("--config", help="Path to convergence config JSON")

    args = parser.parse_args()

    # Update tracking if requested
    if args.update:
        if args.iteration is None:
            parser.error("--iteration is required when using --update")

        with open(args.update) as f:
            metrics = json.load(f)

        update_tracking(args.iteration, metrics, args.csv)

    # Check convergence if requested
    if args.check_convergence:
        if args.update is None:
            parser.error("--update is required when using --check-convergence")

        with open(args.update) as f:
            current_metrics = json.load(f)

        history = load_tracking_history(args.csv)

        # Remove current iteration from history if it was just added
        if history and history[-1]['iteration'] == args.iteration:
            history = history[:-1]

        config = {}
        if args.config:
            with open(args.config) as f:
                config = json.load(f)

        result = check_convergence(current_metrics, history, config)

        print("\n" + "=" * 60)
        print("CONVERGENCE CHECK")
        print("=" * 60)
        print(f"Iteration: {result['iteration']}")
        print(f"Should Stop: {result['should_stop']}")
        print(f"Reason: {result['reason']}")

        # Save convergence result
        result_path = Path(args.output_dir) / f"convergence_check_iter_{args.iteration}.json"
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)

    # Generate plots
    generate_convergence_plots(args.csv, args.output_dir)

    # Generate report
    generate_convergence_report(args.csv, args.output_dir)


if __name__ == "__main__":
    main()
