# Quick Start Guide: YOLO-26E Callout Detection

## Installation

```bash
cd packages/callout-processor-v5
pip install ultralytics numpy
```

## Basic Usage

### 1. Text-based Detection (Recommended First)

Test zero-shot detection with existing text prompts:

```bash
# Using US NCS prompts
python src/detect_yoloe.py \
  /path/to/your/plan.png \
  --method text \
  --prompts prompts/us_ncs.json \
  --conf 0.1 \
  --output output/results.json

# View results
cat output/results.json
```

### 2. Visual-based Detection

First, you need to create visual prompts by extracting crops from example plans:

```bash
# 1. Create some example crops (manual step - use screenshot tool)
#    Extract 3-5 callout symbols from a plan
#    Save to: examples/us/ncs/detail/detail_ncs_01.png, etc.

# 2. Run visual detection
python src/detect_yoloe.py \
  /path/to/your/plan.png \
  --method visual \
  --prompts examples/us/ncs \
  --conf 0.1 \
  --output output/results_visual.json
```

## Python API Example

```python
from src.detect_yoloe import detect_callouts_text, load_prompt_json

# Load prompts
prompts = load_prompt_json("prompts/us_ncs.json")

# Detect callouts
results = detect_callouts_text(
    "plan.png",
    prompts,
    conf_threshold=0.1,
    iou_threshold=0.5
)

# Process results
print(f"Found {results['metadata']['num_detections']} callouts")

for detection in results['detections']:
    print(f"{detection['callout_type']}: "
          f"bbox={detection['bbox']}, "
          f"conf={detection['confidence']:.2f}")
```

## Tuning Parameters

### Confidence Threshold

Controls detection sensitivity:

```bash
# More detections (may include false positives)
--conf 0.05

# Balanced (recommended starting point)
--conf 0.1

# Fewer, higher-confidence detections
--conf 0.2
```

### IoU Threshold

Controls duplicate suppression:

```bash
# Less aggressive (keeps more overlapping boxes)
--iou 0.3

# Balanced (recommended)
--iou 0.5

# More aggressive (removes overlaps)
--iou 0.7
```

## Testing Your Implementation

### 1. Run on Sample Plans

```bash
# Test on repository sample plans
python src/detect_yoloe.py \
  ../../apps/sample-plan.pdf \
  --method text \
  --prompts prompts/us_ncs.json \
  --output output/sample_results.json
```

### 2. Visualize Results

```python
from PIL import Image, ImageDraw
import json

# Load image and results
img = Image.open("plan.png")
draw = ImageDraw.Draw(img)

with open("output/results.json") as f:
    results = json.load(f)

# Draw bounding boxes
for det in results['detections']:
    x, y, w, h = det['bbox']
    draw.rectangle([x, y, x+w, y+h], outline='red', width=2)
    draw.text((x, y-10), f"{det['callout_type']}: {det['confidence']:.2f}")

img.save("output/annotated.png")
print("Saved annotated image to output/annotated.png")
```

## Common Issues

### "Model not found"

The model auto-downloads on first use. Ensure internet connection.

### "No detections found"

- Try lowering confidence: `--conf 0.05`
- Verify image is readable (PNG/JPG)
- Check image resolution (72-300 DPI recommended)

### "Too many false positives"

- Raise confidence: `--conf 0.2`
- Improve text prompts with more specific descriptions
- Add post-processing filters

## Next Steps

1. Run on test plans to evaluate performance
2. Compare text vs visual methods
3. Extract visual prompts from your specific plans
4. Tune thresholds for your use case
5. Integrate with validation pipeline

## File Locations

- **Source code**: `src/detect_yoloe.py`
- **Text prompts**: `prompts/*.json`
- **Visual prompts**: `examples/*/[standard]/[callout_type]/*.png`
- **Output**: `output/*.json`
- **Documentation**: `src/README.md`, `IMPLEMENTATION.md`

## Help

```bash
python src/detect_yoloe.py --help
```
