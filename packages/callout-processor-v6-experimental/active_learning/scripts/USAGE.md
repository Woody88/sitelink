# Active Learning Scripts Usage Guide

This directory contains critical scripts for the active learning pipeline:

## Core Modules

### 1. error_analysis.py

Analyzes validation errors (false negatives and false positives) and provides categorization, visualization, and prompt improvement suggestions.

**Key Features:**
- Size-based categorization (tiny, small, medium, large)
- Position-based categorization (edge, corner, center, overlapping)
- Visual characteristic analysis (low contrast, unusual aspect ratio)
- Class-specific error patterns
- FN crop extraction with context padding
- Error distribution visualizations
- Prompt refinement suggestions

**Usage:**

```bash
# Basic error analysis
python error_analysis.py \
  validation_results.json \
  image.png \
  --output-dir error_analysis/iteration_1

# With FN crop extraction
python error_analysis.py \
  validation_results.json \
  image.png \
  --output-dir error_analysis/iteration_1 \
  --extract-crops

# With prompt suggestions
python error_analysis.py \
  validation_results.json \
  image.png \
  --output-dir error_analysis/iteration_1 \
  --extract-crops \
  --prompts current_prompts.json
```

**Input Format (validation_results.json):**
```json
{
  "precision": 0.85,
  "recall": 0.78,
  "f1": 0.81,
  "tp": 85,
  "fp": 15,
  "fn": 24,
  "fp": [
    {"bbox": [x, y, w, h], "class": "detail"}
  ],
  "fn": [
    {"bbox": [x, y, w, h], "class": "elevation"}
  ],
  "detections": [
    {"bbox": [x, y, w, h], "class": "title"}
  ],
  "by_class": {
    "detail": {"f1": 0.81, "precision": 0.88, "recall": 0.75, "fn": 10}
  }
}
```

**Output:**
- `error_report.json` - Categorized error analysis
- `fn_crops/` - Extracted false negative images
- `fn_size_distribution.png` - Size histogram
- `fn_position_distribution.png` - Position histogram
- `fn_class_distribution.png` - Class histogram
- `error_heatmap.png` - Spatial error heatmap
- `prompt_suggestions.json` - Suggested prompt improvements

### 2. convergence_tracker.py

Tracks metrics across iterations and implements convergence detection logic.

**Key Features:**
- CSV-based metric tracking
- Convergence detection (target, plateau, overfitting, max iterations)
- Trend visualization (F1, precision, recall, counts)
- Per-class metric tracking
- Improvement analysis

**Usage:**

```bash
# Update tracking with new metrics
python convergence_tracker.py \
  --csv convergence_tracking.csv \
  --output-dir convergence_plots \
  --update metrics_iter_1.json \
  --iteration 1

# Check convergence
python convergence_tracker.py \
  --csv convergence_tracking.csv \
  --output-dir convergence_plots \
  --update metrics_iter_2.json \
  --iteration 2 \
  --check-convergence \
  --config convergence_config.json

# Generate plots only
python convergence_tracker.py \
  --csv convergence_tracking.csv \
  --output-dir convergence_plots
```

**Input Format (metrics.json):**
```json
{
  "val_f1": 0.89,
  "val_precision": 0.90,
  "val_recall": 0.88,
  "val_tp": 88,
  "val_fp": 10,
  "val_fn": 12,
  "train_f1": 0.92,
  "train_precision": 0.93,
  "train_recall": 0.91,
  "dataset_size": 200,
  "training_time": 3600,
  "epochs": 50,
  "by_class": {
    "detail": {"f1": 0.87, "precision": 0.88, "recall": 0.86, "fn": 5},
    "elevation": {"f1": 0.90, "precision": 0.91, "recall": 0.89, "fn": 4}
  }
}
```

**Convergence Config (convergence_config.json):**
```json
{
  "target_f1": 0.98,
  "plateau_threshold": 0.005,
  "plateau_iterations": 3,
  "overfitting_threshold": 0.05,
  "max_iterations": 10
}
```

**Output:**
- `convergence_tracking.csv` - Metrics CSV
- `f1_trend.png` - F1 over iterations
- `metrics_trend.png` - Precision/Recall/F1 trends
- `counts_trend.png` - TP/FP/FN counts
- `per_class_f1_trend.png` - Per-class F1 trends
- `per_class_fn_trend.png` - Per-class FN trends
- `dataset_size_trend.png` - Dataset growth
- `convergence_report.json` - Summary report
- `convergence_check_iter_N.json` - Convergence decision

## Integration Example

Here's how these modules integrate into the active learning pipeline:

```bash
#!/bin/bash

ITERATION=1
OUTPUT_BASE="active_learning_output"

# 1. Run validation (from batch_validate.py)
python batch_validate.py \
  --model weights/yoloe-26n.pt \
  --dataset dataset_v6 \
  --output "$OUTPUT_BASE/iteration_$ITERATION/validation.json"

# 2. Analyze errors
python error_analysis.py \
  "$OUTPUT_BASE/iteration_$ITERATION/validation.json" \
  "$OUTPUT_BASE/iteration_$ITERATION/image.png" \
  --output-dir "$OUTPUT_BASE/iteration_$ITERATION/error_analysis" \
  --extract-crops \
  --prompts current_prompts.json

# 3. Update convergence tracking
python convergence_tracker.py \
  --csv "$OUTPUT_BASE/convergence_tracking.csv" \
  --output-dir "$OUTPUT_BASE/convergence_plots" \
  --update "$OUTPUT_BASE/iteration_$ITERATION/validation.json" \
  --iteration $ITERATION \
  --check-convergence \
  --config convergence_config.json

# 4. Check if we should continue
SHOULD_STOP=$(jq -r '.should_stop' "$OUTPUT_BASE/convergence_plots/convergence_check_iter_$ITERATION.json")

if [ "$SHOULD_STOP" = "true" ]; then
  echo "Convergence achieved - stopping"
  exit 0
fi

# 5. Use error analysis to refine prompts and augment dataset
# ... (prompt refinement logic)
# ... (dataset augmentation with FN crops)

# 6. Retrain and continue to next iteration
# ...
```

## Error Categorization Details

### Size Categories
- **tiny**: < 500 px² (often missed, need explicit small object handling)
- **small**: 500-2000 px² (may need scale-aware prompts)
- **medium**: 2000-10000 px² (typical detection size)
- **large**: > 10000 px² (usually detected well)

### Position Categories
- **edge**: Within 100px of image boundary
- **corner**: Near two boundaries (edge + edge)
- **center**: Interior of image
- **overlapping**: IoU > 0.3 with a detection (possibly suppressed)

### Visual Characteristics
- **low contrast**: std dev < 30 (hard to distinguish from background)
- **unusual aspect ratio**: < 0.2 or > 5.0 (elongated or compressed)

## Convergence Criteria

1. **Target Achieved**: val_f1 >= target_f1 (default 0.98)
2. **Plateau**: < 0.5% improvement over last 3 iterations
3. **Overfitting**: train_f1 - val_f1 > 5%
4. **Resource Limit**: iteration >= max_iterations (default 10)

## Testing

Run the test suite to verify modules work correctly:

```bash
python test_modules.py
```

This creates temporary test data and validates all functions work correctly.

## Dependencies

Install required packages:

```bash
pip install -r ../requirements.txt
```

Key dependencies:
- matplotlib >= 3.7.0
- seaborn >= 0.12.0
- opencv-python >= 4.8.0
- numpy >= 1.24.0
