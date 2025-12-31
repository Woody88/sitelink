---
name: marker-detection-patterns
description: Construction plan marker detection expertise using PaddleOCR and OpenCV. Auto-invoke when discussing marker detection, OCR pipelines, shape detection (circles, triangles), or construction drawing analysis. Based on US/Canada architectural standards.
---

# Marker Detection Patterns for Construction Plans

## CRITICAL: Callout Format Understanding

Construction plans follow **US and Canada general architecture drawing standards** with TWO types of callouts:

### Callout Types
1. **Circular Callouts** (Detail markers)
2. **Triangular Callouts** (Section/elevation markers)

### Callout Structure (Dual-Part Format)
```
┌─────────┐
│    5    │  ← Detail number (top)
├─────────┤
│   A7    │  ← Sheet number (bottom) - letter + number
└─────────┘
```

**Pattern:** Detail number ABOVE sheet number
- Detail number: Integer (e.g., 1, 2, 5, 10)
- Sheet number: Letter + number (e.g., A5, A7, A10, A-401)
- Full reference: "5/A7" means "Detail 5 on Sheet A7"

## Detection Pipeline

### 1. Shape Detection (Two Detectors)

#### Circle Detection (Hough Circle Transform)
```python
circles = cv2.HoughCircles(
    preprocessed_image,
    cv2.HOUGH_GRADIENT,
    dp=1,
    minDist=30,
    param1=50,
    param2=30,
    minRadius=10,
    maxRadius=50
)
```

#### Triangle Detection (Contour Analysis)
```python
def detect_triangles(image):
    # Find contours
    contours, _ = cv2.findContours(
        edges, 
        cv2.RETR_EXTERNAL, 
        cv2.CHAIN_APPROX_SIMPLE
    )
    
    triangles = []
    for contour in contours:
        # Approximate polygon
        epsilon = 0.04 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Check if triangle (3 vertices)
        if len(approx) == 3:
            # Verify it's pointing down (architectural standard)
            vertices = approx.reshape(3, 2)
            if is_downward_triangle(vertices):
                triangles.append({
                    'contour': contour,
                    'vertices': vertices,
                    'bbox': cv2.boundingRect(contour)
                })
    
    return triangles

def is_downward_triangle(vertices):
    """Verify triangle points downward (top base, bottom point)"""
    # Sort by y-coordinate (top to bottom)
    sorted_verts = sorted(vertices, key=lambda v: v[1])
    
    # Top two vertices should have similar y
    top_y_diff = abs(sorted_verts[0][1] - sorted_verts[1][1])
    
    # Bottom vertex should be lower
    bottom_y = sorted_verts[2][1]
    
    return top_y_diff < 10 and bottom_y > sorted_verts[0][1] + 20
```

### 2. Image Preprocessing (Enhanced for Both Shapes)
```python
def preprocess_for_detection(image):
    # Upscale for small text
    upscaled = cv2.resize(image, None, fx=2.0, fy=2.0)
    
    # Convert to grayscale
    gray = cv2.cvtColor(upscaled, cv2.COLOR_BGR2GRAY)
    
    # CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Bilateral filtering (preserves edges)
    denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
    
    # Adaptive thresholding for shape detection
    thresh = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,  # Invert for black shapes on white
        blockSize=11,
        C=2
    )
    
    return {
        'enhanced': enhanced,      # For OCR
        'thresh': thresh,          # For shape detection
        'original_scale': image    # For reference
    }
```

### 3. OCR on Detected Callouts (Dual-Part Recognition)

#### Region Extraction Strategy
```python
def extract_callout_regions(shape_bbox, shape_type):
    """
    Extract top (detail) and bottom (sheet) regions from callout.
    
    Architectural standard:
    - Circle: Split horizontally at center
    - Triangle: Split at ~60% height (top base is larger)
    """
    x, y, w, h = shape_bbox
    
    if shape_type == 'circle':
        # Split circle horizontally
        detail_region = (x, y, w, h // 2)           # Top half
        sheet_region = (x, y + h // 2, w, h // 2)   # Bottom half
        
    elif shape_type == 'triangle':
        # Triangle: detail at top (wider), sheet at bottom (point)
        split_y = int(h * 0.4)  # Split higher for triangle
        detail_region = (x, y, w, split_y)
        sheet_region = (x, y + split_y, w, h - split_y)
    
    return detail_region, sheet_region
```

#### PaddleOCR Configuration for Callouts
```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(
    use_angle_cls=True,      # Handle rotated text
    lang='en',
    det_model_dir='PP-OCRv4_det',
    rec_model_dir='PP-OCRv4_rec',
    
    # Optimized for small text in callouts
    det_limit_side_len=1600,  # Allow larger images
    det_db_thresh=0.3,        # Lower threshold for small text
    det_db_box_thresh=0.5,    # Confidence for detection boxes
    
    # Recognition optimization
    rec_image_shape="3, 48, 320",  # Taller for vertical stacking
    use_gpu=False  # CPU inference (Docker container)
)

def recognize_callout_text(detail_region, sheet_region):
    """
    OCR both parts of the callout.
    Returns: (detail_num, sheet_id, confidence)
    """
    # OCR detail number (top)
    detail_result = ocr.ocr(detail_region, cls=True)
    detail_text = extract_text(detail_result)
    detail_conf = get_confidence(detail_result)
    
    # OCR sheet number (bottom)  
    sheet_result = ocr.ocr(sheet_region, cls=True)
    sheet_text = extract_text(sheet_result)
    sheet_conf = get_confidence(sheet_result)
    
    # Validate format
    detail_num = validate_detail_number(detail_text)  # Should be integer
    sheet_id = validate_sheet_number(sheet_text)      # Should be [A-Z]\d+
    
    avg_confidence = (detail_conf + sheet_conf) / 2
    
    return detail_num, sheet_id, avg_confidence
```

### 4. Pattern Validation

#### Detail Number Pattern
```python
def validate_detail_number(text):
    """
    Detail numbers are typically 1-2 digits.
    Examples: 1, 5, 10, 23
    """
    import re
    
    # Clean OCR errors (O->0, l->1, etc.)
    text = text.replace('O', '0').replace('o', '0')
    text = text.replace('l', '1').replace('I', '1')
    
    # Match 1-2 digit numbers
    match = re.search(r'\b(\d{1,2})\b', text)
    if match:
        return match.group(1)
    
    return None
```

#### Sheet Number Pattern
```python
def validate_sheet_number(text):
    """
    Sheet numbers follow pattern: [Letter][Dash?][Digits]
    Examples: A5, A7, A10, A-401, E-2
    
    Common prefixes:
    - A: Architecture
    - S: Structural
    - E: Electrical
    - M: Mechanical
    - P: Plumbing
    """
    import re
    
    # Clean OCR errors
    text = text.upper().strip()
    
    # Primary pattern: Letter + optional dash + digits
    pattern = r'\b([A-Z])-?(\d+)\b'
    match = re.search(pattern, text)
    
    if match:
        letter = match.group(1)
        number = match.group(2)
        
        # Reconstruct with consistent format
        # If original had dash, preserve it
        if '-' in text:
            return f"{letter}-{number}"
        else:
            return f"{letter}{number}"
    
    return None
```

#### Combined Reference Format
```python
def format_reference(detail_num, sheet_id):
    """
    Format: detail_num/sheet_id
    Example: "5/A7" means Detail 5 on Sheet A7
    """
    if detail_num and sheet_id:
        return f"{detail_num}/{sheet_id}"
    return None
```

## Complete Detection Workflow

```python
class CalloutDetector:
    def __init__(self):
        self.ocr = self._init_ocr()
    
    def detect_callouts(self, tile_image_path):
        """
        Detect all callouts (circles + triangles) on a tile.
        Returns list of detected callouts with metadata.
        """
        # Load and preprocess
        image = cv2.imread(tile_image_path)
        processed = preprocess_for_detection(image)
        
        callouts = []
        
        # Detect circles
        circles = cv2.HoughCircles(
            processed['thresh'],
            cv2.HOUGH_GRADIENT,
            dp=1, minDist=30,
            param1=50, param2=30,
            minRadius=10, maxRadius=50
        )
        
        if circles is not None:
            for (x, y, r) in circles[0]:
                callout = self._process_callout(
                    processed['enhanced'],
                    bbox=(int(x-r), int(y-r), int(2*r), int(2*r)),
                    shape_type='circle',
                    confidence_base=0.8  # Hough confidence
                )
                if callout:
                    callouts.append(callout)
        
        # Detect triangles
        triangles = detect_triangles(processed['thresh'])
        
        for triangle in triangles:
            callout = self._process_callout(
                processed['enhanced'],
                bbox=triangle['bbox'],
                shape_type='triangle',
                confidence_base=0.7  # Contour confidence
            )
            if callout:
                callouts.append(callout)
        
        return callouts
    
    def _process_callout(self, image, bbox, shape_type, confidence_base):
        """Process a single callout: extract regions, OCR, validate."""
        # Extract detail and sheet regions
        detail_region, sheet_region = extract_callout_regions(bbox, shape_type)
        
        # Crop image regions
        x, y, w, h = detail_region
        detail_img = image[y:y+h, x:x+w]
        
        x, y, w, h = sheet_region
        sheet_img = image[y:y+h, x:x+w]
        
        # OCR both parts
        detail_num, detail_conf = self._ocr_region(detail_img, 'detail')
        sheet_id, sheet_conf = self._ocr_region(sheet_img, 'sheet')
        
        # Validate format
        if not (detail_num and sheet_id):
            return None  # Invalid callout
        
        # Calculate overall confidence
        confidence = (
            0.3 * confidence_base +     # Shape detection
            0.4 * detail_conf +          # Detail OCR
            0.3 * sheet_conf             # Sheet OCR
        )
        
        # Create reference
        reference = format_reference(detail_num, sheet_id)
        
        return {
            'shape_type': shape_type,
            'bbox': bbox,
            'detail_number': detail_num,
            'sheet_number': sheet_id,
            'reference': reference,
            'confidence': confidence,
            'detail_confidence': detail_conf,
            'sheet_confidence': sheet_conf
        }
    
    def _ocr_region(self, image, region_type):
        """OCR a single region (detail or sheet)."""
        result = self.ocr.ocr(image, cls=True)
        text = extract_text(result)
        conf = get_confidence(result)
        
        if region_type == 'detail':
            validated = validate_detail_number(text)
        else:  # sheet
            validated = validate_sheet_number(text)
        
        return validated, conf
```

## Database Schema (Updated)

```sql
CREATE TABLE plan_markers (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    tile_id TEXT NOT NULL,
    
    -- Callout metadata
    shape_type TEXT NOT NULL CHECK(shape_type IN ('circle', 'triangle')),
    detail_number TEXT NOT NULL,     -- e.g., "5"
    sheet_number TEXT NOT NULL,      -- e.g., "A7"
    reference TEXT NOT NULL,          -- e.g., "5/A7"
    
    -- Position (center of shape on tile)
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    
    -- Bounding box
    bbox_x INTEGER NOT NULL,
    bbox_y INTEGER NOT NULL,
    bbox_width INTEGER NOT NULL,
    bbox_height INTEGER NOT NULL,
    
    -- Confidence scores
    detection_confidence REAL,   -- Shape detection confidence
    detail_confidence REAL,      -- Detail number OCR confidence
    sheet_confidence REAL,       -- Sheet number OCR confidence
    overall_confidence REAL,     -- Combined confidence
    
    -- Linking
    linked_sheet_id TEXT,        -- Foreign key to actual sheet
    link_status TEXT CHECK(link_status IN ('auto', 'confirmed', 'rejected', 'pending')),
    link_confidence REAL,        -- How confident the link is
    
    -- Review metadata
    requires_review BOOLEAN DEFAULT FALSE,  -- Flag low-confidence detections
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    review_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (plan_id) REFERENCES plans(id),
    FOREIGN KEY (sheet_id) REFERENCES plan_sheets(id),
    FOREIGN KEY (linked_sheet_id) REFERENCES plan_sheets(id)
);

-- Indexes
CREATE INDEX idx_markers_plan ON plan_markers(plan_id);
CREATE INDEX idx_markers_sheet ON plan_markers(sheet_id);
CREATE INDEX idx_markers_reference ON plan_markers(reference);
CREATE INDEX idx_markers_shape_type ON plan_markers(shape_type);
CREATE INDEX idx_markers_confidence ON plan_markers(overall_confidence);
CREATE INDEX idx_markers_review ON plan_markers(requires_review) WHERE requires_review = TRUE;
CREATE INDEX idx_markers_link_status ON plan_markers(link_status);
```

## Linking Strategy

```python
def link_callout_to_sheet(callout, available_sheets):
    """
    Match callout's sheet_number to actual sheet in database.
    
    Example:
    - Callout reference: "5/A7"
    - Match against sheets with names like "A-7", "A7", "SHEET A-7"
    """
    sheet_number = callout['sheet_number']  # e.g., "A7"
    
    # Generate matching patterns
    patterns = [
        sheet_number,                          # "A7"
        sheet_number.replace('-', ''),         # "A7" -> "A7"
        f"{sheet_number[0]}-{sheet_number[1:]}", # "A7" -> "A-7"
        f"SHEET {sheet_number}",               # "SHEET A7"
        f"SHEET {sheet_number[0]}-{sheet_number[1:]}", # "SHEET A-7"
    ]
    
    # Try exact match first
    for sheet in available_sheets:
        sheet_name = sheet['name'].upper().strip()
        for pattern in patterns:
            if pattern in sheet_name or sheet_name in pattern:
                return {
                    'linked_sheet_id': sheet['id'],
                    'link_status': 'auto',
                    'link_confidence': 0.9,
                    'requires_review': False
                }
    
    # No match found - flag for review
    return {
        'linked_sheet_id': None,
        'link_status': 'pending',
        'link_confidence': 0.0,
        'requires_review': True
    }
```

## Optimization Priorities

### 1. Shape Detection Accuracy
- **Circles**: Fine-tune Hough parameters per tile type
- **Triangles**: Improve vertex detection for rotated/skewed triangles
- **Both**: Filter false positives using aspect ratio, size constraints

### 2. OCR Accuracy (Dual-Part Challenge)
- **Region splitting**: Accurate horizontal division of callout
- **Small text**: PaddleOCR optimized for 8-16px text
- **Number recognition**: Handle OCR errors (O->0, l->1)

### 3. Confidence Scoring
```python
# Target: >90% overall confidence
confidence = (
    0.25 * shape_detection_score +  # Hough/contour confidence
    0.35 * detail_ocr_confidence +  # Detail number OCR
    0.25 * sheet_ocr_confidence +   # Sheet number OCR
    0.15 * pattern_match_score      # Regex validation
)

# Flag for review if < 0.7
requires_review = confidence < 0.7
```

### 4. Position Accuracy
- **Goal**: <2px error from shape center
- **Method**: Sub-pixel accuracy using moments
- **Verification**: Compare with ground truth annotations

## Testing Strategy

### Test Dataset Requirements
- **50 annotated tiles** from various sheet types
- **Ground truth includes:**
  - Shape type (circle/triangle)
  - Exact position (x, y)
  - Detail number
  - Sheet number
  - Shape bounding box

### Metrics to Track
```python
# Detection metrics (per shape type)
precision_circles = TP_circles / (TP_circles + FP_circles)
recall_circles = TP_circles / (TP_circles + FN_circles)
f1_circles = 2 * (precision_circles * recall_circles) / (precision_circles + recall_circles)

precision_triangles = TP_triangles / (TP_triangles + FP_triangles)
recall_triangles = TP_triangles / (TP_triangles + FN_triangles)
f1_triangles = 2 * (precision_triangles * recall_triangles) / (precision_triangles + recall_triangles)

# OCR accuracy
detail_accuracy = correct_details / total_details
sheet_accuracy = correct_sheets / total_sheets

# Position accuracy
avg_position_error = mean([distance(detected.center, ground_truth.center)])

# Overall targets
assert f1_circles >= 0.90
assert f1_triangles >= 0.85  # Triangles harder due to orientation
assert detail_accuracy >= 0.95
assert sheet_accuracy >= 0.90
assert avg_position_error < 2.0  # pixels
```

## Common Issues & Solutions

### Issue: Triangle Orientation Varies
**Solution:**
```python
def normalize_triangle_orientation(vertices):
    """Rotate triangle to standard down-pointing orientation."""
    # Find orientation using principal component analysis
    angle = calculate_triangle_angle(vertices)
    
    # Rotate to standard orientation (point down)
    if abs(angle) > 15:  # degrees
        rotated = rotate_vertices(vertices, -angle)
        return rotated
    
    return vertices
```

### Issue: Dual-Part Region Splitting Inaccurate
**Solution:**
```python
def adaptive_region_split(shape_bbox, shape_type, image):
    """
    Use edge detection to find actual text separation line
    instead of assuming midpoint.
    """
    x, y, w, h = shape_bbox
    region = image[y:y+h, x:x+w]
    
    # Horizontal projection profile
    projection = np.sum(region, axis=1)  # Sum each row
    
    # Find valley (separation between detail and sheet)
    # Look for minimum in middle 60% of shape
    search_start = int(h * 0.2)
    search_end = int(h * 0.8)
    
    split_y = search_start + np.argmin(projection[search_start:search_end])
    
    # Create regions
    detail_region = (x, y, w, split_y)
    sheet_region = (x, y + split_y, w, h - split_y)
    
    return detail_region, sheet_region
```

### Issue: OCR Confuses "O" and "0", "I" and "1"
**Solution:** Post-processing with context
```python
def correct_ocr_errors(text, expected_type):
    """
    Apply domain knowledge to correct common OCR errors.
    """
    if expected_type == 'detail':
        # Detail numbers are pure digits
        text = text.replace('O', '0').replace('o', '0')
        text = text.replace('I', '1').replace('l', '1')
        text = re.sub(r'[^\d]', '', text)  # Remove non-digits
        
    elif expected_type == 'sheet':
        # Sheet starts with letter, then numbers
        text = text.upper()
        # First character should be letter
        if len(text) > 0 and text[0].isdigit():
            # Likely error - try common substitutions
            if text[0] == '4':
                text = 'A' + text[1:]
            elif text[0] == '3':
                text = 'E' + text[1:]
        
        # Rest should be digits (after removing dash)
        letter = text[0] if text else ''
        numbers = re.sub(r'[^\d-]', '', text[1:])
        text = letter + numbers
    
    return text
```

## Reference: Existing Implementation

The current implementation is located at:
```
\\wsl.localhost\Ubuntu-20.04\home\woodson\Code\projects\sitelink\packages\callout-processor
```

Review this code to understand:
- Current shape detection approach
- Existing OCR configuration
- Pattern matching implementation
- Database integration

## US/Canada Architectural Standards

Reference markers follow standard conventions:
- **Detail markers** (circles): Reference details on other sheets
- **Section markers** (triangles): Indicate section cuts
- **Format consistency**: Detail/Sheet always in this order
- **Sheet numbering**: Discipline prefix + number (A=Architecture, S=Structural, etc.)

These are NOT random - they follow established industry standards that have been consistent for decades.
