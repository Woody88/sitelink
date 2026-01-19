# Callout Detection: Grounding DINO → YOLO Pipeline

## Overview

Replace the slow CV (HoughCircles) + LLM pipeline with a modern object detection approach for detecting callout symbols in construction/engineering drawings.

## Current Problems

1. **HoughCircles misses edge circles** - circles along image borders not detected
2. **LLM API calls are slow and costly** - ~5 min per 4-page PDF
3. **Grid marker confusion** - single letters (R, Q, P) misclassified as callouts
4. **Over-filtering** - aggressive LLM prompt rejects valid callouts

## Callout Types to Detect

| Type | Description | Visual |
|------|-------------|--------|
| `detail` | Circle with number/sheet reference | "10/S2.0", "A/A5" |
| `section` | Circle with triangle pointer(s) | Section cut indicator |
| `elevation` | Circle with upward triangle | Elevation view marker |
| `title` | Circle at bottom of detail boxes | Labels details |
| `grid_marker` | Single letter for column grid | R, Q, P, N (NOT a callout) |

## Recommended Pipeline

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Grounding DINO     │ --> │  Label Review       │ --> │  YOLOv8 Training    │
│  (Zero-Shot)        │     │  (CVAT/Roboflow)    │     │  (Fine-Tune)        │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                           │                           │
         v                           v                           v
   Auto-generate              Correct labels              Fast, accurate
   bounding boxes             50-100 per class            local inference
```

### Step 1: ~~Bootstrap Dataset with Grounding DINO~~ Manual Labeling Required

> **UPDATE (2025-01-18)**: Grounding DINO testing showed it's **NOT viable** for zero-shot callout detection:
> - Detects large regions (50%+ of image) instead of individual symbols
> - Callouts are too small (10-30 pixels) for the model
> - Very low recall (2-6 detections vs dozens of actual callouts)
> - See `output/dino-canadian/` and `output/dino-us/` for test results

**Revised approach:** Manual labeling in CVAT or Roboflow
- Label 50-100 examples per class
- Export in YOLO format
- Proceed to Step 3 (YOLOv8 training)

### Step 2: Review & Refine Labels

Load Grounding DINO predictions into labeling tool (CVAT or Roboflow):
- Delete false positives
- Adjust inaccurate bounding boxes
- Assign correct class labels

**Target:** 50-100 examples per class

### Step 3: Fine-Tune YOLOv8

Train YOLOv8 on the bootstrapped dataset:
- Classes: `detail_callout`, `section_callout`, `elevation_callout`, `title_callout`, `grid_marker`
- Training time: ~1 hour on modest GPU
- Result: Fast, accurate, local inference

### Step 4: Post-Processing with Lightweight OCR

After YOLO detects callouts:
1. Crop image to bounding box
2. Run Tesseract or DocTR OCR on crop
3. Parse text with regex (e.g., "10/S2.0" → identifier=10, sheet=S2.0)

## Comparison

| Approach | Speed | Accuracy | Data Needs | Cost |
|----------|-------|----------|------------|------|
| Current (Hough+LLM) | Very Slow | Low-Medium | None | High (API) |
| Grounding DINO (Zero-Shot) | Medium | Medium | None | Low (Local) |
| **YOLOv8 (Fine-Tuned)** | **Very Fast** | **High** | 50-100/class | **Very Low** |

## Files & Context

- Current pipeline: `src/pipeline.py`
- LLM classification: `src/llm_pipeline.py`
- CV detection: `src/detect.py`
- Current output: `output/canadian-llm-v2/`

### Test PDFs

| Plan | Path | Pages | Standard |
|------|------|-------|----------|
| Canadian | `/home/woodson/Code/projects/sitelink/apps/4-Structural-Drawings - 4pages.pdf` | 4 | PSPC |
| US | `/home/woodson/Code/projects/sitelink/apps/RTA_DRAWRING_8_PAGE_PLAN.pdf` | 8 | NCS |

## Research Source

Consultation with Gemini 2.5 Pro via zen MCP confirmed:
- No public pre-trained models for construction drawing symbols
- Grounding DINO excellent for bootstrapping training data
- YOLOv8 is the production-grade solution
- Making `grid_marker` a distinct class solves the false positive problem

## Implementation Checklist

- [ ] Test Grounding DINO on sample sheet
- [ ] Evaluate zero-shot detection quality
- [ ] Set up labeling workflow (CVAT/Roboflow)
- [ ] Bootstrap dataset from DINO predictions
- [ ] Train YOLOv8 model
- [ ] Integrate with existing pipeline

## Installation

```bash
# Grounding DINO
pip install groundingdino-py

# YOLOv8
pip install ultralytics

# Lightweight OCR
pip install pytesseract
# or
pip install python-doctr
```
