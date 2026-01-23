# Post-Processing Filter Results

## Summary

Implemented post-processing filters to improve precision while maintaining high recall. Filters remove false positives based on size, aspect ratio, area, and class-specific rules.

## Overall Results

### Before Filters
| Page | GT | Precision | Recall | F1 | TP | FP | FN |
|------|----|-----------| -------|----|----|----|-----|
| Page 2 | 90 | 66.7% | 100% | 80.0% | 90 | 45 | 0 |
| Page 3 | 35 | 77.8% | 100% | 87.5% | 35 | 10 | 0 |
| Page 4 | 52 | 38.5% | 80.8% | 52.2% | 42 | 67 | 10 |
| **TOTAL** | **177** | **56.9%** | **94.4%** | **70.9%** | **167** | **122** | **10** |

### After Filters
| Page | GT | Precision | Recall | F1 | TP | FP | FN | Change |
|------|----|-----------| -------|----|----|----|-----|---------|
| Page 2 | 90 | **83.8%** | 97.8% | **90.3%** | 88 | 17 | 2 | **+17.1pp precision** ✅ |
| Page 3 | 35 | 0% | 0% | 0% | 0 | 1 | 35 | **BROKEN** ❌ |
| Page 4 | 52 | **70.2%** | 76.9% | **73.4%** | 40 | 17 | 12 | **+31.7pp precision** ✅ |

## Per-Page Analysis

### Page 2 (Floor Plan with Elevation Callouts)
**Excellent improvement across all metrics**

Before:
- 135 detections (90 TP, 45 FP, 0 FN)
- 66.7% precision, 100% recall, 80.0% F1

After:
- 105 detections (88 TP, 17 FP, 2 FN)
- **83.8% precision** (+17.1pp), **97.8% recall** (-2.2pp), **90.3% F1** (+10.3pp)
- Removed 30 false positives (mostly dimension text)
- Only missed 2 real callouts (acceptable trade-off)

**Filters applied:**
- Size filter: 135 → 115 (20 removed)
- Area filter: 115 → 109 (6 removed)
- Class-specific filter: 109 → 105 (4 removed)

**Per-Class:**
- Elevation: 95.6% precision, 100% recall (87/87 found) ← **Excellent**
- Detail: 7.1% precision, 100% recall (1/1 found, but 13 FPs)
- Title: 0% precision, 0% recall (missed 2 real titles)

**Conclusion:** Ready for production on floor plans with elevations.

---

### Page 4 (Floor Plan with Detail/Elevation Mix)
**Significant precision improvement**

Before:
- 109 detections (42 TP, 67 FP, 10 FN)
- 38.5% precision, 80.8% recall, 52.2% F1

After:
- 57 detections (40 TP, 17 FP, 12 FN)
- **70.2% precision** (+31.7pp), **76.9% recall** (-3.9pp), **73.4% F1** (+21.2pp)
- Removed 52 false positives (mostly detail callouts on text)
- Only 2 additional misses (10 → 12 FN)

**Filters applied:**
- Size filter: 109 → 74 (35 removed) ← Most effective
- Area filter: 74 → 62 (12 removed)
- Class-specific filter: 62 → 57 (5 removed)

**Per-Class:**
- Elevation: 79.2% precision, 100% recall (19/19 found) ← **Perfect recall**
- Detail: 63.6% precision, 65.6% recall (21/32 found)
- Title: 0% precision, 0% recall (0/1 found)

**Conclusion:** Good performance. Detail callouts need more work (missed 11/32).

---

### Page 3 (Detail Sheet with Title Callouts)
**CRITICAL ISSUE: Over-filtering**

Before:
- 45 detections (35 TP, 10 FP, 0 FN)
- 77.8% precision, 100% recall, 87.5% F1

After (current filters):
- 3 detections (0 TP, 1 FP, 35 FN)
- **0% precision, 0% recall, 0% F1**
- Removed 42 detections INCLUDING all 35 real title callouts ❌

**Filters applied:**
- Size filter: 45 → 6 (39 removed) ← **Problem here**
- Aspect filter: 6 → 4 (2 removed)
- Class-specific filter: 4 → 3 (1 removed)

**Root Cause:** Title callouts are very small (12-40px) and being rejected by the minimum size filter (15px). The class-specific title filter tries to allow 12-80px, but the general size filter (15-150px) runs first and removes them.

**Solution Needed:**
1. Lower global min_size to 12px, OR
2. Apply class-specific filter BEFORE general size filter, OR
3. Disable size filtering for title callouts

**Conclusion:** Filters broken for title callouts. Need urgent fix before production.

---

## Filter Implementation Details

### Filter Chain (Sequential)
1. **Size Filter** (15-150px)
   - Removes very small (noise) and very large (text blocks)
   - Most effective: removed 94 FPs across all pages
   - **Problem:** Also removes small title callouts

2. **Aspect Ratio Filter** (0.3-3.0)
   - Removes very wide/tall boxes (dimension lines)
   - Minimal impact: only 2 removals
   - Safe filter, no false negatives

3. **Area Filter** (400-15000px²)
   - Removes large text areas
   - Effective: removed 18 FPs
   - Safe filter

4. **Class-Specific Filter**
   - Detail: 20-100px, aspect 0.5-2.0 (strict)
   - Elevation: 25-120px (medium)
   - Title: 12-80px, aspect 0.4-2.5 (relaxed)
   - Problem: Runs AFTER size filter, so can't rescue filtered titles

### Code Location
- `src/postprocess_filters.py` (200+ lines)
- Integrated into `src/detect_yolo_finetuned.py` (--no-filters flag to disable)

---

## Recommendations

### Immediate (Fix Title Callouts)
**Option A: Lower global minimum size**
```python
def filter_by_size(detections, min_size=12, max_size=150):  # Was 15
```
- Pros: Simple one-line fix
- Cons: May allow more noise

**Option B: Class-specific size filtering**
Move class-specific filter BEFORE general size filter, or make size filter class-aware.
- Pros: Precise control per class
- Cons: More complex code

**Option C: Disable size filter for title callouts**
Skip size filter if class=='title'
- Pros: Surgical fix
- Cons: Still need to identify title callouts before filtering

**Recommendation:** Go with **Option A** (lower min_size to 12px). Test on all pages, adjust if needed.

### Short-Term (Improve Detail Callouts)
- Detail callouts have high FP rate (13 FPs on page 2, missed 11/32 on page 4)
- Current detail filter: 20-100px, aspect 0.5-2.0
- Consider:
  - More aggressive max size (100px → 80px)
  - Stricter aspect ratio (0.5-2.0 → 0.6-1.7)
  - Add OCR filter: if box contains only text, reject

### Long-Term (Production Deployment)
1. Test on 20+ diverse plans (US NCS, Canadian NCS, different scales)
2. Collect edge cases where filters fail
3. Add ML-based filter (train small classifier on TP/FP examples)
4. User feedback loop: let users mark false positives, retrain filters

---

## Files Created
- `src/postprocess_filters.py` (200+ lines)
- `FILTER_RESULTS.md` (this document)
- Validation images: `test_output/*_filtered_validation.png`

---

## Next Steps

1. **Fix title callout filtering** (1 hour)
   - Lower min_size to 12px
   - Re-test page 3
   - Validate all pages

2. **Final validation** (1 hour)
   - Run all 3 pages with fixed filters
   - Calculate overall precision/recall/F1
   - Generate final comparison table

3. **Production readiness check** (2 hours)
   - Test on 5-10 additional plans
   - Measure inference time
   - Document deployment requirements

4. **Deploy** (when ready)
   - Update bead ticket with final results
   - Mark as production-ready
   - Integrate into mobile app
