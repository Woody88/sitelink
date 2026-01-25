# Adding New Annotation Classes

## Overview

This guide covers how to add new callout classes beyond the current three (detail, elevation, title).

## Current Classes

```
0: detail     - Small circular/rectangular callouts (e.g., "1", "A3")
1: elevation  - Similar to detail, often on elevation views
2: title      - Larger boxes with detail titles (e.g., "WALL SECTION A-A")
```

## When to Add a New Class

Consider adding a new class when:
- ✅ There's a distinct visual difference from existing classes
- ✅ There's a semantic reason to treat them differently
- ✅ You have 50+ examples to annotate

**Don't add a new class if:**
- ❌ Visual appearance is similar to existing class
- ❌ Only a few examples exist
- ❌ No clear use case for separating them

**Example good cases:**
- `section` - Section cut symbols (distinct circle-with-arrow shape)
- `legend` - Legend symbols (often in title blocks)
- `keynote` - Keynote callouts (numbers in hexagons)

**Example bad cases:**
- `detail_small` vs `detail_large` - Size is not a good classifier
- `detail_floor_plan` vs `detail_elevation` - Location-based, not visual
- `detail_canadian` vs `detail_us` - Standard-based, not visual

## Adding a New Class: Step-by-Step

### Step 1: Update Roboflow Project

1. Log into Roboflow
2. Go to your callout detection project
3. Navigate to "Classes"
4. Click "Add Class"
5. Enter new class name (e.g., "section")
6. Save changes

### Step 2: Annotate Examples

1. Upload images containing the new class
2. Annotate at least 50-100 examples
3. Mix with existing classes (detail, elevation, title)
4. Ensure high-quality annotations

**Important:** Don't create a dataset with only the new class. Mix with existing classes so the model learns to distinguish them.

### Step 3: Export New Dataset

1. Go to "Versions" in Roboflow
2. Generate new version (e.g., v7 if current is v6)
3. Export as "YOLO v8 (PyTorch)"
4. Download .zip file

### Step 4: Verify Dataset Structure

```bash
unzip callout-detection.v7i.yolo26.zip -d dataset_v7
```

Check `dataset_v7/data.yaml`:

```yaml
path: /absolute/path/to/dataset_v7
train: train/images
val: valid/images
test: test/images

nc: 4  # Number of classes (was 3, now 4)
names:
  0: detail
  1: elevation
  2: title
  3: section  # New class
```

**Critical:** Verify `nc` matches number of classes and `names` includes all classes.

### Step 5: Update Code Constants

#### Update `CLASS_NAMES` in all scripts

Find and update in these files:

**`test_v5_sahi.py`:**
```python
CLASS_NAMES = ["detail", "elevation", "title", "section"]  # Add new class
```

**`generate_detection_json.py`:**
```python
CLASS_NAMES = ["detail", "elevation", "title", "section"]  # Add new class
```

**`src/validate_with_ground_truth.py`:**
```python
class_names = ['detail', 'elevation', 'title', 'section']  # Add new class
```

**`visualize_ground_truth.py`:**
```python
CLASS_NAMES = {0: 'detail', 1: 'elevation', 2: 'title', 3: 'section'}
CLASS_COLORS = {
    0: (255, 0, 0),    # Blue for detail
    1: (0, 255, 0),    # Green for elevation
    2: (0, 0, 255),    # Red for title
    3: (255, 255, 0),  # Cyan for section (choose unique color)
}
```

#### Update Post-Processing Filters (Optional)

If the new class has specific size/aspect ratio characteristics, add custom filters:

**`src/postprocess_filters.py`:**

```python
def apply_all_filters(detections, verbose=False):
    # ... existing code ...

    # Class-specific filters
    for det in size_filtered:
        if det['class'] == 'detail':
            # Existing detail filter
            if bbox[2] > 150:  # Too wide
                removed_by_class += 1
                continue
        elif det['class'] == 'section':
            # New section filter
            if bbox[2] < 30 or bbox[2] > 100:  # Section symbols ~30-100px wide
                removed_by_class += 1
                continue

        class_filtered.append(det)

    # ... rest of code ...
```

**Note:** Only add class-specific filters if you notice consistent false positives for that class.

### Step 6: Update Training Script

**`train_combined.py`:**

```python
# Update data path to new dataset
results = model.train(
    data='dataset_v7/data.yaml',  # Updated from v6
    epochs=200,
    imgsz=640,
    batch=16,
    device=0,
    project='runs/detect',
    name='v7_with_section',  # Descriptive name
    patience=50,
    save=True,
    verbose=True,
)
```

### Step 7: Train New Model

```bash
python train_combined.py
```

**Monitor training:**
- All 4 classes should appear in training logs
- Validation mAP should be similar or better than before
- New class should have decent precision/recall (>70%)

**Output:**
```
runs/detect/v7_with_section/weights/best.pt
```

### Step 8: Validate New Model

#### Test on pages with new class:

```bash
python generate_detection_json.py \
  plan_with_sections.pdf \
  5 \
  test_detections.json \
  test_image.png

python src/validate_with_ground_truth.py \
  test_image.png \
  test_detections.json \
  dataset_v7/test/labels/test_page.txt \
  --output validation.png
```

#### Check per-class performance:

```
Class        Precision    Recall       F1
--------------------------------------------------------------------------------
detail       95.0%        92.0%        93.5%
elevation    98.0%        97.0%        97.5%
title        100.0%       95.0%        97.4%
section      88.0%        85.0%        86.5%  ← New class performance
```

**Expected:** New class should have >70% precision and >80% recall.

**If below target:**
- Collect more examples (need 100+)
- Check annotation quality (are labels correct?)
- Add harder examples (edge cases, partial views)

### Step 9: Update Documentation

Update these files with new class info:

**`docs/ARCHITECTURE.md`:**
```markdown
**Classes:**
- `0`: detail (small circular/rectangular callouts)
- `1`: elevation (similar to detail)
- `2`: title (larger boxes with titles)
- `3`: section (section cut symbols)  ← Add description
```

**`docs/TRAINING.md`:**
```markdown
**Annotation Guidelines:**
- **detail**: Small callouts with numbers
- **elevation**: Similar to detail
- **title**: Larger text boxes
- **section**: Section cut symbols (circle with arrow)  ← Add guidelines
```

**`README.md`:**
Update class count and examples:
```markdown
Classes detected: 4 (detail, elevation, title, section)
```

### Step 10: Update Model in Production

```bash
# Backup old model
cp production/callout_detector.pt production/callout_detector_v6_backup.pt

# Deploy new model
cp runs/detect/v7_with_section/weights/best.pt production/callout_detector.pt
```

Test on production data before full deployment.

## Example: Adding "keynote" Class

### 1. Roboflow Setup

Add "keynote" class in Roboflow, annotate 100+ examples:
```
Existing:
  detail     (500 examples)
  elevation  (400 examples)
  title      (300 examples)

New:
  keynote    (100 examples)  ← Add these
```

### 2. Export v8 Dataset

```bash
unzip callout-detection.v8i.yolo26.zip -d dataset_v8
```

Verify `dataset_v8/data.yaml`:
```yaml
nc: 4
names:
  0: detail
  1: elevation
  2: title
  3: keynote
```

### 3. Update Code

**All detection scripts:**
```python
CLASS_NAMES = ["detail", "elevation", "title", "keynote"]
```

**Visualization script:**
```python
CLASS_NAMES = {
    0: 'detail',
    1: 'elevation',
    2: 'title',
    3: 'keynote'  # Add new
}

CLASS_COLORS = {
    0: (255, 0, 0),    # Blue
    1: (0, 255, 0),    # Green
    2: (0, 0, 255),    # Red
    3: (255, 0, 255),  # Magenta
}
```

### 4. Train

```python
model.train(
    data='dataset_v8/data.yaml',
    epochs=200,
    name='v8_with_keynote',
    ...
)
```

### 5. Validate

```bash
# Check keynote performance
python src/validate_with_ground_truth.py ...

# Expected output:
# keynote: 85% precision, 80% recall
```

### 6. Deploy

If metrics are good (>70% P, >80% R), deploy to production.

## Removing a Class

To remove an unused class:

### 1. Roboflow

1. Delete all annotations of that class
2. Remove class from project
3. Generate new dataset version

### 2. Update Code

Remove from `CLASS_NAMES` in all scripts:
```python
# Before
CLASS_NAMES = ["detail", "elevation", "title", "section"]

# After (removed "elevation")
CLASS_NAMES = ["detail", "title", "section"]
```

**Note:** Class IDs will shift:
```
Before:          After:
0: detail        0: detail
1: elevation     1: title    (was 2)
2: title         2: section  (was 3)
3: section
```

### 3. Retrain

Train new model with updated dataset.

### 4. Update All Ground Truth

If you have existing annotations with old class IDs, they must be updated:

```python
# Script to update class IDs in .txt files
def remap_class_ids(annotation_file):
    """Remap class IDs after removing elevation (class 1)."""
    with open(annotation_file) as f:
        lines = f.readlines()

    remapped = []
    for line in lines:
        parts = line.strip().split()
        class_id = int(parts[0])

        # Skip elevation (class 1)
        if class_id == 1:
            continue

        # Remap: 2→1, 3→2
        if class_id == 2:
            class_id = 1  # title: 2→1
        elif class_id == 3:
            class_id = 2  # section: 3→2

        parts[0] = str(class_id)
        remapped.append(' '.join(parts) + '\n')

    with open(annotation_file, 'w') as f:
        f.writelines(remapped)
```

**Warning:** Removing classes is complex and error-prone. Only do if absolutely necessary.

## Best Practices

### Class Design

✅ **Good class design:**
- Visually distinct (different shape, size, color)
- Semantically meaningful (different purpose in drawing)
- Sufficient examples (100+)

❌ **Bad class design:**
- Based on location (floor plan vs elevation)
- Based on standard (Canadian vs US)
- Too few examples (<50)
- Overlapping visual characteristics

### Annotation Consistency

When adding a new class:
- ✅ Create clear annotation guidelines
- ✅ Have one person annotate all examples (consistency)
- ✅ Double-check edge cases
- ❌ Don't mix similar-looking callouts across classes

### Testing

Before deploying model with new class:
- ✅ Test on pages with mix of all classes
- ✅ Verify precision/recall for new class
- ✅ Check confusion matrix (is new class confused with others?)
- ❌ Don't deploy without validation

### Incremental Approach

Start with few classes (3-4), add more only if needed:
1. **v1:** detail, title (2 classes) - simple
2. **v2:** detail, elevation, title (3 classes) - good
3. **v3:** detail, elevation, title, section (4 classes) - if needed
4. **v4:** ... (5+ classes) - only if absolutely necessary

**Reason:** More classes = more training data needed and higher chance of confusion.

## Troubleshooting

### New Class Has Low Precision

**Cause:** Model is detecting other things as the new class.

**Solution:**
- Add negative examples (similar-looking things that are NOT the class)
- Check annotation quality (are labels correct?)
- Adjust class-specific filters

### New Class Has Low Recall

**Cause:** Model is missing examples of the new class.

**Solution:**
- Add more diverse examples (different sizes, orientations, contexts)
- Lower confidence threshold temporarily to see if model detects them
- Check if examples are too similar to another class

### Class Confusion

**Symptom:** Model labels class A as class B.

**Check confusion matrix:**
```
Predicted →
Actual ↓     detail  elevation  title  section
detail       90      5          0      5      ← 5% confused with section
elevation    2       95         1      2
title        0       0          98     2
section      8       2          0      90     ← 8% confused with detail
```

**Solution:**
- Add more distinct examples of confused classes
- Improve annotation guidelines to clarify differences
- Consider merging classes if confusion is high (>20%)

### Training Doesn't Converge

**Cause:** Too many classes for amount of training data.

**Solution:**
- Collect more data (50+ per class minimum)
- Train for more epochs (300-500)
- Start with pretrained model (transfer learning)
- Reduce number of classes
