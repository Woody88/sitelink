# OCR-Based Filtering for Detail Callouts

## Goal

Reduce detail callout false positives from 26 total (13 on Page 2, 12 on Page 4) to ~5-8 total by filtering out dimension text and notes.

**Expected Impact**:
- Page 2 detail precision: 7.1% → **50-70%**
- Page 4 detail precision: 63.6% → **80-90%**
- Overall precision: 79.5% → **85-90%**

---

## Implementation Steps

### Step 1: Add OCR Dependency

**File**: `requirements.txt`

```txt
# Add this line
pytesseract>=0.3.10
```

Then install:
```bash
pip install pytesseract

# Install Tesseract OCR engine
# Ubuntu/Debian:
sudo apt-get install tesseract-ocr

# macOS:
brew install tesseract

# Verify installation:
tesseract --version
```

---

### Step 2: Create OCR Filter Module

**File**: `src/ocr_filter.py`

```python
"""
OCR-based filtering to remove text-only false positives.

Filters out:
- Dimension text (e.g., "12'-6\"", "3/4\"", "2.5m")
- Notes (e.g., "TYP", "EQ", "SIM")
- Alphanumeric labels (e.g., "A1", "B-23")
"""

import re
import cv2
import numpy as np
from typing import Dict, List, Optional
import pytesseract


def extract_text_from_bbox(image: np.ndarray, bbox: List[float]) -> str:
    """
    Extract text from bounding box using OCR.

    Args:
        image: Full image
        bbox: [x, y, w, h] bounding box

    Returns:
        Extracted text (stripped)
    """
    x, y, w, h = [int(v) for v in bbox]

    # Add small margin to improve OCR accuracy
    margin = 5
    x = max(0, x - margin)
    y = max(0, y - margin)
    w = min(image.shape[1] - x, w + 2 * margin)
    h = min(image.shape[0] - y, h + 2 * margin)

    # Extract crop
    crop = image[y:y+h, x:x+w]

    # Convert to grayscale for better OCR
    if len(crop.shape) == 3:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop

    # Apply thresholding to improve OCR
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Run OCR with config for better accuracy
    config = '--psm 7 --oem 3'  # PSM 7 = single line, OEM 3 = default
    text = pytesseract.image_to_string(binary, config=config)

    return text.strip()


def is_dimension_text(text: str) -> bool:
    """
    Check if text is dimension text.

    Patterns:
    - "12'-6\"" (feet-inches)
    - "3/4\"" (fractional inches)
    - "2.5m" (metric)
    - "100mm" (metric)
    - "R15" (radius)
    """
    text = text.upper()

    # Feet-inches pattern: 12'-6", 3'-0", etc.
    if re.match(r"^\d+'-\d+\"?$", text):
        return True

    # Fractional inches: 3/4", 1/2", etc.
    if re.match(r"^\d+/\d+\"?$", text):
        return True

    # Decimal with units: 2.5m, 100mm, 3.5', etc.
    if re.match(r"^\d+\.?\d*['\"]?[mM]{1,2}?$", text):
        return True

    # Radius: R15, R10, etc.
    if re.match(r"^R\d+$", text):
        return True

    # Generic number with optional decimal
    if re.match(r"^\d+\.?\d*$", text):
        return True

    return False


def is_note_text(text: str) -> bool:
    """
    Check if text is a common note/abbreviation.

    Examples: TYP, EQ, SIM, NTS, REF, etc.
    """
    text = text.upper().strip('.')

    common_notes = [
        'TYP', 'TYPICAL',
        'EQ', 'EQUAL',
        'SIM', 'SIMILAR',
        'NTS', 'NOT TO SCALE',
        'REF', 'REFERENCE',
        'MIN', 'MAX',
        'CLR', 'CLEAR',
        'CL', 'CENTERLINE',
        'DN', 'DOWN',
        'UP',
        'N', 'S', 'E', 'W',  # Compass directions
    ]

    return text in common_notes


def is_alphanumeric_label(text: str) -> bool:
    """
    Check if text is a simple alphanumeric label.

    Examples: A1, B-23, C12, etc.
    """
    text = text.upper()

    # Pattern: Letter + Number (with optional dash/space)
    if re.match(r"^[A-Z][-\s]?\d+$", text):
        return True

    # Pattern: Number + Letter
    if re.match(r"^\d+[-\s]?[A-Z]$", text):
        return True

    return False


def is_text_only_detection(image: np.ndarray, detection: Dict, min_confidence: float = 0.6) -> bool:
    """
    Check if detection is text-only (dimension/note/label).

    Args:
        image: Full image
        detection: Detection dict with 'bbox' key
        min_confidence: Minimum OCR confidence to trust result

    Returns:
        True if detection is text-only (should be filtered)
    """
    bbox = detection['bbox']

    # Extract text from bounding box
    text = extract_text_from_bbox(image, bbox)

    # If OCR returned nothing, keep the detection (likely has symbol)
    if len(text) == 0:
        return False

    # Check for dimension text
    if is_dimension_text(text):
        return True

    # Check for note text
    if is_note_text(text):
        return True

    # Check for alphanumeric label
    if is_alphanumeric_label(text):
        return True

    # If text is very short and all uppercase (likely abbreviation)
    if len(text) <= 4 and text.isupper():
        return True

    return False


def filter_text_only_detections(
    image: np.ndarray,
    detections: List[Dict],
    callout_types: Optional[List[str]] = None,
    verbose: bool = False
) -> Dict:
    """
    Filter out text-only detections using OCR.

    Args:
        image: Full image
        detections: List of detection dicts
        callout_types: List of callout types to filter (default: ['detail'])
        verbose: Print filtering statistics

    Returns:
        Dict with 'filtered_detections' and 'filter_stats'
    """
    if callout_types is None:
        callout_types = ['detail']  # Only filter detail callouts by default

    original_count = len(detections)
    filtered = []
    removed_count = 0

    for det in detections:
        callout_type = det.get('class', det.get('callout_type'))

        # Only apply OCR filter to specified callout types
        if callout_type not in callout_types:
            filtered.append(det)
            continue

        # Check if text-only
        if is_text_only_detection(image, det):
            removed_count += 1
            if verbose:
                text = extract_text_from_bbox(image, det['bbox'])
                print(f"Removed text-only detection: '{text}' (class: {callout_type})")
        else:
            filtered.append(det)

    stats = {
        'original': original_count,
        'removed_by_ocr': removed_count,
        'final': len(filtered)
    }

    if verbose:
        print(f"\nOCR filter: {original_count} → {len(filtered)} ({removed_count} removed)")

    return {
        'filtered_detections': filtered,
        'filter_stats': stats
    }


if __name__ == "__main__":
    import json
    import argparse

    parser = argparse.ArgumentParser(description="Test OCR filtering on detections")
    parser.add_argument("image", help="Path to image")
    parser.add_argument("detections_json", help="Path to detections JSON")
    parser.add_argument("--types", nargs='+', default=['detail'],
                        help="Callout types to filter (default: detail)")
    parser.add_argument("--verbose", action="store_true", help="Print removed detections")

    args = parser.parse_args()

    # Load image
    image = cv2.imread(args.image)

    # Load detections
    with open(args.detections_json) as f:
        data = json.load(f)
    detections = data['detections']

    # Apply OCR filter
    result = filter_text_only_detections(
        image,
        detections,
        callout_types=args.types,
        verbose=args.verbose
    )

    print(f"\n=== OCR Filter Results ===")
    print(f"Original detections: {result['filter_stats']['original']}")
    print(f"Text-only removed: {result['filter_stats']['removed_by_ocr']}")
    print(f"Final detections: {result['filter_stats']['final']}")
```

---

### Step 3: Integrate OCR Filter into Detection Pipeline

**File**: `src/detect_yolo_finetuned.py`

Add import:
```python
from ocr_filter import filter_text_only_detections
```

Modify `detect_callouts_finetuned()` to add OCR filtering step:

```python
def detect_callouts_finetuned(
    image_path: str,
    weights_path: str = "weights/callout_detector.pt",
    tile_size: int = TILE_SIZE,
    overlap: float = OVERLAP,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.5,
    output_path: str = None,
    use_filters: bool = True,
    use_ocr_filter: bool = True,  # NEW PARAMETER
) -> Dict:
    # ... existing code ...

    merged = merge_detections(all_detections, iou_threshold=0.5)
    print(f"After NMS: {len(merged)} callouts")

    # Apply post-processing filters
    if use_filters:
        filter_result = apply_all_filters(merged, verbose=True)
        merged = filter_result['filtered_detections']
        filter_stats = filter_result['filter_stats']
    else:
        filter_stats = None

    # Apply OCR filter (after general filters)
    ocr_stats = None
    if use_ocr_filter:
        ocr_result = filter_text_only_detections(
            image,
            merged,
            callout_types=['detail'],  # Only filter detail callouts
            verbose=True
        )
        merged = ocr_result['filtered_detections']
        ocr_stats = ocr_result['filter_stats']

    # ... rest of code ...
```

Add CLI argument:
```python
parser.add_argument("--no-ocr-filter", action="store_true",
                    help="Disable OCR-based text filtering")
```

Update function call:
```python
results = detect_callouts_finetuned(
    args.image,
    weights_path=args.weights,
    conf_threshold=args.conf,
    iou_threshold=args.iou,
    output_path=args.output,
    use_filters=not args.no_filters,
    use_ocr_filter=not args.no_ocr_filter  # NEW
)
```

---

### Step 4: Test on Validation Set

```bash
# Test on Page 2 (13 detail FPs expected to reduce to ~2-3)
python src/detect_yolo_finetuned.py test_output/4pages_p2.png \
  --weights weights/callout_detector.pt \
  --conf 0.01 \
  --output test_output/4pages_p2_ocr.png \
  --output-json test_output/4pages_p2_ocr.json

# Validate
python src/validate_with_ground_truth.py \
  test_output/4pages_p2.png \
  test_output/4pages_p2_ocr.json \
  /path/to/ground_truth.txt \
  --output test_output/4pages_p2_ocr_validation.png

# Test on Page 4 (12 detail FPs expected to reduce to ~3-5)
python src/detect_yolo_finetuned.py test_output/4pages_p4.png \
  --weights weights/callout_detector.pt \
  --conf 0.01 \
  --output test_output/4pages_p4_ocr.png \
  --output-json test_output/4pages_p4_ocr.json

# Validate
python src/validate_with_ground_truth.py \
  test_output/4pages_p4.png \
  test_output/4pages_p4_ocr.json \
  /path/to/ground_truth.txt \
  --output test_output/4pages_p4_ocr_validation.png
```

---

### Step 5: Measure Impact

Compare results before/after OCR filtering:

| Page | Metric | Before OCR | After OCR | Change |
|------|--------|-----------|-----------|--------|
| Page 2 | Detail Precision | 7.1% | **~60%** | **+53pp** |
| Page 2 | Detail FPs | 13 | **~3** | **-77%** |
| Page 4 | Detail Precision | 63.6% | **~85%** | **+21pp** |
| Page 4 | Detail FPs | 12 | **~4** | **-67%** |
| Overall | Precision | 79.5% | **~87%** | **+8pp** |

---

## Expected Results

### Before OCR Filter

**Page 2 Detail Callouts**:
- 1 TP (real callout found)
- 13 FPs (dimension text: "12'-6\"", "3'-0\"", "TYP", etc.)
- Precision: 1/14 = 7.1%

**Page 4 Detail Callouts**:
- 21 TPs (real callouts found)
- 12 FPs (dimension text, notes)
- Precision: 21/33 = 63.6%

### After OCR Filter

**Page 2 Detail Callouts**:
- 1 TP (unchanged - has symbol)
- ~2-3 FPs (OCR misses some, or non-text FPs)
- Precision: 1/3 = **33%** to 1/4 = **25%** (still low, but 3-5x better)

**Page 4 Detail Callouts**:
- 21 TPs (unchanged - have symbols)
- ~3-5 FPs (OCR misses some edge cases)
- Precision: 21/25 = **84%** to 21/26 = **81%** (good!)

---

## Limitations and Edge Cases

### OCR May Miss:

1. **Stylized fonts** - OCR struggles with decorative/custom fonts
2. **Small text** - Text < 10px may not OCR correctly
3. **Rotated text** - Vertical or diagonal text harder to recognize
4. **Low contrast** - Light text on light background

### Solutions:

1. **Pre-process crops**:
   - Resize small crops (upscale 2x-3x for OCR)
   - Rotate text to horizontal (detect orientation first)
   - Enhance contrast (histogram equalization)

2. **Multiple OCR passes**:
   ```python
   # Try different preprocessings
   text1 = ocr(crop)
   text2 = ocr(upscale(crop, 2x))
   text3 = ocr(rotate(crop, 90))

   # If any pass detects dimension text, filter
   if is_dimension_text(text1) or is_dimension_text(text2) or is_dimension_text(text3):
       return True
   ```

3. **Fallback to conservative filter**:
   ```python
   # If OCR fails (empty result), use conservative rule
   if len(text) == 0:
       # Keep detection if it has circular shape (likely symbol)
       if is_circular(bbox):
           return False
       else:
           return True  # Reject if not circular
   ```

---

## Next Steps After OCR Filter

Once OCR filter is working:

1. **Re-validate all 3 pages** - Measure new precision/recall
2. **Update FINAL_RESULTS.md** with OCR results
3. **Deploy to production** if metrics meet thresholds:
   - Overall precision: >85%
   - Overall recall: >90%
   - Detail precision: >75%
   - Detail recall: >70%

4. **Optional further improvements**:
   - Multi-scale detection (improve recall)
   - Confidence threshold tuning (optimize precision-recall balance)
   - Ensemble methods (combine multiple models)

---

## Estimated Timeline

- **Step 1** (Install OCR): 15 minutes
- **Step 2** (Create OCR filter module): 2 hours
- **Step 3** (Integrate into pipeline): 1 hour
- **Step 4** (Test and validate): 1 hour
- **Step 5** (Measure and document): 1 hour

**Total**: ~5-6 hours

---

## Success Criteria

**After OCR filter implementation**:
- ✅ Detail callout precision: >75%
- ✅ Detail callout recall: >65%
- ✅ Overall precision: >85%
- ✅ Overall recall: >90%
- ✅ Detail callouts ready for production
