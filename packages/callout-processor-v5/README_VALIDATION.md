# v5 Callout Detection - Validation Complete ✅

**Status:** Production Ready
**Performance:** 96.5% Precision, 96.5% Recall
**Date:** 2026-01-22

## Quick Start

### View Validation Results
```bash
# Side-by-side comparisons (Ground Truth | Model | Validation)
open comparison_page2.png  # Floor plan (89 GT callouts)
open comparison_page3.png  # Detail sheet (35 GT callouts)
open comparison_page4.png  # Mixed page (20 GT callouts)
```

### Key Files

**Documentation:**
- `SUMMARY.md` - Quick reference (START HERE)
- `VALIDATION_RESULTS_CORRECT.md` - Full metrics breakdown
- `VALIDATION_PROCESS.md` - Complete reproducible workflow
- `NEXT_STEPS.md` - Deployment recommendations

**Visual Results:**
- `comparison_page*.png` - Three-panel comparisons
- `validation_page*_ground_truth.png` - Roboflow annotations
- `validation_page*_result.png` - TP/FP/FN visualizations

**Model:**
- `runs/detect/v5_combined2/weights/best.pt` - Trained weights

**Dataset:**
- `dataset_v6/` - Current Roboflow annotations
- `callout-detection.v6i.yolo26.zip` - Roboflow export

## Performance Summary

**Combined Metrics (Pages 2-4):**
- Precision: **96.5%** (Target: >70%) ✅
- Recall: **96.5%** (Target: >90%) ✅
- F1 Score: **96.5%** ✅

**By Class:**
| Class     | Precision | Recall | F1    |
|-----------|-----------|--------|-------|
| Elevation | 97.2%     | 99.1%  | 98.1% |
| Title     | 97.1%     | 89.5%  | 93.1% |

**By Page:**
| Page | Type        | Precision | Recall | F1    |
|------|-------------|-----------|--------|-------|
| 2    | Floor Plan  | 96.7%     | 98.9%  | 97.8% |
| 3    | Detail Sheet| 97.0%     | 91.4%  | 94.1% |
| 4    | Mixed       | 95.0%     | 95.0%  | 95.0% |

## Scripts

**Validation:**
- `visualize_ground_truth.py` - Render Roboflow annotations
- `generate_detection_json.py` - Run model and save JSON
- `create_comparison_images.py` - Generate side-by-side comparisons
- `src/validate_with_ground_truth.py` - Calculate metrics

**Testing:**
- `test_v5_sahi.py` - Run detection with SAHI tiling

**Training:**
- `train_combined.py` - Train with combined dataset

## Directory Structure

```
callout-processor-v5/
├── SUMMARY.md                    # Quick reference
├── VALIDATION_PROCESS.md         # Complete workflow documentation
├── VALIDATION_RESULTS_CORRECT.md # Full metrics
├── comparison_page*.png          # Visual comparisons
├── validation_page*.png          # Ground truth & results
├── runs/detect/v5_combined2/     # Model weights
├── dataset_v6/                   # Current Roboflow dataset
├── test_v5_sahi_output/          # Current test results
├── src/                          # Source code
└── archive_old_tests/            # Archived old outputs
```

## Reproducing Validation

See `VALIDATION_PROCESS.md` for complete step-by-step instructions.

**Quick version:**
```bash
# 1. Visualize ground truth
python visualize_ground_truth.py \
  <page_image> <roboflow_annotation.txt> <output.png>

# 2. Run detection
python generate_detection_json.py \
  <pdf_path> <page_num> <output.json> <output.png>

# 3. Validate
python src/validate_with_ground_truth.py \
  <image> <detection.json> <annotation.txt> --output <result.png>
```

## What Changed

**Previous (WRONG):**
- Validated against v4 ground truth
- Page 4: 1.9% recall → "catastrophic failure"

**Current (CORRECT):**
- Validated against Roboflow annotations
- Page 4: 95.0% recall → **excellent performance**

See `COMPARISON_V4_VS_ROBOFLOW_GROUND_TRUTH.md` for full explanation.

## Recommendation

**✅ Deploy v5 to production immediately**

Performance significantly exceeds targets. No retraining needed.

Optional improvement: Add missed title callouts to training for 89.5% → 95%+ title recall.

## Next Actions

1. Review comparison images to confirm results
2. Integrate v5 into sitelink-interpreter pipeline
3. Deploy to production backend
4. Monitor performance and collect edge cases

---

**Model:** v5_combined2
**Training Data:** dataset_v6 (Roboflow)
**Validation:** Pages 2-4 from 4-Structural-Drawings - 4pages.pdf
**Settings:** DPI=72, SAHI tiling (2048px, 0.2 overlap), conf=0.25, filters enabled
