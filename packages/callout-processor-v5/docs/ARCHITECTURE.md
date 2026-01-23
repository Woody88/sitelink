# Callout Detection Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT: PDF Plan                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PDF Rendering (PyMuPDF)                       │
│  • DPI: 72 (CRITICAL - DO NOT CHANGE)                           │
│  • Output: High-res image (e.g., 3456x2592 for 24"x18" plan)   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SAHI Tiling (Required)                        │
│  • Tile Size: 2048x2048 pixels (CRITICAL)                       │
│  • Overlap: 0.2 (20% overlap between tiles)                     │
│  • Why: YOLO can't handle full 3456x2592 images effectively     │
│  • Result: 2-4 tiles per page depending on aspect ratio         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              YOLO Detection (Per Tile)                           │
│  • Model: YOLO-26n (Ultralytics)                                │
│  • Input: 2048x2048 tile                                        │
│  • Confidence: 0.25 (CRITICAL)                                  │
│  • IoU: 0.5 (NMS threshold)                                     │
│  • Output: Bounding boxes + class + confidence                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│           NMS (Non-Maximum Suppression)                          │
│  • Merge overlapping detections from tile boundaries            │
│  • IoU threshold: 0.5                                           │
│  • Handles duplicate detections in overlap regions              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Post-Processing Filters                             │
│  1. Size Filter: Remove tiny/huge boxes                         │
│  2. Aspect Ratio Filter: Remove extreme rectangles              │
│  3. Area Filter: Remove boxes in invalid page regions           │
│  4. Class-Specific: Detail callouts can't be too wide           │
│  5. Title Filter: Skip filters for title callouts (exempt)      │
│  • Result: 88-100% detections retained (12% false positives removed)
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              OUTPUT: Final Detections                            │
│  • Format: [{"bbox": [x,y,w,h], "class": "detail|elevation|     │
│             title", "confidence": 0.0-1.0}]                     │
│  • Typical: 20-90 callouts per page                             │
└─────────────────────────────────────────────────────────────────┘
```

## Critical Parameters (DO NOT CHANGE)

### 1. DPI: 72
**Why:** This is the proven sweet spot from v4 testing.
- ✅ **72 DPI:** Perfect balance - callouts are clear, file size manageable
- ❌ **150 DPI:** Too large, SAHI generates 8+ tiles, slower processing
- ❌ **36 DPI:** Too small, tiny callouts become unreadable

**Impact:** Changing DPI requires retraining the entire model.

**Calculation:**
```
24" × 18" plan at 72 DPI = 1728×1296 pixels
24" × 18" plan at 150 DPI = 3600×2700 pixels (2.5x larger)
```

### 2. SAHI Tile Size: 2048×2048
**Why:** YOLO-26 was trained on 640×640 images, but scales well to 2048×2048.
- ✅ **2048:** Large enough to see detail callouts, small enough for GPU memory
- ❌ **1024:** Too small, splits callouts across tiles
- ❌ **4096:** Too large, GPU memory issues, slower processing

**Impact:** Changing tile size requires retraining.

### 3. SAHI Overlap: 0.2 (20%)
**Why:** Ensures callouts near tile edges are captured completely in at least one tile.
- ✅ **0.2:** Captures edge callouts without excessive duplication
- ❌ **0.0:** Misses callouts split across tile boundaries
- ❌ **0.5:** Too much duplication, slower processing, more false duplicates

### 4. Confidence Threshold: 0.25
**Why:** Lower threshold improves recall without excessive false positives (thanks to post-processing filters).
- ✅ **0.25:** 96.5% recall with 96.5% precision (validated)
- ❌ **0.5:** Higher precision but lower recall (misses ~20% of callouts)
- ❌ **0.1:** Too many false positives, filters can't remove them all

**Tunable:** This can be adjusted without retraining (0.2-0.3 range recommended).

### 5. Post-Processing Filters: ENABLED
**Why:** Removes 10-15% false positives while retaining all true positives.

**Impact:** Increases precision from ~85% to 96.5% with no recall loss.

**Classes:**
- `0`: detail (small circular/rectangular callouts with text/numbers)
- `1`: elevation (similar to detail, often on elevations)
- `2`: title (larger rectangular boxes with detail titles)

## Data Flow

```
Training Phase:
─────────────
Roboflow Dataset (YOLO format)
    │
    ├─ train/
    │   ├─ images/*.jpg
    │   └─ labels/*.txt (class x_center y_center width height)
    │
    ├─ valid/
    │   ├─ images/*.jpg
    │   └─ labels/*.txt
    │
    └─ test/ (optional)
        ├─ images/*.jpg
        └─ labels/*.txt

        ▼

    YOLO Training
    • Architecture: YOLO-26n
    • Input size: 640×640 (auto-resized by YOLO)
    • Epochs: 100-300
    • Batch size: 16-32
    • Optimizer: Adam

        ▼

    Model Weights
    • runs/detect/v5_combined2/weights/best.pt


Inference Phase:
────────────────
PDF → Render (72 DPI) → SAHI Tiles → YOLO → NMS → Filters → Detections


Validation Phase:
─────────────────
PDF → Render → SAHI → YOLO → NMS → Filters → Detection JSON
                                                     │
Ground Truth (Roboflow .txt) ────────────────────────┼──→ Validation Script
                                                     │
                                                     ▼
                                            TP/FP/FN Metrics
                                            Precision/Recall/F1
```

## Model Architecture

```
YOLO-26n (Ultralytics)
├── Backbone: CSPDarknet (lightweight)
├── Neck: PANet (feature pyramid)
├── Head: YOLO detection head
│   ├── 3 output scales (small/medium/large objects)
│   ├── Anchor-free detection
│   └── Classification + Bounding Box regression
│
└── Output: [class_id, x_center, y_center, width, height, confidence]
```

## File Formats

### YOLO Annotation Format (.txt)
```
class_id x_center y_center width height
0 0.5 0.5 0.1 0.1
1 0.3 0.7 0.05 0.05
2 0.8 0.2 0.15 0.08
```
- All coordinates normalized (0.0-1.0)
- class_id: 0=detail, 1=elevation, 2=title
- (x_center, y_center): Center of bounding box
- (width, height): Box dimensions

### Detection JSON Format
```json
{
  "detections": [
    {
      "bbox": [x, y, w, h],  // Pixel coordinates [x, y, width, height]
      "class": "detail",      // "detail" | "elevation" | "title"
      "confidence": 0.87      // 0.0-1.0
    }
  ]
}
```

## Performance Characteristics

### v5 Model (YOLO-26n)
- **Training data:** 89+ images (Canadian + US plans)
- **Classes:** detail, elevation, title
- **Performance:** 96.5% precision, 96.5% recall
- **Speed:** ~2-3 seconds per page (including SAHI tiling)
- **GPU:** Works on CPU, faster on GPU (CUDA)

### Typical Page Statistics
- **Floor plan:** 80-90 callouts (mostly elevation)
- **Detail sheet:** 20-40 callouts (mix of detail and title)
- **Elevation sheet:** 5-20 callouts (mostly detail)
- **Tile count:** 2-4 tiles per page at 72 DPI

## Error Handling

### Common Issues

**1. No detections:**
- Check PDF renders correctly (not encrypted/corrupted)
- Verify DPI is 72
- Check model weights loaded correctly

**2. Too many false positives:**
- Ensure post-processing filters are enabled
- Lower confidence threshold may help (0.2-0.25)
- Check if plan has unusual layout (may need retraining)

**3. Low recall (missing callouts):**
- Verify confidence threshold is 0.25 or lower
- Check if callouts are very small (< 20px) - may need higher DPI
- Verify SAHI tiling is enabled

**4. Detections at wrong locations:**
- Check tile coordinate adjustment is working
- Verify NMS is merging duplicates correctly
- Check image rendering didn't flip/rotate the PDF

## Dependencies

```
Core:
  ultralytics  # YOLO model
  opencv-python  # Image processing
  PyMuPDF (fitz)  # PDF rendering
  numpy  # Array operations

Training:
  Roboflow dataset (YOLO format)
  GPU with CUDA (optional but recommended)

Validation:
  All core dependencies
  Ground truth annotations (.txt files)
```

## Resource Requirements

### Training
- **GPU:** 8GB+ VRAM recommended (NVIDIA RTX 2060 or better)
- **RAM:** 16GB+ system RAM
- **Disk:** 10GB+ for dataset + model checkpoints
- **Time:** 2-4 hours for 100 epochs

### Inference
- **CPU:** Works on any modern CPU (slower)
- **GPU:** 4GB+ VRAM (much faster)
- **RAM:** 4GB+ system RAM
- **Disk:** 500MB for model weights

### Typical Processing Time (72 DPI, SAHI enabled)
- **CPU:** 5-10 seconds per page
- **GPU (RTX 3060):** 2-3 seconds per page
- **Large plan (100 pages):** 3-10 minutes total
