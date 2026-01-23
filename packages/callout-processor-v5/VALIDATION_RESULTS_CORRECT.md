# v5 Model Validation Results (Correct Roboflow Ground Truth)

**Date:** 2026-01-22
**Model:** v5 Combined (runs/detect/v5_combined2/weights/best.pt)
**Ground Truth:** Roboflow annotations (dataset_v6) - USER ANNOTATED

## Executive Summary

✅ **v5 EXCEEDS TARGET PERFORMANCE**

**Combined Performance (Pages 2-4):**
- **Precision: 96.5%** (Target: >70%) ✅
- **Recall: 96.5%** (Target: >90%) ✅
- **F1 Score: 96.5%** ✅

v5 shows excellent performance across all pages with the correct Roboflow ground truth annotations.

## Per-Page Results

### Page 2 (Floor Plan)
**Overall:**
- Precision: **96.7%**
- Recall: **98.9%**
- F1: **97.8%**
- TP: 88, FP: 3, FN: 1

**By Class:**
| Class     | Precision | Recall | F1    | TP | FP | FN | GT |
|-----------|-----------|--------|-------|----|----|----|----|
| elevation | 96.6%     | 98.9%  | 97.7% | 86 | 3  | 1  | 87 |
| title     | 100.0%    | 100.0% | 100.0%| 2  | 0  | 0  | 2  |

✅ Excellent performance on floor plan with mostly elevation callouts

### Page 3 (Detail Sheet)
**Overall:**
- Precision: **97.0%**
- Recall: **91.4%**
- F1: **94.1%**
- TP: 32, FP: 1, FN: 3

**By Class:**
| Class | Precision | Recall | F1    | TP | FP | FN | GT |
|-------|-----------|--------|-------|----|----|----|----|
| title | 97.0%     | 91.4%  | 94.1% | 32 | 1  | 3  | 35 |

✅ Strong performance on title callouts, missed 3 out of 35

### Page 4 (Mixed)
**Overall:**
- Precision: **95.0%**
- Recall: **95.0%**
- F1: **95.0%**
- TP: 19, FP: 1, FN: 1

**By Class:**
| Class     | Precision | Recall  | F1     | TP | FP | FN | GT |
|-----------|-----------|---------|--------|----|----|----|----|
| elevation | 100.0%    | 100.0%  | 100.0% | 19 | 0  | 0  | 19 |
| title     | 0.0%      | 0.0%    | 0.0%   | 0  | 0  | 1  | 1  |
| detail    | N/A (FP)  | N/A     | N/A    | 0  | 1  | 0  | 0  |

**Notes:**
- Perfect detection of all 19 elevation callouts ✅
- Missed 1 title callout
- 1 false positive labeled as "detail"

## Combined Metrics (All Pages)

**Ground Truth Total:** 144 callouts
- Page 2: 89 (87 elevation + 2 title)
- Page 3: 35 (35 title)
- Page 4: 20 (19 elevation + 1 title)

**Detection Total:** 144 callouts
- TP: 139
- FP: 5
- FN: 5

**Overall Performance:**
- **Precision: 96.5%** (139 / 144)
- **Recall: 96.5%** (139 / 144)
- **F1 Score: 96.5%**

**By Class (Combined):**
| Class     | TP  | FP | FN | GT  | Precision | Recall  | F1    |
|-----------|-----|----|----|-----|-----------|---------|-------|
| elevation | 105 | 3  | 1  | 106 | 97.2%     | 99.1%   | 98.1% |
| title     | 34  | 1  | 4  | 38  | 97.1%     | 89.5%   | 93.1% |
| detail    | 0   | 1  | 0  | 0   | 0.0% (FP) | N/A     | N/A   |

## Key Insights

### ✅ Strengths
1. **Elevation callouts**: 99.1% recall, 97.2% precision - EXCELLENT
2. **Overall performance**: 96.5% P/R exceeds both targets
3. **Consistency**: Strong performance across different page types (floor plan, detail sheet, mixed)

### ⚠️ Minor Issues
1. **Title callouts**: 89.5% recall (missed 4/38)
   - Page 3: missed 3/35
   - Page 4: missed 1/1
2. **False positives**: 5 total
   - 3 elevation FPs on Page 2
   - 1 title FP on Page 3
   - 1 detail FP on Page 4 (likely should be elevation/title)

### 🎯 Comparison to Previous Results

**The "Catastrophic Failure" was WRONG:**
- Old validation (with v4 ground truth): 1.9% recall on Page 4
- **Correct validation (with YOUR Roboflow annotations): 95.0% recall on Page 4** ✅

The issue was using the wrong ground truth, NOT model performance.

## Conclusion

**v5 is PRODUCTION READY**

The model significantly exceeds both target metrics:
- ✅ Target: >70% precision → **Achieved: 96.5%**
- ✅ Target: >90% recall → **Achieved: 96.5%**

### Recommendations

1. **Deploy v5** - Performance is excellent and exceeds targets
2. **Optional improvements** (not critical):
   - Add more title callout examples to training to improve title recall from 89.5% to >95%
   - Review the 5 false negatives to understand edge cases
3. **No retraining needed** - Current performance is sufficient for production use

## Files

**Ground Truth Visualizations:**
- `validation_page2_ground_truth.png` - YOUR Roboflow annotations for Page 2
- `validation_page3_ground_truth.png` - YOUR Roboflow annotations for Page 3
- `validation_page4_ground_truth.png` - YOUR Roboflow annotations for Page 4

**Validation Results:**
- `validation_page2_result.png` - TP/FP/FN visualization for Page 2
- `validation_page3_result.png` - TP/FP/FN visualization for Page 3
- `validation_page4_result.png` - TP/FP/FN visualization for Page 4

**Detection Files:**
- `validation_page2_detections.json` - v5 detections for Page 2
- `validation_page3_detections.json` - v5 detections for Page 3
- `validation_page4_detections.json` - v5 detections for Page 4
