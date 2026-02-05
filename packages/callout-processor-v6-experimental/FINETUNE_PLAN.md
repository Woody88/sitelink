# Fine-tune DocLayout-YOLO for Construction Drawing Layout Detection

**Beads ticket**: sitelink-ws0
**Working directory**: `packages/callout-processor-v6-experimental/`

## Context

We ran a POC with DocLayout-YOLO (pre-trained on DocStructBench academic documents) on construction structural drawings. It partially works but has critical failures. We also tested YOLOE-26 text prompts — that performed even worse. Fine-tuning DocLayout-YOLO is the confirmed best path.

### What the POC proved works
- Tables with clear grid lines are detected (Column Schedule, Footing Schedule)
- Dense text paragraphs are individually detected at high confidence

### What fails and must be fixed by fine-tuning
1. **Notes fragmentation**: "GENERAL NOTES" section gets split into 11+ separate detections (each paragraph + each heading = separate box). We need ONE box per notes section.
2. **Legends = Figure**: "Slab & Deck Legend" and "Deck Legend" are classified as Figure. We need a dedicated `legend_box` class.
3. **Small tables missed**: "Bearing Plate Schedule" (small, ~300px wide) was not detected.

### POC results for reference
- `poc_doclayout_results/poc_summary.json` — full detection data
- `poc_doclayout_results/*_detected.png` — annotated images showing what DocLayout found
- `poc_yoloe_layout_results/` — YOLOE comparison (much worse)

## Phase 1: Dataset Preparation

### 1.1 Render PDF pages to images

Render construction drawing pages at **150 DPI** (matching the POC) to PNG images for annotation.

```python
# Use existing render function from test_doclayout_yolo.py
# Render ALL pages from each PDF, not just the ones tested in POC
# Target: 80-120 pages total from diverse sources
```

**PDF sources** (in `docs/plans/`):

| PDF | Pages | Content types |
|-----|-------|---------------|
| `ca/examples/4-Structural-Drawings.pdf` | ~4 | Notes, schedules, legends, details |
| `ca/examples/4-Structural-Drawings - 4pages.pdf` | 4 | Subset of above |
| `us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf` | ~10 | Notes, schedules, plan views, details |
| `us/examples/structural/rinker/Rinker_050.pdf` through `Rinker_059.pdf` | 10 | Structural details |
| `us/examples/RTA_DRAWINGS_VOL1_US_PLAN.pdf` | Multi | Mixed structural content |
| `us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf` | Multi | Mixed arch/structural |

### 1.2 Upload to Roboflow for annotation

- **Roboflow workspace**: `plan-detection` (existing — same workspace used for callout-detection-combined)
- Create NEW project: `document-layout-construction`
- Upload rendered PNGs
- Set up 3 classes: `schedule_table`, `notes_block`, `legend_box`

### 1.3 Annotation guidelines

**CRITICAL annotation rules — these fix the POC failures:**

#### `schedule_table`
- Draw ONE box around the entire table including header row, all data rows, and the table title text directly above
- Include small tables like "Bearing Plate Schedule" (even if only 3-4 rows)
- Include the title block schedule at bottom-right of each sheet as `schedule_table` ONLY if it contains tabular data rows
- Do NOT include the title block itself (company name, sheet number area)

#### `notes_block`
- **MOST IMPORTANT**: Draw ONE box around the ENTIRE notes section — from the section heading ("GENERAL NOTES", "STRUCTURAL STEEL NOTES", "CONCRETE NOTES") all the way down to the last numbered item
- Do NOT annotate each paragraph separately — that's exactly the fragmentation problem we're fixing
- If a page has "GENERAL NOTES" (items 1-15) and separately "CONCRETE NOTES" (items 1-8), those are TWO notes_block boxes
- Include the heading text inside the box
- Minimum size: the box should be at least ~200x200 pixels

#### `legend_box`
- Draw one box around the entire legend area including its title ("LEGEND", "DECK LEGEND", "SLAB LEGEND", "SYMBOL LEGEND")
- Include the border if visible
- Include all symbol-description rows
- Legends typically have: a bordered region, symbol samples on the left, text descriptions on the right

### 1.4 Target annotation count

| Class | Target instances | Notes |
|-------|-----------------|-------|
| `schedule_table` | 80-150 | Tables appear on ~30-40% of structural pages |
| `notes_block` | 60-100 | Notes sections on first 1-2 pages of each set |
| `legend_box` | 30-60 | Legends appear on ~20% of pages |

### 1.5 Export from Roboflow

- Export in **YOLOv8 format** (same format DocLayout-YOLO uses)
- 80/20 train/val split
- Download to `datasets/document-layout-construction/`

Expected structure:
```
datasets/document-layout-construction/
├── data.yaml
├── train/
│   ├── images/
│   └── labels/
└── valid/
    ├── images/
    └── labels/
```

`data.yaml` should contain:
```yaml
train: train/images
val: valid/images

nc: 3
names: ['schedule_table', 'notes_block', 'legend_box']
```

## Phase 2: Fine-tuning

### 2.1 Training script

Create `train_doclayout_finetune.py`:

```python
#!/usr/bin/python3
"""
Fine-tune DocLayout-YOLO on construction drawing layout regions.

Base model: DocLayout-YOLO DocStructBench (YOLOv10 architecture)
Target classes: schedule_table, notes_block, legend_box
"""

import os
os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"

from huggingface_hub import hf_hub_download
from doclayout_yolo import YOLOv10

# Download pre-trained weights
MODEL_PATH = hf_hub_download(
    repo_id="juliozhao/DocLayout-YOLO-DocStructBench",
    filename="doclayout_yolo_docstructbench_imgsz1024.pt"
)

DATA_YAML = 'datasets/document-layout-construction/data.yaml'

def train():
    model = YOLOv10(MODEL_PATH)

    results = model.train(
        data=DATA_YAML,
        epochs=100,
        imgsz=1024,         # Match pre-trained resolution
        batch=4,             # Adjust based on GPU memory (RTX 3080 = 10GB)
        project='runs/layout',
        name='doclayout_finetune_v1',
        device=0,
        workers=4,

        # Transfer learning settings
        lr0=0.001,           # Lower LR for fine-tuning (not training from scratch)
        lrf=0.01,            # Final LR = lr0 * lrf
        warmup_epochs=5,     # Warm up before full learning

        # Construction drawing augmentation (conservative)
        hsv_h=0.0,           # No hue shift (drawings are B&W/grayscale)
        hsv_s=0.0,           # No saturation shift
        hsv_v=0.2,           # Slight brightness variation
        degrees=0,           # No rotation (drawings have fixed orientation)
        translate=0.1,       # Slight translation
        scale=0.3,           # Scale augmentation for varied table/note sizes
        shear=0,
        perspective=0,
        flipud=0,            # No vertical flip
        fliplr=0.5,          # Horizontal flip OK (symmetric layouts)
        mosaic=0.3,          # Light mosaic (less aggressive than default)
        mixup=0.0,           # No mixup
        copy_paste=0.0,

        # Training settings
        patience=20,
        save_period=10,
        val=True,
        plots=True,
        verbose=True,
    )

    return results

if __name__ == '__main__':
    train()
```

### 2.2 Key training considerations

1. **imgsz=1024**: Must match DocLayout-YOLO's pre-trained resolution. Do NOT use 2048 (that's for our callout model)
2. **doclayout_yolo.YOLOv10, NOT ultralytics.YOLO**: DocLayout-YOLO is a modified YOLOv10 architecture. Use its own package
3. **lr0=0.001**: Lower than default (0.01) because we're fine-tuning, not training from scratch
4. **No rotation augmentation**: Construction drawings always have fixed orientation
5. **Minimal color augmentation**: Drawings are mostly black and white
6. **batch=4**: With imgsz=1024 on RTX 3080 (10GB VRAM). Reduce to 2 if OOM

### 2.3 If training fails to converge

Try these adjustments in order:
1. **Freeze backbone**: Add `freeze=10` to freeze first 10 layers of the backbone
2. **Lower learning rate**: Try `lr0=0.0005`
3. **More epochs**: Increase to 150 with `patience=30`
4. **Larger model**: Try DocLayout-YOLO-S (small) instead of the base model if nano doesn't have enough capacity

## Phase 3: Evaluation

### 3.1 Validation metrics

After training, check `runs/layout/doclayout_finetune_v1/results.csv` for:
- mAP50 >= 0.70 for each class
- mAP50-95 >= 0.50 overall

### 3.2 Visual evaluation script

Create `eval_doclayout_finetune.py` that:
1. Loads the fine-tuned model from `runs/layout/doclayout_finetune_v1/weights/best.pt`
2. Runs inference on the SAME test PDFs used in the POC (for direct comparison)
3. Saves annotated images to `eval_doclayout_finetune_results/`
4. Prints side-by-side comparison: pre-trained vs fine-tuned detection counts

### 3.3 Success criteria

| Test | Pre-trained (POC) | Target (fine-tuned) |
|------|-------------------|---------------------|
| CA page 0: notes sections | 11 fragments | 3-4 unified boxes |
| CA page 0: Deck Legend | Detected as Figure | Detected as legend_box |
| CA page 0: Bearing Plate Schedule | MISSED | Detected as schedule_table |
| DWL page 1: Foundation Plan Notes | MISSED | Detected as notes_block |

## Phase 4: Integration

### 4.1 Create production detection module

Create `src/doclayout_detect.py` that:
1. Loads the fine-tuned DocLayout-YOLO model
2. Takes a PDF page image as input
3. Returns detections in the same format as `src/api_detect.py`: `{"bbox": [x,y,w,h], "class": "schedule_table", "confidence": 0.85}`

### 4.2 Update api_detect.py for hybrid detection

The production pipeline should run TWO models:
```
PDF Page → render at 72 DPI
    ├─► Existing YOLO26n (callout symbols)
    │   └─► detail, elevation, title, grid_bubble
    │
    └─► Fine-tuned DocLayout-YOLO (document regions)
        └─► schedule_table, notes_block, legend_box
```

Both models produce detections in the same format. The caller (TypeScript sitelink-interpreter) receives a merged list.

### 4.3 Save fine-tuned weights

Copy best weights to `weights/doclayout_construction_v1.pt` alongside existing `best_v5_balanced.pt`.

## Environment notes

- Python: `/usr/bin/python3` (3.10.12) — NOT the linuxbrew python3.14
- DocLayout-YOLO installed: `doclayout-yolo>=0.0.2`
- CLIP installed for YOLOE (not needed for DocLayout fine-tuning)
- HuggingFace xet workaround: `os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"`
- GPU: CUDA available on device 0
