# Detection and Validation Guide

## Overview

This guide covers how to:
1. Generate detections on new PDFs (without validation)
2. Generate detections with validation against ground truth
3. Interpret results
4. Integrate into production

## Quick Reference

```bash
# Just detect (no validation)
python test_v5_sahi.py

# Detect + validate (with ground truth)
python generate_detection_json.py ... && \
python src/validate_with_ground_truth.py ...
```

## Detection Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│               INPUT: PDF + Page Number                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Render Page (72 DPI)                            │
│  python generate_detection_json.py pdf.pdf 5 out.json out.png   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│            SAHI Tiling + YOLO Detection                          │
│  • Tiles: 2048×2048 with 0.2 overlap                            │
│  • Model: runs/detect/v5_combined2/weights/best.pt              │
│  • Confidence: 0.25                                              │
│  • Filters: Enabled                                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                 OUTPUT: Detection JSON                           │
│  {                                                               │
│    "detections": [                                               │
│      {"bbox": [x,y,w,h], "class": "detail", "confidence": 0.87},│
│      ...                                                         │
│    ]                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Method 1: Simple Detection (No Validation)

Use when you just want to detect callouts on a PDF without checking accuracy.

### Script: `test_v5_sahi.py`

```bash
python test_v5_sahi.py
```

**Customization:**
Edit the script to change:
- PDF path: `PLAN_4PAGE = '/path/to/your/plan.pdf'`
- Pages to process: `start_page=2, end_page=10`
- Output directory: `OUTPUT_DIR = Path('my_output')`

**Output:**
```
test_v5_sahi_output/
└── plan_name/
    ├── page2_annotated.png  # Image with detections drawn
    ├── page3_annotated.png
    └── ...
```

**Output Format:**
- Annotated images with bounding boxes
- Blue boxes: detail callouts
- Green boxes: elevation callouts
- Cyan boxes: title callouts
- Text shows class and confidence

### Programmatic Usage

```python
from ultralytics import YOLO
import sys
from pathlib import Path

sys.path.insert(0, 'src')
from sahi_tiling import tile_image, merge_detections
from postprocess_filters import apply_all_filters

# Load model
model = YOLO('runs/detect/v5_combined2/weights/best.pt')

# Render PDF page at 72 DPI
image = render_pdf_page('plan.pdf', page_num=5, dpi=72)

# Detect with SAHI
tiles = tile_image(image, tile_size=2048, overlap=0.2)
all_detections = []

for tile, offset in tiles:
    results = model.predict(tile, conf=0.25, iou=0.5, verbose=False)
    # Extract boxes and adjust coordinates
    # ... (see test_v5_sahi.py for full implementation)

# Merge overlapping detections
merged = merge_detections(all_detections, iou_threshold=0.5)

# Apply filters
filtered = apply_all_filters(merged, verbose=False)

# Use detections
for det in filtered['filtered_detections']:
    print(f"{det['class']}: {det['bbox']} (conf={det['confidence']:.2f})")
```

## Method 2: Detection with Validation

Use when you have ground truth annotations and want to measure accuracy.

### Step 1: Generate Detection JSON

```bash
python generate_detection_json.py \
  /path/to/plan.pdf \
  5 \
  page5_detections.json \
  page5_image.png
```

**Parameters:**
- `pdf_path`: Path to PDF file
- `page_num`: Page number (1-indexed)
- `output_json`: Where to save detection JSON
- `output_image`: Where to save rendered page (for validation script)

**Output:**
- `page5_detections.json`: Detection results in JSON format
- `page5_image.png`: Rendered page image (72 DPI)

**JSON Format:**
```json
{
  "detections": [
    {
      "bbox": [100.5, 200.3, 50.2, 30.1],
      "class": "detail",
      "confidence": 0.87
    },
    {
      "bbox": [300.1, 150.7, 45.3, 28.5],
      "class": "elevation",
      "confidence": 0.92
    }
  ]
}
```

### Step 2: Validate Against Ground Truth

```bash
python src/validate_with_ground_truth.py \
  page5_image.png \
  page5_detections.json \
  dataset_v6/test/labels/page5_annotation.txt \
  --output page5_validation.png
```

**Parameters:**
- `image`: Rendered page image (from step 1)
- `detection_json`: Detection results (from step 1)
- `annotation`: Roboflow ground truth (.txt file in YOLO format)
- `--output`: Where to save validation visualization

**Output (Console):**
```
============================================================
VALIDATION RESULTS
============================================================

Ground Truth: 25 callouts
Detected: 23 callouts

True Positives: 23
False Positives: 0
False Negatives: 2

Precision: 100.0%
Recall: 92.0%
F1 Score: 95.8%

Class        Precision    Recall       F1           TP     FP     FN     GT
--------------------------------------------------------------------------------
detail       100.0%       83.3%        90.9%        10     0      2      12
elevation    0.0%         0.0%         0.0%         0      0      0      0
title        100.0%       100.0%       100.0%       13     0      0      13

Validation visualization saved: page5_validation.png
```

**Output (Image):**
- Green boxes: True Positives (correctly detected)
- Red boxes: False Positives (incorrect detections)
- Blue boxes: False Negatives (missed callouts)

### Step 3: Create Comparison Visualization

```python
python create_comparison_images.py
```

Edit the script to specify:
- Ground truth visualization path
- Model output path
- Validation result path
- Output comparison path

**Output:**
Three-panel comparison image:
```
[Ground Truth] | [Model Detections] | [Validation (TP/FP/FN)]
```

## Batch Processing

### Process Multiple Pages

```python
# Process pages 10-20 with validation
for page_num in range(10, 21):
    # Generate detections
    os.system(f"""
        python generate_detection_json.py \
          plan.pdf {page_num} \
          page{page_num}_det.json \
          page{page_num}_img.png
    """)

    # Validate (if ground truth exists)
    gt_file = f"dataset_v6/test/labels/page{page_num}.txt"
    if os.path.exists(gt_file):
        os.system(f"""
            python src/validate_with_ground_truth.py \
              page{page_num}_img.png \
              page{page_num}_det.json \
              {gt_file} \
              --output page{page_num}_val.png
        """)
```

### Process Entire PDF

```python
import fitz

doc = fitz.open('plan.pdf')
num_pages = doc.page_count
doc.close()

for page_num in range(1, num_pages + 1):
    print(f"Processing page {page_num}/{num_pages}...")
    # Run detection
    # ... (same as above)
```

## Interpreting Results

### Precision
**Formula:** TP / (TP + FP)

**Meaning:** Of all detections made, how many were correct?

**Example:**
- Detected 100 callouts
- 90 were real callouts (TP)
- 10 were false (FP)
- Precision = 90 / (90 + 10) = 90%

**High precision (>90%):** Few false positives ✅
**Low precision (<70%):** Many false positives ❌

### Recall
**Formula:** TP / (TP + FN)

**Meaning:** Of all real callouts, how many did we find?

**Example:**
- 100 real callouts in ground truth
- Found 90 (TP)
- Missed 10 (FN)
- Recall = 90 / (90 + 10) = 90%

**High recall (>90%):** Finding almost all callouts ✅
**Low recall (<70%):** Missing many callouts ❌

### F1 Score
**Formula:** 2 × (Precision × Recall) / (Precision + Recall)

**Meaning:** Harmonic mean of precision and recall (balanced measure).

**Example:**
- Precision = 95%
- Recall = 90%
- F1 = 2 × (0.95 × 0.90) / (0.95 + 0.90) = 92.4%

**High F1 (>90%):** Good balance ✅
**Low F1 (<80%):** Poor overall performance ❌

### Per-Class Metrics

Look at metrics for each class separately:

**Example:**
```
detail:     90% precision, 85% recall ← Detail callouts hardest to detect
elevation:  95% precision, 98% recall ← Elevation performing well
title:      100% precision, 95% recall ← Title performing best
```

**Action:** If one class underperforms, add more training examples of that class.

## Production Integration

### API Endpoint Example

```python
from fastapi import FastAPI, File, UploadFile
import tempfile

app = FastAPI()

@app.post("/detect")
async def detect_callouts(
    pdf: UploadFile = File(...),
    page: int = 1
):
    # Save uploaded PDF
    with tempfile.NamedTemporaryFile(suffix='.pdf') as tmp:
        tmp.write(await pdf.read())
        tmp.flush()

        # Render page
        image = render_pdf_page(tmp.name, page, dpi=72)

        # Detect
        detections = detect_with_sahi(model, image)

        return {
            "page": page,
            "detections": detections,
            "count": len(detections)
        }
```

### Batch Processing Service

```python
def process_plan(pdf_path: str, output_dir: Path):
    """Process entire plan and save results."""
    doc = fitz.open(pdf_path)

    results = {
        "pdf": pdf_path,
        "total_pages": doc.page_count,
        "pages": []
    }

    for page_num in range(1, doc.page_count + 1):
        # Render
        image = render_pdf_page(pdf_path, page_num, dpi=72)

        # Detect
        detections = detect_with_sahi(model, image)

        # Save results
        page_result = {
            "page": page_num,
            "detections": len(detections),
            "detail": sum(1 for d in detections if d['class'] == 'detail'),
            "elevation": sum(1 for d in detections if d['class'] == 'elevation'),
            "title": sum(1 for d in detections if d['class'] == 'title'),
        }
        results["pages"].append(page_result)

        # Save annotated image
        save_annotated(image, detections, output_dir / f"page{page_num}.png")

    doc.close()

    # Save summary
    with open(output_dir / "summary.json", 'w') as f:
        json.dump(results, f, indent=2)

    return results
```

## Optimization Tips

### 1. Batch GPU Inference

Instead of processing tiles one-by-one, batch them:

```python
# Slow: Process tiles sequentially
for tile, offset in tiles:
    results = model.predict(tile, conf=0.25)

# Fast: Batch tiles together
tile_images = [tile for tile, _ in tiles]
results = model.predict(tile_images, conf=0.25)  # Process all at once
```

**Speedup:** 2-3x faster on GPU

### 2. Lower Resolution for Preview

For UI preview/thumbnails, use lower DPI:

```python
# Full quality (production)
image = render_pdf_page(pdf_path, page, dpi=72)  # 3456x2592

# Preview quality (faster)
image = render_pdf_page(pdf_path, page, dpi=36)  # 1728x1296 (4x fewer pixels)
```

**Speedup:** 4x faster rendering, 2x faster detection
**Tradeoff:** May miss small callouts

### 3. Cache Rendered Pages

Don't re-render the same page:

```python
page_cache = {}

def get_page(pdf_path, page_num):
    key = (pdf_path, page_num)
    if key not in page_cache:
        page_cache[key] = render_pdf_page(pdf_path, page_num)
    return page_cache[key]
```

### 4. Parallel Processing

Process multiple pages in parallel:

```python
from multiprocessing import Pool

def process_page(args):
    pdf_path, page_num = args
    # ... detection logic ...
    return results

with Pool(processes=4) as pool:
    args = [(pdf_path, p) for p in range(1, num_pages + 1)]
    results = pool.map(process_page, args)
```

**Speedup:** Nearly linear with CPU cores (4 cores = 4x faster)
**Note:** GPU inference doesn't parallelize well (use batching instead)

## Troubleshooting

### No Detections

**Possible causes:**
1. Model not loaded correctly
2. Confidence threshold too high
3. Image not rendered correctly
4. Wrong DPI

**Debug:**
```python
# Check model loaded
print(model)  # Should show YOLO model info

# Lower confidence threshold
detections = detect_with_sahi(model, image, conf=0.1)

# Check image
cv2.imwrite('debug_image.png', image)

# Verify DPI
print(f"Image size: {image.shape}")  # Should be ~3456x2592 for 24"x18" plan
```

### Too Many False Positives

**Solution:**
1. Enable post-processing filters (should be on by default)
2. Increase confidence threshold: `conf=0.3` or `conf=0.4`
3. Add negative examples to training data

### Low Recall (Missing Callouts)

**Solution:**
1. Lower confidence threshold: `conf=0.2` or `conf=0.15`
2. Check SAHI tiling is enabled
3. Verify DPI is 72 (not lower)
4. Add more training examples

### Detections in Wrong Location

**Cause:** Coordinate adjustment after tiling is broken

**Debug:**
```python
# Check tile offsets
for tile, offset in tiles:
    print(f"Tile offset: {offset}")  # Should be (0,0), (1024,0), etc.

# Verify bbox adjustment
bbox_global = adjust_coordinates(bbox_local, offset)
print(f"Local: {bbox_local}, Offset: {offset}, Global: {bbox_global}")
```

### Slow Processing

**Optimization steps:**
1. Use GPU instead of CPU
2. Batch tile processing
3. Lower DPI for preview (36 instead of 72)
4. Reduce image quality if acceptable
5. Process pages in parallel (CPU-bound parts)

**Typical speed:**
- CPU: 5-10 seconds/page
- GPU (RTX 3060): 2-3 seconds/page
- GPU with batching: 1-2 seconds/page
