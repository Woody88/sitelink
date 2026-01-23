# Training Data Cleanup Plan - Simplified 3-Class Model

## Critical Discovery

**Problem Found**: Current training data mislabels slab type indicators (S6, S1, etc.) and other plain circles as "detail callouts".

**Root Cause**: Slab type indicators are plain circles that refer to slab schedules, NOT detail callouts.

**Evidence**:
- Canadian plan page 1 has "SLAB & DECK LEGEND" with S1-S8 entries
- "S6" circles in floor areas are slab types, not detail callouts
- True detail callouts have horizontal divider + arrow (e.g., "15/S4.1")

## Simplified Solution

**Focus on what both US and Canada agree on:**

1. ✅ **Detail Callout** - Circle with horizontal divider (both standards use this)
2. ✅ **Elevation Callout** - Triangle + circle (100% recall, 79-95% precision - works great!)
3. ✅ **Title Callout** - Already working (83% precision, 100% recall)

**Remove for now:**
- ❌ Section callouts (add later)
- ❌ Plain circle "detail callouts" (were actually slab types, grids, room numbers)
- ❌ Grid callouts (add later if needed for context)
- ❌ Slab type indicators (not callouts at all)

---

## Current Training Data Status

**Location**: `/home/woodson/Code/projects/sitelink/packages/callout-processor-v4/temp_annotations/`

**Current Counts**:
- Detail: 246 annotations ← **NEEDS CLEANUP**
- Elevation: 672 annotations ← **KEEP AS IS**
- Title: 490 annotations ← **KEEP AS IS**

**Estimated After Cleanup**:
- Detail: ~50-100 annotations (only those with horizontal dividers)
- Elevation: 672 (no changes)
- Title: 490 (no changes)

---

## Cleanup Steps

### Step 1: Audit Current Detail Callout Annotations

**Goal**: Identify which of the 246 "detail" annotations are actually detail callouts with horizontal dividers.

**Visual Criteria for TRUE Detail Callouts**:
1. ✅ Has circle
2. ✅ Has horizontal divider line through circle
3. ✅ Has two pieces of info (detail number / sheet reference)
4. ✅ May have directional arrow or leader line

**NOT Detail Callouts** (remove these):
- ❌ Plain circle with "S1", "S2", "S6", etc. → Slab type indicator
- ❌ Plain circle with "A", "B", "1", "7" + grid lines → Grid callout
- ❌ Plain circle with "101", "205" → Room number
- ❌ Plain circle with "12'-6\"" → Dimension

**Manual Review Required**: Go through each of the 18 files with detail annotations and verify.

### Step 2: Files to Review

Based on current training data, these files have detail callout annotations:

```
4_Structural_Drawings___4pages_page_03_png.rf.*.txt
4_Structural_Drawings_page_04_png.rf.*.txt
4_Structural_Drawings_page_05_png.rf.*.txt
RTA_DRAWINGS_VOL1_US_PLAN_page_24_png.rf.*.txt
... (14 more files)
```

**For each file**:
1. Open corresponding image
2. Check each "detail" annotation (class 0)
3. If it's a plain circle without divider → **DELETE annotation**
4. If it has horizontal divider → **KEEP annotation**

### Step 3: Update Roboflow Project

**Actions in Roboflow**:

1. **Review and delete wrong annotations**:
   - Search for annotations labeled "detail"
   - Check each one visually
   - Delete if no horizontal divider visible

2. **Verify remaining detail callouts**:
   - All should have horizontal divider
   - Should show two pieces of info (e.g., "D2" / "A-512" or "15" / "S4.1")

3. **Keep elevation and title as-is**:
   - Elevation: 672 annotations (working well)
   - Title: 490 annotations (working well)

4. **Export cleaned dataset**:
   - Generate new version
   - Export in YOLOv8 format

### Step 4: Add More Detail Callout Examples

**After cleanup, we'll likely have only 50-100 detail callout examples.**

**Target**: 500+ detail callout examples (to match elevation's 672)

**Where to find more detail callouts with horizontal dividers**:
- Detail sheets (pages with enlarged details)
- Section drawings
- US NCS standard drawings (always have dividers)
- Canadian drawings with proper detail callouts (not slab types)

**Annotation Guidelines**:
```
✅ ANNOTATE AS DETAIL:
   ┌─────┐
   │  D2 │  ← Detail number
   ├─────┤  ← MUST have horizontal divider
   │A-512│  ← Sheet reference
   └─────┘

✅ ANNOTATE AS DETAIL:
   ┌──┐
   │15│  ← Detail number
   ├──┤  ← MUST have horizontal divider
   │S4.1│ ← Sheet reference
   └──┘
   ↗ (with arrow pointing to detail)

❌ DO NOT ANNOTATE AS DETAIL:
   ┌──┐
   │S6│  ← Slab type indicator (no divider)
   └──┘

❌ DO NOT ANNOTATE AS DETAIL:
   ┌─┐
   │7│   ← Grid callout (no divider)
   └─┘
   |
   | (with grid line)
```

---

## Expected Results After Cleanup

### Before Cleanup:
| Class | Annotations | Recall | Precision | Issues |
|-------|------------|--------|-----------|---------|
| Detail | 246 | 66% | 64% | Many false positives (slab types, grids) |
| Elevation | 672 | 100% | 79-95% | Working well |
| Title | 490 | 83-100% | 81-83% | Working well |

### After Cleanup + More Data:
| Class | Annotations | Expected Recall | Expected Precision | Notes |
|-------|------------|-----------------|-------------------|-------|
| Detail | 500+ | **85-90%** | **85-90%** | Only true detail callouts with dividers |
| Elevation | 672 | **100%** | **85-95%** | Keep as is |
| Title | 490 | **90-100%** | **85-90%** | Keep as is |

### Why This Will Work Better:

1. **No ambiguity**: All three classes have distinctive visual features
   - Detail: Circle with horizontal divider
   - Elevation: Triangle + circle
   - Title: Large text boxes or small circles (context-dependent)

2. **Balanced training data**:
   - Detail: ~500 examples (after adding more)
   - Elevation: 672 examples
   - Title: 490 examples
   - All classes well-represented

3. **No confusion with other symbols**:
   - Slab types excluded (S1-S8)
   - Grid callouts excluded
   - Room numbers excluded
   - Dimensions excluded

4. **Works for both US and Canadian plans**:
   - Both use detail callouts with horizontal dividers
   - Both use elevation callouts with triangles
   - Both use title callouts

---

## Timeline

**Step 1: Audit Current Annotations** (2-3 hours)
- Review 18 files with detail annotations
- Delete plain circles without dividers
- Keep only true detail callouts

**Step 2: Add More Detail Callout Examples** (3-4 hours)
- Find 10-15 more plan pages with detail callouts
- Annotate 400-450 more detail callouts with dividers
- Target: 500+ total detail annotations

**Step 3: Retrain Model** (1-2 hours)
- Export cleaned dataset from Roboflow
- Update training config (3 classes only)
- Train for 100-150 epochs
- Validate on test set

**Step 4: Re-run Validation** (1 hour)
- Test on 4-page test set
- Generate new precision/recall metrics
- Update FINAL_RESULTS.md

**Total**: 7-10 hours

---

## Training Configuration Update

**Old config** (4 classes):
```yaml
names:
  0: detail
  1: elevation
  2: title
  3: section
```

**New config** (3 classes - SIMPLIFIED):
```yaml
names:
  0: detail      # Only with horizontal divider
  1: elevation   # Triangle + circle
  2: title       # Text-based title callouts
```

**Class mapping update**:
```python
# Update postprocess_filters.py class names
CLASS_NAMES = ['detail', 'elevation', 'title']

# Remove section-specific filters
# Only apply filters to detail, elevation, title
```

---

## Verification Checklist

After cleanup and retraining, verify:

- [ ] All "detail" annotations in training data have horizontal dividers
- [ ] No slab type indicators (S1-S8) labeled as detail
- [ ] No grid callouts labeled as detail
- [ ] No room numbers labeled as detail
- [ ] Detail class has 500+ examples
- [ ] Model trained with 3 classes only
- [ ] Validation shows >85% precision and >85% recall for detail
- [ ] Works on both US and Canadian plans

---

## Next Steps After This Works

Once the simplified 3-class model works well (>85% precision/recall), we can add:

1. **Section callouts** (if needed)
2. **Context-aware slab type detection** (if users want to identify slab types)
3. **Grid callout detection** (for better context filtering)
4. **Multi-region support** (if standards diverge in future)

**But for now**: Focus on the core 3 callout types that work reliably.

---

## Success Criteria

**Definition of "Production Ready"**:
- ✅ Detail callouts: >85% precision, >85% recall (on plans with dividers)
- ✅ Elevation callouts: >90% precision, >95% recall (already there!)
- ✅ Title callouts: >85% precision, >90% recall (already there!)
- ✅ Works on both US NCS and Canadian PSPC plans
- ✅ No confusion with slab types, grids, room numbers, dimensions

**This is achievable** with the simplified 3-class approach.
