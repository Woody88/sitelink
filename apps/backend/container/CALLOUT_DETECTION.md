# Callout Detection System

This document describes the CV+LLM hybrid callout detection system used to identify and locate hyperlink markers on construction plan sheets.

## Architecture Overview

The detection pipeline uses a two-stage approach:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OpenCV Shape   │────▶│  Crop & Encode   │────▶│  LLM Batch      │
│  Detection      │     │  Each Shape      │     │  Validation     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                │
         │ Hough Circles                                  │ Semantic
         │ Contour Analysis                               │ Understanding
         │ Section Flags                                  │ OCR
         ▼                                                ▼
   Shape Candidates                              Validated Callouts
   (pixel coordinates)                           (normalized 0-1)
```

### Stage 1: OpenCV Shape Detection (`detect_shapes_cv`)

Uses multiple computer vision techniques to find shape candidates:

1. **Hough Circle Transform** - Precise detection of circular callout symbols
2. **Contour Analysis** - Detects triangles, section flags, and irregular shapes
3. **Morphological Operations** - Cleans up noise and connects broken lines

### Stage 2: LLM Batch Validation (`validate_shapes_with_llm`)

Each detected shape is:
1. Cropped with padding from the original image
2. Encoded as base64 PNG
3. Sent to the LLM (Gemini 2.5 Flash) in batches
4. Validated for callout content and OCR'd for reference text

## Configuration Parameters

Located in `server.py` at the top of the CV+LLM section:

```python
# Detection Configuration
DEDUP_DISTANCE_PX = 200      # Distance threshold for deduplicating nearby callouts
CROP_PADDING_PX = 70         # Padding around shapes when cropping for LLM
CONFIDENCE_THRESHOLD = 0.90  # Minimum confidence for accepting callouts (0.0-1.0)
CALLOUT_REF_PATTERN = r'^[A-Z0-9.-]+/[A-Z0-9.-]+$'  # Valid callout format regex
```

### Hough Circle Parameters (in `detect_shapes_cv`)

```python
min_radius = int(12 * scale)   # Minimum circle radius (pixels at 300 DPI)
max_radius = int(50 * scale)   # Maximum circle radius
min_dist = int(40 * scale)     # Minimum distance between circle centers
param1 = 50                    # Canny edge detection threshold
param2 = 30                    # Accumulator threshold (lower = more detections)
```

### Contour Detection Parameters

```python
min_area = int(600 * scale ** 2)   # Minimum contour area
max_area = int(8500 * scale ** 2)  # Maximum contour area
circularity_threshold = 0.65       # Above this = circle, below = other shape
```

---

## Customizing Marker Appearance

Marker overlays are styled via CSS in `viewer/src/styles.css`:

### Marker Size

```css
.marker-overlay {
    width: 32px;      /* Change to adjust marker diameter */
    height: 32px;     /* Keep equal to width for circles */
}
```

### Marker Color

```css
.marker-overlay {
    /* Default: Red/Pink markers */
    background: rgba(233, 69, 96, 0.3);    /* Fill color (with transparency) */
    border: 3px solid #e94560;              /* Border color */
}

/* For "needs review" markers: Yellow/Orange */
.marker-overlay.needs-review {
    background: rgba(255, 193, 7, 0.3);
    border-color: #ffc107;
}
```

Common color alternatives:
- **Blue**: `rgba(66, 133, 244, 0.3)` with border `#4285f4`
- **Green**: `rgba(52, 168, 83, 0.3)` with border `#34a853`
- **Purple**: `rgba(156, 39, 176, 0.3)` with border `#9c27b0`
- **Orange**: `rgba(255, 152, 0, 0.3)` with border `#ff9800`

### Marker Shape

```css
.marker-overlay {
    border-radius: 50%;   /* 50% = circle, 0 = square, 8px = rounded square */
}
```

### Marker Border Thickness

```css
.marker-overlay {
    border: 3px solid #e94560;   /* Change 3px to adjust thickness */
}
```

### Hover & Selection Effects

```css
.marker-overlay:hover {
    transform: scale(1.2);    /* Grow to 120% on hover */
}

.marker-overlay.selected {
    transform: scale(1.3);    /* Selected marker is 130% size */
    box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.4);  /* Glow effect */
}
```

---

## Improving Detection Accuracy

### Current Limitations

1. **Missing markers** - Some callout symbols are not detected by OpenCV
2. **False positives filtered** - LLM correctly rejects non-callouts but some valid ones may be rejected
3. **Position accuracy** - When detected, positions are accurate; the issue is recall not precision

### Avenues for Improvement

#### 1. Lower OpenCV Detection Thresholds (Higher Recall)

**File**: `server.py` in `detect_shapes_cv()`

```python
# More permissive Hough circle detection
circles = cv2.HoughCircles(
    blurred, cv2.HOUGH_GRADIENT, 1, min_dist,
    param1=50,
    param2=25,      # Lower from 30 → more circle candidates
    minRadius=int(10 * scale),   # Lower from 12 → smaller circles
    maxRadius=int(60 * scale)    # Raise from 50 → larger circles
)

# More permissive contour detection
min_area = int(400 * scale ** 2)    # Lower from 600
max_area = int(12000 * scale ** 2)  # Raise from 8500
```

**Trade-off**: More candidates means longer LLM processing and potentially more false positives to filter.

#### 2. Lower LLM Confidence Threshold

**File**: `server.py`

```python
CONFIDENCE_THRESHOLD = 0.85  # Lower from 0.90 to accept more borderline callouts
```

**Trade-off**: May accept more false positives (scale indicators, dimensions, etc.)

#### 3. Add Text Block Detection (Borderless Callouts)

Some callouts don't have a circle/triangle border. The backend-dev implementation includes text block detection:

```python
def detect_text_blocks(thresh: np.ndarray, dpi: int = 300) -> list:
    """Detect potential borderless text callouts (XX/00 pattern)."""
    scale = dpi / 300.0

    # Horizontal smearing to connect text characters
    k_width = int(22 * scale)
    k_height = int(5 * scale)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_width, k_height))
    smeared = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(smeared, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    blocks = []
    min_area = int(500 * scale ** 2)
    max_area = int(6000 * scale ** 2)

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        aspect = w / float(h) if h > 0 else 0

        # Filter for callout-sized text blocks
        if min_area < area < max_area and 1.1 < aspect < 5.0:
            blocks.append({
                "type": "text_callout",
                "method": "blob",
                "centerX": x + w // 2,
                "centerY": y + h // 2,
                "bbox": {"x1": x, "y1": y, "x2": x + w, "y2": y + h},
                "confidence": 0.65
            })

    return blocks
```

#### 4. Improve LLM Prompt Engineering

The batch validation prompt can be refined to better identify callout types:

**File**: `server.py` in `build_batch_validation_prompt()`

- Add more examples of valid callout types
- Be more explicit about what NOT to match (scale indicators, dimensions)
- Include context about the specific plan set being processed

#### 5. Multi-Pass Detection with Different Parameters

Run detection multiple times with different parameter sets:

```python
def detect_shapes_cv_multipass(image: np.ndarray, dpi: int = 300) -> list:
    """Run detection with multiple parameter sets and merge results."""
    all_shapes = []

    # Pass 1: Standard parameters
    all_shapes.extend(detect_shapes_cv(image, dpi, param2=30))

    # Pass 2: Aggressive (more candidates)
    all_shapes.extend(detect_shapes_cv(image, dpi, param2=20))

    # Pass 3: Conservative (high confidence only)
    all_shapes.extend(detect_shapes_cv(image, dpi, param2=40))

    # Deduplicate across all passes
    return deduplicate_shapes(all_shapes)
```

#### 6. Template Matching for Known Callout Styles

If the plan set uses consistent callout styles, template matching can improve recall:

```python
def detect_with_template(image: np.ndarray, template: np.ndarray) -> list:
    """Find callouts matching a known template."""
    result = cv2.matchTemplate(image, template, cv2.TM_CCOEFF_NORMED)
    threshold = 0.8
    locations = np.where(result >= threshold)
    # ... convert locations to shape dicts
```

#### 7. Increase Image DPI for Better Small Symbol Detection

Currently using 300 DPI. Higher DPI improves detection of small callouts:

**Trade-off**: Larger images mean longer processing time and more memory usage.

```python
# In queue-consumer.ts or wherever DPI is set
const DPI = 400;  # Increase from 300
```

#### 8. Add OCR Pre-filtering with Tesseract

Before sending to LLM, use Tesseract to pre-filter regions containing text:

```python
import pytesseract

def has_callout_text(crop: np.ndarray) -> bool:
    """Check if crop contains text matching callout pattern."""
    text = pytesseract.image_to_string(crop, config='--psm 6')
    return bool(re.search(r'\d+/[A-Z]\d+', text, re.IGNORECASE))
```

---

## Debugging Detection Issues

### Enable Debug Output

The CV detection saves debug images to the output directory:

```python
# Debug visualization is saved to:
# {output_dir}/cv_llm_debug/cv_detection_debug.png
# {output_dir}/cv_llm_debug/crops/shape_1_circle.png
# etc.
```

### Check Detection Logs

Look for these log messages in the container output:

```
[Callouts] CV+LLM detection for sheet-0 (5100x3300)
[Callouts] Step 1: OpenCV shape detection...
[Callouts]   Found 45 shape candidates
[Callouts] Step 2: LLM batch validation...
[Callouts]   LLM validated 7 callouts
[Callouts] Step 3: Deduplication...
[Callouts]   After dedup: 7 callouts
```

### Test Individual Sheets

Use curl to test detection on a specific sheet:

```bash
# Extract a page with vips
vips pdfload sample.pdf /tmp/page.png --page=2 --dpi=300

# Test detection
curl -X POST http://localhost:32804/detect-callouts \
  -H "X-Sheet-Id: test" \
  -H "X-Valid-Sheet-Numbers: [\"A1\",\"A2\",\"A3\"]" \
  --data-binary @/tmp/page.png
```

---

## Reference Implementation

The detection pipeline was ported from:
- `/home/woodson/Code/projects/sitelink_backend-dev/packages/callout-processor/`

Key files:
- `src/services/enhancedShapeDetection.py` - OpenCV detection
- `src/services/cvLLMDetection.ts` - Pipeline orchestration
- `src/utils/batchValidation.ts` - LLM batch validation
