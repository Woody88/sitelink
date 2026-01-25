# Active Learning Loop Orchestrator

Complete automation script for the YOLO-26 → YOLOE-26 active learning workflow.

## Overview

`active_learning_loop.py` orchestrates the entire active learning pipeline, automatically:

1. **Validating** the current model against ground truth
2. **Analyzing** errors to identify failure patterns
3. **Checking** convergence criteria to decide if training should continue
4. **Extracting** the most informative hard examples
5. **Pausing** for manual review and dataset augmentation
6. **Retraining** the model with improved data
7. **Tracking** metrics and generating visualizations

This eliminates the need to manually run individual scripts and ensures consistent workflow execution.

## Quick Start

### Basic Usage

```bash
# Run active learning with default config
cd active_learning/scripts
python3 active_learning_loop.py --config ../config/al_config.yaml
```

This will:
- Start from iteration 0 (baseline)
- Pause after each iteration for manual review
- Continue until convergence or max iterations

### Resume from Checkpoint

```bash
# Automatically find and resume from last completed iteration
python3 active_learning_loop.py --config ../config/al_config.yaml --resume
```

### Start from Specific Iteration

```bash
# Start from iteration 3 (useful if resuming after manual intervention)
python3 active_learning_loop.py --config ../config/al_config.yaml --start-iteration 3
```

### Dry-Run Mode

```bash
# Test the workflow without actually training (fast)
python3 active_learning_loop.py --config ../config/al_config.yaml --dry-run
```

Useful for:
- Testing the pipeline setup
- Validating configuration
- Debugging workflow issues
- Checking that all paths and files are correct

### Automatic Mode (⚠️ Not Recommended)

```bash
# Skip human review and use pseudo-labels
python3 active_learning_loop.py --config ../config/al_config.yaml --auto
```

⚠️ **Warning**: This mode skips manual review and uses model predictions as labels for hard examples. This can propagate errors and hurt performance. Only use for experimentation.

## Workflow Details

### Iteration Workflow

Each iteration follows this sequence:

```
┌─────────────────────────────────────────────────┐
│ 1. Validate Model (batch_validate.py)          │
│    - Run on validation set                      │
│    - Calculate F1, precision, recall            │
│    - Generate per-image and per-class metrics   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ 2. Analyze Errors (error_analysis.py)          │
│    - Categorize FNs by size/position/visual     │
│    - Extract crops for manual review            │
│    - Generate error visualizations              │
│    - Suggest prompt improvements                │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ 3. Check Convergence (convergence_tracker.py)  │
│    - Update metrics tracking CSV                │
│    - Check stopping criteria                    │
│    - Generate trend plots                       │
└────────────────────┬────────────────────────────┘
                     ▼
              ┌──────┴──────┐
              │ Converged?  │
              └──────┬──────┘
                     │
          ┌──────────┴──────────┐
          │                     │
         Yes                   No
          │                     │
          ▼                     ▼
    ┌─────────┐          ┌──────────────────────────────┐
    │  DONE!  │          │ 4. Extract Hard Examples     │
    └─────────┘          │    - Score FNs by info value │
                         │    - Select top N samples    │
                         └──────────┬───────────────────┘
                                    ▼
                         ┌──────────────────────────────┐
                         │ 5. Manual Review (PAUSE)     │
                         │    - Review FN crops         │
                         │    - Upload to Roboflow      │
                         │    - Annotate corrections    │
                         │    - Export augmented dataset│
                         │    - Press ENTER to continue │
                         └──────────┬───────────────────┘
                                    ▼
                         ┌──────────────────────────────┐
                         │ 6. Retrain (train_al.py)     │
                         │    - Fine-tune with new data │
                         │    - Apply learning rate decay│
                         │    - Save weights            │
                         └──────────┬───────────────────┘
                                    ▼
                         ┌──────────────────────────────┐
                         │ 7. Update Tracking           │
                         │    - Append to CSV           │
                         │    - Generate plots          │
                         │    - Save iteration report   │
                         └──────────┬───────────────────┘
                                    │
                                    └──────┐
                                           │
                                       (repeat)
```

### Convergence Criteria

The loop automatically stops when **any** of these conditions are met:

1. **Target Achieved**: `val_f1 >= 0.98` (configurable)
2. **Plateau Detected**: `< 0.5%` improvement over last 3 iterations
3. **Overfitting**: `train_f1 - val_f1 > 5%`
4. **Resource Limit**: 10 iterations completed

Configure these in `config/al_config.yaml`:

```yaml
active_learning:
  target_f1: 0.98
  plateau_threshold: 0.005  # 0.5%
  max_iterations: 10
```

### Hard Example Selection

The orchestrator uses a multi-factor sampling strategy to select the most informative false negatives:

**Scoring Formula:**
```
score = size_weight * size_diversity
      + position_weight * spatial_diversity
      + class_weight * class_balance
      + uncertainty_weight * visual_difficulty
```

**Weights** (from `config/al_config.yaml`):
```yaml
sampling_strategy:
  class_balance_weight: 0.3     # Prefer underrepresented classes
  size_diversity_weight: 0.3    # Prefer rare sizes (tiny/large)
  spatial_diversity_weight: 0.2 # Prefer edge/corner cases
  uncertainty_weight: 0.2       # Prefer low contrast/unusual aspect
```

**Selection Process:**
1. Score each false negative by informativeness
2. Sort by score (highest = most informative)
3. Select top `max_samples_per_iteration` (default: 20)

This ensures diverse, high-value training examples rather than random sampling.

## Output Structure

```
active_learning/
├── iterations/
│   ├── iteration_0/              # Baseline
│   │   ├── weights/
│   │   │   ├── best.pt           # Best model weights
│   │   │   └── last.pt           # Last epoch weights
│   │   ├── validation.json       # Validation results
│   │   ├── error_analysis/
│   │   │   ├── error_report.json
│   │   │   ├── fn_crops/         # Hard example crops
│   │   │   ├── fn_size_distribution.png
│   │   │   ├── fn_position_distribution.png
│   │   │   ├── error_heatmap.png
│   │   │   └── prompt_suggestions.json
│   │   ├── metadata.json         # Iteration metadata
│   │   └── training_log.txt      # Training console output
│   ├── iteration_1/
│   │   └── ...                   # Same structure
│   └── iteration_N/
│       └── ...
├── metrics/
│   ├── convergence_tracking.csv  # Metrics across all iterations
│   ├── convergence_plots/
│   │   ├── f1_trend.png          # F1 score over iterations
│   │   ├── metrics_trend.png     # Precision/Recall/F1
│   │   ├── counts_trend.png      # TP/FP/FN counts
│   │   ├── per_class_f1_trend.png
│   │   └── per_class_fn_trend.png
│   └── iteration_reports/
│       ├── iteration_00_report.json
│       ├── iteration_01_report.json
│       └── ...
└── prompt_versions/
    ├── prompt_history.json       # Evolution of prompts
    ├── prompts_iteration_00.json
    ├── prompts_iteration_01.json
    └── ...
```

## Configuration

### Required Configuration File

The script requires `config/al_config.yaml`:

```yaml
# Model Configuration
model:
  baseline: yolo26n.pt              # YOLO-26 baseline model
  target: yoloe-26n-seg.pt          # Target YOLOE-26 model
  type: yoloe-26-nano

# Active Learning Parameters
active_learning:
  max_samples_per_iteration: 20     # Hard examples per iteration
  require_human_review: true        # Pause for manual review
  target_f1: 0.98                   # Stop when achieved
  plateau_threshold: 0.005          # Stop if < 0.5% improvement
  max_iterations: 10                # Resource limit

# Sampling Strategy
sampling_strategy:
  class_balance_weight: 0.3
  size_diversity_weight: 0.3
  spatial_diversity_weight: 0.2
  uncertainty_weight: 0.2

# Training Configuration
training:
  strategy: fine_tune
  base_lr: 0.001                    # Initial learning rate
  lr_decay_factor: 0.5              # LR decay per iteration
  epochs_base: 150                  # Epochs for iteration 0
  epochs_increment: 100             # Epochs for iteration 1+
  patience: 20                      # Early stopping patience
  imgsz: 2560                       # Image size
  batch: 2                          # Batch size

# Text Prompts
prompts:
  source: prompts/ca_ncs.json       # Initial prompt file
  detail: "A detail callout..."
  elevation: "An elevation marker..."
  title: "A title block..."
```

## Manual Review Process

When the orchestrator pauses for manual review:

```
================================================================================
MANUAL REVIEW REQUIRED
================================================================================
Iteration: 1
Hard examples: 20
FN crops saved to: active_learning/iterations/iteration_1/error_analysis/fn_crops/

NEXT STEPS:
1. Review false negative crops in error_analysis/fn_crops/
2. Upload crops to Roboflow project
3. Annotate crops with correct labels
4. Export augmented dataset to datasets/dataset_combined/
5. Review prompt suggestions in error_analysis/prompt_suggestions.json
6. Update prompts if needed

When ready to continue training, press ENTER...
(or Ctrl+C to exit)
================================================================================
```

### Roboflow Workflow

1. **Review Crops**
   ```bash
   cd active_learning/iterations/iteration_1/error_analysis/fn_crops
   ls -lh  # Check extracted crops
   ```

2. **Upload to Roboflow**
   - Create/use existing Roboflow project
   - Upload all crops from `fn_crops/` directory
   - Group by class or size category if helpful

3. **Annotate**
   - Draw correct bounding boxes
   - Assign correct class labels
   - Fix any annotation errors from original dataset

4. **Export Dataset**
   - Export in YOLO format
   - Download to `datasets/dataset_combined/`
   - Ensure `data.yaml` is updated with new image count

5. **Update Prompts** (optional)
   - Review `error_analysis/prompt_suggestions.json`
   - Update `prompt_versions/prompts_iteration_N.json` if needed
   - Prompts automatically loaded on next training run

6. **Continue Training**
   - Press ENTER in the terminal
   - Orchestrator will start retraining with augmented data

## Advanced Usage

### Custom Sampling Strategy

Edit `config/al_config.yaml` to adjust hard example selection:

```yaml
sampling_strategy:
  class_balance_weight: 0.4    # Increase to prioritize rare classes
  size_diversity_weight: 0.2   # Decrease if size isn't a major issue
  spatial_diversity_weight: 0.3 # Increase for edge detection problems
  uncertainty_weight: 0.1      # Decrease if confident in model predictions
```

### Iteration-Specific Training Parameters

The orchestrator automatically adjusts training parameters per iteration:

**Iteration 0 (Baseline):**
- Model: YOLO-26-nano (no prompts)
- Epochs: 150
- Learning rate: 0.001
- Strategy: Train from scratch

**Iteration 1+:**
- Model: YOLOE-26-nano (with prompts)
- Epochs: 100
- Learning rate: `0.001 * (0.5 ** iteration)`
- Strategy: Fine-tune from previous iteration

This ensures:
- Strong baseline foundation
- Incremental improvements via fine-tuning
- Preventing catastrophic forgetting with LR decay

### Debugging Failed Iterations

If an iteration fails:

1. **Check Logs**
   ```bash
   cat active_learning/iterations/iteration_N/training_log.txt
   tail -100 active_learning/iterations/iteration_N/error_analysis/error_report.json
   ```

2. **Validate Dataset**
   ```bash
   # Ensure dataset is valid YOLO format
   ls -lh datasets/dataset_combined/images/
   ls -lh datasets/dataset_combined/labels/
   cat datasets/dataset_combined/data.yaml
   ```

3. **Check Model Path**
   ```bash
   # Ensure previous iteration completed
   ls -lh active_learning/iterations/iteration_{N-1}/weights/best.pt
   ```

4. **Resume Manually**
   ```bash
   # Fix the issue, then resume from failed iteration
   python3 active_learning_loop.py --config ../config/al_config.yaml --start-iteration N
   ```

### Parallel Experimentation

Run multiple active learning experiments with different configs:

```bash
# Experiment 1: High LR
cp config/al_config.yaml config/al_config_high_lr.yaml
# Edit: base_lr: 0.002
python3 active_learning_loop.py --config ../config/al_config_high_lr.yaml

# Experiment 2: More samples per iteration
cp config/al_config.yaml config/al_config_more_samples.yaml
# Edit: max_samples_per_iteration: 50
python3 active_learning_loop.py --config ../config/al_config_more_samples.yaml
```

Each experiment will create separate `iterations/` directories based on config.

## Dependencies

Install required packages:

```bash
pip install -r ../../requirements.txt
```

Required packages:
- `matplotlib` - Plotting
- `seaborn` - Statistical visualizations
- `opencv-python` - Image processing
- `numpy` - Numerical operations
- `pyyaml` - Configuration parsing
- `ultralytics` - YOLO/YOLOE models

## Troubleshooting

### Import Errors

**Problem:**
```
ModuleNotFoundError: No module named 'matplotlib'
```

**Solution:**
```bash
pip install matplotlib seaborn opencv-python numpy pyyaml
```

### Config Not Found

**Problem:**
```
[ERROR] Config file not found: config/al_config.yaml
```

**Solution:**
```bash
# Run from scripts directory
cd active_learning/scripts
python3 active_learning_loop.py --config ../config/al_config.yaml

# Or use absolute path
python3 active_learning_loop.py --config /full/path/to/al_config.yaml
```

### Dataset Not Found

**Problem:**
```
[ERROR] Dataset not found: datasets/dataset_combined
```

**Solution:**
```bash
# Ensure dataset exists
ls active_learning/datasets/dataset_combined/
# Should contain: images/, labels/, data.yaml

# Or update config to point to correct dataset
```

### Model Not Found

**Problem:**
```
[ERROR] Model not found: weights/yolo26n.pt
```

**Solution:**
```bash
# For iteration 0, ensure baseline model exists
ls weights/yolo26n.pt

# For iteration 1+, ensure previous iteration completed
ls active_learning/iterations/iteration_0/weights/best.pt
```

### Training Fails

**Problem:**
Training script fails with CUDA errors or OOM

**Solution:**
```yaml
# Edit config/al_config.yaml
training:
  batch: 1        # Reduce from 2 to 1
  imgsz: 2048     # Reduce from 2560 to 2048
```

### Convergence Not Detected

**Problem:**
Loop continues even though F1 seems good

**Solution:**
```yaml
# Check convergence config
active_learning:
  target_f1: 0.98           # Ensure this matches your expectation
  plateau_threshold: 0.005  # Increase to 0.01 for earlier stopping
```

## Performance Tips

### Speed Up Iterations

1. **Reduce validation set size** (faster validation)
2. **Decrease `max_samples_per_iteration`** (less manual review)
3. **Lower `epochs_increment`** (faster training)
4. **Use smaller image size** (faster inference)

### Improve Convergence

1. **Increase `max_samples_per_iteration`** (more diverse data)
2. **Adjust sampling weights** (target specific error types)
3. **Refine prompts** (better vision-language alignment)
4. **Add more base data** (stronger foundation)

## Examples

### Full Workflow Example

```bash
# 1. Setup
cd active_learning/scripts

# 2. Start active learning
python3 active_learning_loop.py --config ../config/al_config.yaml

# Output:
# ================================================================================
# ACTIVE LEARNING LOOP - YOLO-26 → YOLOE-26
# ================================================================================
# [ITERATION 0] Starting...
# [STEP 1/7] Validating model...
# [STEP 2/7] Analyzing errors...
# [STEP 3/7] Checking convergence...
# [CONVERGENCE] Continue training: F1=0.9650, target=0.9800
# [STEP 4/7] Extracting hard examples...
# [SAMPLING] Selected 20 hard examples from 45 FNs
# [STEP 5/7] Manual review required...
#
# ================================================================================
# MANUAL REVIEW REQUIRED
# ================================================================================
# ...press ENTER after reviewing...

# 3. Manual review (in another terminal)
cd active_learning/iterations/iteration_0/error_analysis/fn_crops
# Upload to Roboflow, annotate, export to datasets/dataset_combined/

# 4. Continue training (press ENTER in original terminal)
# [STEP 6/7] Retraining model...
# [TRAIN] This may take several hours...
# [TRAIN] Training complete!
# [STEP 7/7] Updating tracking and plots...
# [ITERATION 0] Complete!

# 5. Repeat for iteration 1, 2, ... until convergence

# ================================================================================
# ACTIVE LEARNING COMPLETE
# ================================================================================
# Reason: Target F1 achieved: 0.9812 >= 0.9800
# Final F1: 0.9812
# Total iterations: 4
```

### Resume After Interruption

```bash
# If Ctrl+C during iteration 2
# [INTERRUPTED] Stopped at iteration 2
# [INTERRUPTED] Resume with: --start-iteration 2

# Resume
python3 active_learning_loop.py --config ../config/al_config.yaml --start-iteration 2
```

### Dry-Run for Testing

```bash
# Test the entire workflow without training (fast)
python3 active_learning_loop.py --config ../config/al_config.yaml --dry-run

# Output:
# [INIT] Dry-run mode: True
# [ITERATION 0] Starting...
# [STEP 1/7] Validating model...
# [STEP 2/7] Analyzing errors...
# [STEP 3/7] Checking convergence...
# [STEP 4/7] Extracting hard examples...
# [STEP 5/7] Manual review required...
# [STEP 6/7] Skipping training (dry-run mode)
# [STEP 7/7] Updating tracking and plots...
```

## Best Practices

1. **Always use interactive mode** (default) for production
2. **Review convergence plots** after each iteration
3. **Check prompt suggestions** - they're data-driven insights
4. **Keep track of dataset versions** - export from Roboflow with version tags
5. **Document changes** - add notes to `iteration_reports/`
6. **Backup weights** - copy `best.pt` to safe location after convergence
7. **Monitor GPU usage** - ensure training is using GPU
8. **Validate final model** - run separate holdout test after convergence

## References

- Main README: `../README.md`
- Script documentation: `./USAGE.md`
- Implementation notes: `./IMPLEMENTATION_NOTES.md`
- Module tests: `./test_modules.py`
