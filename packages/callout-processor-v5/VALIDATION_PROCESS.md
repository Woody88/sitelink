# Complete Validation Process Documentation

**Purpose:** Document the exact process for validating callout detection models against Roboflow ground truth to ensure reproducible results.

## Overview

This process validates a trained YOLO model's performance by comparing its detections against authoritative Roboflow annotations, calculating precision/recall/F1 metrics, and generating visual comparisons.

## Prerequisites

- Trained YOLO model weights (e.g., `runs/detect/v5_combined2/weights/best.pt`)
- Roboflow dataset with ground truth annotations in YOLO format
- Test PDF with pages to validate
- Python environment with dependencies installed

## Critical Rule: Source of Truth

**ALWAYS use Roboflow annotations as ground truth** - they are the authoritative labels used for training.

**NEVER use:**
- v4 annotation files
- Manually created annotations
- Outputs from previous models

**Only use:**
- Annotations from Roboflow dataset export (YOLO format)
- Files in `dataset_v*/train/labels/` or `dataset_v*/valid/labels/`

## Complete Validation Workflow

### Step 1: Identify Roboflow Ground Truth Files

Find the correct annotation files for your test pages from the Roboflow dataset.

**File naming pattern:**
```
dataset_v6/train/labels/<pdf_filename>_page_<page_index>_png.rf.<hash>.txt
```

**Important:** PDF pages are 0-indexed in filenames:
- `page_00` = Page 1
- `page_01` = Page 2
- `page_02` = Page 3
- `page_03` = Page 4

**Example for 4-page PDF:**
```bash
# Find ground truth annotations
find dataset_v6 -name "*4pages*page_01*.txt"  # Page 2
find dataset_v6 -name "*4pages*page_02*.txt"  # Page 3
find dataset_v6 -name "*4pages*page_03*.txt"  # Page 4
```

**Verify ground truth:**
```bash
# Count callouts by class (0=detail, 1=elevation, 2=title)
awk '{print $1}' dataset_v6/train/labels/FILE.txt | sort | uniq -c
```

### Step 2: Visualize Ground Truth Annotations

Generate visual representations of the Roboflow annotations to confirm they're correct.

**Script:** `visualize_ground_truth.py`

```bash
python visualize_ground_truth.py \
  <path_to_rendered_page_image.png> \
  <path_to_roboflow_annotation.txt> \
  <output_visualization.png>
```

**Example:**
```bash
python visualize_ground_truth.py \
  "test_v5_output/4page_canadian/4-Structural-Drawings - 4pages_page2.png" \
  "dataset_v6/train/labels/4_Structural_Drawings___4pages_page_01_png.rf.166ee339f73ef90b5695c3fcd48afb46.txt" \
  "validation_page2_ground_truth.png"
```

**Output:**
- PNG file with green/blue/red boxes showing ground truth annotations
- Console output with callout counts by class

**Visual verification:** Check that annotations match what you labeled in Roboflow.

### Step 3: Run Model Detection and Save JSON

Run the trained model on test pages and save detections in JSON format for validation.

**Script:** `generate_detection_json.py`

```bash
python generate_detection_json.py \
  <pdf_path> \
  <page_number> \
  <output_json> \
  <output_image>
```

**Example:**
```bash
python generate_detection_json.py \
  "/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf" \
  2 \
  "validation_page2_detections.json" \
  "validation_page2_image.png"
```

**Important settings in script:**
- DPI: 72 (v4's proven setting)
- SAHI tiling: TILE_SIZE=2048, OVERLAP=0.2
- Confidence threshold: 0.25
- Post-processing filters: ENABLED

**Output:**
- JSON file with detections: `{'detections': [{'bbox': [x,y,w,h], 'class': 'detail'|'elevation'|'title', 'confidence': float}, ...]}`
- PNG file with raw rendered page (no annotations)
- Console summary of detection counts

### Step 4: Validate Against Ground Truth

Compare model detections to Roboflow ground truth and calculate metrics.

**Script:** `src/validate_with_ground_truth.py`

```bash
python src/validate_with_ground_truth.py \
  <page_image.png> \
  <detection_json> \
  <roboflow_annotation.txt> \
  --output <validation_result.png>
```

**Example:**
```bash
python src/validate_with_ground_truth.py \
  validation_page2_image.png \
  validation_page2_detections.json \
  dataset_v6/train/labels/4_Structural_Drawings___4pages_page_01_png.rf.166ee339f73ef90b5695c3fcd48afb46.txt \
  --output validation_page2_result.png
```

**IoU threshold:** 0.5 (default, hardcoded in script)

**Output:**
- Console output with precision/recall/F1 metrics (overall and per-class)
- PNG visualization with:
  - Green boxes: True Positives (correct detections)
  - Red boxes: False Positives (incorrect detections)
  - Blue boxes: False Negatives (missed ground truth)

**Metrics interpretation:**
- **Precision = TP / (TP + FP)** - How many detections were correct
- **Recall = TP / (TP + FN)** - How many ground truth callouts were found
- **F1 = 2 * P * R / (P + R)** - Harmonic mean of precision and recall

### Step 5: Generate Side-by-Side Comparisons

Create visual comparisons showing ground truth, model output, and validation results together.

**Script:** `create_comparison_images.py`

```bash
python create_comparison_images.py
```

**Hardcoded paths in script:**
- Ground truth visualizations: `validation_page*_ground_truth.png`
- Model annotated outputs: `test_v5_sahi_output/4page_canadian/page*_annotated.png`
- Validation results: `validation_page*_result.png`

**Output:**
- `comparison_page2.png` - Three-panel comparison
- `comparison_page3.png` - Three-panel comparison
- `comparison_page4.png` - Three-panel comparison

**Format:**
```
[Ground Truth (Roboflow)] | [v5 Detections] | [Validation (TP/FP/FN)]
```

### Step 6: Calculate Combined Metrics

Manually sum metrics across all validated pages.

**Example calculation:**
```
Page 2: GT=89, TP=88, FP=3, FN=1
Page 3: GT=35, TP=32, FP=1, FN=3
Page 4: GT=20, TP=19, FP=1, FN=1

Combined:
  GT total = 144
  TP total = 139
  FP total = 5
  FN total = 5

  Precision = 139 / (139 + 5) = 96.5%
  Recall = 139 / (139 + 5) = 96.5%
  F1 = 96.5%
```

### Step 7: Document Results

Create comprehensive documentation with:
- Overall metrics (precision/recall/F1)
- Per-page breakdown
- Per-class breakdown
- Comparison to targets
- Visual evidence (comparison images)
- Recommendations

**Template:** See `VALIDATION_RESULTS_CORRECT.md`

## File Organization

### Input Files (Keep)
```
dataset_v6/train/labels/*.txt          # Roboflow ground truth annotations
dataset_v6/train/images/*.png          # Training images (if needed)
callout-detection*.v*i.yolo26.zip      # Roboflow dataset exports
runs/detect/v5_combined2/weights/best.pt  # Trained model
```

### Generated Files (Validation Session)
```
validation_page*_ground_truth.png      # Ground truth visualizations
validation_page*_image.png             # Raw rendered pages
validation_page*_detections.json       # Model detection results
validation_page*_result.png            # TP/FP/FN visualizations
comparison_page*.png                   # Side-by-side comparisons
```

### Documentation Files
```
VALIDATION_RESULTS_CORRECT.md          # Full metrics and analysis
COMPARISON_V4_VS_ROBOFLOW_GROUND_TRUTH.md  # Explains wrong vs right GT
NEXT_STEPS.md                          # Decision matrix
SUMMARY.md                             # Quick reference
VALIDATION_PROCESS.md                  # This file
```

## Scripts Reference

### `visualize_ground_truth.py`
**Purpose:** Render Roboflow YOLO annotations on images
**Inputs:** Image, YOLO annotation file
**Outputs:** Annotated PNG with class counts
**Usage:** Visual verification of ground truth

### `generate_detection_json.py`
**Purpose:** Run model detection with SAHI and save JSON
**Inputs:** PDF, page number, model path
**Outputs:** Detection JSON, raw page image
**Settings:** DPI=72, SAHI tiling, filters enabled

### `src/validate_with_ground_truth.py`
**Purpose:** Calculate TP/FP/FN metrics and visualize
**Inputs:** Image, detection JSON, ground truth annotation
**Outputs:** Metrics (console), validation PNG
**IoU threshold:** 0.5

### `create_comparison_images.py`
**Purpose:** Create three-panel comparison images
**Inputs:** Ground truth PNG, model PNG, validation PNG
**Outputs:** Side-by-side comparison
**Note:** Edit script to customize paths

## Common Issues and Solutions

### Issue: "Catastrophic failure" with low recall
**Cause:** Using wrong ground truth annotations (e.g., v4 files instead of Roboflow)
**Solution:** Always use Roboflow dataset annotations from `dataset_v*/train/labels/`

### Issue: Ground truth counts don't match expectations
**Cause:** Using augmented training images instead of original annotations
**Solution:** Use the base annotation file (shortest hash), avoid augmented versions

### Issue: Page numbers don't match
**Cause:** PDF pages are 0-indexed in filenames
**Solution:** `page_00` = Page 1, `page_01` = Page 2, etc.

### Issue: Can't find annotation file
**Cause:** Filename contains PDF name with special characters
**Solution:** Use `find` with wildcards: `find dataset_v6 -name "*4pages*page_01*.txt"`

### Issue: Model detects nothing
**Cause:** Wrong model path or model not trained
**Solution:** Verify model path points to `runs/detect/v*/weights/best.pt`

## Retraining Workflow (If Needed)

If validation reveals performance issues:

### 1. Extract False Negatives
```bash
python src/validate_with_ground_truth.py \
  <image> <detection_json> <annotation> \
  --output <result.png> \
  --extract-fn <output_dir>
```

This saves crops of missed callouts to `<output_dir>/`.

### 2. Upload to Roboflow
- Log into Roboflow project
- Upload FN crops as new images
- Annotate with correct class
- Generate new dataset version

### 3. Download New Dataset
```bash
# Download from Roboflow UI
# Save as callout-detection.v<N>i.yolo26.zip
unzip callout-detection.v<N>i.yolo26.zip -d dataset_v<N>
```

### 4. Retrain Model
```bash
python train_v5.py  # Or appropriate training script
# Uses dataset_v<N> path
```

### 5. Re-validate
Repeat this entire validation process with new model weights.

## Quality Checklist

Before accepting validation results:

- [ ] Ground truth annotations are from Roboflow dataset
- [ ] Visualized ground truth matches what you labeled
- [ ] Used correct page numbers (accounting for 0-indexing)
- [ ] Model detections ran with same settings as production (DPI=72, SAHI, filters)
- [ ] IoU threshold is 0.5
- [ ] Calculated combined metrics across all test pages
- [ ] Visual comparisons show expected TP/FP/FN patterns
- [ ] Documented results with metrics and images
- [ ] Compared to performance targets (>70% precision, >90% recall)

## Performance Targets

**Minimum acceptable:**
- Precision: >70%
- Recall: >90%

**Excellent (v5 achieved):**
- Precision: 96.5%
- Recall: 96.5%

**Production ready:**
- Both metrics exceed minimum targets
- Per-class performance is acceptable for all classes
- Visual validation confirms TP/FP/FN make sense

## Notes

- **Always validate on pages NOT in training set** (use valid split or separate PDFs)
- **DPI=72 is proven** - don't change unless testing different settings
- **SAHI tiling is required** for large pages (3456x2592 at 72 DPI)
- **Post-processing filters improve precision** - keep enabled unless testing raw model
- **IoU=0.5 is standard** for object detection validation
- **Combined metrics** are more important than individual page metrics
- **Visual validation** is critical - numbers can lie, images don't

## Version History

- **2026-01-22:** Initial documentation for v5 validation process
- Model: v5_combined2
- Dataset: dataset_v6 (Roboflow export)
- Results: 96.5% precision/recall
