# OpenSeadragon + OpenCV Detection Integration Guide

## Overview

This document explains how to integrate OpenCV-based callout detection results with OpenSeadragon for interactive visualization of construction plans with clickable overlays.

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Detection Pipeline                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PDF (any DPI) ──> OpenCV Detection ──> Normalized Coords (0-1) │
│                         │                        │               │
│                         │                        └──> results.json│
│                         │                                         │
│                    Detection DPI                                 │
│                   (e.g., 300 DPI)                                │
│                    2550 x 3300 px                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tile Generation                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PDF (page 0) ──> vips dzsave ──> DZI Tiles                     │
│                  (150 DPI)              │                        │
│                                         └──> plan.dzi            │
│                  Tile DPI                    plan_files/         │
│                 1275 x 1650 px                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenSeadragon Viewer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Load DZI tiles                                               │
│  2. Get tile image dimensions (imageSize.x, imageSize.y)        │
│  3. For each callout:                                            │
│     • normalized coords → tile pixel coords                      │
│     • tile pixel coords → viewport coords                        │
│     • create overlay with imageToViewportRectangle              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Coordinate System Deep Dive

### The Problem

OpenCV detection and OpenSeadragon use **different coordinate systems**, and the detection may be done at a **different DPI** than the tiles.

```
┌─────────────────────────────────────────────────────────────────┐
│              OpenCV Detection Results (results.json)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  {                                                                │
│    "calloutRef": "2/A5",                                         │
│    "x": 0.3706,           ← Normalized (0-1) based on detection  │
│    "y": 0.2609,           ← image width/height                   │
│    "pixelX": 945,         ← Pixel coords at DETECTION DPI        │
│    "pixelY": 861,         ← (e.g., 300 DPI = 2550x3300)          │
│    "confidence": 0.9025                                          │
│  }                                                                │
│                                                                   │
│  Detection Image:  2550 x 3300 pixels (300 DPI)                 │
│  pixelX / x = 945 / 0.3706 ≈ 2550 ✓                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Tile Image (plan.dzi)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  <Size Width="1275" Height="1650" />                            │
│                                                                   │
│  Tile Image: 1275 x 1650 pixels (150 DPI)                       │
│                                                                   │
│  DPI Mismatch: 2550/1275 = 2x difference!                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              OpenSeadragon Viewport Coordinates                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  • Image width is normalized to 1.0                              │
│  • Image height is SCALED by aspect ratio                        │
│                                                                   │
│  For 1275x1650 image:                                            │
│    viewport width  = 1.0                                         │
│    viewport height = 1650/1275 ≈ 1.294                          │
│                                                                   │
│  (0,0) ──────────────────────> (1.0, 0)                         │
│    │                                                              │
│    │        Image Content                                        │
│    │                                                              │
│    ▼                                                              │
│  (0, 1.294) ──────────────> (1.0, 1.294)                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### ❌ Wrong Approaches That Don't Work

#### 1. Using pixelX/pixelY directly
```javascript
// ❌ WRONG - DPI mismatch!
const imagePoint = new OpenSeadragon.Point(h.pixelX, h.pixelY);
const viewportPoint = viewer.viewport.imageToViewportCoordinates(imagePoint);
// This uses detection pixels (945, 861) but tile image is 1275x1650
// Position will be off by 2x!
```

#### 2. Using normalized coords without conversion
```javascript
// ❌ WRONG - Doesn't account for OSD aspect ratio scaling!
const viewportPoint = new OpenSeadragon.Point(h.x, h.y);
viewer.addOverlay({ location: viewportPoint });
// y-coordinates will be stretched/compressed
```

#### 3. Using viewport coords for width/height with Point location
```javascript
// ❌ WRONG - Causes drift during zoom animation!
viewer.addOverlay({
  location: viewportPoint,
  placement: OpenSeadragon.Placement.CENTER,
  width: 0.025,   // viewport coords
  height: 0.025   // viewport coords
});
// Overlay will "jump" during zoom animation
```

### ✅ Correct Solution

```javascript
// 1. Get tile image dimensions
const tiledImage = viewer.world.getItemAt(0);
const imageSize = tiledImage.getContentSize();
// imageSize.x = 1275, imageSize.y = 1650

// 2. Convert normalized coords (0-1) to tile pixel coords
const tilePixelX = h.x * imageSize.x;  // 0.3706 * 1275 = 472
const tilePixelY = h.y * imageSize.y;  // 0.2609 * 1650 = 430

// 3. Create Rect in IMAGE coordinates (pixels)
const overlayPixelSize = 25;  // Size in image pixels
const imageRect = new OpenSeadragon.Rect(
  tilePixelX - overlayPixelSize / 2,  // Center the overlay
  tilePixelY - overlayPixelSize / 2,
  overlayPixelSize,
  overlayPixelSize
);

// 4. Convert image Rect to viewport Rect
const viewportRect = viewer.viewport.imageToViewportRectangle(imageRect);

// 5. Add overlay with Rect (no placement, no width/height)
viewer.addOverlay({
  element: element,
  location: viewportRect  // Rect handles position + size
});
```

## Why This Solution Works

### 1. DPI Independence
```
Normalized coords (0-1) are independent of DPI
    ↓
Multiply by ACTUAL tile dimensions (not detection dimensions)
    ↓
Get correct pixel position on the tile image
```

### 2. Proper Scaling
```
Using OpenSeadragon.Rect in image coordinates
    ↓
Converted to viewport via imageToViewportRectangle
    ↓
Overlay scales with image (bigger on zoom in, smaller on zoom out)
No drift during zoom animation
```

### 3. Aspect Ratio Handling
```
imageToViewportRectangle handles OSD's aspect-ratio scaling
    ↓
You don't need to manually calculate viewport.y scaling
    ↓
Position is always correct
```

## Common Pitfalls & Solutions

### Pitfall 1: Overlay Drift During Zoom

**Symptom**: Overlays move inward when zooming in, outward when zooming out, then snap back to position.

**Cause**: Using Point location with viewport-coordinate width/height.

**Solution**: Use Rect in image coordinates instead.

```javascript
// Before (causes drift)
viewer.addOverlay({
  location: new OpenSeadragon.Point(x, y),
  width: 0.025,
  height: 0.025
});

// After (no drift)
const rect = new OpenSeadragon.Rect(x - size/2, y - size/2, size, size);
viewer.addOverlay({
  location: viewer.viewport.imageToViewportRectangle(rect)
});
```

### Pitfall 2: Wrong Position Due to DPI Mismatch

**Symptom**: Overlays are offset from the actual callout positions.

**Cause**: Using pixel coordinates from detection results directly when tile DPI differs.

**Solution**: Always use normalized coordinates (x, y) and multiply by tile dimensions.

```javascript
// Before (wrong if DPI mismatch)
const imagePoint = new OpenSeadragon.Point(h.pixelX, h.pixelY);

// After (correct for any DPI)
const tilePixelX = h.x * imageSize.x;
const tilePixelY = h.y * imageSize.y;
```

### Pitfall 3: Fixed Screen Size Instead of Scaling

**Symptom**: Overlay circles stay the same screen size when zooming (don't scale with image).

**Cause**: Using CSS fixed pixel sizes without OSD scaling.

**Solution**: Use image-coordinate-based Rect so overlay scales with image.

```javascript
// Define size in IMAGE pixels (will scale with zoom)
const overlayPixelSize = 25;  // 25 pixels on the image

// Rect in image coords ensures it scales
const imageRect = new OpenSeadragon.Rect(
  tilePixelX - overlayPixelSize / 2,
  tilePixelY - overlayPixelSize / 2,
  overlayPixelSize,
  overlayPixelSize
);
```

## Click Handling with MouseTracker

**Important**: Standard JavaScript click events don't work on OpenSeadragon overlays.

```javascript
// ❌ WRONG - Click events don't fire!
element.addEventListener('click', () => {
  alert('This will never fire!');
});

// ✅ CORRECT - Use OpenSeadragon.MouseTracker
new OpenSeadragon.MouseTracker({
  element: element,
  clickHandler: () => {
    alert(`Navigate to Sheet: ${hyperlink.targetSheetRef}`);
  }
});
```

## Complete Working Example

```javascript
function addOverlays(hyperlinks) {
  // Get tile image dimensions
  const tiledImage = viewer.world.getItemAt(0);
  const imageSize = tiledImage.getContentSize();

  // Define overlay size in image pixels
  const overlayPixelSize = 25;

  hyperlinks.forEach((h, index) => {
    const element = document.createElement('div');
    element.className = 'callout-overlay';

    // Convert normalized coords to tile pixel coords
    const tilePixelX = h.x * imageSize.x;
    const tilePixelY = h.y * imageSize.y;

    // Create Rect in image coordinates
    const imageRect = new OpenSeadragon.Rect(
      tilePixelX - overlayPixelSize / 2,
      tilePixelY - overlayPixelSize / 2,
      overlayPixelSize,
      overlayPixelSize
    );

    // Convert to viewport coordinates
    const viewportRect = viewer.viewport.imageToViewportRectangle(imageRect);

    // Add overlay
    viewer.addOverlay({
      element: element,
      location: viewportRect
    });

    // Add click handler with MouseTracker
    new OpenSeadragon.MouseTracker({
      element: element,
      clickHandler: () => {
        alert(`Navigate to Sheet: ${h.targetSheetRef}`);
      }
    });
  });
}
```

## Key Takeaways

1. **Always use normalized coordinates** (0-1) from detection results
2. **Multiply by tile image dimensions** to get pixel coords for the tile
3. **Use OpenSeadragon.Rect in image coordinates** for proper scaling
4. **Use `imageToViewportRectangle()`** for conversion
5. **Use MouseTracker** for click handling, not vanilla JS events
6. **Don't mix coordinate systems** - convert once and use consistently

## Reference

- **Detection Results**: Normalized coordinates (0-1) + pixel coords at detection DPI
- **Tile Image**: Actual dimensions from `tiledImage.getContentSize()`
- **Viewport**: OpenSeadragon's scaled coordinate system
- **Conversion Method**: `viewer.viewport.imageToViewportRectangle(rect)`

---

Generated from: `/packages/new-detection-processing/demo/`
