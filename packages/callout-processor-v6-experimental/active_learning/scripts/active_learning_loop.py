#!/usr/bin/env python3
"""
Active Learning Loop Orchestrator for YOLO-26 -> YOLOE-26 Upgrade

This script orchestrates the complete active learning workflow to iteratively improve
callout detection from YOLO-26 baseline (96.5% F1) to YOLOE-26 with prompts (98-99% F1).

Main Active Learning Loop:
    1. Validate current model (batch_validate.py)
    2. Analyze errors (error_analysis.py)
    3. Check convergence (convergence_tracker.py)
    4. Extract hard examples for manual review
    5. Pause for human review and dataset augmentation (Roboflow)
    6. Retrain model (train_active_learning.py)
    7. Update tracking and plots
    8. Repeat until convergence or max iterations

Features:
    - Interactive mode: Pause for human review at each iteration
    - Automatic mode: Use pseudo-labels (risky, not recommended)
    - Dry-run mode: Test workflow without training
    - Resume capability: Continue from specific iteration
    - Comprehensive error handling and progress tracking
    - Integration with all active learning modules

Usage:
    # Standard interactive mode (recommended)
    python active_learning_loop.py --config config/al_config.yaml

    # Start from specific iteration
    python active_learning_loop.py --config config/al_config.yaml --start-iteration 2

    # Resume from last checkpoint
    python active_learning_loop.py --config config/al_config.yaml --resume

    # Dry-run mode (no training)
    python active_learning_loop.py --config config/al_config.yaml --dry-run

    # Automatic mode (no human review - risky)
    python active_learning_loop.py --config config/al_config.yaml --auto

Output Structure:
    active_learning/
    ├── iterations/iteration_N/
    │   ├── weights/              # Model weights
    │   ├── validation.json       # Validation results
    │   ├── error_analysis/       # Error categorization
    │   ├── fn_crops/            # False negative crops
    │   ├── metadata.json        # Iteration metadata
    │   └── training_log.txt     # Training log
    ├── metrics/
    │   ├── convergence_tracking.csv  # All iterations metrics
    │   ├── convergence_plots/        # Trend visualizations
    │   └── iteration_reports/        # Per-iteration reports
    └── prompt_versions/          # Prompt evolution history
"""

import sys
import json
import yaml
import argparse
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Import modules - defer plotting imports until needed
try:
    from convergence_tracker import check_convergence, update_tracking, generate_convergence_plots
    from prompt_manager import PromptManager
except ImportError as e:
    print(f"[WARNING] Failed to import required modules: {e}")
    print("[WARNING] Make sure to install dependencies:")
    print("    pip install matplotlib seaborn opencv-python numpy pyyaml")
    if '--help' not in sys.argv and '-h' not in sys.argv:
        raise


class ActiveLearningOrchestrator:
    """
    Orchestrates the complete active learning workflow.
    """

    def __init__(self, config_path: str, start_iteration: int = 0, dry_run: bool = False,
                 auto_mode: bool = False, resume: bool = False):
        """
        Initialize orchestrator.

        Args:
            config_path: Path to al_config.yaml
            start_iteration: Starting iteration number (0 = baseline)
            dry_run: If True, skip training
            auto_mode: If True, skip human review (use pseudo-labels)
            resume: If True, find and resume from last iteration
        """
        self.config_path = Path(config_path)
        self.dry_run = dry_run
        self.auto_mode = auto_mode

        # Load configuration
        self.config = self._load_config()

        # Setup paths
        self.base_dir = self.config_path.parent.parent
        self.scripts_dir = self.base_dir / "scripts"
        self.iterations_dir = self.base_dir / "iterations"
        self.metrics_dir = self.base_dir / "metrics"
        self.prompts_dir = self.base_dir / "prompt_versions"

        # Create directories
        self.iterations_dir.mkdir(exist_ok=True)
        self.metrics_dir.mkdir(exist_ok=True)
        (self.metrics_dir / "convergence_plots").mkdir(exist_ok=True)
        (self.metrics_dir / "iteration_reports").mkdir(exist_ok=True)
        self.prompts_dir.mkdir(exist_ok=True)

        # Determine starting iteration
        if resume:
            self.current_iteration = self._find_last_iteration() + 1
            print(f"[RESUME] Resuming from iteration {self.current_iteration}")
        else:
            self.current_iteration = start_iteration

        # Initialize prompt manager
        self.prompt_manager = PromptManager(
            str(self.prompts_dir / "prompt_history.json")
        )

        # Load prompt source
        prompts_source = self.base_dir / self.config['prompts']['source']
        if prompts_source.exists():
            with open(prompts_source) as f:
                initial_prompts = json.load(f)
            self.prompt_manager.update_prompts(
                iteration=0,
                prompts=initial_prompts,
                reason="Initial prompts from config"
            )

        # Convergence tracking
        self.convergence_csv = self.metrics_dir / "convergence_tracking.csv"
        self.metrics_history = self._load_metrics_history()

        print(f"[INIT] Active Learning Orchestrator initialized")
        print(f"[INIT] Base directory: {self.base_dir}")
        print(f"[INIT] Starting iteration: {self.current_iteration}")
        print(f"[INIT] Dry-run mode: {self.dry_run}")
        print(f"[INIT] Auto mode: {self.auto_mode}")

    def _load_config(self) -> Dict:
        """Load configuration from YAML file."""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {self.config_path}")

        with open(self.config_path) as f:
            config = yaml.safe_load(f)

        return config

    def _find_last_iteration(self) -> int:
        """Find the last completed iteration."""
        completed = []
        for iteration_dir in self.iterations_dir.glob("iteration_*"):
            try:
                iteration_num = int(iteration_dir.name.split("_")[1])
                # Check if iteration has validation results
                if (iteration_dir / "validation.json").exists():
                    completed.append(iteration_num)
            except (ValueError, IndexError):
                continue

        return max(completed) if completed else -1

    def _load_metrics_history(self) -> List[Dict]:
        """Load metrics history from convergence tracking CSV."""
        history = []

        if not self.convergence_csv.exists():
            return history

        import csv
        with open(self.convergence_csv) as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert numeric fields
                for key in ['iteration', 'tp', 'fp', 'fn', 'tn']:
                    if key in row:
                        row[key] = int(row[key])
                for key in ['precision', 'recall', 'f1', 'val_f1', 'train_f1']:
                    if key in row:
                        row[key] = float(row[key])
                history.append(row)

        return history

    def run_active_learning(self):
        """
        Main active learning loop.

        Workflow per iteration:
        1. Validate current model
        2. Analyze errors
        3. Check convergence
        4. Extract hard examples
        5. Manual review (or auto-label if auto_mode)
        6. Retrain model
        7. Update tracking and plots
        """
        print("\n" + "=" * 80)
        print("ACTIVE LEARNING LOOP - YOLO-26 → YOLOE-26")
        print("=" * 80)
        print(f"Target F1: {self.config['active_learning']['target_f1']}")
        print(f"Max iterations: {self.config['active_learning']['max_iterations']}")
        print(f"Require human review: {self.config['active_learning']['require_human_review']}")
        print("=" * 80 + "\n")

        # Main loop
        while self.current_iteration < self.config['active_learning']['max_iterations']:
            print(f"\n{'=' * 80}")
            print(f"ITERATION {self.current_iteration}")
            print(f"{'=' * 80}\n")

            try:
                # Run single iteration
                iteration_metrics, should_stop, stop_reason = self.run_iteration(
                    self.current_iteration
                )

                # Generate iteration report
                self._generate_iteration_report(
                    self.current_iteration,
                    iteration_metrics,
                    should_stop,
                    stop_reason
                )

                # Check if should stop
                if should_stop:
                    print(f"\n{'=' * 80}")
                    print("ACTIVE LEARNING COMPLETE")
                    print(f"{'=' * 80}")
                    print(f"Reason: {stop_reason}")
                    print(f"Final F1: {iteration_metrics.get('val_f1', 'N/A')}")
                    print(f"Total iterations: {self.current_iteration + 1}")
                    print(f"{'=' * 80}\n")
                    break

                # Move to next iteration
                self.current_iteration += 1

            except KeyboardInterrupt:
                print("\n\n[INTERRUPTED] Active learning interrupted by user")
                print(f"[INTERRUPTED] Stopped at iteration {self.current_iteration}")
                print(f"[INTERRUPTED] Resume with: --start-iteration {self.current_iteration}")
                break

            except Exception as e:
                print(f"\n[ERROR] Iteration {self.current_iteration} failed: {e}")
                import traceback
                traceback.print_exc()

                # Ask user if they want to continue
                if not self.auto_mode:
                    response = input("\nContinue to next iteration? (y/n): ").strip().lower()
                    if response != 'y':
                        break
                else:
                    break

        print("\n[DONE] Active learning loop finished")
        print(f"[DONE] Output saved to: {self.iterations_dir}")
        print(f"[DONE] Metrics saved to: {self.metrics_dir}")

    def run_iteration(self, iteration: int) -> Tuple[Dict, bool, Optional[str]]:
        """
        Run a single iteration of active learning.

        Args:
            iteration: Current iteration number

        Returns:
            Tuple of (metrics, should_stop, stop_reason)
        """
        iteration_dir = self.iterations_dir / f"iteration_{iteration}"
        iteration_dir.mkdir(exist_ok=True)

        print(f"[ITERATION {iteration}] Starting...")
        print(f"[ITERATION {iteration}] Output directory: {iteration_dir}")

        # Step 1: Validate current model
        print(f"\n[STEP 1/7] Validating model...")
        validation_results = self._run_validation(iteration, iteration_dir)

        # Step 2: Analyze errors
        print(f"\n[STEP 2/7] Analyzing errors...")
        error_analysis = self._run_error_analysis(iteration, iteration_dir, validation_results)

        # Step 3: Check convergence
        print(f"\n[STEP 3/7] Checking convergence...")
        current_metrics = self._extract_metrics(validation_results)
        convergence_result = self._check_convergence(iteration, current_metrics)

        should_stop = convergence_result['should_stop']
        stop_reason = convergence_result['reason']

        print(f"[CONVERGENCE] {stop_reason}")

        if should_stop:
            # Update tracking before stopping
            update_tracking(iteration, current_metrics, str(self.convergence_csv))
            self._generate_convergence_plots()
            return current_metrics, True, stop_reason

        # Step 4: Extract hard examples
        print(f"\n[STEP 4/7] Extracting hard examples...")
        hard_examples = self._extract_hard_examples(iteration, error_analysis)

        # Step 5: Manual review or auto-label
        if self.config['active_learning']['require_human_review'] and not self.auto_mode:
            print(f"\n[STEP 5/7] Manual review required...")
            self._pause_for_manual_review(iteration, iteration_dir, hard_examples)
        else:
            print(f"\n[STEP 5/7] Auto-labeling (no human review)...")
            # In auto mode, assume pseudo-labels from model predictions
            print("[WARNING] Auto mode is risky - using model predictions as labels")

        # Step 6: Retrain model
        if not self.dry_run:
            print(f"\n[STEP 6/7] Retraining model...")
            self._retrain_model(iteration)
        else:
            print(f"\n[STEP 6/7] Skipping training (dry-run mode)")

        # Step 7: Update tracking and plots
        print(f"\n[STEP 7/7] Updating tracking and plots...")
        update_tracking(iteration, current_metrics, str(self.convergence_csv))
        self._generate_convergence_plots()

        print(f"\n[ITERATION {iteration}] Complete!")

        return current_metrics, False, None

    def _run_validation(self, iteration: int, iteration_dir: Path) -> Dict:
        """Run batch validation on current model."""
        validation_output = iteration_dir / "validation.json"

        # Determine model path
        if iteration == 0:
            # Baseline model
            model_path = self.base_dir.parent / "weights" / self.config['model']['baseline']
        else:
            # Previous iteration's best weights
            prev_iteration_dir = self.iterations_dir / f"iteration_{iteration - 1}"
            model_path = prev_iteration_dir / "weights" / "best.pt"

        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        # Get dataset path
        dataset_path = self.base_dir / "datasets" / "dataset_combined"
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset not found: {dataset_path}")

        data_yaml = dataset_path / "data.yaml"

        # Run batch_validate.py
        cmd = [
            "python3",
            str(self.scripts_dir / "batch_validate.py"),
            "--model", str(model_path),
            "--data", str(data_yaml),
            "--output", str(validation_output),
            "--conf-thres", "0.25",
            "--iou-thres", "0.5"
        ]

        print(f"[VALIDATE] Running: {' '.join(cmd)}")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"[ERROR] Validation failed:")
            print(result.stderr)
            raise RuntimeError(f"Validation failed with return code {result.returncode}")

        print(result.stdout)

        # Load and return results
        if not validation_output.exists():
            raise FileNotFoundError(f"Validation output not found: {validation_output}")

        with open(validation_output) as f:
            return json.load(f)

    def _run_error_analysis(self, iteration: int, iteration_dir: Path,
                           validation_results: Dict) -> Dict:
        """Run error analysis on validation results."""
        error_analysis_dir = iteration_dir / "error_analysis"
        error_analysis_dir.mkdir(exist_ok=True)

        validation_json = iteration_dir / "validation.json"

        # Get validation image path (first image from validation results)
        validation_image = None
        if 'per_image_metrics' in validation_results:
            for img_data in validation_results['per_image_metrics']:
                if 'image_path' in img_data:
                    validation_image = img_data['image_path']
                    break

        if not validation_image:
            print("[WARNING] No validation image found, using placeholder")
            validation_image = "dummy.png"

        # Run error_analysis.py
        cmd = [
            "python3",
            str(self.scripts_dir / "error_analysis.py"),
            str(validation_json),
            str(validation_image),
            "--output-dir", str(error_analysis_dir),
            "--extract-crops"
        ]

        print(f"[ERROR_ANALYSIS] Running: {' '.join(cmd)}")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"[WARNING] Error analysis had issues:")
            print(result.stderr)

        print(result.stdout)

        # Load error report
        error_report_path = error_analysis_dir / "error_report.json"
        if error_report_path.exists():
            with open(error_report_path) as f:
                return json.load(f)

        return {}

    def _extract_metrics(self, validation_results: Dict) -> Dict:
        """Extract metrics from validation results."""
        overall = validation_results.get('overall_metrics', {})

        return {
            'val_f1': overall.get('f1', 0.0),
            'precision': overall.get('precision', 0.0),
            'recall': overall.get('recall', 0.0),
            'tp': overall.get('tp', 0),
            'fp': overall.get('fp', 0),
            'fn': overall.get('fn', 0),
            'tn': overall.get('tn', 0)
        }

    def _check_convergence(self, iteration: int, current_metrics: Dict) -> Dict:
        """Check if training should stop."""
        al_config = self.config['active_learning']

        convergence_config = {
            'target_f1': al_config['target_f1'],
            'plateau_threshold': al_config['plateau_threshold'],
            'max_iterations': al_config['max_iterations'],
            'plateau_iterations': 3,
            'overfitting_threshold': 0.05
        }

        return check_convergence(current_metrics, self.metrics_history, convergence_config)

    def _extract_hard_examples(self, iteration: int, error_analysis: Dict) -> List[Dict]:
        """
        Extract hard examples for manual review.

        Uses sampling strategy from config to select most informative false negatives.
        """
        fn_details = error_analysis.get('fn_details', [])

        if not fn_details:
            print("[WARNING] No false negatives found")
            return []

        # Get sampling strategy weights
        strategy = self.config['sampling_strategy']
        max_samples = self.config['active_learning']['max_samples_per_iteration']

        # Score each FN by informativeness
        scored_fns = []
        for fn in fn_details:
            score = 0.0

            # Size diversity (prefer rare sizes)
            size_category = fn.get('size_category', 'medium')
            size_weights = {'tiny': 1.0, 'small': 0.8, 'medium': 0.5, 'large': 0.3}
            score += size_weights.get(size_category, 0.5) * strategy['size_diversity_weight']

            # Spatial diversity (prefer edge cases)
            position = fn.get('position', 'center')
            position_weights = {'corner': 1.0, 'edge': 0.8, 'center': 0.5}
            score += position_weights.get(position, 0.5) * strategy['spatial_diversity_weight']

            # Class balance (prefer underrepresented classes)
            class_name = fn.get('class', 'unknown')
            # Simple heuristic: rare classes get higher weight
            class_counts = {c: sum(1 for f in fn_details if f.get('class') == c)
                          for c in set(f.get('class') for f in fn_details)}
            max_count = max(class_counts.values()) if class_counts else 1
            class_weight = 1.0 - (class_counts.get(class_name, 1) / max_count)
            score += class_weight * strategy['class_balance_weight']

            # Uncertainty (low confidence = high uncertainty)
            # For FNs, we don't have confidence, so use visual characteristics
            if fn.get('low_contrast', False):
                score += 0.5 * strategy['uncertainty_weight']
            if fn.get('unusual_aspect', False):
                score += 0.3 * strategy['uncertainty_weight']

            scored_fns.append((score, fn))

        # Sort by score (descending) and take top N
        scored_fns.sort(key=lambda x: x[0], reverse=True)
        hard_examples = [fn for _, fn in scored_fns[:max_samples]]

        print(f"[SAMPLING] Selected {len(hard_examples)} hard examples from {len(fn_details)} FNs")

        return hard_examples

    def _pause_for_manual_review(self, iteration: int, iteration_dir: Path,
                                 hard_examples: List[Dict]):
        """
        Pause execution for manual review and dataset augmentation.

        Provides instructions for using Roboflow to review and annotate hard examples.
        """
        print("\n" + "=" * 80)
        print("MANUAL REVIEW REQUIRED")
        print("=" * 80)
        print(f"Iteration: {iteration}")
        print(f"Hard examples: {len(hard_examples)}")
        print(f"FN crops saved to: {iteration_dir / 'error_analysis' / 'fn_crops'}")
        print()
        print("NEXT STEPS:")
        print("1. Review false negative crops in error_analysis/fn_crops/")
        print("2. Upload crops to Roboflow project")
        print("3. Annotate crops with correct labels")
        print("4. Export augmented dataset to datasets/dataset_combined/")
        print("5. Review prompt suggestions in error_analysis/prompt_suggestions.json")
        print("6. Update prompts if needed")
        print()
        print("When ready to continue training, press ENTER...")
        print("(or Ctrl+C to exit)")
        print("=" * 80 + "\n")

        try:
            input()
        except KeyboardInterrupt:
            print("\n[INTERRUPTED] Exiting...")
            sys.exit(0)

        print("\n[RESUME] Continuing to training...")

    def _retrain_model(self, iteration: int):
        """Retrain model with augmented dataset."""
        iteration_dir = self.iterations_dir / f"iteration_{iteration}"

        # Get dataset path
        dataset_path = self.base_dir / "datasets" / "dataset_combined"
        data_yaml = dataset_path / "data.yaml"

        # Get prompts for this iteration
        prompts = self.prompt_manager.get_latest_prompts()
        prompts_path = self.prompts_dir / f"prompts_iteration_{iteration:02d}.json"
        with open(prompts_path, 'w') as f:
            json.dump(prompts, f, indent=2)

        # Determine training parameters
        training_config = self.config['training']

        if iteration == 0:
            # Baseline training with YOLO-26
            epochs = training_config['epochs_base']
            lr = training_config['base_lr']
            model_arg = self.config['model']['baseline']
        else:
            # Fine-tuning with YOLOE-26
            epochs = training_config['epochs_increment']
            lr = training_config['base_lr'] * (training_config['lr_decay_factor'] ** iteration)
            # Use previous iteration's best weights
            prev_iteration_dir = self.iterations_dir / f"iteration_{iteration - 1}"
            model_arg = str(prev_iteration_dir / "weights" / "best.pt")

        # Run train_active_learning.py
        cmd = [
            "python3",
            str(self.scripts_dir / "train_active_learning.py"),
            "--iteration", str(iteration),
            "--data", str(data_yaml),
            "--epochs", str(epochs),
            "--lr", str(lr),
            "--batch", str(training_config['batch']),
            "--imgsz", str(training_config['imgsz']),
            "--patience", str(training_config['patience'])
        ]

        if iteration > 0:
            cmd.extend(["--prompts", str(prompts_path)])
        else:
            cmd.extend(["--model", model_arg])

        print(f"[TRAIN] Running: {' '.join(cmd)}")
        print(f"[TRAIN] This may take several hours...")

        result = subprocess.run(cmd, capture_output=False, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Training failed with return code {result.returncode}")

        print(f"[TRAIN] Training complete!")
        print(f"[TRAIN] Weights saved to: {iteration_dir / 'weights'}")

    def _generate_convergence_plots(self):
        """Generate convergence plots from tracking CSV."""
        plots_dir = self.metrics_dir / "convergence_plots"
        plots_dir.mkdir(exist_ok=True)

        try:
            generate_convergence_plots(
                str(self.convergence_csv),
                str(plots_dir)
            )
            print(f"[PLOTS] Convergence plots saved to: {plots_dir}")
        except Exception as e:
            print(f"[WARNING] Failed to generate plots: {e}")

    def _generate_iteration_report(self, iteration: int, metrics: Dict,
                                   should_stop: bool, stop_reason: Optional[str]):
        """Generate iteration report."""
        report_dir = self.metrics_dir / "iteration_reports"
        report_dir.mkdir(exist_ok=True)

        report_path = report_dir / f"iteration_{iteration:02d}_report.json"

        report = {
            'iteration': iteration,
            'timestamp': datetime.now().isoformat(),
            'metrics': metrics,
            'convergence': {
                'should_stop': should_stop,
                'reason': stop_reason
            },
            'config': {
                'target_f1': self.config['active_learning']['target_f1'],
                'max_iterations': self.config['active_learning']['max_iterations']
            }
        }

        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"[REPORT] Iteration report saved to: {report_path}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Active Learning Loop Orchestrator for YOLO-26 -> YOLOE-26",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Standard interactive mode (recommended)
  python active_learning_loop.py --config config/al_config.yaml

  # Start from specific iteration
  python active_learning_loop.py --config config/al_config.yaml --start-iteration 2

  # Resume from last checkpoint
  python active_learning_loop.py --config config/al_config.yaml --resume

  # Dry-run mode (no training)
  python active_learning_loop.py --config config/al_config.yaml --dry-run

  # Automatic mode (no human review - risky)
  python active_learning_loop.py --config config/al_config.yaml --auto

Output Structure:
  active_learning/
  ├── iterations/iteration_N/       # Per-iteration outputs
  │   ├── weights/                  # Model weights
  │   ├── validation.json           # Validation results
  │   ├── error_analysis/           # Error categorization
  │   └── metadata.json             # Iteration metadata
  ├── metrics/
  │   ├── convergence_tracking.csv  # All iterations metrics
  │   ├── convergence_plots/        # Trend visualizations
  │   └── iteration_reports/        # Per-iteration reports
  └── prompt_versions/              # Prompt evolution history
        """
    )

    parser.add_argument(
        '--config',
        type=str,
        default='config/al_config.yaml',
        help='Path to configuration YAML file (default: config/al_config.yaml)'
    )

    parser.add_argument(
        '--start-iteration',
        type=int,
        default=0,
        help='Starting iteration number (default: 0 = baseline)'
    )

    parser.add_argument(
        '--resume',
        action='store_true',
        help='Resume from last completed iteration'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Test workflow without training (useful for debugging)'
    )

    parser.add_argument(
        '--auto',
        action='store_true',
        help='Automatic mode: skip human review and use pseudo-labels (risky!)'
    )

    args = parser.parse_args()

    # Validate arguments
    if args.resume and args.start_iteration != 0:
        print("[ERROR] Cannot use both --resume and --start-iteration")
        sys.exit(1)

    try:
        # Initialize orchestrator
        orchestrator = ActiveLearningOrchestrator(
            config_path=args.config,
            start_iteration=args.start_iteration,
            dry_run=args.dry_run,
            auto_mode=args.auto,
            resume=args.resume
        )

        # Run active learning loop
        orchestrator.run_active_learning()

    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Exiting...")
        sys.exit(0)

    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
