# Training and Retraining Guide

## Overview

This guide covers how to train a new callout detection model or retrain an existing one with additional data.

## Training Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Collect & Annotate Data in Roboflow                     │
│  • Upload PDF pages as images (rendered at 72 DPI)              │
│  • Annotate callouts with bounding boxes                        │
│  • Assign classes: detail (0), elevation (1), title (2)         │
│  • Goal: 100+ diverse images for good generalization            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Export Dataset from Roboflow                            │
│  • Format: YOLO v8 (PyTorch)                                    │
│  • Split: 70% train, 20% valid, 10% test                        │
│  • Augmentation: Roboflow handles this automatically            │
│  • Download: .zip file with train/valid/test splits             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Prepare Dataset Locally                                 │
│  • Extract .zip to dataset_vX/                                  │
│  • Verify structure: dataset_vX/{train,valid,test}/{images,labels}
│  • Check data.yaml has correct paths and class names            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Train Model                                             │
│  • Script: train_combined.py                                    │
│  • Duration: 2-4 hours (100-300 epochs)                         │
│  • Monitor: Training loss, validation mAP, recall               │
│  • Output: runs/detect/vX_combined/weights/best.pt              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Validate Model                                          │
│  • Generate detections on test pages                            │
│  • Compare against Roboflow ground truth                        │
│  • Calculate precision/recall/F1                                │
│  • Target: >70% precision, >90% recall                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Deploy or Iterate                                       │
│  • If metrics meet targets → Deploy to production               │
│  • If metrics below targets → Collect more data and retrain     │
└─────────────────────────────────────────────────────────────────┘
```

## Step 1: Collect & Annotate Data

### 1.1 Render PDFs to Images

Use the same settings as inference (72 DPI):

```python
import fitz  # PyMuPDF
from PIL import Image
import numpy as np

def render_pdf_page(pdf_path, page_num, dpi=72):
    """Render PDF page at 72 DPI for annotation."""
    doc = fitz.open(pdf_path)
    page = doc[page_num - 1]

    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()

    return img

# Example: Render all pages
for page_num in range(1, doc.page_count + 1):
    img = render_pdf_page("plan.pdf", page_num)
    img.save(f"page_{page_num:03d}.png")
```

### 1.2 Upload to Roboflow

1. Create/open Roboflow project
2. Upload rendered images
3. Annotate callouts with bounding boxes
4. Assign correct class:
   - **detail**: Small circular/rectangular callouts with numbers (e.g., "1", "A3")
   - **elevation**: Similar to detail, often on elevation views
   - **title**: Larger boxes with detail titles (e.g., "WALL SECTION A-A")

**Annotation Guidelines:**
- Draw tight bounding boxes around callouts (no extra whitespace)
- Include leader lines if they're part of the callout
- For title blocks, include the entire text box
- Exclude page margins and sheet numbers

### 1.3 Quality Check

Before exporting:
- ✅ All images have annotations (no blank images)
- ✅ Classes are assigned correctly
- ✅ Bounding boxes are tight and accurate
- ✅ No duplicate annotations
- ✅ Dataset size: 100+ images for good generalization

## Step 2: Export Dataset

### 2.1 Roboflow Export Settings

1. Go to "Versions" in Roboflow
2. Click "Export Dataset"
3. Select:
   - **Format:** YOLO v8 (PyTorch)
   - **Split:** 70% train, 20% valid, 10% test (or custom)
   - **Augmentation:** Let Roboflow handle (rotation, brightness, etc.)
4. Download .zip file

### 2.2 Dataset Structure

After extraction, you should have:

```
dataset_vX/
├── data.yaml           # Dataset configuration
├── train/
│   ├── images/         # Training images (.jpg or .png)
│   │   ├── image1.jpg
│   │   ├── image2.jpg
│   │   └── ...
│   └── labels/         # YOLO annotations (.txt)
│       ├── image1.txt
│       ├── image2.txt
│       └── ...
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

### 2.3 Verify data.yaml

```yaml
path: /absolute/path/to/dataset_vX
train: train/images
val: valid/images
test: test/images

nc: 3  # Number of classes
names:
  0: detail
  1: elevation
  2: title
```

**Critical:** Update `path` to absolute path on your system.

## Step 3: Train Model

### 3.1 Training Script

Use `train_combined.py`:

```python
from ultralytics import YOLO

# Load pretrained YOLO-26n model
model = YOLO('yolo26n.pt')

# Train
results = model.train(
    data='dataset_v6/data.yaml',  # Update to your dataset
    epochs=200,                    # 100-300 recommended
    imgsz=640,                     # YOLO standard input size
    batch=16,                      # Adjust based on GPU memory
    device=0,                      # GPU 0, or 'cpu' for CPU training
    project='runs/detect',
    name='v6_combined',            # Update version number
    patience=50,                   # Early stopping patience
    save=True,
    verbose=True,
)
```

### 3.2 Training Parameters

**Essential Parameters:**
- `epochs`: 100-300 (stop when validation mAP plateaus)
- `imgsz`: 640 (DO NOT CHANGE - YOLO standard)
- `batch`: 16-32 (higher = faster but needs more GPU memory)
- `device`: 0 for GPU, 'cpu' for CPU training

**Optional Parameters:**
- `patience`: 50 (stop if no improvement for 50 epochs)
- `lr0`: 0.01 (initial learning rate, auto-tuned by YOLO)
- `weight_decay`: 0.0005 (regularization)

### 3.3 Monitor Training

During training, monitor:
- **Training loss:** Should decrease steadily
- **Validation mAP:** Should increase then plateau
- **Validation recall:** Most important for our use case
- **Validation precision:** Should stay high (>80%)

**Good training:**
```
Epoch    GPU_mem   box_loss   cls_loss   dfl_loss   Instances       mAP50    mAP50-95
  100/200  4.2G      0.823      0.412      1.234       123         0.876      0.642
  150/200  4.2G      0.645      0.298      1.089       123         0.912      0.698
  200/200  4.2G      0.598      0.271      1.012       123         0.925      0.715
```

**Bad training (overfitting):**
```
Epoch    mAP50_train  mAP50_valid
  100      0.95         0.82   ← Training much higher than validation
  150      0.98         0.81   ← Gap increasing
  200      0.99         0.79   ← Validation decreasing = OVERFITTING
```

**Solution for overfitting:**
- More training data
- More augmentation
- Lower learning rate
- Add regularization (weight_decay)

### 3.4 Output Files

After training:
```
runs/detect/v6_combined/
├── weights/
│   ├── best.pt        # Best model (use this for inference)
│   └── last.pt        # Last epoch checkpoint
├── results.csv        # Training metrics per epoch
├── confusion_matrix.png
├── PR_curve.png
├── F1_curve.png
└── train_batch*.jpg   # Sample training batches
```

## Step 4: Validate Model

### 4.1 Test on Unseen Pages

Use pages NOT in training/validation sets:

```bash
python generate_detection_json.py \
  test_plan.pdf \
  5 \
  test_page5_detections.json \
  test_page5_image.png
```

### 4.2 Compare to Ground Truth

```bash
python src/validate_with_ground_truth.py \
  test_page5_image.png \
  test_page5_detections.json \
  dataset_v6/test/labels/test_page5.txt \
  --output test_page5_validation.png
```

### 4.3 Metrics Interpretation

**Target Metrics:**
- Precision: >70%
- Recall: >90%
- F1: >80%

**If metrics are below target:**

| Issue | Solution |
|-------|----------|
| Low precision (<70%) | Enable post-processing filters |
| Low recall (<90%) | Lower confidence threshold (0.2-0.25) |
| Low recall (<90%) AND threshold already low | Need more training data |
| High precision but low recall | Model is too conservative - add more diverse examples |
| Low precision AND low recall | Model is confused - check class labels are correct |

### 4.4 Visual Inspection

Always visually inspect validation results:
- **Green boxes (TP):** Should cover all real callouts
- **Red boxes (FP):** Should be minimal (check if filters can remove them)
- **Blue boxes (FN):** Identify patterns - are they all small? Specific type?

## Step 5: Iterate or Deploy

### 5.1 If Metrics Meet Targets

✅ **Deploy to production:**

1. Copy model weights to production location:
   ```bash
   cp runs/detect/v6_combined/weights/best.pt production/callout_detector_v6.pt
   ```

2. Update production config to use new model
3. Test on production data
4. Monitor performance

### 5.2 If Metrics Below Target

❌ **Collect more data and retrain:**

**Identify failure patterns:**
```bash
# Extract false negatives for retraining
python src/validate_with_ground_truth.py \
  image.png detections.json ground_truth.txt \
  --extract-fn fn_crops/
```

**Add to Roboflow:**
1. Upload FN crops to Roboflow
2. Annotate correctly
3. Generate new dataset version
4. Retrain (go back to Step 2)

**Common failure patterns:**
- **Missing small callouts:** Add more small callout examples
- **Confusing detail vs elevation:** Add more clear examples of each
- **Missing title blocks:** Add more title block examples
- **False positives on text:** Add negative examples (pages with text but no callouts)

## Retraining Workflow

When adding new data to existing model:

```
1. Start with existing Roboflow project
2. Add new images + annotations
3. Generate new dataset version (v6 → v7)
4. Download new .zip file
5. Extract to dataset_v7/
6. Update train_combined.py to use dataset_v7/data.yaml
7. Train new model: v7_combined
8. Validate: compare v7 vs v6 performance
9. If v7 better → deploy, else → iterate
```

## Best Practices

### Data Collection
- ✅ Diverse plans (different architects, standards, years)
- ✅ Mix of page types (floor plans, elevations, details)
- ✅ Both Canadian NCS and US plans
- ✅ Different scales and complexity levels
- ❌ Don't just collect one type of plan

### Annotation Quality
- ✅ Consistent bounding box tightness
- ✅ Correct class labels (double-check detail vs elevation)
- ✅ Include difficult/edge cases
- ❌ Don't skip hard-to-annotate callouts

### Training
- ✅ Use GPU for training (10-20x faster)
- ✅ Monitor both precision AND recall (not just mAP)
- ✅ Save checkpoints frequently
- ✅ Use early stopping (patience=50)
- ❌ Don't train for too many epochs (overfitting)

### Validation
- ✅ Test on completely unseen plans
- ✅ Calculate per-class metrics (detail, elevation, title separately)
- ✅ Visual inspection of results
- ❌ Don't trust metrics alone - look at the images!

## Troubleshooting

### "CUDA out of memory"
**Solution:** Reduce batch size (16 → 8 → 4)

### "Dataset not found"
**Solution:** Check `path` in data.yaml is absolute path

### "No convergence after 100 epochs"
**Solution:**
- Check learning rate (try lr0=0.001 for slower, more stable)
- Verify dataset quality (no corrupted images/labels)
- Try different architecture (yolo26s instead of yolo26n)

### "Model detects nothing"
**Solution:**
- Check confidence threshold (try 0.1 for testing)
- Verify model loaded correctly
- Test on training images first (should work perfectly)

### "Too many false positives"
**Solution:**
- Enable post-processing filters
- Increase confidence threshold (0.3-0.4)
- Add negative examples to training data

### "Missing specific callout types"
**Solution:**
- Collect 20+ examples of that type
- Annotate carefully
- Retrain and validate
