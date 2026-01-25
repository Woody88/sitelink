#!/usr/bin/env python3
"""
Active Learning Training Script for YOLO-26 and YOLOE-26

This script implements a two-stage active learning approach for callout detection:

Stage 1 (Iteration 0): YOLO-26 Baseline
    - Train YOLO-26-nano from scratch using traditional object detection
    - No text prompts, pure vision-based learning
    - 150 epochs with standard augmentations
    - Establishes baseline performance (target: ~96.5% F1)

Stage 2 (Iterations 1+): YOLOE-26 with Text Prompts
    - Fine-tune YOLOE-26 using vision-language model with text descriptions
    - Load text prompts from prompt_manager.py
    - Set prompts via: model.set_classes(names, model.get_text_pe(descriptions))
    - 100 epochs per iteration with decreasing learning rate
    - Incremental improvements from error analysis and prompt refinement

Key Features:
    - Automatic model type selection based on iteration number
    - Integration with prompt_manager for text prompt evolution
    - Learning rate decay: lr = base_lr * (decay_factor ** iteration)
    - Comprehensive metadata tracking (model type, prompts, metrics, config)
    - Checkpoint management and iteration continuity

Training Configuration:
    - Image size: 2048px (matches dataset resolution)
    - Batch size: 2 (optimized for large images)
    - Data augmentation: Construction drawing specific
    - Device: GPU (CUDA)

Output Structure:
    active_learning/iterations/iteration_N/
    ├── weights/
    │   ├── best.pt          # Best validation weights
    │   └── last.pt          # Last epoch weights
    ├── metadata.json        # Model type, prompts, metrics, config
    ├── training_log.txt     # Console output log
    └── results.csv          # Training metrics per epoch

Usage:
    # Iteration 0 (baseline)
    python train_active_learning.py --iteration 0 --data dataset_combined/data.yaml

    # Iteration 1+ (with prompts)
    python train_active_learning.py --iteration 1 --data dataset_combined/data.yaml \\
        --prompts prompt_versions/prompts_iteration_01.json

    # Continue from previous iteration
    python train_active_learning.py --iteration 2 --data dataset_combined/data.yaml \\
        --continue-from iterations/iteration_1/weights/best.pt

Requirements:
    - ultralytics >= 8.0.0 (YOLOE support)
    - torch >= 2.0.0
    - prompt_manager.py in same directory
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Any, List
import shutil

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ultralytics import YOLO
from prompt_manager import (
    load_prompt_version,
    get_initial_prompts,
    save_prompt_version
)


# Training configurations
BASELINE_CONFIG = {
    'model_type': 'yolo26',
    'model_file': 'yolo26n.pt',
    'epochs': 150,
    'base_lr': 0.001,
    'img_size': 2048,
    'batch_size': 2,
    'use_prompts': False,
    'description': 'Baseline YOLO-26-nano traditional object detection'
}

YOLOE_CONFIG = {
    'model_type': 'yoloe26',
    'model_file': 'yoloe-26n.pt',
    'epochs': 100,
    'base_lr': 0.001,
    'img_size': 2048,
    'batch_size': 2,
    'use_prompts': True,
    'lr_decay_factor': 0.5,
    'description': 'YOLOE-26-nano vision-language model with text prompts'
}

# Data augmentation settings optimized for construction drawings
AUGMENTATION_CONFIG = {
    'hsv_h': 0.0,       # No hue shift (drawings are black/white)
    'hsv_s': 0.0,       # No saturation shift
    'hsv_v': 0.2,       # Slight brightness variation
    'degrees': 0,       # No rotation (drawings are axis-aligned)
    'translate': 0.1,   # Slight translation
    'scale': 0.3,       # Scale augmentation
    'shear': 0,         # No shear
    'perspective': 0,   # No perspective
    'flipud': 0,        # No vertical flip
    'fliplr': 0.5,      # Horizontal flip (drawings can be mirrored)
    'mosaic': 0.5,      # Reduced mosaic (preserve drawing context)
    'mixup': 0.0,       # No mixup
    'copy_paste': 0.0,  # No copy-paste
}

# Training settings
TRAINING_CONFIG = {
    'patience': 20,     # Early stopping patience
    'save_period': 10,  # Save checkpoint every N epochs
    'val': True,        # Validate during training
    'plots': True,      # Generate training plots
    'verbose': True,    # Verbose output
    'workers': 0,       # Single process (avoid multiprocessing issues)
}


def get_iteration_config(iteration: int) -> Dict[str, Any]:
    """
    Get training configuration for specific iteration.

    Args:
        iteration: Iteration number (0 for baseline, 1+ for YOLOE)

    Returns:
        Configuration dictionary
    """
    if iteration == 0:
        return BASELINE_CONFIG.copy()
    else:
        config = YOLOE_CONFIG.copy()
        # Apply learning rate decay
        config['lr'] = config['base_lr'] * (config['lr_decay_factor'] ** iteration)
        return config


def setup_iteration_directory(iteration: int, base_dir: str = 'iterations') -> Path:
    """
    Create iteration output directory structure.

    Args:
        iteration: Iteration number
        base_dir: Base directory for iterations

    Returns:
        Path to iteration directory
    """
    # Determine directory name
    if iteration == 0:
        dir_name = 'iteration_0_baseline'
    else:
        dir_name = f'iteration_{iteration}'

    iter_dir = Path(base_dir) / dir_name
    iter_dir.mkdir(parents=True, exist_ok=True)

    # Create subdirectories
    (iter_dir / 'weights').mkdir(exist_ok=True)

    return iter_dir


def load_prompts_for_iteration(
    iteration: int,
    prompts_file: Optional[str] = None,
    prompts_dir: str = 'prompt_versions'
) -> Dict[str, str]:
    """
    Load text prompts for YOLOE training.

    Args:
        iteration: Iteration number
        prompts_file: Optional explicit prompts file path
        prompts_dir: Directory containing versioned prompts

    Returns:
        Dictionary mapping class names to text prompts
    """
    if iteration == 0:
        # Baseline doesn't use prompts
        return {}

    if prompts_file:
        # Load from explicit file
        with open(prompts_file, 'r') as f:
            data = json.load(f)
            return data.get('prompts', data)

    # Try to load version-specific prompts
    try:
        version_data = load_prompt_version(iteration, prompts_dir)
        return version_data['prompts']
    except FileNotFoundError:
        # Fall back to iteration 0 prompts or initial prompts
        try:
            version_data = load_prompt_version(0, prompts_dir)
            return version_data['prompts']
        except FileNotFoundError:
            print(f"Warning: No prompts found for iteration {iteration}, using initial prompts")
            return get_initial_prompts()


def set_model_prompts(model: YOLO, prompts: Dict[str, str], class_names: List[str]):
    """
    Set text prompts for YOLOE model.

    Args:
        model: YOLOE model instance
        prompts: Dictionary mapping class names to text descriptions
        class_names: List of class names in order
    """
    # Get text descriptions in class order
    descriptions = [prompts.get(name, f"{name} callout") for name in class_names]

    print("\nSetting text prompts for YOLOE:")
    for name, desc in zip(class_names, descriptions):
        print(f"  {name}: {desc[:80]}...")

    # Set classes with text prompt embeddings
    text_embeddings = model.get_text_pe(descriptions)
    model.set_classes(class_names, text_embeddings)
    print("✓ Text prompts applied to model")


def train_iteration(
    iteration: int,
    dataset_path: str,
    config: Dict[str, Any],
    prompts: Optional[Dict[str, str]] = None,
    base_model_path: Optional[str] = None,
    output_dir: Optional[str] = None
) -> str:
    """
    Train a single active learning iteration.

    Args:
        iteration: Iteration number
        dataset_path: Path to data.yaml file
        config: Training configuration dictionary
        prompts: Optional text prompts for YOLOE
        base_model_path: Optional path to continue from previous weights
        output_dir: Optional output directory (default: iterations/iteration_N)

    Returns:
        Path to best weights file
    """
    # Setup output directory
    if output_dir:
        iter_dir = Path(output_dir)
        iter_dir.mkdir(parents=True, exist_ok=True)
    else:
        iter_dir = setup_iteration_directory(iteration)

    print(f"\n{'='*70}")
    print(f"Active Learning Iteration {iteration}")
    print(f"{'='*70}")
    print(f"Model Type: {config['model_type'].upper()}")
    print(f"Output Directory: {iter_dir}")
    print(f"Dataset: {dataset_path}")

    # Initialize model
    if base_model_path and os.path.exists(base_model_path):
        print(f"Continuing from: {base_model_path}")
        model = YOLO(base_model_path)
    else:
        print(f"Starting fresh with: {config['model_file']}")
        model = YOLO(config['model_file'])

    # Set prompts for YOLOE
    if config['use_prompts'] and prompts:
        # Extract class names from dataset
        import yaml
        with open(dataset_path, 'r') as f:
            data_config = yaml.safe_load(f)
            class_names = data_config.get('names', ['detail', 'elevation', 'title'])

        set_model_prompts(model, prompts, class_names)

    # Configure training parameters
    train_params = {
        'data': dataset_path,
        'epochs': config['epochs'],
        'imgsz': config['img_size'],
        'batch': config['batch_size'],
        'lr0': config.get('lr', config['base_lr']),
        'project': str(iter_dir.parent),
        'name': iter_dir.name,
        'device': 0,  # GPU
        **AUGMENTATION_CONFIG,
        **TRAINING_CONFIG
    }

    print(f"\nTraining Parameters:")
    print(f"  Epochs: {train_params['epochs']}")
    print(f"  Image Size: {train_params['imgsz']}")
    print(f"  Batch Size: {train_params['batch']}")
    print(f"  Learning Rate: {train_params['lr0']:.6f}")
    if config['use_prompts']:
        print(f"  Text Prompts: {len(prompts)} classes")
    print(f"{'='*70}\n")

    # Train model
    results = model.train(**train_params)

    # Get paths to saved weights
    weights_dir = iter_dir / 'weights'
    best_weights = weights_dir / 'best.pt'
    last_weights = weights_dir / 'last.pt'

    # If weights were saved to project/name structure, move them
    train_output = iter_dir.parent / iter_dir.name / 'weights'
    if train_output.exists() and train_output != weights_dir:
        if (train_output / 'best.pt').exists():
            shutil.copy(train_output / 'best.pt', best_weights)
        if (train_output / 'last.pt').exists():
            shutil.copy(train_output / 'last.pt', last_weights)

    print(f"\n{'='*70}")
    print(f"Training Complete!")
    print(f"  Best Weights: {best_weights}")
    print(f"  Last Weights: {last_weights}")
    print(f"{'='*70}\n")

    return str(best_weights)


def save_iteration_metadata(
    iteration: int,
    config: Dict[str, Any],
    prompts: Dict[str, str],
    metrics: Dict[str, Any],
    output_dir: Path
):
    """
    Save iteration metadata for tracking and reproducibility.

    Args:
        iteration: Iteration number
        config: Training configuration used
        prompts: Text prompts used (empty for baseline)
        metrics: Training metrics and results
        output_dir: Directory to save metadata
    """
    metadata = {
        'iteration': iteration,
        'timestamp': datetime.now().isoformat(),
        'model_type': config['model_type'],
        'model_file': config['model_file'],
        'use_prompts': config['use_prompts'],
        'config': {
            'epochs': config['epochs'],
            'learning_rate': config.get('lr', config['base_lr']),
            'img_size': config['img_size'],
            'batch_size': config['batch_size'],
        },
        'prompts': prompts,
        'metrics': metrics,
        'augmentation': AUGMENTATION_CONFIG,
    }

    metadata_file = output_dir / 'metadata.json'
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved metadata to: {metadata_file}")


def extract_training_metrics(results_file: str) -> Dict[str, Any]:
    """
    Extract key metrics from training results.

    Args:
        results_file: Path to results.csv file

    Returns:
        Dictionary of extracted metrics
    """
    metrics = {
        'training_completed': True,
        'results_file': results_file
    }

    try:
        import pandas as pd
        df = pd.read_csv(results_file)

        # Get final metrics
        final_row = df.iloc[-1]
        metrics.update({
            'final_epoch': int(final_row.get('epoch', 0)),
            'final_train_loss': float(final_row.get('train/box_loss', 0)),
            'final_val_loss': float(final_row.get('val/box_loss', 0)),
            'best_mAP50': float(df['metrics/mAP50(B)'].max()),
            'best_mAP50_95': float(df['metrics/mAP50-95(B)'].max()),
        })
    except Exception as e:
        print(f"Warning: Could not extract metrics from results: {e}")
        metrics['error'] = str(e)

    return metrics


def main():
    parser = argparse.ArgumentParser(
        description='Active Learning Training Script for YOLO-26 and YOLOE-26',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--iteration', '-i',
        type=int,
        required=True,
        help='Iteration number (0 for baseline, 1+ for YOLOE with prompts)'
    )

    parser.add_argument(
        '--data', '-d',
        type=str,
        required=True,
        help='Path to data.yaml file'
    )

    parser.add_argument(
        '--prompts', '-p',
        type=str,
        help='Path to prompts JSON file (optional, auto-loads from prompt_versions/)'
    )

    parser.add_argument(
        '--continue-from', '-c',
        type=str,
        help='Path to weights to continue training from'
    )

    parser.add_argument(
        '--output-dir', '-o',
        type=str,
        help='Output directory (default: iterations/iteration_N)'
    )

    parser.add_argument(
        '--prompts-dir',
        type=str,
        default='prompt_versions',
        help='Directory containing versioned prompts (default: prompt_versions)'
    )

    args = parser.parse_args()

    # Validate dataset path
    if not os.path.exists(args.data):
        print(f"Error: Dataset not found: {args.data}")
        sys.exit(1)

    # Get iteration configuration
    config = get_iteration_config(args.iteration)

    # Load prompts if needed
    prompts = {}
    if config['use_prompts']:
        prompts = load_prompts_for_iteration(
            args.iteration,
            args.prompts,
            args.prompts_dir
        )

        # Save prompts for this iteration if not already saved
        if not args.prompts:
            save_prompt_version(
                args.iteration,
                prompts,
                args.prompts_dir,
                refinement_notes={'source': 'auto-loaded for training'}
            )

    # Train iteration
    best_weights = train_iteration(
        iteration=args.iteration,
        dataset_path=args.data,
        config=config,
        prompts=prompts,
        base_model_path=args.continue_from,
        output_dir=args.output_dir
    )

    # Extract and save metadata
    output_dir = Path(args.output_dir) if args.output_dir else setup_iteration_directory(args.iteration)
    results_file = output_dir / 'results.csv'

    metrics = {}
    if results_file.exists():
        metrics = extract_training_metrics(str(results_file))

    save_iteration_metadata(
        iteration=args.iteration,
        config=config,
        prompts=prompts,
        metrics=metrics,
        output_dir=output_dir
    )

    print(f"\n{'='*70}")
    print(f"Iteration {args.iteration} Complete!")
    print(f"Next steps:")
    print(f"  1. Run validation: python batch_validate.py --iteration {args.iteration}")
    print(f"  2. Analyze errors: python error_analysis.py --iteration {args.iteration}")
    print(f"  3. Check convergence: python convergence_tracker.py --iteration {args.iteration}")
    if args.iteration < 10:
        print(f"  4. If needed, train iteration {args.iteration + 1}")
    print(f"{'='*70}\n")


if __name__ == '__main__':
    main()
