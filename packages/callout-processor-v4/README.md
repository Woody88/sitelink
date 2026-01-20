# Callout Detection (YOLO26)

Detect callout symbols (detail circles, elevation triangles, title blocks) in construction/engineering drawings using YOLO26.

## Quick Start

### Run Detection on an Image

```bash
python -c "
from ultralytics import YOLO
model = YOLO('weights/callout_detector.pt')
results = model('your_image.png', conf=0.25, imgsz=2048)
results[0].save('output.png')
print(f'Found {len(results[0].boxes)} callouts')
"
```

Or use the inference script with tiled detection for large images:

```bash
python src/infer_yolo.py \
  --model weights/callout_detector.pt \
  --image your_plan.png \
  --output detected.png \
  --tile-size 1024 \
  --conf 0.25
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

Current model (`weights/callout_detector.pt`):

| Class | Precision | Recall | mAP50 |
|-------|-----------|--------|-------|
| detail | 69.5% | 78.9% | 78.8% |
| title | 65.3% | 38.5% | 51.4% |
| **Overall** | 67.4% | 58.7% | **65.1%** |

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

### Low detection on large plans
Use tiled inference or resize to 2048px:
```bash
python src/infer_yolo.py --tile-size 1024 --overlap 0.25
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

1. **Tighter annotations**: Exclude pointer lines from bounding boxes
2. **Class simplification**: Merge detail+elevation into "callout" class
3. **SAHI inference**: For plans >2048px without quality loss
4. **More data**: Expand training set for better generalization
