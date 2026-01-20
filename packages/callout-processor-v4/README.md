# Callout Detection (YOLO26)

Detect callout symbols (detail circles, elevation triangles, title blocks) in construction/engineering drawings using YOLO26.

> **Important**: See bead `sitelink-e1z` for context on the DPI/resolution decision that affects inference quality.

## Quick Start

### Run Detection on a PDF (Recommended)

Use **72 DPI** rendering for best results - this matches the training scale where callouts are ~30-50px.

```bash
python src/unified_pipeline.py \
  --pdf your_plan.pdf \
  --output ./output \
  --dpi 72 \
  --conf 0.1
```

### Why 72 DPI?

The model was trained on full-page images at ~2048x1536 resolution (equivalent to 72 DPI rendering):
- At **72 DPI**: Full page is ~3400x2600px, callouts are ~30-50px ✅ Matches training
- At **300 DPI**: Full page is ~14,400x10,800px, callouts in tiles are ~5-10px ❌ Too small

See `sitelink-e1z` for the full analysis.

### Run Detection on an Image

```bash
python -c "
from ultralytics import YOLO
model = YOLO('weights/callout_detector.pt')
results = model('your_image.png', conf=0.1, imgsz=2048)
results[0].save('output.png')
print(f'Found {len(results[0].boxes)} callouts')
"
```

Or use the inference script (for images already rendered at appropriate resolution):

```bash
python src/infer_yolo.py \
  --model weights/callout_detector.pt \
  --image your_plan.png \
  --output detected.png \
  --conf 0.1
```

### Output
- Annotated image with bounding boxes
- Classes: `detail` (circles), `elevation` (triangles), `title` (title blocks)

## Training

### Prerequisites

```bash
pip install ultralytics pillow opencv-python
```

### Dataset Structure

```
roboflow_native/
├── data.yaml
├── train/
│   ├── images/
│   └── labels/
└── valid/
    ├── images/
    └── labels/
```

Labels are YOLO format: `class_id x_center y_center width height` (normalized 0-1)

### Train a New Model

```bash
python src/train_yolo.py \
  --model yolo26n.pt \
  --data roboflow_native/data.yaml \
  --imgsz 2048 \
  --epochs 100 \
  --name my_training_run
```

### Training Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--model` | yolo26n.pt | Base model (yolo26n.pt, yolo11n.pt, yolo11s.pt) |
| `--imgsz` | 2560 | Training resolution (2048+ recommended for small callouts) |
| `--batch` | 2 | Batch size (reduce if GPU OOM) |
| `--epochs` | 100 | Training epochs (early stopping enabled) |
| `--data` | dataset/dataset.yaml | Path to dataset YAML |
| `--device` | 0 | GPU device (0, 1, or cpu) |

### Why 2048+ Resolution?

Callout symbols are small (~20-30px in original plans). At lower resolutions:

| Resolution | Callout Size | Detection |
|------------|--------------|-----------|
| 640px | ~5px | ❌ Too small |
| 1280px | ~9px | ❌ Below threshold |
| 2048px | ~18px | ✅ Detectable |

YOLO needs objects ≥16-20px for reliable detection.

## Creating a Dataset

### Option 1: Roboflow (Recommended)

1. Upload plan images to [Roboflow](https://roboflow.com)
2. Label callouts with classes: `detail`, `elevation`, `title`
3. Export as "YOLOv8" or "YOLO26" format
4. **Important**: Disable "Resize" preprocessing or set to native resolution

### Option 2: Manual YOLO Labels

Create label files matching image names:

```
# image: plans/sheet1.png
# label: plans/sheet1.txt

0 0.5 0.3 0.02 0.03   # detail at center-ish, small box
1 0.8 0.2 0.015 0.025 # elevation at top-right
2 0.1 0.9 0.08 0.02   # title at bottom-left
```

Class IDs: 0=detail, 1=elevation, 2=title

### Labeling Tips

1. **Tight boxes**: Only include the symbol (circle/triangle), not pointer lines
2. **Consistent sizing**: Keep boxes tight around the symbol
3. **All instances**: Label every callout, even partially visible ones

## Model Architecture

We use **YOLO26n** instead of YOLO11n:

| Model | Layers | Parameters | Advantage |
|-------|--------|------------|-----------|
| YOLO11n | 182 | 2.59M | Standard |
| YOLO26n | 260 | 2.57M | 43% deeper, better small object features |

The deeper architecture extracts better features for small symbols.

## Performance

Current model (`weights/callout_detector.pt`) trained on 2048px images:

| Class | Precision | Recall | mAP50 |
|-------|-----------|--------|-------|
| detail | ~85% | ~80% | ~82% |
| elevation | ~80% | ~75% | ~78% |
| title | ~70% | ~45% | ~55% |
| **Overall** | ~78% | ~67% | **~82%** |

> Note: Best results when inference resolution matches training (~3400x2600 at 72 DPI).

### Metrics Explained

- **mAP50**: Mean Average Precision at 50% IoU - measures detection accuracy where predicted boxes must overlap ≥50% with ground truth
- **Precision**: Of all detections, what % are correct
- **Recall**: Of all ground truth callouts, what % were found

## Files

```
callout-processor-v4/
├── src/
│   ├── train_yolo.py      # Training script
│   ├── infer_yolo.py      # Inference with tiling
│   └── ...
├── weights/
│   └── callout_detector.pt # Trained YOLO26 model
├── roboflow_native/        # Dataset (2048px native)
├── yolo26n.pt              # Base YOLO26 weights
├── yolo11n.pt              # Base YOLO11 weights
└── output/                 # Detection outputs
```

## Troubleshooting

### Low detection on PDFs
Use 72 DPI rendering (not 300 DPI) to match training scale:
```bash
python src/unified_pipeline.py --pdf plan.pdf --output ./out --dpi 72
```

### Low detection on pre-rendered images
If images are from high-DPI rendering, downscale to ~3400x2600 or use tiled inference:
```bash
python src/infer_yolo.py --tile-size 2048 --overlap 0.25
```

### GPU Out of Memory
Reduce batch size or image size:
```bash
python src/train_yolo.py --batch 1 --imgsz 1280
```

### Detail vs Elevation confusion
The model sometimes confuses these classes. Solutions:
1. Tighter annotations (symbol only, no pointer lines)
2. More training examples for elevation class
3. Post-process with shape analysis (circles vs triangles)

## Future Improvements

1. **300 DPI training**: Train on tiled 300 DPI images for higher quality output (requires re-annotation on tiles, could use Google Colab for GPU)
2. **Tighter annotations**: Exclude pointer lines from bounding boxes
3. **More data**: Expand training set with more Canadian (PSPC) examples
4. **Section class**: Add section callout class (currently only detail, elevation, title)
