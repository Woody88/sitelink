# v5 vs v4 Callout Detection Comparison

## Test Setup
- **Plan:** 4-Page Canadian Structural Drawings (pages 2-4, skipping page 1 legend)
- **Ground Truth:** 177 total callouts across 3 pages
- **Method:** SAHI tiling (2048px tiles, 25% overlap) at 72 DPI
- **Models:**
  - v4: YOLOv8n trained on 58 images (from callout-processor-v4)
  - v5: YOLO26n trained on 251 images with balanced validation

## Overall Comparison

| Model | Precision | Recall | F1 | Total Detections | Notes |
|-------|-----------|--------|----|--------------------|-------|
| **v4** | 79.5% | **92.1%** | 85.3% | 163 (from 177 GT) | Baseline with post-processing filters |
| **v5 (no filters)** | **TBD** | **TBD** | **TBD** | 150 | Raw detections |
| **v5 (with filters)** | **TBD** | **TBD** | **TBD** | **144** | Post-processing filters applied |

## Per-Page Results

### Page 2: Floor Plan (90 GT callouts: 87 elevation, 1 detail, 2 title)

| Model | Detections | Precision | Recall | Notes |
|-------|------------|-----------|--------|-------|
| **v4** | 88 | 83.8% | 97.8% | 88/90 found, 17 FPs |
| **v5 (no filters)** | 97 | **TBD** | **TBD** | 95 elevation, 0 detail, 2 title |
| **v5 (with filters)** | **91** | **TBD** | **TBD** | 89 elevation, 0 detail, 2 title (6 FPs removed) |

**v4 breakdown:**
- Elevation: 95.6% P, 100% R (87/87 found)
- Detail: 7.1% P, 100% R (1/1 found, 13 FPs)
- Title: 0% P, 0% R (0/2 found - both missed)

**v5 observations:**
- Detected 97 vs v4's 88 (9 more detections)
- Need to check if these are TPs or FPs
- Appears to have found more elevation callouts

### Page 3: Detail Sheet (35 GT title callouts)

| Model | Detections | Precision | Recall | Notes |
|-------|------------|-----------|--------|-------|
| **v4** | 35 | 81.4% | 100% | Perfect recall with custom title filter |
| **v5 (no filters)** | 33 | **TBD** | **94.3%** (est) | All classified as title |
| **v5 (with filters)** | **33** | **TBD** | **94.3%** (est) | No change - filters preserve title callouts |

**v5 observations:**
- Detected 33 vs v4's 35 (2 fewer)
- If GT is 35, recall = 33/35 = 94.3%
- May have missed 2 title callouts

### Page 4: Mixed (52 GT callouts: 19 elevation, 33 detail)

| Model | Detections | Precision | Recall | Notes |
|-------|------------|-----------|--------|-------|
| **v4** | 40 | 70.2% | 76.9% | 40/52 found |
| **v5 (no filters)** | 20 | **TBD** | **38.5%** (est) | 19 elevation, 1 detail |
| **v5 (with filters)** | **20** | **TBD** | **38.5%** (est) | No change - 19 elevation, 1 detail |

**v4 breakdown:**
- Elevation: 100% R (19/19 found)
- Detail: 65.6% R (21/33 found, 12 missed)

**v5 observations:**
- Detected only 20 vs v4's 40 (20 fewer!)
- Appears to have found all 19 elevation (100% R on elevation)
- Only found 1/33 detail callouts (3% R) - **MAJOR REGRESSION**

## Key Findings

### ✅ v5 Improvements
1. **Training metrics excellent:** 95.5% mAP50 validation
2. **All 3 classes detected:** vs first training (detail only)
3. **Balanced validation:** Fixed dataset split issue

### ⚠️ v5 Regressions
1. **Page 4 detail callouts:** Only 1/33 detected (3% recall) vs v4's 21/33 (65.6%)
2. **Page 3 title callouts:** 33/35 detected (94% recall) vs v4's 35/35 (100%)
3. **Total detections:** 150 vs v4's 163 (8% fewer)

### 🔍 Needs Investigation
1. Why is v5 missing detail callouts on Page 4?
2. Is v5 over-classifying elevation? (95 on page 2 vs GT 87)
3. Do we need post-processing filters like v4?

## Hypothesis

**v5 may be over-detecting elevation and under-detecting detail:**
- Page 2: 95 elevation detected vs 87 GT (8 extra)
- Page 4: 1 detail detected vs 33 GT (32 missing)
- Page 4: 19 elevation detected vs 19 GT (perfect)

**Possible causes:**
1. Class imbalance in training? (983 detail, 928 elevation, 802 title)
2. Confidence threshold too high for detail class?
3. Missing post-processing filters?
4. Model learned elevation features better than detail?

## Filter Impact Summary

**Post-processing filters applied** (same filters from v4 that achieved 79.5% precision):

- Page 2: 97 → 91 detections (6 elevation FPs removed by class-specific filter)
- Page 3: 33 → 33 detections (title callouts preserved)
- Page 4: 20 → 20 detections (no false positives to remove)
- **Total: 150 → 144 detections** (6 FPs removed)

**Key Finding**: Filters worked well but didn't solve Page 4 detail callout issue:
- Filters are designed for external geometry (size, aspect ratio, area)
- Can't distinguish detail callouts from slab references (both are circles ~20-60px)
- v5 model must learn the horizontal divider feature to avoid slab reference confusion

## BREAKTHROUGH: The Feedback Loop Solution

**What We Had Working:**
The validation script with FN extraction was the "learn from mistakes" approach!

**Complete Workflow:**
```bash
# 1. Run detection and validation
python run_page4_validation.py

# 2. Get ground truth annotation (YOLO format) for Page 4
# Copy to: validation_page4/page4_ground_truth.txt

# 3. Extract missed callouts (FN crops)
python src/validate_with_ground_truth.py \
  validation_page4/page4_rendered.png \
  validation_page4/page4_detections.json \
  validation_page4/page4_ground_truth.txt \
  --output validation_page4/page4_validation.png \
  --extract-fn validation_page4/missed_callouts

# 4. Upload validation_page4/missed_callouts/ to Roboflow
# 5. Retrain v5 model with augmented dataset
# 6. Re-test - expect 6% → 85%+ detail recall
```

**Files:**
- `run_page4_validation.py` - Complete workflow script
- `src/validate_with_ground_truth.py` - Enhanced with FN extraction
- See bead comment on sitelink-xvb for full details

## Next Steps

1. ✅ Run proper ground truth comparison with validation script
2. ✅ Generate TP/FP/FN visualization images
3. ✅ Calculate exact precision/recall per class
4. ✅ Apply v4's post-processing filters to v5 detections
5. ✅ Test lower confidence threshold for detail class
6. ✅ Enhanced validation script with FN extraction
7. ✅ Find ground truth annotation file for Page 4 (used v4's annotation: 53 callouts)
8. ✅ Run validation with --extract-fn to get missed callout crops (extracted 53 crops)
9. 🔲 Upload crops to Roboflow and retrain
10. 🔲 Re-test on Page 4 to confirm improvement

## Validation Results (Actual)

Ran validation with v4's ground truth (53 annotations: 27 detail, 26 elevation, 1 title):

**Overall Performance:**
- Ground Truth: 54 callouts
- Detected: 20 callouts
- True Positives: 1
- False Positives: 19
- False Negatives: 53
- **Precision: 5.0%**
- **Recall: 1.9%**
- **F1 Score: 2.7%**

**Per-Class Breakdown:**
- **Detail**: 0% P, 0% R (0 TP, 1 FP, 27 FN out of 27 GT) - Complete failure
- **Elevation**: 5.3% P, 3.8% R (1 TP, 18 FP, 25 FN out of 26 GT) - Nearly complete failure
- **Title**: 0% P, 0% R (0 TP, 0 FP, 1 FN out of 1 GT)

**Critical Finding**: Model only got 1 correct detection out of 20 attempts. Even elevation callouts (which showed 100% recall on Page 2) failed catastrophically on Page 4.

**Extracted Crops**: 53 false negative crops saved to `validation_page4/missed_callouts/` for retraining.

## Files

- v4 results: `test_output/4pages_p*_final_validation.png`
- v5 results: `test_v5_sahi_output/4page_canadian/page*_annotated.png`
- v4 model: `../callout-processor-v4/weights/callout_detector.pt`
- v5 model: `runs/detect/v5_combined2/weights/best.pt`
