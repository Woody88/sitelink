# Ground Truth Comparison: v4 Files vs Roboflow Annotations

**Date:** 2026-01-22

## Problem: Wrong Ground Truth Led to False "Catastrophic Failure"

### What Happened

I initially validated v5 using v4's ground truth annotation files, which showed:
- **Page 4 with v4 ground truth**: 1.9% recall (catastrophic failure!)
- User corrected: "Page 4 has NO detail callouts"

When I re-validated using YOUR actual Roboflow annotations:
- **Page 4 with Roboflow ground truth**: 95.0% recall ✅

The "catastrophic failure" was because I used the wrong ground truth, NOT because v5 was performing poorly.

## Ground Truth Comparison: Page 4

### v4 Ground Truth (WRONG)
**File:** Not from Roboflow dataset
- Total: 54 callouts
- Detail: 27
- Elevation: 26
- Title: 1

**Result when validated against this:**
- Recall: 1.9% (53/54 missed) ❌
- Appeared to be catastrophic failure

### Roboflow Ground Truth (CORRECT - YOUR ANNOTATIONS)
**File:** `dataset_v6/train/labels/4_Structural_Drawings___4pages_page_03_png.rf.*.txt`
- Total: 20 callouts
- Detail: 0 (correct - you confirmed Page 4 has no detail callouts)
- Elevation: 19
- Title: 1

**Result when validated against this:**
- Precision: 95.0%
- Recall: 95.0%
- F1: 95.0% ✅

## Key Lesson

**Always use the Roboflow annotations as ground truth** - they are YOUR authoritative labels.

v4's annotation files were:
1. Incomplete or incorrect
2. NOT what was used for training
3. Led to completely wrong conclusions about v5 performance

## Correct Validation Process

1. ✅ Use Roboflow dataset annotations from `dataset_v6/train/labels/`
2. ✅ Generate ground truth visualizations to visually confirm annotations
3. ✅ Compare model output against YOUR Roboflow annotations
4. ✅ Calculate metrics based on YOUR ground truth

## v5 Actual Performance (with correct ground truth)

**Combined (Pages 2-4):**
- Precision: 96.5%
- Recall: 96.5%
- F1: 96.5%

**v5 EXCEEDS TARGETS** ✅

| Metric    | Target | v5 Actual | Status |
|-----------|--------|-----------|--------|
| Precision | >70%   | 96.5%     | ✅ EXCEEDS |
| Recall    | >90%   | 96.5%     | ✅ EXCEEDS |

## Corrective Actions Taken

1. ✅ Created `visualize_ground_truth.py` to render YOUR Roboflow annotations
2. ✅ Generated ground truth visualizations for all 3 pages
3. ✅ Re-validated all pages using correct Roboflow ground truth
4. ✅ Documented correct performance metrics in `VALIDATION_RESULTS_CORRECT.md`
5. ✅ This comparison document to prevent future confusion

## Files

**Correct Ground Truth (from YOUR Roboflow dataset):**
- Page 2: `dataset_v6/train/labels/4_Structural_Drawings___4pages_page_01_png.rf.*.txt`
- Page 3: `dataset_v6/train/labels/4_Structural_Drawings___4pages_page_02_png.rf.*.txt`
- Page 4: `dataset_v6/train/labels/4_Structural_Drawings___4pages_page_03_png.rf.*.txt`

**Ground Truth Visualizations:**
- `validation_page2_ground_truth.png`
- `validation_page3_ground_truth.png`
- `validation_page4_ground_truth.png`

**Validation Results:**
- `validation_page2_result.png` (TP/FP/FN)
- `validation_page3_result.png` (TP/FP/FN)
- `validation_page4_result.png` (TP/FP/FN)
