# augment_dataset.py Usage Guide

Dataset augmentation module for active learning pipeline. Extracts false negative crops with context and prepares them for manual annotation in Roboflow.

## Overview

This module implements a **human-in-the-loop** workflow for improving the dataset with hard examples:

1. Extract FN crops with 50px padding (context window)
2. Generate metadata CSV for tracking
3. Upload to Roboflow for review and annotation
4. Export corrected annotations
5. Merge with original dataset

## Key Functions

### 1. extract_crop_with_padding()

Extract a crop with context padding around a bbox.

```python
from augment_dataset import extract_crop_with_padding

crop = extract_crop_with_padding(
    image_path='/path/to/image.png',
    bbox=[100, 100, 50, 50],  # x, y, w, h
    padding=50
)
# Returns: np.ndarray (150x150 with 50px padding on all sides)
```

**Args:**
- `image_path`: Path to source image
- `bbox`: Tuple of (x, y, w, h)
- `padding`: Pixels of context padding (default: 50)

### 2. augment_dataset_manual()

Main workflow function - extracts crops and prepares for Roboflow.

```python
from augment_dataset import augment_dataset_manual

hard_examples = [
    {'bbox': [100, 100, 50, 50], 'class': 'detail'},
    {'bbox': [200, 200, 45, 45], 'class': 'elevation'},
]

annotation_dir = augment_dataset_manual(
    hard_examples=hard_examples,
    iteration_num=1,
    output_dir='error_analysis/iteration_1',
    image_path='validation_image.png'
)
# Returns: 'error_analysis/iteration_1/for_annotation'
```

**Output structure:**
```
error_analysis/iteration_1/for_annotation/
├── fn_001_000_detail.jpg        # Crop with 50px padding
├── fn_001_001_elevation.jpg
├── ...
└── metadata.csv                 # Tracking metadata
```

**metadata.csv format:**
```csv
filename,original_image,ground_truth_class,bbox_x,bbox_y,bbox_w,bbox_h,confidence,iteration,crop_timestamp
fn_001_000_detail.jpg,/path/to/image.png,detail,100,100,50,50,0.0,1,2026-01-23T12:00:00
```

### 3. extract_hard_examples_from_error_report()

Extract hard examples from error_report.json with severity filtering.

```python
from augment_dataset import extract_hard_examples_from_error_report

hard_examples = extract_hard_examples_from_error_report(
    error_report_path='error_analysis/iteration_1/error_report.json',
    min_severity='tiny'  # Only extract tiny+small+medium+large
)
# Returns: List of dicts with bbox, class, and metadata
```

**Severity levels:**
- `'tiny'`: < 500 px² (includes small, medium, large)
- `'small'`: 500-2000 px² (includes medium, large)
- `'medium'`: 2000-10000 px² (includes large)
- `'large'`: > 10000 px²
- `'all'`: All sizes + low contrast + unusual aspect

### 4. merge_datasets()

Merge new annotations with original dataset.

```python
from augment_dataset import merge_datasets

merged_path = merge_datasets(
    original_dataset='dataset_v6',
    new_annotations='roboflow_export/iteration_1',
    output_dataset='dataset_v7'
)
# Returns: 'dataset_v7'
```

**Dataset structure:**
```
dataset_v7/
├── data.yaml
├── train/
│   ├── images/
│   └── labels/
├── val/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

## Command-Line Usage

### Extract Mode (Default)

Extract crops for manual annotation:

```bash
# Basic usage
python augment_dataset.py \
  error_analysis/iteration_1/error_report.json \
  validation_image.png \
  --iteration 1 \
  --output-dir error_analysis/iteration_1

# Extract only tiny objects
python augment_dataset.py \
  error_analysis/iteration_1/error_report.json \
  validation_image.png \
  --iteration 1 \
  --output-dir error_analysis/iteration_1 \
  --min-severity tiny
```

**Output:**
- Crops saved to `error_analysis/iteration_1/for_annotation/`
- Metadata CSV with tracking information
- Prints Roboflow workflow instructions

### Merge Mode

Merge new annotations with original dataset:

```bash
python augment_dataset.py \
  error_report.json \
  image.png \
  --iteration 1 \
  --output-dir output \
  --merge \
  --original-dataset dataset_v6 \
  --new-annotations roboflow_export \
  --merged-output dataset_v7
```

**Output:**
- Merged dataset in `dataset_v7/`
- Prints statistics for each split
- Shows next training steps

## Complete Workflow Example

### Step 1: Run Validation and Error Analysis

```bash
# Run validation
python batch_validate.py \
  --model iterations/iteration_1/weights/best.pt \
  --dataset dataset_v6 \
  --output error_analysis/iteration_1/validation.json

# Analyze errors
python error_analysis.py \
  error_analysis/iteration_1/validation.json \
  error_analysis/iteration_1/image.png \
  --output-dir error_analysis/iteration_1 \
  --extract-crops
```

### Step 2: Extract Hard Examples

```bash
python augment_dataset.py \
  error_analysis/iteration_1/error_report.json \
  error_analysis/iteration_1/image.png \
  --iteration 1 \
  --output-dir error_analysis/iteration_1 \
  --min-severity tiny
```

**Output:**
```
Extracted 15 hard examples:
  - Size categories: ['tiny', 'small', 'medium', 'large']
  - Low contrast: 3
  - Unusual aspect: 2

Extracting 15 hard examples for manual annotation...
✓ Extracted 15 crops
✓ Saved to: error_analysis/iteration_1/for_annotation
✓ Metadata: error_analysis/iteration_1/for_annotation/metadata.csv

======================================================================
ROBOFLOW ANNOTATION WORKFLOW
======================================================================
[Detailed instructions printed here]
```

### Step 3: Roboflow Workflow

1. **Upload crops to Roboflow:**
   - Go to your Roboflow workspace
   - Upload all images from `error_analysis/iteration_1/for_annotation/`
   - Tag with: `iteration_01_fn`

2. **Review and correct annotations:**
   - Check if ground truth class is correct
   - Adjust bboxes if needed (crops have 50px padding)
   - Add missing annotations if multiple objects in crop
   - Fix any labeling errors

3. **Export new dataset version:**
   - Generate new version in Roboflow
   - Export as **YOLOv11 format**
   - Download to `roboflow_export/iteration_1/`

### Step 4: Merge Datasets

```bash
python augment_dataset.py \
  error_report.json \
  image.png \
  --iteration 1 \
  --output-dir output \
  --merge \
  --original-dataset dataset_v6 \
  --new-annotations roboflow_export/iteration_1 \
  --merged-output dataset_v7
```

**Output:**
```
======================================================================
MERGING DATASETS
======================================================================

Merging train split...
  Original images: 180
  New images: 12
  Merged total: 192 images, 192 labels

Merging val split...
  Original images: 20
  New images: 3
  Merged total: 23 images, 23 labels

✓ Copied data.yaml
✓ Dataset merged successfully
✓ Output: dataset_v7

Next steps:
  1. Update data.yaml if needed
  2. Run training with merged dataset:
     python train_active_learning.py --iteration 2 --data dataset_v7/data.yaml
```

### Step 5: Retrain with Augmented Dataset

```bash
python train_active_learning.py \
  --iteration 2 \
  --data dataset_v7/data.yaml \
  --continue-from iterations/iteration_1/weights/best.pt
```

## Integration with Active Learning Pipeline

```bash
#!/bin/bash
# Full iteration cycle with dataset augmentation

ITERATION=1
BASE_DIR="active_learning_output"
DATASET="dataset_v6"

# 1. Validation
python batch_validate.py \
  --model iterations/iteration_$ITERATION/weights/best.pt \
  --dataset $DATASET \
  --output "$BASE_DIR/iteration_$ITERATION/validation.json"

# 2. Error analysis
python error_analysis.py \
  "$BASE_DIR/iteration_$ITERATION/validation.json" \
  "$BASE_DIR/iteration_$ITERATION/image.png" \
  --output-dir "$BASE_DIR/iteration_$ITERATION" \
  --extract-crops

# 3. Check convergence
python convergence_tracker.py \
  --csv "$BASE_DIR/convergence_tracking.csv" \
  --output-dir "$BASE_DIR/convergence_plots" \
  --update "$BASE_DIR/iteration_$ITERATION/validation.json" \
  --iteration $ITERATION \
  --check-convergence

# 4. If not converged, augment dataset
SHOULD_STOP=$(jq -r '.should_stop' "$BASE_DIR/convergence_plots/convergence_check_iter_$ITERATION.json")

if [ "$SHOULD_STOP" = "false" ]; then
  echo "Extracting hard examples for annotation..."

  python augment_dataset.py \
    "$BASE_DIR/iteration_$ITERATION/error_report.json" \
    "$BASE_DIR/iteration_$ITERATION/image.png" \
    --iteration $ITERATION \
    --output-dir "$BASE_DIR/iteration_$ITERATION" \
    --min-severity tiny

  echo ""
  echo "============================================"
  echo "MANUAL STEP REQUIRED"
  echo "============================================"
  echo "1. Upload crops to Roboflow"
  echo "2. Review and correct annotations"
  echo "3. Export and download new dataset"
  echo "4. Run merge command:"
  echo ""
  echo "   python augment_dataset.py \\"
  echo "     error_report.json image.png \\"
  echo "     --iteration $ITERATION \\"
  echo "     --output-dir output \\"
  echo "     --merge \\"
  echo "     --original-dataset $DATASET \\"
  echo "     --new-annotations roboflow_export/iteration_$ITERATION \\"
  echo "     --merged-output dataset_v$((ITERATION+1))"
  echo ""
  echo "5. Retrain with augmented dataset"
fi
```

## Best Practices

### Crop Selection Strategy

Focus on these high-priority categories:

1. **Tiny objects** (<500 px²): Often missed, need explicit examples
2. **Low contrast**: Hard to distinguish from background
3. **Edge cases**: Near image boundaries
4. **Overlapping**: May be suppressed by NMS
5. **Unusual aspect ratios**: Elongated or compressed shapes

### Annotation Guidelines

When reviewing crops in Roboflow:

1. **Verify ground truth class**: Original labels may be wrong
2. **Adjust bbox precisely**: 50px padding provides context
3. **Add missing annotations**: Crop may contain multiple objects
4. **Fix labeling errors**: Correct any mistakes in original dataset
5. **Consistent style**: Follow project annotation conventions

### Dataset Merging

- Always backup original dataset before merging
- Check for duplicate filenames (merging will skip)
- Verify `data.yaml` paths are correct
- Validate merged dataset with test script

### Monitoring Improvements

After retraining with augmented dataset:

```bash
# Compare metrics
python convergence_tracker.py \
  --csv convergence_tracking.csv \
  --output-dir convergence_plots
```

**Expected improvements:**
- Recall increase on FN categories
- Reduced miss rate for tiny/low-contrast objects
- Better performance on edge cases
- Higher overall F1 score

## Common Issues

### Issue: No hard examples extracted

**Cause:** Error report may be empty or all FNs filtered out

**Solution:**
```bash
# Try 'all' severity level
python augment_dataset.py ... --min-severity all
```

### Issue: Crops are too small/large

**Cause:** Padding not appropriate for object size

**Solution:** Modify padding in code:
```python
augment_dataset_manual(..., padding=100)  # Larger context
```

### Issue: Merge fails with duplicate filenames

**Cause:** New annotations contain filenames already in original dataset

**Solution:** Rename files in Roboflow export before merging

### Issue: Dataset YAML not found after merge

**Cause:** Original dataset missing `data.yaml`

**Solution:** Copy from backup or regenerate:
```yaml
train: train/images
val: val/images
test: test/images
nc: 3
names: [detail, elevation, title]
```

## Testing

Run the test suite to verify module works:

```bash
python test_augment_dataset.py
```

**Tests cover:**
- Crop extraction with padding
- Edge/corner case handling
- CSV metadata generation
- Hard example extraction
- Dataset merging
- Invalid input handling

## Dependencies

Required packages:

```bash
pip install opencv-python numpy
```

Already included in `active_learning/requirements.txt`.

## Related Modules

- **error_analysis.py**: Generates error_report.json
- **batch_validate.py**: Produces validation results
- **convergence_tracker.py**: Monitors training progress
- **train_active_learning.py**: Retrains with augmented dataset

## Output Files Reference

### for_annotation/ Directory

```
for_annotation/
├── fn_001_000_detail.jpg        # [iteration]_[index]_[class]
├── fn_001_001_elevation.jpg
├── fn_001_002_title.jpg
├── ...
└── metadata.csv
```

### metadata.csv

| Column | Description | Example |
|--------|-------------|---------|
| filename | Crop image filename | `fn_001_000_detail.jpg` |
| original_image | Source image path | `/path/to/image.png` |
| ground_truth_class | Expected class | `detail` |
| bbox_x | Original bbox x | `100` |
| bbox_y | Original bbox y | `100` |
| bbox_w | Original bbox width | `50` |
| bbox_h | Original bbox height | `50` |
| confidence | Model confidence (0.0 for FN) | `0.0` |
| iteration | Iteration number | `1` |
| crop_timestamp | Extraction timestamp | `2026-01-23T12:00:00` |

## Troubleshooting

Enable debug output:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Check intermediate outputs:

```bash
# Verify crops were extracted
ls -lh error_analysis/iteration_1/for_annotation/

# Check metadata
cat error_analysis/iteration_1/for_annotation/metadata.csv

# Validate crop images
file error_analysis/iteration_1/for_annotation/*.jpg
```
