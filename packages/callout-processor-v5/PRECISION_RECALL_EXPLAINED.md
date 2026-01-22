# Understanding Precision vs Recall

## The Basics

Imagine you're looking for callouts on a construction drawing with **100 actual callouts** (ground truth).

### Your Detection Results:
- You found **120 callouts** total
- Of these, **90 are correct** (true positives)
- **30 are wrong** - you marked dimension text or notes as callouts (false positives)
- You **missed 10 real callouts** (false negatives)

### The Metrics:

**Recall = "How many real callouts did I find?"**
```
Recall = True Positives / (True Positives + False Negatives)
Recall = 90 / (90 + 10) = 90 / 100 = 90%
```
→ You found 90 out of 100 real callouts

**Precision = "How many of my detections are correct?"**
```
Precision = True Positives / (True Positives + False Positives)
Precision = 90 / (90 + 30) = 90 / 120 = 75%
```
→ Only 75% of your detections are actually callouts, 25% are junk

---

## Real-World Analogy

### Fishing for Fish (Callouts)

**Pond has 100 fish** (ground truth callouts)

**Scenario 1: High Recall, Low Precision** (92.1% recall, 79.5% precision)
- You cast a wide net and catch **92 fish** ← Good recall! (92%)
- But you also caught **24 pieces of trash** (false positives)
- Your bucket has 116 items total (92 fish + 24 trash)
- Only 79.5% of your bucket is actually fish ← Okay precision

**Scenario 2: High Precision, Low Recall** (100% precision, 50% recall)
- You're very picky and only catch **50 fish**
- You catch **zero trash** (perfect precision!)
- But you missed 50 real fish ← Bad recall

---

## In Our Callout Detection

### Current Performance:

| Page | Recall | Precision | What It Means |
|------|--------|-----------|---------------|
| **Page 2** | 97.8% | 83.8% | Found 88/90 real callouts, but 17/105 detections are wrong |
| **Page 3** | 100% | 81.4% | Found all 35 callouts, but 8/43 detections are wrong |
| **Page 4** | 76.9% | 70.2% | Found only 40/52 callouts, and 17/57 detections are wrong |

### Breakdown for Page 2:

**Ground Truth**: 90 callouts (87 elevation, 1 detail, 2 title)

**Our Detections**: 105 callouts

**Results**:
- ✅ True Positives: 88 (correct detections)
  - 87 elevation (100% of real elevations)
  - 1 detail (100% of real details)
  - 0 title (missed both small title callouts)

- ❌ False Positives: 17 (wrong detections)
  - 4 elevation (marked text as elevation)
  - 13 detail (marked dimension text/notes as detail)
  - 0 title

- 😢 False Negatives: 2 (missed real callouts)
  - 0 elevation (found all!)
  - 0 detail (found the one!)
  - 2 title (both small circular title callouts missed)

**Precision = 88/105 = 83.8%**
- 83.8% of our detections are correct
- 16.2% are junk (dimension text marked as callouts)

**Recall = 88/90 = 97.8%**
- We found 97.8% of the real callouts
- We only missed 2 small title callouts

---

## Why Detail Callouts Are NOT Production Ready

### The Problem

**Detail Callouts on Page 2**:
- Ground truth: **1 real detail callout**
- Our detections: **14 detail callouts**
- True positives: **1** (we found the real one!)
- False positives: **13** (we marked 13 dimension text/notes as detail callouts)

**Precision = 1/14 = 7.1%** ← TERRIBLE!
- Only 7% of our "detail callout" detections are actually detail callouts
- 93% are false alarms (dimension text, notes, etc.)

**Recall = 1/1 = 100%** ← GOOD!
- We found the one real detail callout

**Detail Callouts on Page 4**:
- Ground truth: **32 real detail callouts**
- Our detections: **33 detail callouts**
- True positives: **21** (we found 21 real ones)
- False positives: **12** (we marked 12 non-callouts as detail)
- False negatives: **11** (we missed 11 real detail callouts)

**Precision = 21/33 = 63.6%** ← POOR
- Only 64% of our "detail callout" detections are correct
- 36% are false alarms

**Recall = 21/32 = 65.6%** ← POOR
- We only found 66% of the real detail callouts
- We missed 34% of them

### Why This Is Not Production Ready

**User Impact**:
1. **Low precision (7-64%)**: User sees many false positives
   - They click on a "detail callout" but it's just dimension text
   - Frustrating user experience
   - Wastes user time

2. **Low recall (66%)**: User misses real callouts
   - They think they've seen all detail callouts, but 34% are hidden
   - Could cause construction errors if they miss critical details

**Contrast with Elevation Callouts**:
- Precision: 79-95% (good - most detections are real)
- Recall: 100% (perfect - found every single one)
- User can trust elevation callout detections

---

## How to Increase Precision

### The Precision-Recall Trade-off

**Key Insight**: Precision and recall are usually inversely related.

**To increase precision** (reduce false positives):
1. **Be more conservative** - only mark things you're very confident about
2. **Higher confidence threshold** - reject low-confidence detections
3. **Stricter filters** - more aggressive size/aspect/area constraints
4. **Add validation** - OCR check (if it's just text, reject it)

**Side effect**: Recall usually goes down (you miss more real callouts)

**To increase recall** (find more real callouts):
1. **Be more aggressive** - mark anything that might be a callout
2. **Lower confidence threshold** - accept low-confidence detections
3. **Looser filters** - relaxed size/aspect constraints

**Side effect**: Precision usually goes down (more false positives)

### Specific Techniques to Improve Precision

#### 1. **OCR-based Filtering** (Recommended for Detail Callouts)

**Problem**: Detail callout false positives are mostly dimension text like "12'-6\"" or notes like "TYP."

**Solution**:
```python
import pytesseract

def is_text_only(crop: np.ndarray) -> bool:
    """Check if box contains only text (dimension/note)."""
    # Run OCR
    text = pytesseract.image_to_string(crop).strip()

    # If box contains dimension pattern (e.g., "12'-6\"", "3/4\"")
    if re.match(r"[\d\s'-/\"]+$", text):
        return True  # Reject as dimension text

    # If box contains common note text (TYP, EQ, etc.)
    if text.upper() in ['TYP', 'TYP.', 'EQ', 'EQ.', 'SIM', 'SIM.']:
        return True  # Reject as note

    # If box is mostly alphanumeric (no symbols/shapes)
    if len(text) > 0 and text.isalnum():
        return True  # Reject as text

    return False  # Keep (likely has symbol/shape)
```

**Expected Impact**:
- Page 2: Reduce 13 detail FPs → estimated 2-3 FPs (precision 7% → 50-70%)
- Page 4: Reduce 12 detail FPs → estimated 3-5 FPs (precision 64% → 75-85%)

**Recall Impact**: Minimal (shouldn't miss real callouts with symbols)

#### 2. **Stricter Class-Specific Filters**

**Current detail filter**:
```python
if callout_type == 'detail':
    if w > 100 or h > 100:
        continue
    if w < 20 or h < 20:
        continue
    aspect_ratio = h / w if w > 0 else 0
    if aspect_ratio < 0.5 or aspect_ratio > 2.0:
        continue
```

**Proposed stricter filter**:
```python
if callout_type == 'detail':
    # More aggressive max size (remove larger text boxes)
    if w > 80 or h > 80:  # Was 100
        continue
    # Stricter minimum (remove very small noise)
    if w < 25 or h < 25:  # Was 20
        continue
    # Stricter aspect (require more square)
    aspect_ratio = h / w if w > 0 else 0
    if aspect_ratio < 0.6 or aspect_ratio > 1.7:  # Was 0.5-2.0
        continue
```

**Expected Impact**:
- Precision: +5-10pp (removes some FPs)
- Recall: -5-10pp (may miss some edge cases)

**Trade-off**: Depends on whether you prioritize precision or recall

#### 3. **Confidence Threshold Tuning**

**Current**: conf=0.01 (very low - accepts almost everything)

**Experiment with higher thresholds**:
```bash
# Test different thresholds
python src/detect_yolo_finetuned.py page.png --conf 0.05  # Less aggressive
python src/detect_yolo_finetuned.py page.png --conf 0.10  # Moderate
python src/detect_yolo_finetuned.py page.png --conf 0.20  # Conservative
```

**Expected Impact**:
- Higher threshold → Higher precision, lower recall
- Need to validate on test set to find optimal threshold

#### 4. **Ensemble Method**

**Idea**: Require multiple detection methods to agree

```python
# Run both YOLO-finetuned and YOLO-26E
detections_yolo = detect_yolo_finetuned(image)
detections_yoloe = detect_yoloe(image)

# Only keep detections that both models found (high precision)
consensus = [d for d in detections_yolo
             if has_matching_detection(d, detections_yoloe, iou_threshold=0.5)]
```

**Expected Impact**:
- Precision: +10-20pp (only keep high-confidence detections)
- Recall: -10-20pp (may miss detections only one model found)

---

## How to Improve Detail Callout Recall

**Current Problem**: Page 4 misses 11/32 detail callouts (65.6% recall)

### Techniques:

#### 1. **Lower Confidence Threshold**

**Current**: conf=0.01 (already very low)

**Try**: conf=0.005 or conf=0.001
- May find more real callouts that were barely below threshold
- But will also get more false positives (trade-off)

#### 2. **Smaller Tile Size**

**Current**: 2048px tiles

**Try**: 1024px or 1536px tiles
- Smaller tiles = larger relative size of callouts
- May improve detection of small detail callouts (20-40px)
- More tiles = slower inference

#### 3. **Multi-Scale Detection**

**Idea**: Run detection at multiple scales

```python
# Detect at 100%, 150%, 200% zoom
detections_100 = detect(image, scale=1.0)
detections_150 = detect(image, scale=1.5)
detections_200 = detect(image, scale=2.0)

# Merge all detections
all_detections = merge([detections_100, detections_150, detections_200])
```

**Expected Impact**:
- Recall: +5-15pp (finds callouts missed at single scale)
- Precision: May decrease slightly (more detections = more FPs)

#### 4. **More Training Data**

**Current**: Model trained on 58 images

**Improvement**: Collect more diverse examples
- More detail callout variations
- Different drawing styles
- Different scales and resolutions

**Expected Impact**: +10-20pp recall, +5-10pp precision

---

## Recommended Action Plan

### Phase 1: Quick Wins (High Impact, Low Effort)

1. **Implement OCR-based filtering for detail callouts**
   - Add pytesseract dependency
   - Filter out dimension text patterns
   - Expected: Precision 64% → 80%+

2. **Test confidence threshold tuning**
   - Run validation at conf=0.05, 0.10, 0.15, 0.20
   - Find optimal threshold for detail callouts
   - May improve precision without losing recall

### Phase 2: Medium-Term (Medium Impact, Medium Effort)

3. **Implement multi-scale detection**
   - Detect at 100%, 150%, 200% zoom
   - Merge results with NMS
   - Expected: Recall 66% → 75%+

4. **Stricter class-specific filters**
   - Adjust detail callout constraints
   - Test on validation set
   - Expected: Precision +5-10pp, Recall -5pp

### Phase 3: Long-Term (High Impact, High Effort)

5. **Collect more training data**
   - Annotate 100+ more images with detail callouts
   - Retrain model
   - Expected: Both precision and recall improve

6. **Ensemble methods**
   - Combine YOLO-finetuned + YOLO-26E
   - Require consensus for high-confidence detections
   - Expected: Precision +10-20pp

---

## Summary

**Recall**: "Did I find all the real callouts?" (completeness)
**Precision**: "Are my detections actually callouts?" (accuracy)

**Current Status**:
- ✅ **Elevation**: High precision (79-95%), perfect recall (100%)
- ✅ **Title (detail sheets)**: Good precision (83%), perfect recall (100%)
- ❌ **Detail**: Poor precision (64%), poor recall (66%)
- ❌ **Title (floor plans)**: Zero recall (missed all small circular callouts)

**Why Detail Is Not Production Ready**:
- User sees many false positives (dimension text marked as callouts)
- User misses 34% of real detail callouts
- Frustrating and unreliable experience

**Best Path to Improve Detail Callouts**:
1. **OCR filtering** (remove dimension text FPs) → +16pp precision
2. **Confidence tuning** (find optimal threshold) → +5-10pp precision
3. **Multi-scale detection** (find missed callouts) → +9pp recall
4. **More training data** (improve model) → +10-20pp both metrics

**Target**: 80%+ precision, 80%+ recall for production readiness
