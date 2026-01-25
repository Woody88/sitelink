# augment_dataset.py Quick Reference

## Quick Commands

### Extract hard examples for annotation
```bash
python augment_dataset.py \
  error_analysis/iteration_1/error_report.json \
  validation_image.png \
  --iteration 1 \
  --output-dir error_analysis/iteration_1
```

### Extract only tiny objects (highest priority)
```bash
python augment_dataset.py \
  error_report.json image.png \
  --iteration 1 \
  --output-dir error_analysis/iteration_1 \
  --min-severity tiny
```

### Merge datasets after Roboflow annotation
```bash
python augment_dataset.py \
  error_report.json image.png \
  --iteration 1 --output-dir output \
  --merge \
  --original-dataset dataset_v6 \
  --new-annotations roboflow_export/iteration_1 \
  --merged-output dataset_v7
```

## Python API

### Extract crops
```python
from augment_dataset import augment_dataset_manual

annotation_dir = augment_dataset_manual(
    hard_examples=[
        {'bbox': [100, 100, 50, 50], 'class': 'detail'}
    ],
    iteration_num=1,
    output_dir='error_analysis/iteration_1',
    image_path='validation_image.png'
)
```

### Get hard examples from error report
```python
from augment_dataset import extract_hard_examples_from_error_report

hard_examples = extract_hard_examples_from_error_report(
    'error_analysis/iteration_1/error_report.json',
    min_severity='tiny'
)
```

### Merge datasets
```python
from augment_dataset import merge_datasets

merged_path = merge_datasets(
    'dataset_v6',
    'roboflow_export/iteration_1',
    'dataset_v7'
)
```

## Roboflow Workflow (5 Steps)

1. **Upload**: `error_analysis/iteration_N/for_annotation/*.jpg` → Roboflow
2. **Review**: Check labels, adjust bboxes, add missing annotations
3. **Export**: Generate version → Export as YOLOv11 → Download to `roboflow_export/iteration_N/`
4. **Merge**: Run merge command (see above)
5. **Retrain**: `python train_active_learning.py --iteration N+1 --data dataset_vN+1/data.yaml`

## Output Structure

```
error_analysis/iteration_N/for_annotation/
├── fn_001_000_detail.jpg      # [iter]_[idx]_[class].jpg
├── fn_001_001_elevation.jpg
├── ...
└── metadata.csv               # Tracking information
```

## Severity Levels

| Level | Size Range | Priority |
|-------|------------|----------|
| `tiny` | < 500 px² | Highest |
| `small` | 500-2000 px² | High |
| `medium` | 2000-10000 px² | Medium |
| `large` | > 10000 px² | Low |
| `all` | All sizes + low contrast + unusual aspect | Default |

## metadata.csv Fields

- `filename`: Crop filename
- `original_image`: Source image path
- `ground_truth_class`: Expected class
- `bbox_x, bbox_y, bbox_w, bbox_h`: Original coordinates
- `confidence`: Model confidence (0.0 for FN)
- `iteration`: Iteration number
- `crop_timestamp`: Extraction time

## Common Issues

### No hard examples extracted
```bash
# Try 'all' severity
python augment_dataset.py ... --min-severity all
```

### Merge fails with duplicates
Rename files in Roboflow export before merging

### Crops too small/large
Modify padding in code (default: 50px)

## Testing

```bash
python test_augment_dataset.py
```

Expected: `7 passed, 0 failed`

## Documentation

- **Complete guide**: `AUGMENT_DATASET_USAGE.md`
- **Implementation**: `AUGMENT_DATASET_IMPLEMENTATION.md`
- **Workflow script**: `example_augmentation_workflow.sh`
- **Main docs**: `README.md`

## Integration

```bash
# Full iteration cycle
bash example_augmentation_workflow.sh

# After manual annotation
bash example_augmentation_workflow.sh --merge
```
