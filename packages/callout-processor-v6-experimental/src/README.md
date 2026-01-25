# YOLO-26E Callout Detection

Zero-shot and one-shot detection of construction drawing callouts using YOLO-26E.

## Overview

`detect_yoloe.py` implements two detection approaches:

1. **Text-based (zero-shot)**: Uses natural language descriptions to detect callouts
2. **Visual-based (one-shot)**: Uses example crop images to detect similar callouts

## Installation

```bash
pip install ultralytics numpy
```

The YOLO-26E model (`yoloe26n-world.pt`) will be automatically downloaded on first use.

## Usage

### Text-based Detection (Zero-Shot)

Detects callouts using text descriptions from JSON prompt files:

```bash
python src/detect_yoloe.py \
  --method text \
  --prompts prompts/us_ncs.json \
  --conf 0.1 \
  --output output/detections.json \
  plan.png
```

### Visual-based Detection (One-Shot)

Detects callouts using example crop images:

```bash
python src/detect_yoloe.py \
  --method visual \
  --prompts examples/us/ncs \
  --conf 0.1 \
  --output output/detections.json \
  plan.png
```

### Python API

```python
from detect_yoloe import (
    detect_callouts_text,
    detect_callouts_visual,
    load_prompt_json,
    load_visual_prompts,
    save_results
)

# Text-based detection
prompts = load_prompt_json("prompts/us_ncs.json")
results = detect_callouts_text(
    "plan.png",
    prompts,
    conf_threshold=0.1,
    iou_threshold=0.5
)

# Visual-based detection
visual_prompts = load_visual_prompts("examples/us/ncs", ["detail", "elevation"])
all_prompts = []
for images in visual_prompts.values():
    all_prompts.extend(images)

results = detect_callouts_visual(
    "plan.png",
    all_prompts,
    conf_threshold=0.1,
    iou_threshold=0.5
)

# Save results
save_results(results, "output/detections.json")

print(f"Found {len(results['detections'])} callouts")
```

## Output Format

Both methods return the same JSON structure:

```json
{
  "detections": [
    {
      "bbox": [x, y, width, height],
      "confidence": 0.85,
      "callout_type": "detail",
      "method": "text",
      "image_path": "plan.png"
    }
  ],
  "metadata": {
    "model": "yoloe26n-world.pt",
    "conf_threshold": 0.1,
    "iou_threshold": 0.5,
    "num_detections": 10
  }
}
```

### Detection Fields

- `bbox`: Bounding box as `[x, y, width, height]` in pixels
- `confidence`: Detection confidence score (0.0-1.0)
- `callout_type`: Type of callout (detail, elevation, section, title)
- `method`: Detection method used ("text" or "visual")
- `image_path`: Path to the input image

## Parameters

### Confidence Threshold (`--conf`)

- **Range**: 0.0 - 1.0
- **Default**: 0.1
- **Description**: Minimum confidence for detections. Lower values = more detections (higher recall, lower precision)
- **Recommended**: Start with 0.1, increase if too many false positives

### IoU Threshold (`--iou`)

- **Range**: 0.0 - 1.0
- **Default**: 0.5
- **Description**: IoU threshold for Non-Maximum Suppression (NMS). Higher values = more aggressive duplicate removal
- **Recommended**: 0.5 for most cases, increase to 0.7 if overlapping callouts are incorrectly merged

## Model Details

- **Model**: `yoloe26n-world.pt` (YOLO-26E Nano variant)
- **Size**: Lightweight nano model for speed
- **Features**:
  - Zero-shot detection via text prompts
  - One-shot detection via visual prompts
  - Text encoder for semantic understanding
  - No training required

## Troubleshooting

### Model Download Issues

If the model fails to download automatically:

```bash
# Manually download
wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yoloe26n-world.pt
```

### Low Recall (Missing Callouts)

1. Lower confidence threshold: `--conf 0.05`
2. Add more visual prompt variations
3. Improve text prompt descriptions
4. Verify image quality (recommended: 72-300 DPI)

### High False Positives

1. Raise confidence threshold: `--conf 0.2`
2. Use more specific text prompts
3. Filter results using `global_filters` from prompt JSON
4. Post-process to remove text-based false positives

### Memory Issues

The nano model should run on most systems. If you encounter memory issues:

- Reduce image resolution before detection
- Process tiles instead of full images
- Use batch processing with smaller batches

## Next Steps

1. **Extract visual prompts**: Crop example callouts from plans to create reference images
2. **Test both methods**: Compare text vs visual detection performance
3. **Tune thresholds**: Optimize confidence/IoU for your specific plans
4. **Post-process**: Apply filtering rules from prompt JSON
5. **Integrate**: Connect to validation pipeline for accuracy measurement

## References

- [YOLO-26 Documentation](https://docs.ultralytics.com/models/yolo26/)
- [Ultralytics Python API](https://docs.ultralytics.com/guides/)
- [YOLOE Paper](https://arxiv.org/abs/2501.12345) (placeholder - check Ultralytics for actual reference)
