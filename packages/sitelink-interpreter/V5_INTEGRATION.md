# Callout Processor v5 Integration

## Overview

The sitelink-interpreter now uses **callout-processor-v5** for YOLO-based callout detection, replacing the older v4 implementation.

## Performance

v5 delivers production-ready performance with validated metrics:

- **Canadian plans**: 96.5% Precision, 96.5% Recall
- **US plans**: 100% Precision, 93.3% Recall
- **Combined**: 97.1% Precision, 95.4% Recall

Per-class performance:
- **detail**: 93% P, 86% R
- **elevation**: 97% P, 99% R
- **title**: 97% P, 92% R

## Critical Parameters

**DO NOT CHANGE** these without retraining the model:

| Parameter | Value | Why |
|-----------|-------|-----|
| DPI | 72 | Proven optimal from extensive v4 testing |
| Tile Size | 2048×2048 | YOLO sweet spot for large construction plans |
| Tile Overlap | 0.2 (20%) | Captures callouts at tile boundaries |
| Confidence | 0.25 | Best precision/recall balance |

These parameters are hardcoded in `api_detect.py` and used as defaults in `yolo-extraction.ts`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TypeScript (sitelink-interpreter)                           │
│   yolo-extraction.ts                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Python API (callout-processor-v5)                           │
│   src/api_detect.py                                          │
│   • Renders PDF page at 72 DPI (or loads image)            │
│   • Tiles image (2048×2048, 0.2 overlap)                    │
│   • Runs YOLO detection (conf=0.25)                          │
│   • Applies post-processing filters                          │
│   • Outputs detections.json                                  │
└─────────────────────────────────────────────────────────────┘
```

## API Usage

### TypeScript Side

Two main functions:

**1. Full PDF Detection (`extractWithYOLO`)**

```typescript
import { extractWithYOLO } from "./extraction/yolo-extraction.ts";

const result = await extractWithYOLO("/path/to/plan.pdf", {
  dpi: 72,              // Optional, defaults to 72
  confThreshold: 0.25,  // Optional, defaults to 0.25
  standard: 'auto',     // Optional: 'auto', 'pspc', 'ncs'
  validate: true,       // Optional, enables post-processing filters
});

console.log(`Found ${result.entities.length} callouts`);
console.log(`By class:`, result.summary?.by_class);
```

**2. Single Sheet Detection (`detectOnSheet`)**

```typescript
import { detectOnSheet } from "./extraction/yolo-extraction.ts";

const entities = await detectOnSheet(sheetId, {
  confThreshold: 0.25,
  validate: true,
});

console.log(`Found ${entities.length} callouts on this sheet`);
```

### Python Script (Direct Usage)

```bash
# Detect on PDF page
python src/api_detect.py \
  --pdf /path/to/plan.pdf \
  --page 5 \
  --output ./output \
  --conf 0.25

# Detect on rendered image
python src/api_detect.py \
  --image /path/to/sheet.png \
  --output ./output \
  --conf 0.25

# Disable post-processing filters (lower precision, higher recall)
python src/api_detect.py \
  --pdf /path/to/plan.pdf \
  --page 5 \
  --output ./output \
  --no-filters
```

## Output Format

The Python script generates `detections.json`:

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

**Format notes:**
- `bbox` is `[x, y, width, height]` (not `[x1, y1, x2, y2]`)
- `class` is one of: `"detail"`, `"elevation"`, `"title"`
- `confidence` ranges from 0.0 to 1.0

TypeScript code converts this to the Entity format with mapped labels:
- `detail` → `detail_callout`
- `elevation` → `elevation_callout`
- `title` → `title_callout`

## API Endpoints

### POST `/api/detect`

Upload PDF and run YOLO v5 detection.

**Request:**
```typescript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('options', JSON.stringify({
  dpi: 72,
  confThreshold: 0.25,
  standard: 'auto',
}));

const response = await fetch('/api/detect', {
  method: 'POST',
  body: formData,
});
```

**Response:**
```json
{
  "success": true,
  "pdf_name": "plan.pdf",
  "sheets_created": 10,
  "entities_found": 234,
  "needs_review": 12,
  "relationships_created": 89,
  "run_id": "abc123...",
  "by_class": {
    "detail": 100,
    "elevation": 80,
    "title": 54
  }
}
```

### POST `/api/sheets/:id/detect`

Run detection on a single sheet.

**Request:**
```typescript
const response = await fetch(`/api/sheets/${sheetId}/detect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    confThreshold: 0.25,
    validate: true,
  }),
});
```

**Response:**
```json
{
  "success": true,
  "sheet_id": "xyz789",
  "sheet_number": "A3",
  "entities_detected": 23,
  "entities": [
    {
      "id": "ent_123",
      "class_label": "detail_callout",
      "confidence": 0.87,
      "bbox_x1": 100.5,
      "bbox_y1": 200.3,
      "bbox_x2": 150.7,
      "bbox_y2": 230.4,
      ...
    }
  ]
}
```

## Differences from v4

| Aspect | v4 | v5 |
|--------|----|----|
| DPI | 300 | 72 ✅ |
| Tile Size | 640px | 2048px ✅ |
| Overlap | 0.25 | 0.2 ✅ |
| Confidence | 0.1 | 0.25 ✅ |
| Recall (Canadian) | ~44% | 96.5% ✅ |
| Precision (Canadian) | ~80% | 96.5% ✅ |
| SAHI Tiling | Broken | Fixed ✅ |
| Post-processing | Minimal | Comprehensive ✅ |
| Model | v4 | v5_combined2 ✅ |

## Troubleshooting

### "Model not found"

Ensure the model weights exist:
```bash
ls -lh packages/callout-processor-v5/runs/detect/v5_combined2/weights/best.pt
```

If missing, download or copy from backup.

### "API script not found"

Check the Python script exists:
```bash
ls -lh packages/callout-processor-v5/src/api_detect.py
```

### No detections found

1. **Check confidence threshold**: Try lowering to 0.15 temporarily
2. **Check image rendering**: Ensure PDF renders correctly at 72 DPI
3. **Check model**: Verify model loads without errors
4. **Check logs**: Review Python stderr output for errors

### Too many false positives

1. **Enable filters**: Ensure `validate: true` (default)
2. **Raise confidence**: Try 0.3 or 0.35
3. **Check training data**: May need more negative examples

### Low recall (missing callouts)

1. **Lower confidence**: Try 0.20 or 0.15
2. **Disable filters**: Set `validate: false` temporarily
3. **Check DPI**: Ensure rendering at 72 DPI, not lower
4. **Check class**: Verify you're looking for the right class (detail vs elevation)

## Testing

Quick test script:

```typescript
import { extractWithYOLO } from "./extraction/yolo-extraction.ts";

const pdfPath = "/path/to/test/plan.pdf";
const result = await extractWithYOLO(pdfPath);

console.log("Detection Results:");
console.log(`  Total entities: ${result.entities.length}`);
console.log(`  By class:`, result.summary?.by_class);
console.log(`  Needs review: ${result.summary?.needs_review}`);
console.log(`  Run ID: ${result.runId}`);
```

Or test Python script directly:

```bash
cd packages/callout-processor-v5

# Test on Canadian plan
python src/api_detect.py \
  --pdf ../../docs/plans/canadian/4-Structural-Drawings\ -\ 4pages.pdf \
  --page 4 \
  --output test_output

# Check results
cat test_output/detections.json | jq '.detections | length'
```

## Migration from v4

**Code Changes Required:**

None if using the API endpoints. The TypeScript integration layer handles format conversion automatically.

**Database Changes:**

Entities created with v5 will have:
- `detection_method: 'yolo_v5'` (instead of `'yolo'`)
- `ocr_text: null` (v5 doesn't include OCR in detections)
- `crop_image_path: null` (v5 doesn't save crops by default)

**Benefits of Migration:**

1. **2x better recall**: 96.5% vs 44%
2. **Better precision**: 96.5% vs 80%
3. **Fewer false positives**: Post-processing filters remove 10-15% FPs
4. **Production validated**: Tested on Canadian NCS and US plans
5. **Comprehensive docs**: Full training, inference, and troubleshooting guides

## Further Reading

See `packages/callout-processor-v5/docs/`:
- `ARCHITECTURE.md` - System design and data flow
- `TRAINING.md` - How to retrain the model
- `INFERENCE.md` - Detection and validation workflows
- `ADDING_CLASSES.md` - How to add new callout types

## Support

For issues with:
- **Detection accuracy**: See callout-processor-v5 troubleshooting guides
- **Integration errors**: Check this document and TypeScript console logs
- **Model training**: See callout-processor-v5/docs/TRAINING.md
