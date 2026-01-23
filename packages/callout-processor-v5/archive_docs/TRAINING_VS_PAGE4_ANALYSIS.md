# Training Data vs Page 4: Visual Analysis

## Summary

**Problem**: Model trained on 983 detail callout examples achieves 100% recall on validation (47 examples), but only 6% recall on Page 4 real-world test (2/33 detected).

## Files for Visual Comparison

Generated comparison images:

1. **train_batch0_copy.png** - Training batch showing what model learned
2. **val_batch0_copy.png** - Validation batch (47 detail callouts)
3. **page4_full.png** - Full Page 4 where detection fails
4. **page4_crop1.png** - Sample area 1 from Page 4
5. **page4_crop2.png** - Sample area 2 from Page 4
6. **page4_crop3.png** - Sample area 3 from Page 4

## Dataset Statistics

**Training Set:**
- Images: 251
- Detail annotations (class 0): 983
- Elevation annotations (class 1): 928
- Title annotations (class 2): 802

**Validation Set:**
- Images: 10
- Detail annotations: 47
- Elevation annotations: 49
- Title annotations: 57

**Test (Page 4):**
- Ground truth callouts: 52 total
  - Elevation: 19 (model found 19/19 = 100% recall ✅)
  - Detail: 33 (model found 2/33 = 6% recall ❌)

## Performance Comparison

| Set | Detail Callouts | Detection Rate |
|-----|----------------|----------------|
| **Training** | 983 | ~100% (by definition) |
| **Validation** | 47 | **100%** (93.1% precision, 100% recall) ✅ |
| **Page 4 Test** | 33 | **6%** (2/33 detected) ❌ |

## Hypothesis: Distribution Mismatch

The model performs perfectly on training/validation but fails catastrophically on Page 4. Possible causes:

### 1. Scale/Resolution Mismatch
- Training images: Roboflow may have resized/normalized
- Test images: Rendered at 72 DPI from PDF
- Detail callouts on Page 4 may be smaller/larger than training examples

### 2. Visual Appearance Difference
- Training detail callouts: May have clear, bold horizontal dividers
- Page 4 detail callouts: May have faint, thin, or dashed dividers
- Callout style variations between training and test plans

### 3. Context Difference
- Training: Mix of Canadian and US plans
- Page 4: Specific plan type with unique detail callout style
- Model overfitted to training distribution

### 4. Ground Truth Labeling Issue
- Training annotations: May include some plain circles (slab refs)
- Page 4 ground truth: Strict definition (horizontal dividers only)
- Model learned broader definition than test expects

## Questions to Answer (Visual Inspection)

Please inspect the generated images to answer:

1. **Do training detail callouts have visible horizontal dividers?**
   - Look at train_batch0_copy.png
   - Are the dividers clear and prominent?
   - Or are some plain circles included?

2. **Do Page 4 detail callouts look different?**
   - Look at page4_crop*.png
   - Are dividers present but too thin?
   - Are they dashed instead of solid?
   - Different circle style (thin outline vs thick)?

3. **Scale comparison:**
   - Are Page 4 callouts similar size to training examples?
   - Or significantly smaller/larger?

4. **What do the 2 detected "detail" callouts look like?**
   - Check test_v5_lowconf_output/page4_conf0.05_nofilters.png
   - Are they actually slab references (plain circles)?
   - Or real detail callouts that model correctly found?

## Next Steps

Based on visual inspection:

**If training data has dividers but Page 4 doesn't:**
- Page 4 might not have detail callouts (only slab references)
- Ground truth may be mislabeled

**If training data has plain circles:**
- Training data contamination (despite cleanup)
- Need stricter annotation filtering

**If both have dividers but different styles:**
- Model needs more diverse training examples
- Add Page 4 style detail callouts to training set

**If scale mismatch:**
- Retrain at correct resolution
- Test at different DPI (150, 300)

## Action Items

1. ✅ Generate comparison images
2. 🔲 Visually inspect training examples for dividers
3. 🔲 Visually inspect Page 4 for detail callout characteristics
4. 🔲 Compare detected boxes to ground truth
5. 🔲 Determine root cause category
6. 🔲 Implement fix based on findings
