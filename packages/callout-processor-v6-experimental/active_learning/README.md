# Active Learning Pipeline for Callout Detection

This directory contains the active learning infrastructure for iteratively improving YOLOE-based callout detection.

## Goal
Upgrade from YOLO26-nano (96.5% F1) to YOLOE-26-nano with text prompts, targeting 98-99% F1.

## Status
- **Iteration 0**: Baseline training with YOLOE-26 + text prompts
- **Target**: 98-99% F1 score

## Directory Structure

```
active_learning/
├── README.md                      # This file
├── convergence_config.json        # Convergence criteria configuration
├── example_prompts.json           # Example prompt templates
├── scripts/
│   ├── error_analysis.py          # Error categorization and analysis
│   ├── convergence_tracker.py     # Metrics tracking and convergence detection
│   ├── batch_validate.py          # Batch validation with YOLOE support
│   ├── prompt_manager.py          # Prompt refinement manager
│   ├── test_modules.py            # Test suite for modules
│   ├── run_iteration.sh           # Automated iteration runner
│   ├── README.md                  # Scripts overview
│   └── USAGE.md                   # Detailed usage documentation
└── output/
    ├── convergence_tracking.csv   # Metrics across iterations
    ├── convergence_plots/         # Trend visualizations
    └── iteration_N/               # Per-iteration outputs
        ├── validation.json        # Validation results
        ├── error_analysis/        # Error categorization
        │   ├── error_report.json
        │   ├── fn_crops/          # False negative crops
        │   ├── fn_size_distribution.png
        │   ├── fn_position_distribution.png
        │   ├── error_heatmap.png
        │   └── prompt_suggestions.json
        └── convergence_check.json # Convergence decision
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r ../requirements.txt
```

### 2. Run a Single Iteration

```bash
cd scripts
./run_iteration.sh 1
```

This will:
1. Run validation on the current model
2. Analyze errors and extract FN crops
3. Update convergence tracking
4. Check convergence criteria
5. Generate visualizations and reports

### 3. Review Results

Check the output directory:
- `output/iteration_1/error_analysis/` - Error analysis and FN crops
- `output/convergence_plots/` - Trend visualizations
- `output/convergence_tracking.csv` - Metrics CSV

### 4. Iterate

Based on error analysis:
1. Augment dataset with FN crops
2. Refine prompts using suggestions
3. Retrain model
4. Run next iteration: `./run_iteration.sh 2`

## Active Learning Workflow

```
┌─────────────────────────────────────────────────┐
│ 1. Initial Training                             │
│    - Train YOLOE on base dataset                │
│    - Save weights to weights/yoloe-26n.pt       │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ 2. Validation (batch_validate.py)               │
│    - Run model on validation set                │
│    - Calculate metrics (F1, precision, recall)  │
│    - Save results to validation.json            │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ 3. Error Analysis (error_analysis.py)           │
│    - Categorize FN by size/position/visual      │
│    - Extract FN crops for augmentation          │
│    - Generate error visualizations              │
│    - Suggest prompt improvements                │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ 4. Convergence Check (convergence_tracker.py)   │
│    - Update metrics tracking CSV                │
│    - Check convergence criteria:                │
│      ✓ Target F1 achieved (>= 0.98)             │
│      ✓ Plateau detected (< 0.5% improvement)    │
│      ✓ Overfitting (train-val gap > 5%)         │
│      ✓ Max iterations reached (>= 10)           │
└────────────────────┬────────────────────────────┘
                     │
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
    ┌─────────┐          ┌──────────────┐
    │  Done!  │          │ 5. Refine    │
    └─────────┘          │    - Augment │
                         │    - Prompts │
                         │    - Retrain │
                         └──────┬───────┘
                                │
                                └──────┐
                                       │
                                   (repeat)
```

## Convergence Criteria

The pipeline stops when any of these conditions are met:

1. **Target Achieved**: Validation F1 >= 0.98
2. **Plateau**: < 0.5% improvement over last 3 iterations
3. **Overfitting**: Train F1 - Val F1 > 5%
4. **Resource Limit**: 10 iterations completed

Configure these in `convergence_config.json`.

## Error Categorization

### Size Categories
- **tiny** (< 500 px²): Often missed, need explicit small object prompts
- **small** (500-2000 px²): May need scale-aware prompts
- **medium** (2000-10000 px²): Typical detection size
- **large** (> 10000 px²): Usually detected well

### Position Categories
- **edge**: Within 100px of boundary (may be partially cropped)
- **corner**: Near two boundaries (often challenging)
- **center**: Interior of image (ideal conditions)
- **overlapping**: IoU > 0.3 with detection (possibly NMS suppressed)

### Visual Characteristics
- **low contrast**: Std dev < 30 (hard to distinguish)
- **unusual aspect ratio**: < 0.2 or > 5.0 (elongated/compressed)

## Prompt Refinement Strategy

Based on error analysis, the system suggests prompt improvements:

**Example:**
```
Current: "detail callout symbol"
Issues: 15 tiny instances missed, 8 low-contrast instances
Suggested: "small detail callout symbol with various contrast levels"
```

Use `prompt_manager.py` to apply these systematically.

## Dataset Augmentation

False negative crops are extracted to `error_analysis/fn_crops/`:
- 50px context padding around bbox
- Organized by size category and class
- Ready for re-annotation and dataset inclusion

## Visualization Outputs

### Trend Plots (convergence_plots/)
- `f1_trend.png` - F1 over iterations
- `metrics_trend.png` - Precision/Recall/F1 comparison
- `counts_trend.png` - TP/FP/FN counts
- `per_class_f1_trend.png` - Per-class F1 trends
- `per_class_fn_trend.png` - Per-class FN trends

### Error Analysis (error_analysis/)
- `fn_size_distribution.png` - Size histogram
- `fn_position_distribution.png` - Position histogram
- `fn_class_distribution.png` - Class distribution
- `error_heatmap.png` - Spatial error map (50x50 grid)

## Example: Full Iteration

```bash
# Iteration 1
cd scripts
./run_iteration.sh 1

# Review error analysis
cat ../output/iteration_1/error_analysis/prompt_suggestions.json

# Augment dataset with FN crops
cp ../output/iteration_1/error_analysis/fn_crops/* ../../dataset_v6/images/

# Re-annotate FN crops (using Roboflow or similar)
# ... manual annotation step ...

# Retrain model with augmented dataset
cd ../..
python train.py --data dataset_v6 --epochs 50 --weights yoloe-26n.pt

# Run next iteration
cd active_learning/scripts
./run_iteration.sh 2
```

## Testing

Verify modules work correctly:

```bash
cd scripts
python3 test_modules.py
```

This runs comprehensive tests with mock data.

## Configuration

### convergence_config.json
```json
{
  "target_f1": 0.98,          // Stop when F1 reaches this
  "plateau_threshold": 0.005,  // Min improvement to continue (0.5%)
  "plateau_iterations": 3,     // Check over last N iterations
  "overfitting_threshold": 0.05, // Max train-val gap (5%)
  "max_iterations": 10         // Resource limit
}
```

### example_prompts.json
```json
{
  "detail": "detail callout symbol",
  "elevation": "elevation marker",
  "title": "title block"
}
```

## Troubleshooting

**Missing dependencies:**
```bash
pip install matplotlib seaborn opencv-python numpy
```

**Validation results not found:**
Ensure `batch_validate.py` has run successfully and saved to the expected location.

**FN crop extraction fails:**
Check that the validation image exists at the path specified in validation.json.

**Convergence check shows wrong decision:**
Review `convergence_config.json` thresholds and adjust as needed.

## References

- See `scripts/USAGE.md` for detailed API documentation
- See `scripts/README.md` for script overviews
- See individual script `--help` for command-line options
