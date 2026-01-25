# YOLOE-26 Active Learning Scripts

This directory contains scripts for active learning with YOLOE-26 vision-language model.

## train_active_learning.py

Comprehensive training script implementing two-stage active learning approach.

### Two-Stage Training Approach

**Stage 1: YOLO-26 Baseline (Iteration 0)**
- Traditional object detection without text prompts
- Train from scratch using yolo26n.pt
- 150 epochs with standard augmentations
- Target: ~96.5% F1 score
- Output: Baseline performance metrics

**Stage 2: YOLOE-26 with Prompts (Iterations 1+)**
- Vision-language model with text descriptions
- Fine-tune using YOLOE-26 architecture
- Text prompts loaded from prompt_manager
- 100 epochs per iteration
- Learning rate decay: lr = 0.001 * (0.5 ** iteration)
- Target: 98-99% F1 score

### Usage

```bash
# Iteration 0 - Baseline YOLO-26
python train_active_learning.py \
  --iteration 0 \
  --data ../../dataset_combined/data.yaml

# Iteration 1 - YOLOE-26 with prompts
python train_active_learning.py \
  --iteration 1 \
  --data ../../dataset_combined/data.yaml \
  --prompts ../prompt_versions/prompts_iteration_01.json

# Iteration 2+ - Continue from previous iteration
python train_active_learning.py \
  --iteration 2 \
  --data ../../dataset_combined/data.yaml \
  --continue-from ../iterations/iteration_1/weights/best.pt
```

### Command-Line Arguments

- `--iteration, -i`: Iteration number (required)
- `--data, -d`: Path to data.yaml file (required)
- `--prompts, -p`: Path to prompts JSON (optional, auto-loads from prompt_versions/)
- `--continue-from, -c`: Path to weights to continue from (optional)
- `--output-dir, -o`: Custom output directory (optional)
- `--prompts-dir`: Directory containing versioned prompts (default: prompt_versions)

### Output Structure

```
iterations/iteration_N/
├── weights/
│   ├── best.pt          # Best validation weights
│   └── last.pt          # Last epoch weights
├── metadata.json        # Model type, prompts, metrics, config
├── results.csv          # Training metrics per epoch
└── training_log.txt     # Console output
```

### Metadata Tracking

Each iteration saves comprehensive metadata including:
- Model type (yolo26 or yoloe26)
- Training configuration (epochs, lr, batch size)
- Text prompts used (for YOLOE iterations)
- Training metrics (mAP, loss values)
- Data augmentation settings
- Timestamp and iteration number

### Integration with Active Learning Pipeline

```bash
# Full iteration cycle
python train_active_learning.py --iteration 1 --data dataset/data.yaml
python batch_validate.py --iteration 1
python error_analysis.py --iteration 1
python augment_dataset.py --iteration 1  # Extract hard examples
python convergence_tracker.py --iteration 1

# If not converged, refine and continue
python train_active_learning.py --iteration 2 --data dataset/data.yaml
```

## prompt_manager.py

Manages text prompts for YOLOE model training and refinement.

### Key Features

1. **Load prompts from JSON** - Imports existing prompts from v5 (ca_ncs.json, us_ncs.json)
2. **Format for YOLOE** - Converts complex prompt structures to simple text descriptions
3. **Error-based refinement** - Analyzes false positives/negatives to improve prompts
4. **Version tracking** - Saves prompt versions across iterations

### Usage

```python
from prompt_manager import (
    load_prompts_from_json,
    get_initial_prompts,
    refine_prompts_from_errors,
    save_prompt_version
)

# Load prompts from existing JSON
prompts = load_prompts_from_json('../../callout-processor-v5/prompts/ca_ncs.json')

# Or use initial prompts
prompts = get_initial_prompts()

# Save initial version
save_prompt_version(
    iteration=0,
    prompts=prompts,
    output_dir='../prompt_versions'
)

# After validation, refine based on errors
error_report = {
    'false_positives': [...],
    'false_negatives': [...]
}

refined = refine_prompts_from_errors(error_report, prompts, iteration=1)

# Save refined version
save_prompt_version(
    iteration=1,
    prompts=refined['prompts'],
    output_dir='../prompt_versions',
    refinement_notes=refined['refinement_notes']
)
```

### Prompt Format

YOLOE expects simple, concise text descriptions focusing on key visual features:

```python
{
    'detail': 'A detail callout circle with horizontal line dividing it...',
    'elevation': 'An elevation indicator symbol with solid circle...',
    'section': 'A section callout with circular symbol...',
    'title': 'A small circular callout symbol at bottom or corner...'
}
```

### Testing

Run the module directly to test:

```bash
cd /home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/active_learning/scripts
python prompt_manager.py
```

This will:
- Load prompts from ca_ncs.json
- Save iteration 0 prompts
- Simulate error analysis
- Generate and save iteration 1 refinements

### Output

Prompt versions are saved to `../prompt_versions/` with format:
```
prompts_iteration_00.json
prompts_iteration_01.json
prompts_iteration_02.json
...
```

Each file contains:
```json
{
  "iteration": 0,
  "timestamp": "2026-01-23T02:52:29.772916",
  "prompts": {
    "detail": "...",
    "elevation": "...",
    "section": "...",
    "title": "..."
  },
  "refinement_notes": {
    "title": ["High false negatives (6). Consider making prompt more inclusive..."]
  }
}
```

## augment_dataset.py

Dataset augmentation module for extracting hard examples and preparing them for manual annotation in Roboflow.

### Key Features

1. **Extract FN crops** - Extracts false negatives with 50px context padding
2. **Generate metadata** - Creates CSV tracking for Roboflow workflow
3. **Human-in-the-loop** - Integrates manual review and annotation
4. **Dataset merging** - Combines new annotations with original dataset

### Usage

```bash
# Extract hard examples for annotation
python augment_dataset.py \
  error_analysis/iteration_1/error_report.json \
  validation_image.png \
  --iteration 1 \
  --output-dir error_analysis/iteration_1 \
  --min-severity tiny

# Merge new annotations with original dataset
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

### Workflow

1. **Extract crops**: Run augment_dataset.py to extract FN crops with context
2. **Upload to Roboflow**: Upload crops for manual review
3. **Review annotations**: Correct labels, adjust bboxes, add missing annotations
4. **Export dataset**: Download corrected annotations in YOLOv11 format
5. **Merge datasets**: Combine new annotations with original dataset
6. **Retrain**: Run next iteration with augmented dataset

### Output

```
error_analysis/iteration_N/for_annotation/
├── fn_001_000_detail.jpg      # Crop with 50px padding
├── fn_001_001_elevation.jpg
├── ...
└── metadata.csv               # Tracking metadata
```

Metadata CSV includes:
- filename, original_image, ground_truth_class
- bbox coordinates (x, y, w, h)
- confidence score, iteration number
- crop timestamp

See [AUGMENT_DATASET_USAGE.md](AUGMENT_DATASET_USAGE.md) for complete documentation.
