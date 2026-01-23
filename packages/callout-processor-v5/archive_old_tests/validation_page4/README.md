# Page 4 Validation Results - False Negative Extraction

## Purpose

This directory contains the results of running validation on Page 4 of the 4-Structural-Drawings PDF, using the "learn from mistakes" feedback loop approach.

## What Happened

The v5 model was tested on Page 4 and achieved catastrophic failure:
- **Overall**: 5.0% precision, 1.9% recall (1 TP out of 20 detections)
- **Detail callouts**: 0% recall (0/27 detected)
- **Elevation callouts**: 3.8% recall (1/26 detected)
- **Title callouts**: 0% recall (0/1 detected)

## Files

### page4_ground_truth.txt
YOLO format annotation from v4 dataset with 53 callouts:
- 27 detail callouts (class 0)
- 26 elevation callouts (class 1)
- 1 title callout (class 2)

Format: `class_id x_center y_center width height` (all normalized 0-1)

### page4_rendered.png
Page 4 rendered at 72 DPI from PDF for detection.

### page4_detections.json
v5 model detections (20 total, only 1 correct).

### page4_validation.png
TP/FP/FN visualization with color-coded boxes:
- **Green**: True Positives (1 total) - Correct detections
- **Red**: False Positives (19 total) - Wrong detections
- **Blue**: False Negatives (53 total) - Missed callouts

### missed_callouts/
**53 extracted crop images** of callouts the model missed.

Each crop is named: `page4_rendered_fn_{index}_{class}_(x,y,w,h).png`

Examples:
- `page4_rendered_fn_0_title_(556,2178,291,46).png` - Missed title callout
- `page4_rendered_fn_26_detail_(1015,481,27,22).png` - Missed detail callout
- `page4_rendered_fn_1_elevation_(665,1834,56,38).png` - Missed elevation callout

Crops include 20% padding around the bounding box for context.

## Next Steps

1. **Upload to Roboflow**:
   - Upload all 53 crops from `missed_callouts/` directory
   - Roboflow will auto-detect class labels from filenames
   - Verify annotations are correct
   - Add to training dataset

2. **Retrain v5 Model**:
   ```bash
   python train_v5.py
   ```

3. **Re-test on Page 4**:
   ```bash
   python run_page4_validation.py
   ```

4. **Expected Results**:
   - Detail recall: 0% → 85%+
   - Elevation recall: 3.8% → 90%+
   - Overall recall: 1.9% → 85%+

## Root Cause

V5's training data (dataset_v6) only had elevation and title callouts annotated for Page 4, completely missing all 27 detail callouts. The model never learned what Page 4 detail callouts look like at 72 DPI rendering.

The extracted crops will teach the model:
- Page 4 detail callout appearance (horizontal dividers at 72 DPI)
- Page 4 elevation callout style
- Correct scale and resolution (2048px tiles from 72 DPI render)

## Commands Used

```bash
# Run complete validation workflow
python run_page4_validation.py

# Copy ground truth from v4
cp ../callout-processor-v4/dataset/train/labels/4_Structural_Drawings_page_04_png.rf.58433d975643e6c0d64e5878df2b9403.txt \
   validation_page4/page4_ground_truth.txt

# Run validation with FN extraction
python src/validate_with_ground_truth.py \
  validation_page4/page4_rendered.png \
  validation_page4/page4_detections.json \
  validation_page4/page4_ground_truth.txt \
  --output validation_page4/page4_validation.png \
  --extract-fn validation_page4/missed_callouts
```

## Reference

- Bead ticket: sitelink-xvb
- Comparison doc: V5_VS_V4_COMPARISON.md
- Workflow script: run_page4_validation.py
- Validation script: src/validate_with_ground_truth.py
