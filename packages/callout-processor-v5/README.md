# Callout Processor V5 - YOLO-26E Zero-Shot Detection

Zero-shot and one-shot callout detection for construction plan drawings using YOLO-26E's visual and text prompt capabilities.

## Overview

This package implements callout detection **without requiring custom training** by leveraging YOLO-26E's prompt-based detection:

- **Visual Prompts (One-Shot)**: Provide example crop images of callouts → YOLO-26E finds similar symbols
- **Text Prompts (Zero-Shot)**: Describe callouts in natural language → YOLO-26E finds matching symbols

## Key Advantages Over v4

| Feature | V4 (YOLOv8 Training) | V5 (YOLO-26E Prompts) |
|---------|---------------------|----------------------|
| Training Required | Yes (100s of annotations) | No |
| Adaptation to New Standards | Re-train entire model | Add new prompt/crop |
| Time to Deploy | Days-weeks | Minutes |
| Annotation Burden | High (manual labeling) | Low (3-5 crops per type) |
| Flexibility | Fixed classes | Dynamic prompts |

## Directory Structure

```
callout-processor-v5/
├── examples/              # Visual prompt reference images
│   ├── us/               # US standards
│   │   ├── ncs/          # National CAD Standard
│   │   │   ├── detail/
│   │   │   ├── elevation/
│   │   │   ├── section/
│   │   │   └── title/
│   │   └── csi/          # CSI MasterFormat
│   └── ca/               # Canadian standards
│       ├── ncs/
│       └── csi/
├── prompts/              # Text prompt definitions
│   ├── us_ncs.json
│   ├── us_csi.json
│   ├── ca_ncs.json
│   └── ca_csi.json
├── src/
│   ├── detect_yoloe.py   # Detection implementation
│   └── validate.py       # Validation against ground truth
├── tests/
│   ├── plans/            # Test plan images
│   └── expected/         # Ground truth annotations
├── requirements.txt
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
cd packages/callout-processor-v5
pip install -r requirements.txt
```

This will install:
- `ultralytics` (YOLO-26E model)
- `numpy`, `pillow` (image processing)
- `tqdm` (progress bars)

The YOLO-26E model (`yoloe26n-world.pt`, ~10-20MB) auto-downloads on first use.

### 2. Prepare Visual Prompts (One-Shot)

**IMPORTANT**: Before running visual prompt detection, you must add crop images to `examples/`.

See [`examples/README.md`](examples/README.md) for detailed instructions on:
- What crop images are needed (3-5 per callout type)
- Size requirements (15-40px symbols with ~5px margin)
- Where to extract them from (available PDF plans)
- Naming convention

**Current Status**: `examples/` directories are empty - waiting for manual crop preparation.

### 3. Run Detection

#### Text Prompts (Zero-Shot)

```bash
python src/detect_yoloe.py plan_image.png \
  --method text \
  --prompts prompts/us_ncs.json \
  --conf 0.1 \
  --output results.json
```

#### Visual Prompts (One-Shot)

```bash
python src/detect_yoloe.py plan_image.png \
  --method visual \
  --prompts examples/us/ncs \
  --conf 0.1 \
  --output results.json
```

### 4. Validate Results

```bash
python src/validate.py \
  --predictions results.json \
  --ground-truth tests/expected/plan_annotations.json \
  --image plan_image.png \
  --output-dir validation_output/
```

This generates:
- Annotated images with TP/FP/FN overlays
- JSON metrics (precision, recall, F1 per callout type)

## How It Works

### Visual Prompts (One-Shot Detection)

1. **Prepare Crops**: Extract 3-5 example images of each callout type from plans
2. **Detection**: YOLO-26E's visual encoder learns from the examples
3. **Matching**: Finds all visually similar symbols on the plan

```python
from src.detect_yoloe import detect_callouts_visual

results = detect_callouts_visual(
    image_path="plan.png",
    prompt_images=["examples/us/ncs/detail/detail_01.png"],
    conf_threshold=0.1
)
```

### Text Prompts (Zero-Shot Detection)

1. **Define Prompts**: Describe callouts in natural language (already done in `prompts/`)
2. **Detection**: YOLO-26E's text encoder understands the description
3. **Matching**: Finds symbols matching the textual description

```python
from src.detect_yoloe import detect_callouts_text, load_prompt_json

prompts = load_prompt_json("prompts/us_ncs.json")
results = detect_callouts_text(
    image_path="plan.png",
    text_prompts=prompts,
    conf_threshold=0.1
)
```

## Text Prompt Definitions

Text prompts are stored in `prompts/*.json` and describe:
- Visual characteristics (circle, triangle, size, etc.)
- Text content (numbers, letters, sheet references)
- False positive filters (exclude NORTH, SCALE, etc.)

Example from `prompts/us_ncs.json`:

```json
{
  "callout_types": {
    "detail": {
      "text_prompt": "A circular callout symbol with a thin black outline and white fill. Contains a number (1-99) or letter+number (A1, B2). NO triangles attached. Circle diameter 0.3-0.8 inches.",
      "visual_characteristics": [
        "Perfect circular outline",
        "No triangles or attachments",
        "1-2 digit numbers OR letter+number"
      ]
    }
  }
}
```

## Configuration

### Detection Thresholds

- **Confidence Threshold (`--conf`)**: Minimum detection confidence (default: 0.1)
  - Lower = more detections but more false positives
  - Higher = fewer detections but higher precision
  - Recommended: 0.05-0.15 for callouts

- **IoU Threshold (`--iou`)**: Non-max suppression overlap (default: 0.5)
  - Controls duplicate detection removal
  - Higher = more strict (fewer duplicates)
  - Recommended: 0.4-0.6

### Validation IoU

- **Matching Threshold**: Minimum IoU to match prediction to ground truth (default: 0.5)
  - Controls what counts as a "correct" detection
  - Standard: 0.5 (50% overlap)
  - Strict: 0.75 (75% overlap)

## Success Criteria

Based on the bead ticket requirements:

- [ ] Visual prompt recall > 70%
- [ ] Text prompt recall > 50%
- [ ] Integration with sitelink-interpreter works
- [ ] Can process standard US NCS and Canadian PSPC plans

## Next Steps

### Phase 1-2: COMPLETE ✓
- [x] Directory structure created
- [x] Text prompts defined (us_ncs, us_csi, ca_ncs, ca_csi)
- [x] `detect_yoloe.py` implemented
- [x] `validate.py` implemented
- [x] `requirements.txt` created

### Phase 3: BLOCKED - Waiting for Visual Prompts
**Current blocker**: `examples/` directories are empty

**Required action**: Extract crop images from sample plans and add to `examples/` subdirectories.

See [`examples/README.md`](examples/README.md) for detailed instructions.

### Phase 4: Validation (After Crops Ready)
1. Run visual prompt testing on available plans
2. Run text prompt testing
3. Generate validation metrics and comparison images
4. Review results visually
5. Tune thresholds if needed

### Phase 5: Integration
Integrate with `packages/sitelink-interpreter/src/extraction/yoloe-extraction.ts`

## Troubleshooting

### Model Download Issues
If YOLO-26E model fails to download automatically:
```bash
wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yoloe26n-world.pt
mv yoloe26n-world.pt ~/.cache/ultralytics/
```

### CUDA/GPU Support
YOLO-26E will auto-detect and use GPU if available. For CPU-only:
```bash
export CUDA_VISIBLE_DEVICES=""
python src/detect_yoloe.py ...
```

### Memory Issues
If processing large plans (>4000x4000px), use the nano model:
```python
# In detect_yoloe.py, model is already set to yoloe26n-world.pt (nano)
```

For even larger images, consider tiling the input.

## References

- [YOLO-26E Documentation](https://docs.ultralytics.com/models/yolo26/)
- [Ultralytics Guides](https://docs.ultralytics.com/guides/)
- [Bead Ticket: sitelink-xvb](https://github.com/beads-db/beads/issues/sitelink-xvb)
- [Callout Processor v4](../callout-processor-v4/) (training-based approach)

## Contributing

When adding support for new standards or callout types:

1. **Visual Prompts**: Add crops to `examples/{region}/{standard}/{type}/`
2. **Text Prompts**: Add JSON to `prompts/{region}_{standard}.json`
3. **Validation**: Add ground truth to `tests/expected/`
4. **Test**: Run validation to measure performance

Always validate changes with annotated comparison images before committing.
