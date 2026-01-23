# YOLO Callout Detection: Recall Optimization Guide

## Problem Summary

Extended YOLO training (more epochs + patience) improved validation mAP but **decreased production recall**:

| Model | mAP50 | Detections | Detail | Elevation | Recall (vs 89 GT) |
|-------|-------|------------|--------|-----------|-------------------|
| **Baseline yolo26n** | 82.7% | **79** | 34 | 45 | **44%** ⭐ BEST |
| **Improved yolo26n** | 93.0% | **67** | 34 | 33 | 34% |
| **yolo26s** | 96.5% | **58-60** | - | - | 26% |

### Root Cause

**mAP optimizes for precision+recall balance, but production needs HIGH RECALL.**

During extended training (200 epochs):
- Recall **decreased 23%**: 0.0039 → 0.0030
- Precision increased
- mAP increased (88.4% → 92.4%)
- But fewer callouts detected in production

**Key Insight:** The model learned to be more "conservative" to maximize mAP, trading recall for precision.

---

## Solution Roadmap

### Step 1: Test Lower Confidence Thresholds (FASTEST - Do This First)

The improved model may have detected callouts but assigned them lower confidence scores.

#### 1a. Test Baseline Model at Lower Thresholds

```bash
cd /home/woodson/Code/projects/sitelink/packages/callout-processor-v4

# Test at conf=0.05
python src/unified_pipeline.py \
  --pdf "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
  --output test_baseline_conf005 \
  --model weights/callout_detector.pt \
  --conf 0.05

# Test at conf=0.03
python src/unified_pipeline.py \
  --pdf "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
  --output test_baseline_conf003 \
  --model weights/callout_detector.pt \
  --conf 0.03

# Compare results
cat test_baseline_conf005/summary.json | jq '.total_detections'
cat test_baseline_conf003/summary.json | jq '.total_detections'
```

#### 1b. Test Improved Model at Lower Thresholds

```bash
# Test improved model at conf=0.05
python src/unified_pipeline.py \
  --pdf "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
  --output test_improved_conf005 \
  --model weights/callout_detector_yolo26n_improved.pt \
  --conf 0.05

# Test at conf=0.03
python src/unified_pipeline.py \
  --pdf "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
  --output test_improved_conf003 \
  --model weights/callout_detector_yolo26n_improved.pt \
  --conf 0.03
```

#### 1c. Analyze Results

```bash
# Create comparison table
echo "Model,Conf,Detections" > threshold_comparison.csv
echo "Baseline,0.10,79" >> threshold_comparison.csv
cat test_baseline_conf005/summary.json | jq -r '"Baseline,0.05," + (.total_detections|tostring)' >> threshold_comparison.csv
cat test_baseline_conf003/summary.json | jq -r '"Baseline,0.03," + (.total_detections|tostring)' >> threshold_comparison.csv
cat test_improved_conf005/summary.json | jq -r '"Improved,0.05," + (.total_detections|tostring)' >> threshold_comparison.csv
cat test_improved_conf003/summary.json | jq -r '"Improved,0.03," + (.total_detections|tostring)' >> threshold_comparison.csv

column -t -s',' threshold_comparison.csv
```

**Decision Point:** If lowering threshold to 0.03-0.05 increases detections to ~80+, use that threshold in production. Accept higher false positive rate, filter with OCR validation.

---

### Step 2: Generate Precision-Recall Curves

Understand the full precision/recall trade-off across all confidence thresholds.

#### 2a. Create PR Curve Script

```python
# create file: src/generate_pr_curve.py
from ultralytics import YOLO
import json
import matplotlib.pyplot as plt
import numpy as np

model = YOLO('weights/callout_detector_yolo26n_improved.pt')

# Run validation with save_json=True
results = model.val(
    data='dataset_highres/data.yaml',
    save_json=True,
    plots=True,
)

# Ultralytics automatically generates PR curve in runs/detect/val/
print(f"Precision: {results.results_dict['metrics/precision(B)']}")
print(f"Recall: {results.results_dict['metrics/recall(B)']}")
print(f"mAP50: {results.results_dict['metrics/mAP50(B)']}")

# PR curve saved to: runs/detect/val/PR_curve.png
# Metrics saved to: runs/detect/val/results.json
```

#### 2b. Run PR Analysis

```bash
python src/generate_pr_curve.py

# View the PR curve
open runs/detect/val/PR_curve.png

# Find optimal threshold for target recall (e.g., 80%)
# Look at the curve: what confidence gives 80% recall?
```

**Decision Point:** If curve shows high recall (>70%) is achievable at low confidence (<0.05) with acceptable precision, deploy with that threshold.

---

### Step 3: Retrain with Recall-Focused Objectives

If threshold tuning doesn't achieve target recall, retrain with recall priority.

#### 3a. Create Recall-Focused Training Script

```python
# create file: src/train_for_recall.py
from ultralytics import YOLO

model = YOLO('yolo26n.pt')

results = model.train(
    data='dataset_highres/data.yaml',
    epochs=100,
    patience=20,
    batch=2,
    imgsz=2048,
    device=0,
    name='callout_yolo26n_recall_focused',

    # CRITICAL: Increase objectness loss to penalize false negatives
    box=7.5,
    cls=0.5,
    dfl=1.5,

    # Save based on recall, not mAP
    # Monitor metrics/recall(B) closely
    save_period=5,

    # Augmentation
    hsv_h=0.0,
    hsv_s=0.0,
    hsv_v=0.2,
    degrees=0,
    translate=0.1,
    scale=0.3,
    flipud=0,
    fliplr=0.5,
    mosaic=0.5,
    mixup=0.0,
)

# After training, manually select checkpoint with BEST RECALL
# Not best mAP!
```

#### 3b. Monitor Recall During Training

```bash
# Watch recall metric in real-time
watch -n 10 'tail -1 runs/detect/callout_yolo26n_recall_focused/results.csv | awk -F"," "{print \"Recall: \" \$5 \" mAP50: \" \$8}"'
```

#### 3c. Select Best Recall Model

```bash
# Find epoch with highest recall (column 5)
awk -F',' 'NR>1 {if ($5 > max) {max=$5; epoch=$1; map=$8}} END {print "Best Recall Epoch:", epoch, "Recall:", max, "mAP50:", map}' runs/detect/callout_yolo26n_recall_focused/results.csv

# Copy that epoch's weights (not best.pt!)
# e.g., if epoch 45 had best recall:
cp runs/detect/callout_yolo26n_recall_focused/weights/epoch45.pt weights/callout_detector_recall_optimized.pt
```

---

### Step 4: Increase Training Resolution

Tiny objects (9-18px callouts) benefit from higher resolution training.

#### 4a. Train at 4096px Resolution

```python
# create file: src/train_highres_4096.py
from ultralytics import YOLO

model = YOLO('yolo26n.pt')

results = model.train(
    data='dataset_highres/data.yaml',
    epochs=100,
    patience=20,
    batch=1,  # Reduced batch size for 4096px
    imgsz=4096,  # DOUBLE the resolution
    device=0,
    name='callout_yolo26n_4096px',

    # Recall-focused loss weights
    box=7.5,
    cls=0.5,
    dfl=1.5,

    # Augmentation
    hsv_h=0.0,
    hsv_s=0.0,
    hsv_v=0.2,
    degrees=0,
    translate=0.1,
    scale=0.3,
    flipud=0,
    fliplr=0.5,
    mosaic=0.5,
    mixup=0.0,
)
```

#### 4b. Test High-Resolution Model

```bash
# Test with 4096px model
python src/unified_pipeline.py \
  --pdf "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
  --output test_4096px \
  --model runs/detect/callout_yolo26n_4096px/weights/best.pt \
  --conf 0.05

# Compare detections
cat test_4096px/summary.json | jq '.total_detections'
```

**Note:** 4096px training requires more GPU memory and training time. Start with Step 1 (threshold tuning) first.

---

## Step 5: Advanced Techniques (If Steps 1-4 Fail)

### False Negative Analysis

```bash
# Manually review missed callouts
python -c "
import json
import cv2

# Load ground truth annotations
# Load model predictions
# Find missed callouts (in GT but not in predictions)
# Analyze patterns: size, location, context
"
```

### Two-Stage Detection Pipeline

1. **Stage 1:** YOLO with conf=0.01 (high recall, many false positives)
2. **Stage 2:** OCR + validation filter (remove false positives)

### Alternative Architectures

- Faster R-CNN with FPN (better for tiny objects)
- RetinaNet with Focal Loss
- DETR (transformer-based, no anchor tuning needed)

---

## Expected Results by Step

| Step | Expected Outcome | Time | Cost |
|------|-----------------|------|------|
| 1. Lower Threshold | 79 → 90+ detections | 10 min | Free |
| 2. PR Curve | Optimal conf threshold | 15 min | Free |
| 3. Recall Training | Recall 34% → 60%+ | 3 hours | GPU time |
| 4. 4096px Training | Recall 60% → 80%+ | 6 hours | GPU time |

---

## Testing Commands Reference

```bash
# Quick test on single PDF
python src/unified_pipeline.py \
  --pdf "PATH_TO_PDF" \
  --output test_output \
  --model weights/MODEL.pt \
  --conf 0.05

# Batch test multiple models/thresholds
for model in callout_detector.pt callout_detector_yolo26n_improved.pt; do
  for conf in 0.1 0.05 0.03; do
    python src/unified_pipeline.py \
      --pdf "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
      --output "test_${model%.pt}_conf${conf}" \
      --model "weights/$model" \
      --conf $conf
  done
done

# Compare all results
for dir in test_*/; do
  echo "$dir: $(cat $dir/summary.json | jq -r '.total_detections') detections"
done
```

---

## Key Metrics to Monitor

- **Recall**: % of ground truth callouts detected (target: >80%)
- **Precision**: % of detections that are real callouts (target: >60%)
- **F1-Score**: Harmonic mean of precision and recall
- **False Positive Rate**: How many incorrect detections per page (target: <10)

**Production Priority:** Maximize recall first, filter false positives with OCR validation second.

---

## References

- Bead sitelink-p4b: Extended training results analysis
- Bead sitelink-uiz: yolo26s vs yolo26n comparison
- Bead sitelink-e1z: 72 DPI rendering decision
- Training results: `runs/detect/callout_yolo26n_200ep/results.csv`
