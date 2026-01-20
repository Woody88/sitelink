# Roboflow Labeling Guide for Callout Detection

## Overview

We have 245 images ready for labeling. **Start with 30-40 images** to get a working model, then expand.

## Quick Start

### 1. Create Roboflow Account
1. Go to https://roboflow.com
2. Sign up (free tier allows 10,000 images)
3. Create a new project:
   - **Project Name**: `callout-detection`
   - **Project Type**: `Object Detection`
   - **Annotation Group**: Create new → `callouts`

### 2. Upload Images (Start Small!)

**Recommended first batch** (30 diverse images):
```
roboflow_dataset/images/
├── 4_Structural_Drawings___4pages_page_00.png  (Canadian)
├── 4_Structural_Drawings___4pages_page_01.png
├── 4_Structural_Drawings___4pages_page_02.png
├── 4_Structural_Drawings___4pages_page_03.png
├── sample_plan_page_00.png through _06.png     (US samples)
├── RTA_DRAWRING_8_PAGE_PLAN_page_00.png through _07.png
└── ~10 pages from RTA_DRAWINGS_VOL1 (varied sheets)
```

**Upload steps:**
1. Click "Upload" in your project
2. Drag & drop selected images
3. Click "Save and Continue"

### 3. Set Up Classes

Create these **3 classes** (in this order for consistency):
1. `detail` - Circle with number/sheet reference, NO triangles (e.g., "10/S2.0")
2. `elevation` - Circle with ANY triangles (covers both section & elevation markers)
3. `title` - Circle at bottom of detail boxes (labels the detail view)

> **Note:** We merged section and elevation into one class because the US (NCS) standard
> doesn't distinguish them as clearly as the Canadian (PSPC) standard. Both use circles
> with triangles - the LLM can distinguish them later by context.

### 4. Labeling Instructions

**For each image:**
1. Click on the image to enter annotation mode
2. Select the class from the left sidebar
3. Draw a bounding box around each callout symbol

**Key tips:**
- Draw the box to include the full circle/symbol plus any attached triangles
- Include a small margin around the symbol (~20% padding)
- Don't include the line connecting to the drawing - just the symbol

**Reference the guidelines while labeling:**
- Canadian: `docs/plans/ca/guidelines/PSPC National CADD Standard - Callout Symbols.pdf`
- US: `docs/plans/us/guidelines/ncs6_uds6_symbols.pdf`

### 5. Visual Guide

```
DETAIL CALLOUT:            ELEVATION CALLOUT:              TITLE CALLOUT:
   ┌─────┐                    ▲          ▲                    ┌─────┐
   │  10 │                 ┌─────┐    ┌─────┐                 │  1  │  DETAIL NAME
   │ ─── │                 │  A  │    │  1  │                 │ ─── │  ──────────
   │ S2.0│                 └─────┘    └─────┘                 │ A1  │  SCALE: 1/4"
   └─────┘                    ▼                               └─────┘

Circle with               Circle with ANY triangles        Circle at bottom
number/sheet ref          (section or elevation)           of detail box
NO triangles              Label as "elevation"             labeling the view
```

### 6. Export for Training

Once you've labeled 30+ images:

1. Click "Generate" → "Create New Version"
2. **Preprocessing**:
   - Auto-Orient: ON
   - Resize: 640x640 (Fit within)
3. **Augmentation** (optional but recommended):
   - Flip: Horizontal
   - Brightness: -15% to +15%
4. **Export Format**: `YOLO v8`
5. Download the dataset

### 7. Retrain the Model

After downloading from Roboflow:

```bash
# Extract the downloaded zip
unzip roboflow_dataset.zip -d roboflow_export

# Retrain with the new labels
cd packages/callout-processor-v4
python src/train_yolo.py \
  --data roboflow_export/data.yaml \
  --epochs 100 \
  --name callout_roboflow_v1
```

## Common Labeling Mistakes to Avoid

1. **Don't label grid markers** - Single letters (R, Q, P, N) along grid lines are NOT callouts
2. **Don't label title blocks** - Text in the corner sheet info area
3. **Don't label dimension text** - Numbers showing measurements
4. **Do include the triangles** - Elevation callouts have attached triangles (include them in the box)
5. **Consistent box sizing** - Keep similar padding around all callouts
6. **detail vs elevation** - If it has ANY triangles, label as `elevation`. No triangles = `detail`

## Labeling Progress Tracker

| Batch | Images | Status | mAP Achieved |
|-------|--------|--------|--------------|
| 1     | 30     | TODO   | -            |
| 2     | +30    | TODO   | -            |
| 3     | +50    | TODO   | -            |

**Target**: 50+ images per class for good results

## File Locations

- **Images to upload**: `packages/callout-processor-v4/roboflow_dataset/images/`
- **Canadian guidelines**: `docs/plans/ca/guidelines/`
- **US guidelines**: `docs/plans/us/guidelines/`
- **Training script**: `packages/callout-processor-v4/src/train_yolo.py`
