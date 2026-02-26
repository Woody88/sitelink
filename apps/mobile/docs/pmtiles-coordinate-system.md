# PMTiles Overlay Coordinate System

This document explains the coordinate pipeline from YOLO detection through LiveStore to OpenSeadragon overlay rendering. Several subtleties caused markers to render in wrong positions; read this before touching any coordinate math.

## Pipeline Overview

```
YOLO Detection (72 DPI)
    ↓ normalized [0,1] coords
LiveStore Event → markers table
    ↓ normalized x, y, width, height
OpenSeadragon viewport conversion
    ↓ tile-aligned viewport coords
Overlay rendering
```

---

## 1. YOLO Detection (72 DPI)

- Container receives a 300 DPI PNG from R2
- Downsamples to **72 DPI** (`scale_factor = 72/300 = 0.24`) for YOLO inference
- SAHI tiling splits image into overlapping tiles (2048px, 20% overlap), runs YOLO per tile
- Tile detections are merged back to global 72 DPI pixel coordinates
- Bounding box format: `[x_topleft, y_topleft, width, height]` in 72 DPI pixels
- **Normalization** to [0, 1]:
  ```python
  center_x = (x + bw / 2) / w   # w = 72 DPI image width in pixels
  center_y = (y + bh / 2) / h   # h = 72 DPI image height in pixels
  bbox_w   = bw / w
  bbox_h   = bh / h
  ```
- Normalized values are **resolution-independent** — same 0–1 values apply at any DPI since aspect ratio is preserved by uniform downsampling

**Critical invariant: YOLO DPI must remain 72.** The model was trained at this DPI. Changing it breaks detection.

---

## 2. LiveStore Event → Table

- Event: `v1.SheetCalloutsDetected` carries `x, y` (center, 0–1) and optional `width, height` (0–1)
- Materializer inserts into `markers` table with `x, y, width, height` columns
- `width` and `height` are **nullable** (null for legacy markers without bbox data)
- Default bbox when null: **2.5% of image width/height**

---

## 3. OpenSeadragon Viewport Coordinate System

**Critical**: OpenSeadragon viewport coordinates are based on the **TileSource dimensions**, NOT the actual image dimensions.

The TileSource is created with tile-boundary-aligned dimensions:
```typescript
const tileSize = 256;  // Must match dzsave tile size
const tilesX = Math.ceil(imageWidth / tileSize);   // e.g., ceil(14400/256) = 57
const tilesY = Math.ceil(imageHeight / tileSize);   // e.g., ceil(10800/256) = 43
const tileAlignedWidth  = tilesX * tileSize;         // 14592
const tileAlignedHeight = tilesY * tileSize;         // 11008
```

OpenSeadragon viewport conventions:
- x: [0, 1] maps to [0, tileAlignedWidth] pixels
- y: [0, tileAlignedHeight/tileAlignedWidth] maps to [0, tileAlignedHeight] pixels
- **The y-axis is normalized by WIDTH** (not height) — this is OpenSeadragon's convention

---

## 4. Normalized → Viewport Conversion (The Bug Fix)

### ❌ Wrong (caused ~1.3% systematic offset):
```typescript
const aspectRatio = imageHeight / imageWidth;  // 10800/14400 = 0.75
viewport_x = normX;
viewport_y = normY * aspectRatio;  // Wrong: doesn't account for tile alignment
```

### ✅ Correct:
```typescript
const tileAlignedW = Math.ceil(imageWidth / 256) * 256;   // 14592
const scaleX = imageWidth  / tileAlignedW;  // 14400/14592 = 0.9868
const scaleY = imageHeight / tileAlignedW;  // 10800/14592 = 0.7402

viewport_x = normX * scaleX;
viewport_y = normY * scaleY;
```

### For bounding box overlays (center + size):
```typescript
const vpX = (normX - bboxW / 2) * scaleX;  // top-left x
const vpY = (normY - bboxH / 2) * scaleY;  // top-left y
const vpW = bboxW * scaleX;
const vpH = bboxH * scaleY;

viewer.addOverlay({
  element,
  location: new OpenSeadragon.Rect(vpX, vpY, vpW, vpH),
});
```

---

## 5. Error Magnitude

For a 14400×10800 (300 DPI, 48"×36") plan:

| Metric | Value |
|---|---|
| tileAlignedWidth | 14592 (192px padding) |
| Scale error | 1.3% (1 − 14400/14592) |
| Offset at center | ~96px at 300 DPI / ~23px at 72 DPI |
| Offset at bottom-right | ~192px at 300 DPI |
| Visible above | ~300% zoom |

---

## 6. Marker Rendering Style

Matches the `sitelink-interpreter` explorer approach:

| Property | Value |
|---|---|
| Color: detail | `#22c55e` (green) |
| Color: section/elevation | `#3b82f6` (blue) |
| Color: note | `#a855f7` (purple) |
| Default style | Outline only (transparent fill) |
| Selected style | `#facc15` border + 25% opacity yellow fill |
| Labels | Class-colored badge above bbox, shown on hover/selection |
| Scaling | Uses `OpenSeadragon.Rect` (scales with zoom, not fixed-pixel) |
| Legacy bbox | 2.5% of image when `width`/`height` is null |

---

## 7. Key Files

| File | Role |
|---|---|
| `apps/backend/container/detect_yolo.py` | YOLO detection, coordinate normalization |
| `packages/domain/src/events.ts` | `sheetCalloutsDetected` schema (optional width/height) |
| `packages/domain/src/tables.ts` | `markers` table (nullable width/height) |
| `packages/domain/src/materializers.ts` | `v1.SheetCalloutsDetected` materializer |
| `apps/backend/src/workflows/plan-processing.ts` | Marker passthrough in workflow |
| `apps/mobile/hooks/use-markers.ts` | `CalloutMarker` interface with width/height |
| `apps/mobile/components/plans/viewer/pmtiles-viewer.tsx` | Overlay rendering with viewport conversion |

---

## 8. Key Invariants

1. **YOLO detection DPI = 72** — do NOT change, model is trained at this DPI
2. **Tile size = 256** — hardcoded in both `dzsave` and the viewer; they must match
3. **Normalized coords are resolution-independent** — same [0,1] values at 72 or 300 DPI
4. **OpenSeadragon uses tileSource width as the normalizer for BOTH x and y axes**
5. **Materializers must be pure** — no `Date.now()`, use event timestamps for replay correctness
