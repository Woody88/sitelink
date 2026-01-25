# Active Learning Orchestrator - Complete Example

This document shows a complete active learning workflow from start to finish using `active_learning_loop.py`.

## Prerequisites

Before starting, ensure you have:

1. **Baseline model** trained and ready
2. **Validation dataset** with ground truth annotations
3. **Roboflow account** for dataset augmentation
4. **Python dependencies** installed

```bash
# Install dependencies
pip install matplotlib seaborn opencv-python numpy pyyaml ultralytics

# Verify baseline model exists
ls -lh ../weights/yolo26n.pt

# Verify dataset structure
ls -lh datasets/dataset_combined/
# Should contain: images/, labels/, data.yaml
```

## Initial Setup

### 1. Review Configuration

```bash
cd active_learning
cat config/al_config.yaml
```

Key settings to verify:

```yaml
active_learning:
  max_samples_per_iteration: 20     # How many hard examples per iteration
  require_human_review: true        # Must be true for production
  target_f1: 0.98                   # Target performance (98%)
  plateau_threshold: 0.005          # Stop if < 0.5% improvement
  max_iterations: 10                # Safety limit

training:
  base_lr: 0.001                    # Initial learning rate
  epochs_base: 150                  # Epochs for baseline (iteration 0)
  epochs_increment: 100             # Epochs per iteration after baseline
  imgsz: 2560                       # Image size (match dataset)
  batch: 2                          # Batch size (adjust for GPU)
```

### 2. Create Directory Structure

```bash
# Orchestrator creates these automatically, but good to verify paths
mkdir -p iterations
mkdir -p metrics/convergence_plots
mkdir -p metrics/iteration_reports
mkdir -p prompt_versions
mkdir -p datasets/dataset_combined
```

## Running Active Learning

### Start the Loop

```bash
cd scripts
python3 active_learning_loop.py --config ../config/al_config.yaml
```

Expected output:

```
[INIT] Active Learning Orchestrator initialized
[INIT] Base directory: /path/to/active_learning
[INIT] Starting iteration: 0
[INIT] Dry-run mode: False
[INIT] Auto mode: False

================================================================================
ACTIVE LEARNING LOOP - YOLO-26 → YOLOE-26
================================================================================
Target F1: 0.98
Max iterations: 10
Require human review: True
================================================================================

================================================================================
ITERATION 0
================================================================================

[ITERATION 0] Starting...
[ITERATION 0] Output directory: active_learning/iterations/iteration_0
```

## Iteration 0: Baseline Training

### Step 1: Validation

```
[STEP 1/7] Validating model...
[VALIDATE] Running: python3 batch_validate.py --model weights/yolo26n.pt ...
Processing images: 100%|██████████| 50/50 [02:15<00:00, 2.71s/it]

Overall Metrics:
  Precision: 0.9723
  Recall: 0.9580
  F1: 0.9651
  TP: 145, FP: 4, FN: 6
```

The baseline YOLO-26 model achieves **96.5% F1** - our starting point.

### Step 2: Error Analysis

```
[STEP 2/7] Analyzing errors...
[ERROR_ANALYSIS] Running: python3 error_analysis.py ...

False Negatives Analysis:
  Total FN: 6
  Size distribution:
    tiny: 2 (33%)
    small: 3 (50%)
    medium: 1 (17%)
  Position distribution:
    edge: 3 (50%)
    center: 2 (33%)
    corner: 1 (17%)
  Visual characteristics:
    low_contrast: 2 (33%)
    unusual_aspect: 1 (17%)

Extracted 6 FN crops to: iterations/iteration_0/error_analysis/fn_crops/

Prompt Suggestions:
  detail: "Small detail callout with low contrast, especially near edges"
  elevation: "Elevation marker including tiny instances"
  title: "Title block callout with unusual aspect ratios"
```

### Step 3: Convergence Check

```
[STEP 3/7] Checking convergence...
[CONVERGENCE] Continue training: F1=0.9651, target=0.9800
```

Current F1 (96.51%) < Target (98%) → **Continue**

### Step 4: Extract Hard Examples

```
[STEP 4/7] Extracting hard examples...
[SAMPLING] Scoring 6 false negatives by informativeness...

Hard Examples Selected:
  1. Image: plan_042.png, Class: detail, Size: tiny (350 px²)
     Position: edge, Contrast: low (0.23)
     Score: 0.89 (high informativeness)

  2. Image: plan_015.png, Class: elevation, Size: small (780 px²)
     Position: corner, Contrast: medium (0.48)
     Score: 0.85

  3. Image: plan_031.png, Class: detail, Size: tiny (420 px²)
     Position: center, Contrast: low (0.31)
     Score: 0.81

  ... (showing top 3 of 6 selected)

[SAMPLING] Selected 6 hard examples from 6 FNs
```

All FNs are selected since we have < 20 (max_samples_per_iteration).

### Step 5: Manual Review (PAUSE)

```
[STEP 5/7] Manual review required...

================================================================================
MANUAL REVIEW REQUIRED
================================================================================
Iteration: 0
Hard examples: 6
FN crops saved to: active_learning/iterations/iteration_0/error_analysis/fn_crops/

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

**Now perform manual review** (detailed steps below).

### Manual Review Process

Open a **new terminal** while orchestrator is paused:

```bash
# 1. Inspect extracted crops
cd active_learning/iterations/iteration_0/error_analysis/fn_crops
ls -lh

# Output:
# detail_tiny_plan_042_350px.png
# detail_tiny_plan_031_420px.png
# elevation_small_plan_015_780px.png
# ...

# 2. View crops to understand what was missed
# (Use image viewer or upload to Roboflow)

# 3. Upload to Roboflow
# - Go to https://roboflow.com
# - Select your project
# - Upload all images from fn_crops/

# 4. Annotate crops
# - Draw bounding boxes around callouts
# - Assign correct class labels (detail/elevation/title)
# - Review existing annotations for consistency

# 5. Export augmented dataset
# - Click "Export Dataset" in Roboflow
# - Select "YOLO v8" format
# - Download ZIP

# 6. Merge with existing dataset
cd ../../../../../datasets
unzip ~/Downloads/your-roboflow-export.zip -d roboflow_iteration_0
cd dataset_combined

# Copy new images and labels
cp ../roboflow_iteration_0/train/images/* images/train/
cp ../roboflow_iteration_0/train/labels/* labels/train/

# Update data.yaml with new image count
# (orchestrator will use this for training)

# 7. Review prompt suggestions
cd ../../iterations/iteration_0/error_analysis
cat prompt_suggestions.json
```

**Example prompt_suggestions.json:**

```json
{
  "detail": {
    "current": "A detail callout circle",
    "issues": [
      "Missing 2 tiny instances (< 500 px²)",
      "Missing 2 low-contrast instances"
    ],
    "suggested": "A detail callout circle of any size, including small and low-contrast instances, especially near image edges"
  },
  "elevation": {
    "current": "An elevation indicator symbol",
    "issues": [
      "Missing 1 small instance near corner"
    ],
    "suggested": "An elevation indicator symbol with solid circle and triangle marker, including instances near image boundaries"
  }
}
```

Optional: Update prompts based on suggestions:

```bash
# Edit prompt file for next iteration
cd ../../../prompt_versions
cp prompts_iteration_00.json prompts_iteration_01.json
# Edit prompts_iteration_01.json with improved descriptions
```

### Continue Training

Back in the **original terminal** where orchestrator is paused:

```
[Press ENTER]

[RESUME] Continuing to training...
```

### Step 6: Retrain Model

```
[STEP 6/7] Retraining model...
[TRAIN] Running: python3 train_active_learning.py --iteration 1 ...
[TRAIN] This may take several hours...

Epoch 1/100: 100%|██████████| 245/245 [12:34<00:00, 3.08s/it]
  train loss: 0.0234, val loss: 0.0189
  train F1: 0.9876, val F1: 0.9723

Epoch 2/100: 100%|██████████| 245/245 [12:31<00:00, 3.07s/it]
  train loss: 0.0198, val loss: 0.0175
  train F1: 0.9901, val F1: 0.9758

...

Epoch 47/100: 100%|██████████| 245/245 [12:29<00:00, 3.06s/it]
  train loss: 0.0087, val loss: 0.0123
  train F1: 0.9965, val F1: 0.9812

Early stopping triggered - no improvement for 20 epochs

[TRAIN] Training complete!
[TRAIN] Best epoch: 27
[TRAIN] Best val F1: 0.9812
[TRAIN] Weights saved to: iterations/iteration_1/weights/best.pt
```

New model achieves **98.12% F1** after fine-tuning with augmented data!

### Step 7: Update Tracking

```
[STEP 7/7] Updating tracking and plots...
Updated tracking CSV: metrics/convergence_tracking.csv
[PLOTS] Convergence plots saved to: metrics/convergence_plots
[REPORT] Iteration report saved to: metrics/iteration_reports/iteration_01_report.json

[ITERATION 1] Complete!
```

## Iteration 1: Fine-Tuning Results

### Convergence Check

```
================================================================================
ITERATION 1
================================================================================

[STEP 1/7] Validating model...
Overall Metrics:
  Precision: 0.9834
  Recall: 0.9790
  F1: 0.9812
  TP: 148, FP: 2, FN: 3

[STEP 3/7] Checking convergence...

================================================================================
ACTIVE LEARNING COMPLETE
================================================================================
Reason: Target F1 achieved: 0.9812 >= 0.9800
Final F1: 0.9812
Total iterations: 2
================================================================================
```

**Success!** We achieved the target F1 score in just 2 iterations:

- **Iteration 0 (Baseline)**: 96.51% F1
- **Iteration 1 (Fine-tuned)**: 98.12% F1
- **Improvement**: +1.61 percentage points

## Results Analysis

### Check Metrics

```bash
# View convergence tracking
cat metrics/convergence_tracking.csv

# Output:
# iteration,f1,precision,recall,tp,fp,fn,...
# 0,0.9651,0.9723,0.9580,145,4,6
# 1,0.9812,0.9834,0.9790,148,2,3
```

### View Plots

```bash
# Open convergence plots
open metrics/convergence_plots/f1_trend.png
open metrics/convergence_plots/metrics_trend.png
open metrics/convergence_plots/counts_trend.png
```

**f1_trend.png** shows:
- Sharp improvement from 96.51% → 98.12%
- Target line at 98%
- Convergence achieved ✓

**counts_trend.png** shows:
- FN reduced: 6 → 3 (50% reduction)
- FP reduced: 4 → 2 (50% reduction)
- TP increased: 145 → 148

### Review Final Model

```bash
# Final model weights
ls -lh iterations/iteration_1/weights/best.pt

# Model metadata
cat iterations/iteration_1/metadata.json

# Output:
# {
#   "iteration": 1,
#   "model_type": "yoloe-26-nano",
#   "prompts": {
#     "detail": "A detail callout circle of any size...",
#     "elevation": "An elevation indicator symbol...",
#     "title": "A title block callout..."
#   },
#   "training": {
#     "epochs": 100,
#     "best_epoch": 27,
#     "learning_rate": 0.0005,
#     "batch_size": 2,
#     "image_size": 2560
#   },
#   "metrics": {
#     "train_f1": 0.9965,
#     "val_f1": 0.9812,
#     "precision": 0.9834,
#     "recall": 0.9790
#   }
# }
```

## What If Convergence Wasn't Achieved?

If F1 < 98% after iteration 1, the loop would continue:

### Iteration 2 Workflow

```
[ITERATION 1] Complete!

================================================================================
ITERATION 2
================================================================================

[STEP 1/7] Validating model...
Overall Metrics:
  F1: 0.9745 (still < 0.98 target)

[STEP 3/7] Checking convergence...
[CONVERGENCE] Continue training: F1=0.9745, target=0.9800

[STEP 4/7] Extracting hard examples...
[SAMPLING] Selected 3 hard examples from 4 FNs

[STEP 5/7] Manual review required...
[Press ENTER after reviewing crops and augmenting dataset]

[STEP 6/7] Retraining model...
Learning rate: 0.00025 (decayed from 0.0005)
Epochs: 100
...
```

This continues until:
- Target F1 achieved, OR
- Plateau detected (< 0.5% improvement for 3 iterations), OR
- Overfitting detected (train-val gap > 5%), OR
- Max iterations reached (10)

## Advanced Scenarios

### Scenario 1: Resume After Interruption

If you press Ctrl+C during iteration 2:

```
[INTERRUPTED] Active learning interrupted by user
[INTERRUPTED] Stopped at iteration 2
[INTERRUPTED] Resume with: --start-iteration 2
```

To resume:

```bash
python3 active_learning_loop.py --config ../config/al_config.yaml --start-iteration 2
```

Or use auto-resume:

```bash
python3 active_learning_loop.py --config ../config/al_config.yaml --resume

# Output:
# [RESUME] Resuming from iteration 3
```

### Scenario 2: Plateau Detected

If improvements slow down:

```
[ITERATION 5] Complete!

================================================================================
ITERATION 6
================================================================================

[STEP 1/7] Validating model...
Overall Metrics:
  F1: 0.9768

[STEP 3/7] Checking convergence...

================================================================================
ACTIVE LEARNING COMPLETE
================================================================================
Reason: Plateau detected: max improvement 0.0032 < 0.0050 over last 3 iterations
Final F1: 0.9768
Total iterations: 7
================================================================================
```

Model stopped improving despite not reaching target. Options:

1. **Adjust config** and continue:
   ```yaml
   active_learning:
     plateau_threshold: 0.002  # Lower threshold (0.2%)
   ```

2. **Review data quality** - maybe dataset has annotation errors

3. **Accept current performance** - 97.68% may be sufficient

### Scenario 3: Overfitting Detected

If model memorizes training data:

```
[ITERATION 4] Complete!

================================================================================
ACTIVE LEARNING COMPLETE
================================================================================
Reason: Overfitting detected: train F1 (0.9912) - val F1 (0.9745) = 0.0167 > 0.0500
Final F1: 0.9745
Total iterations: 5
================================================================================
```

Model is overfitting. Solutions:

1. **Add more training data** (more diverse examples)
2. **Increase augmentation** in training config
3. **Reduce model capacity** (use smaller model)
4. **Add regularization** (adjust training config)

## Dry-Run Mode for Testing

Test the entire workflow without training (fast):

```bash
python3 active_learning_loop.py --config ../config/al_config.yaml --dry-run

# Output:
# [INIT] Dry-run mode: True
# ...
# [STEP 6/7] Skipping training (dry-run mode)
# ...
# [ITERATION 0] Complete!
```

Useful for:
- Verifying configuration
- Testing dataset paths
- Checking that all modules work
- Debugging workflow issues

## Best Practices Learned

1. **Review prompt suggestions carefully** - they're data-driven and often reveal model blind spots

2. **Quality over quantity** - 6 well-annotated hard examples > 20 random examples

3. **Check dataset balance** - ensure new annotations don't skew class distribution

4. **Monitor overfitting** - if train F1 >> val F1, add more diverse data

5. **Save weights regularly** - copy `best.pt` to backup location after each iteration

6. **Document changes** - note what prompts/data changed each iteration

7. **Validate on holdout set** - after convergence, test on unseen data to confirm performance

## Common Issues and Solutions

### Issue: Training OOM (Out of Memory)

**Error:**
```
CUDA out of memory. Tried to allocate 2.34 GiB
```

**Solution:**
```yaml
# Edit config/al_config.yaml
training:
  batch: 1        # Reduce from 2
  imgsz: 2048     # Reduce from 2560
```

### Issue: Convergence Too Early

**Symptom:**
Stops at 97.2% F1, still has room to improve

**Solution:**
```yaml
active_learning:
  plateau_threshold: 0.002  # More sensitive (0.2% vs 0.5%)
  plateau_iterations: 5     # Check over more iterations
```

### Issue: Too Many Hard Examples

**Symptom:**
Manual review takes too long (> 50 samples per iteration)

**Solution:**
```yaml
active_learning:
  max_samples_per_iteration: 15  # Reduce from 20
```

### Issue: Model Not Learning from Hard Examples

**Symptom:**
Same FNs appear iteration after iteration

**Solution:**
1. Check annotation quality in Roboflow
2. Verify exports are being merged correctly
3. Ensure `data.yaml` reflects new image count
4. Check training logs for signs of learning

## Summary

Using `active_learning_loop.py`:

1. **Automates** the entire active learning workflow
2. **Reduces** manual scripting and error-prone steps
3. **Ensures** consistent execution across iterations
4. **Tracks** metrics automatically
5. **Provides** clear guidance at each step
6. **Handles** convergence detection intelligently

**Result**: 96.5% F1 → 98.1% F1 in 2 iterations with minimal manual effort.

## Next Steps

After convergence:

1. **Validate on test set** - run final model on held-out data
2. **Deploy to production** - use `best.pt` from last iteration
3. **Monitor performance** - track real-world F1 score
4. **Plan next round** - if new failure modes emerge, repeat active learning

## References

- Full documentation: `ACTIVE_LEARNING_LOOP.md`
- Script source: `active_learning_loop.py`
- Module docs: `USAGE.md`
- Config reference: `../config/al_config.yaml`
