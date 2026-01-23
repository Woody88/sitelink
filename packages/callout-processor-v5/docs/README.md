# Callout Detection Documentation

## Overview

This directory contains comprehensive documentation for the v5 callout detection system.

## Documents

### 1. [ARCHITECTURE.md](ARCHITECTURE.md) ⭐ START HERE
**System architecture and critical parameters**

Covers:
- How the detection pipeline works (PDF → Render → SAHI → YOLO → Filters → Output)
- Critical parameters that should NOT be changed (DPI, tile size, confidence)
- Text-based diagrams showing data flow
- File formats and performance characteristics

**Read this first** to understand how everything fits together.

### 2. [TRAINING.md](TRAINING.md)
**How to train or retrain the model**

Covers:
- Complete training workflow (Roboflow → Dataset → Training → Validation)
- How to collect and annotate data
- Training parameters and monitoring
- When to retrain vs deploy
- Best practices and troubleshooting

**Use this when** you need to improve the model or add new training data.

### 3. [INFERENCE.md](INFERENCE.md)
**How to generate detections on PDFs**

Covers:
- Simple detection (no validation)
- Detection with validation (compare to ground truth)
- Interpreting precision/recall/F1 metrics
- Production integration examples
- Optimization tips

**Use this when** you want to run the model on new PDFs or integrate into production.

### 4. [ADDING_CLASSES.md](ADDING_CLASSES.md)
**How to add new callout classes**

Covers:
- When to add vs not add a new class
- Step-by-step process (Roboflow → Code → Training → Deployment)
- What code needs updating
- Example walkthrough
- Best practices

**Use this when** you need to detect a new type of callout (e.g., section symbols, keynotes).

## Quick Reference

### Just Want to Detect Callouts?

```bash
# Simple detection (outputs annotated images)
python test_v5_sahi.py

# Detection with validation (outputs metrics)
python generate_detection_json.py plan.pdf 5 out.json out.png
python src/validate_with_ground_truth.py out.png out.json ground_truth.txt --output val.png
```

See: [INFERENCE.md](INFERENCE.md)

### Need to Retrain the Model?

```bash
# 1. Collect data in Roboflow
# 2. Export as YOLO v8
# 3. Train
python train_combined.py

# 4. Validate
python src/validate_with_ground_truth.py ...
```

See: [TRAINING.md](TRAINING.md)

### Want to Add a New Callout Type?

```bash
# 1. Add class in Roboflow
# 2. Annotate 100+ examples
# 3. Update CLASS_NAMES in code
# 4. Retrain
# 5. Validate
```

See: [ADDING_CLASSES.md](ADDING_CLASSES.md)

## Critical Information

### DO NOT CHANGE These Parameters

Unless you retrain the entire model:

| Parameter | Value | Why |
|-----------|-------|-----|
| **DPI** | 72 | Proven optimal from v4 testing |
| **Tile Size** | 2048×2048 | YOLO sweet spot for large images |
| **Tile Overlap** | 0.2 (20%) | Captures edge callouts |
| **Confidence** | 0.25 | Best precision/recall balance |

**Changing these requires retraining the model from scratch.**

See: [ARCHITECTURE.md](ARCHITECTURE.md) for details.

### Current Classes

```
0: detail     - Small circular/rectangular callouts (e.g., "1", "A3")
1: elevation  - Similar to detail, often on elevation views
2: title      - Larger boxes with detail titles (e.g., "WALL SECTION A-A")
```

### Current Performance (v5)

**Validated on 5 pages (Canadian + US plans):**
- Precision: **97.1%**
- Recall: **95.4%**
- F1: **96.3%**

**Per-class:**
- Detail: 93% P, 86% R
- Elevation: 97% P, 99% R
- Title: 97% P, 92% R

## Directory Structure

```
docs/
├── README.md              # This file
├── ARCHITECTURE.md        # System overview (START HERE)
├── TRAINING.md            # How to train/retrain
├── INFERENCE.md           # How to generate detections
└── ADDING_CLASSES.md      # How to add new classes

../
├── src/                   # Source code
│   ├── sahi_tiling.py                  # SAHI tiling logic
│   ├── postprocess_filters.py          # Post-processing filters
│   ├── validate_with_ground_truth.py   # Validation script
│   └── ...
├── runs/detect/v5_combined2/           # Trained model
│   └── weights/best.pt                 # Model weights
├── dataset_v6/                         # Training data
├── test_v5_sahi.py                     # Simple detection script
├── generate_detection_json.py          # Detection + JSON output
├── train_combined.py                   # Training script
└── ...
```

## Common Workflows

### 1. Quick Test on New PDF

```bash
# Edit test_v5_sahi.py to set PDF path and pages
python test_v5_sahi.py

# Check output in test_v5_sahi_output/
```

### 2. Validate Model Performance

```bash
# Generate detection JSON
python generate_detection_json.py plan.pdf 5 det.json img.png

# Validate against ground truth
python src/validate_with_ground_truth.py \
  img.png det.json ground_truth.txt --output val.png

# Review metrics (console) and visualization (val.png)
```

### 3. Add More Training Data

```bash
# 1. Upload new images to Roboflow
# 2. Annotate callouts
# 3. Generate new dataset version (v7)
# 4. Download and extract
unzip callout-detection.v7i.yolo26.zip -d dataset_v7

# 5. Update train_combined.py:
#    data='dataset_v7/data.yaml'

# 6. Train
python train_combined.py

# 7. Validate
# ... (same as workflow 2)
```

### 4. Deploy New Model

```bash
# Test new model first
python test_v5_sahi.py  # Update MODEL path in script

# If results good, copy to production
cp runs/detect/v7_combined/weights/best.pt production/callout_detector.pt
```

## Troubleshooting Guide

### Problem: No Detections

**Check:**
1. Model loaded correctly? `print(model)`
2. Image rendered correctly? `cv2.imwrite('debug.png', image)`
3. DPI is 72? `print(image.shape)`
4. Confidence too high? Try `conf=0.1`

**See:** [INFERENCE.md - Troubleshooting](INFERENCE.md#troubleshooting)

### Problem: Too Many False Positives

**Solutions:**
1. Enable post-processing filters (should be default)
2. Increase confidence threshold (`conf=0.3`)
3. Add negative examples to training data

**See:** [INFERENCE.md - Interpreting Results](INFERENCE.md#interpreting-results)

### Problem: Low Recall (Missing Callouts)

**Solutions:**
1. Lower confidence threshold (`conf=0.2`)
2. Check SAHI tiling is enabled
3. Verify DPI is 72 (not lower)
4. Add more training examples

**See:** [TRAINING.md - Troubleshooting](TRAINING.md#troubleshooting)

### Problem: Training Not Converging

**Solutions:**
1. More training data (100+ images)
2. Check annotation quality
3. Reduce learning rate
4. Train for more epochs (300-500)

**See:** [TRAINING.md - Step 3](TRAINING.md#step-3-train-model)

### Problem: Want to Add New Class

**Process:**
1. Read [ADDING_CLASSES.md](ADDING_CLASSES.md)
2. Add class in Roboflow
3. Annotate 100+ examples
4. Update code (CLASS_NAMES in all scripts)
5. Retrain

**See:** [ADDING_CLASSES.md - Step-by-Step](ADDING_CLASSES.md#adding-a-new-class-step-by-step)

## Additional Resources

### Outside Documentation

- **YOLO Documentation:** https://docs.ultralytics.com/
- **Roboflow Docs:** https://docs.roboflow.com/
- **SAHI Documentation:** https://github.com/obss/sahi

### Related Files in Main Directory

- `SUMMARY.md` - Quick validation summary
- `VALIDATION_RESULTS_CORRECT.md` - Full validation metrics
- `VALIDATION_PROCESS.md` - Complete validation workflow
- `START_HERE.md` - Project overview

## Getting Help

### Common Questions

**Q: How do I run detection on my PDF?**
A: See [INFERENCE.md](INFERENCE.md) - Method 1: Simple Detection

**Q: How do I improve accuracy?**
A: See [TRAINING.md](TRAINING.md) - Step 5: Iterate or Deploy

**Q: How do I add a new callout type?**
A: See [ADDING_CLASSES.md](ADDING_CLASSES.md)

**Q: What parameters can I safely change?**
A: Confidence threshold (0.2-0.3). Everything else requires retraining.

**Q: Can I use higher DPI?**
A: Yes, but requires retraining the model. 72 DPI is proven optimal.

### Issues and Support

For bugs or questions:
1. Check troubleshooting sections in each doc
2. Review validation results to understand the issue
3. Open issue in project repository with:
   - Error message or unexpected behavior
   - Sample image/PDF (if possible)
   - Steps to reproduce

## Version History

- **v5 (2026-01-22):** Current production model
  - 96.5% precision, 96.5% recall on Canadian plans
  - 97.1% precision, 95.4% recall combined (Canadian + US)
  - 3 classes: detail, elevation, title
  - SAHI tiling enabled
  - Post-processing filters enabled

- **v4:** Previous version
  - Lower recall (~44%)
  - No SAHI tiling
  - Deprecated

## Next Steps

1. **Read [ARCHITECTURE.md](ARCHITECTURE.md)** to understand the system
2. **Try detection** on your PDFs using [INFERENCE.md](INFERENCE.md)
3. **Validate performance** if you have ground truth
4. **Retrain if needed** using [TRAINING.md](TRAINING.md)
