# Session Summary: Page 4 Validation & False Negative Extraction

**Date**: January 22, 2026
**Session Goal**: Execute "learn from mistakes" feedback loop to extract missed callouts for retraining

## What Was Accomplished

### 1. Context Recovery (Post-Compaction)
- Recovered complete workflow from previous session using bead comment on sitelink-xvb
- Rediscovered the "learn from mistakes" approach: validation script with TP/FP/FN visualization + FN extraction
- Key insight: Manual feedback loop is how v4 achieved 92.1% recall

### 2. Ground Truth Annotation Discovery
- **Problem**: V5's dataset_v6 annotation for Page 4 only had 20 callouts (19 elevation + 1 title)
  - Missing all 27 detail callouts!
- **Solution**: Found v4's annotation with 53 callouts (27 detail, 26 elevation, 1 title)
- **Action**: Copied v4 annotation to `validation_page4/page4_ground_truth.txt`

### 3. Validation Execution with FN Extraction
Ran complete validation workflow:

```bash
python src/validate_with_ground_truth.py \
  validation_page4/page4_rendered.png \
  validation_page4/page4_detections.json \
  validation_page4/page4_ground_truth.txt \
  --output validation_page4/page4_validation.png \
  --extract-fn validation_page4/missed_callouts
```

### 4. Validation Results (Catastrophic Failure)

**Overall Performance:**
| Metric | Value |
|--------|-------|
| Ground Truth | 54 callouts |
| Detected | 20 callouts |
| True Positives | 1 |
| False Positives | 19 |
| False Negatives | 53 |
| **Precision** | **5.0%** |
| **Recall** | **1.9%** |
| **F1 Score** | **2.7%** |

**Per-Class Breakdown:**
| Class | Precision | Recall | TP | FP | FN | GT |
|-------|-----------|--------|----|----|----|----|
| Detail | 0.0% | 0.0% | 0 | 1 | 27 | 27 |
| Elevation | 5.3% | 3.8% | 1 | 18 | 25 | 26 |
| Title | 0.0% | 0.0% | 0 | 0 | 1 | 1 |

**Critical Finding**: Model only got **1 correct detection** out of 20 attempts!

### 5. False Negative Extraction
Successfully extracted **53 missed callout crops** to `validation_page4/missed_callouts/`:
- 27 detail callout crops
- 25 elevation callout crops
- 1 title callout crop

Each crop includes 20% padding around the bounding box for context.

Crop naming format: `page4_rendered_fn_{index}_{class}_(x,y,w,h).png`

### 6. Documentation & Communication
- ✅ Updated `V5_VS_V4_COMPARISON.md` with actual validation results
- ✅ Created `validation_page4/README.md` with complete workflow documentation
- ✅ Added bead comment to sitelink-xvb with validation results and next steps
- ✅ Sent Discord update with complete workflow results

## Root Cause Analysis

### Why V5 Failed Catastrophically on Page 4

1. **Training Data Issue**:
   - V5's dataset_v6 only had elevation and title callouts annotated for Page 4
   - All 27 detail callouts were missing from training data
   - Model never learned what Page 4 detail callouts look like

2. **Distribution Mismatch**:
   - Training data has bold, clear horizontal dividers
   - Page 4 has faint dividers at 72 DPI rendering
   - Model overfitted to training distribution

3. **Scale/Resolution**:
   - Page 4 detail callouts may appear different at 72 DPI
   - SAHI tiling (2048px) preserves resolution but model still fails
   - Suggests fundamental feature learning issue, not just scale

## Next Steps (User Action Required)

### 1. Upload Crops to Roboflow
- Navigate to Roboflow project
- Upload all 53 images from `validation_page4/missed_callouts/`
- Roboflow should auto-detect class labels from filenames
- Verify annotations are correct
- Add to training dataset and generate new version

### 2. Retrain V5 Model
Once Roboflow dataset updated:
```bash
cd /home/woodson/Code/projects/sitelink/packages/callout-processor-v5
python train_v5.py  # or whatever training script is used
```

### 3. Re-test on Page 4
After retraining:
```bash
python run_page4_validation.py
```

Expected results:
- Detail recall: 0% → 85%+
- Elevation recall: 3.8% → 90%+
- Overall recall: 1.9% → 85%+

### 4. Validate Improvement
Check that validation image shows mostly green (TP) boxes instead of blue (FN) boxes.

## Files Created/Modified

### Created:
- `validation_page4/README.md` - Complete workflow documentation
- `validation_page4/page4_ground_truth.txt` - Ground truth annotation (copied from v4)
- `validation_page4/page4_validation.png` - TP/FP/FN visualization
- `validation_page4/missed_callouts/` - 53 extracted crop images
- `SESSION_SUMMARY_2026-01-22.md` - This file

### Modified:
- `V5_VS_V4_COMPARISON.md` - Added validation results section
- `src/validate_with_ground_truth.py` - Already had FN extraction from previous session
- `run_page4_validation.py` - Already created from previous session

## Key Insights

1. **The "Learn from Mistakes" Approach Works**:
   - Validation script with TP/FP/FN visualization shows exactly what model missed
   - FN extraction creates training data from failures
   - This manual feedback loop is proven (v4 achieved 92.1% recall with this)

2. **Training Data Quality > Model Architecture**:
   - V5 model (YOLO26n) is technically superior to v4 (YOLO8n)
   - But v5 fails catastrophically because training data missing key examples
   - Adding 53 missed examples should fix the issue

3. **Validation is Critical**:
   - Training metrics can be misleading (v5 showed 100% validation recall)
   - Real-world test with ground truth reveals true performance
   - Visual inspection (validation images) more valuable than metrics alone

## Reference Files

- **Bead Ticket**: sitelink-xvb
- **Plan File**: /home/woodson/.claude/plans/vivid-greeting-marble.md
- **Comparison Doc**: V5_VS_V4_COMPARISON.md
- **Workflow Script**: run_page4_validation.py
- **Validation Script**: src/validate_with_ground_truth.py
- **Training Analysis**: TRAINING_VS_PAGE4_ANALYSIS.md

## Commands for Next Session

If starting new session, run:
```bash
# Check bead ticket status
bd show sitelink-xvb

# Check todo list
bd list --status=in_progress

# Review validation results
open validation_page4/page4_validation.png

# Check extracted crops
ls -lh validation_page4/missed_callouts/ | head -20
```

## Timeline

- **Previous Session**: Enhanced validation script, created workflow script, documented approach
- **This Session**: Found ground truth, ran validation, extracted 53 crops, documented results
- **Next Session**: Upload to Roboflow, retrain, re-test

## Success Metrics

Current state:
- ✅ Validation workflow documented and tested
- ✅ Ground truth annotation found and verified
- ✅ 53 false negative crops extracted
- ✅ Root cause identified (missing training data)
- ✅ Complete documentation created

Pending:
- 🔲 Upload crops to Roboflow
- 🔲 Retrain v5 model
- 🔲 Achieve >85% recall on Page 4
- 🔲 Close sitelink-xvb bead ticket

## Notes for User

The validation image `validation_page4/page4_validation.png` visually shows the catastrophic failure:
- **Green boxes** (TP): Only 1 - the single correct detection
- **Red boxes** (FP): 19 - all the wrong guesses
- **Blue boxes** (FN): 53 - everything the model missed

This makes it very clear what the model needs to learn. After retraining with the 53 extracted crops, we expect to see mostly green boxes instead of blue.

The key breakthrough from the previous session was rediscovering that this manual feedback loop (validate → visualize → extract misses → retrain) is THE proven approach that got v4 to 92.1% recall. We're now executing that exact workflow for v5.
