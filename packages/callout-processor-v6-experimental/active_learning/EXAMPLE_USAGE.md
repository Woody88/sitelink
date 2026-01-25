# Example Usage: batch_validate.py

## Quick Start

### 1. Validate YOLO baseline model (iteration 0)

This establishes the baseline performance (expected ~96.5% F1).

```bash
cd /home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/active_learning

python scripts/batch_validate.py \
  ../../callout-processor-v5/runs/detect/v5_combined2/weights/best.pt \
  ../../callout-processor-v5/dataset_v6 \
  --output metrics \
  --iteration 0
```

**Output:**
```
metrics/iteration_0/
├── validation_report.json    # Full metrics
├── confusion_matrix.png      # Visual confusion matrix
└── per_image_metrics.csv     # Spreadsheet-ready results
```

### 2. Validate YOLOE with text prompts (iteration 1)

Test YOLOE zero-shot performance with optimized text prompts.

```bash
python scripts/batch_validate.py \
  ../../callout-processor-v5/yoloe-26n-seg.pt \
  ../../callout-processor-v5/dataset_v6 \
  --yoloe \
  --prompts-json ../../callout-processor-v5/prompts/us_ncs.json \
  --output metrics \
  --iteration 1 \
  --conf 0.05
```

**Note:** YOLOE requires lower confidence threshold (0.05 vs 0.25).

### 3. Quick test with 10 images

Test the script quickly before running full validation.

```bash
python scripts/batch_validate.py \
  ../../callout-processor-v5/runs/detect/v5_combined2/weights/best.pt \
  ../../callout-processor-v5/dataset_v6 \
  --max-images 10
```

## Comparing Results

### View overall metrics

```bash
# Baseline YOLO (iteration 0)
cat metrics/iteration_0/validation_report.json | jq '.overall'

# YOLOE (iteration 1)
cat metrics/iteration_1/validation_report.json | jq '.overall'
```

**Expected output:**
```json
{
  "precision": 0.965,
  "recall": 0.952,
  "f1": 0.958,
  "tp": 450,
  "fp": 17,
  "fn": 23,
  "gt_total": 473,
  "det_total": 467
}
```

### View per-class metrics

```bash
cat metrics/iteration_0/validation_report.json | jq '.by_class'
```

**Expected output:**
```json
{
  "detail": {
    "precision": 0.97,
    "recall": 0.95,
    "f1": 0.96,
    "tp": 200,
    "fp": 6,
    "fn": 10,
    "gt_count": 210
  },
  "elevation": {
    "precision": 0.96,
    "recall": 0.95,
    "f1": 0.955,
    "tp": 150,
    "fp": 7,
    "fn": 8,
    "gt_count": 158
  },
  "title": {
    "precision": 0.96,
    "recall": 0.96,
    "f1": 0.96,
    "tp": 100,
    "fp": 4,
    "fn": 5,
    "gt_count": 105
  }
}
```

### View confusion matrices

```bash
# Open confusion matrices side by side
open metrics/iteration_0/confusion_matrix.png &
open metrics/iteration_1/confusion_matrix.png &
```

### Analyze per-image metrics in spreadsheet

```bash
# Open CSV in your favorite spreadsheet tool
libreoffice metrics/iteration_0/per_image_metrics.csv
# or
open metrics/iteration_0/per_image_metrics.csv
```

## Advanced Usage

### Test without SAHI tiling

Compare performance with/without SAHI:

```bash
python scripts/batch_validate.py \
  model.pt \
  dataset/ \
  --no-sahi \
  --output metrics/no_sahi
```

### Test without post-processing filters

See raw model performance:

```bash
python scripts/batch_validate.py \
  model.pt \
  dataset/ \
  --no-filters \
  --output metrics/no_filters
```

### Custom confidence threshold

Test different confidence thresholds:

```bash
python scripts/batch_validate.py \
  model.pt \
  dataset/ \
  --conf 0.1 \
  --output metrics/conf_0.1
```

## Interpreting Results

### Overall Metrics

- **Precision**: What % of predictions are correct? (TP / (TP + FP))
  - High precision = Few false positives
  - Target: >95%

- **Recall**: What % of ground truth are detected? (TP / (TP + FN))
  - High recall = Few missed callouts
  - Target: >95%

- **F1 Score**: Harmonic mean of precision and recall
  - Balanced metric
  - Target: >95%

### Per-Class Metrics

Shows which callout types are performing well/poorly:

- **detail**: Typically highest performance (clear circles)
- **elevation**: May have lower recall (triangle variations)
- **title**: Variable (wide text boxes, small circles)

### Confusion Matrix

Visual representation of errors:

- **Diagonal**: Correct predictions (dark blue = high count)
- **Last column**: False negatives (missed callouts)
- **Last row**: False positives (incorrect predictions)
- **Off-diagonal**: Class confusion (e.g., detail predicted as elevation)

### Per-Image Metrics

Identifies problematic images:

- Images with low F1 score need review
- High FP rate may indicate clutter/noise
- High FN rate may indicate difficult callouts

## Troubleshooting

### ImportError: No module named 'ultralytics'

```bash
pip install ultralytics
```

### ImportError: No module named 'matplotlib'

```bash
pip install matplotlib
```

### Model file not found

Check model path is correct:

```bash
ls -la ../../callout-processor-v5/runs/detect/v5_combined2/weights/best.pt
```

### Dataset not found

Check dataset structure:

```bash
ls -la ../../callout-processor-v5/dataset_v6/train/images/
ls -la ../../callout-processor-v5/dataset_v6/train/labels/
```

### YOLOE prompts JSON not found

Check prompts file exists:

```bash
ls -la ../../callout-processor-v5/prompts/us_ncs.json
```

## Next Steps

After validation:

1. **Compare baseline vs YOLOE**: Which has better F1?
2. **Analyze errors**: Check confusion matrix and per-image CSV
3. **Identify hard examples**: Images with low F1 scores
4. **Refine prompts**: Improve YOLOE text descriptions (if needed)
5. **Iterate**: Run validation on iteration 2, 3, etc.
