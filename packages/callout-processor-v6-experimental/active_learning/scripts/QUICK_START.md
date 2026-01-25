# Active Learning Loop - Quick Start Guide

**Goal**: Automate YOLO-26 → YOLOE-26 upgrade from 96.5% to 98% F1 using active learning.

## Prerequisites

```bash
# 1. Install dependencies
pip install matplotlib seaborn opencv-python numpy pyyaml ultralytics

# 2. Verify baseline model exists
ls ../weights/yolo26n.pt

# 3. Verify dataset structure
ls datasets/dataset_combined/images/
ls datasets/dataset_combined/labels/
cat datasets/dataset_combined/data.yaml
```

## Run Active Learning

### Standard Mode (Recommended)

```bash
cd active_learning/scripts
python3 active_learning_loop.py --config ../config/al_config.yaml
```

This will:
1. ✓ Validate model
2. ✓ Analyze errors
3. ✓ Extract hard examples
4. ⏸ **PAUSE** for manual review
5. ✓ Retrain model
6. ✓ Repeat until convergence

### When Paused for Manual Review

```
================================================================================
MANUAL REVIEW REQUIRED
================================================================================
Iteration: N
FN crops saved to: iterations/iteration_N/error_analysis/fn_crops/

NEXT STEPS:
1. Review FN crops
2. Upload to Roboflow
3. Annotate corrections
4. Export to datasets/dataset_combined/
5. Press ENTER to continue
================================================================================
```

**Quick Roboflow Workflow:**

```bash
# 1. View crops
cd iterations/iteration_N/error_analysis/fn_crops
open .  # Or use file browser

# 2. Upload to Roboflow → Annotate → Export YOLO format

# 3. Merge with dataset
cd ../../../../../datasets/dataset_combined
cp ~/Downloads/roboflow-export/train/images/* images/train/
cp ~/Downloads/roboflow-export/train/labels/* labels/train/

# 4. Return to terminal and press ENTER
```

### Resume from Checkpoint

```bash
# Auto-resume from last iteration
python3 active_learning_loop.py --config ../config/al_config.yaml --resume

# Or resume from specific iteration
python3 active_learning_loop.py --config ../config/al_config.yaml --start-iteration 3
```

### Dry-Run (Test Workflow)

```bash
# Test without training (fast)
python3 active_learning_loop.py --config ../config/al_config.yaml --dry-run
```

## Check Results

### View Metrics

```bash
# Convergence tracking
cat ../metrics/convergence_tracking.csv

# Latest iteration report
cat ../metrics/iteration_reports/iteration_NN_report.json

# View plots
open ../metrics/convergence_plots/f1_trend.png
```

### Check Final Model

```bash
# Best weights
ls -lh ../iterations/iteration_N/weights/best.pt

# Model metadata
cat ../iterations/iteration_N/metadata.json
```

## Common Commands

### Interrupt and Resume

```bash
# Press Ctrl+C to stop
# Later, resume with:
python3 active_learning_loop.py --config ../config/al_config.yaml --resume
```

### Adjust Config

```bash
# Edit configuration
nano ../config/al_config.yaml

# Key settings:
# - target_f1: Stop when achieved
# - max_samples_per_iteration: Hard examples per iteration
# - plateau_threshold: Min improvement to continue
# - epochs_increment: Training epochs per iteration
```

### Test Setup

```bash
# Validate orchestrator
python3 test_orchestrator.py

# Should show:
# ✓ Script syntax test passed
# ✓ Help output test passed
# ✓ All required files present
# ✓ Config structure test passed
```

## Convergence Criteria

Stops when **any** of these are met:

- ✓ **Target achieved**: `F1 >= 0.98`
- ✓ **Plateau**: `< 0.5%` improvement over 3 iterations
- ✓ **Overfitting**: `train_f1 - val_f1 > 5%`
- ✓ **Max iterations**: 10 iterations completed

## Troubleshooting

### "Config not found"

```bash
# Use absolute path or ensure you're in scripts/ directory
python3 active_learning_loop.py --config /full/path/to/al_config.yaml
```

### "Module not found"

```bash
# Install dependencies
pip install matplotlib seaborn opencv-python numpy pyyaml ultralytics
```

### "CUDA out of memory"

```yaml
# Edit config/al_config.yaml
training:
  batch: 1        # Reduce from 2
  imgsz: 2048     # Reduce from 2560
```

### Training not improving

1. Check annotation quality in Roboflow
2. Verify dataset is being merged correctly
3. Review prompt suggestions: `cat iterations/iteration_N/error_analysis/prompt_suggestions.json`
4. Consider adjusting sampling weights in config

## Expected Timeline

**Per Iteration:**
- Validation: ~2-5 minutes (depends on val set size)
- Error analysis: ~1-2 minutes
- Manual review: ~15-30 minutes (your time)
- Training: ~2-6 hours (depends on GPU, dataset size, epochs)

**Total:**
- 2-3 iterations typical to reach 98% F1
- ~1-2 days of compute time
- ~1-2 hours of manual annotation time

## Tips

1. **Quality over quantity** - 10 well-annotated hard examples > 30 random ones
2. **Review prompts** - suggestions are data-driven insights
3. **Monitor overfitting** - if train F1 >> val F1, need more data
4. **Save weights** - copy `best.pt` to backup after convergence
5. **Test on holdout** - validate final model on unseen test set

## Full Documentation

- **Detailed guide**: `ACTIVE_LEARNING_LOOP.md`
- **Complete example**: `ORCHESTRATOR_EXAMPLE.md`
- **Module docs**: `USAGE.md`
- **Main README**: `../README.md`

## Help

```bash
# Show all options
python3 active_learning_loop.py --help

# Test modules
python3 test_modules.py

# Validate orchestrator
python3 test_orchestrator.py
```

## Success Indicators

After convergence, you should see:

```
================================================================================
ACTIVE LEARNING COMPLETE
================================================================================
Reason: Target F1 achieved: 0.9812 >= 0.9800
Final F1: 0.9812
Total iterations: 2
================================================================================

[DONE] Active learning loop finished
[DONE] Output saved to: active_learning/iterations
[DONE] Metrics saved to: active_learning/metrics
```

**Next**: Deploy `iterations/iteration_N/weights/best.pt` to production!
