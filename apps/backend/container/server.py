"""
PDF Processing Container Server
Flask server providing PDF processing endpoints for VIPS, OpenCV, and OCR operations.
Uses LLM (Gemini Flash via OpenRouter) for title block analysis.
"""
import io
import os
import json
import base64
import traceback
import requests
from flask import Flask, request, jsonify, Response
import pyvips
import cv2
import numpy as np
import pytesseract
from PIL import Image

app = Flask(__name__)

# OpenRouter API configuration - read at request time to support dynamic injection
# These are injected by the worker using container.startAndWaitForPorts({ envVars: {...} })
def get_openrouter_config():
    """Get OpenRouter config at request time (env vars may be set after module load)"""
    return {
        'api_key': os.environ.get('OPENROUTER_API_KEY', ''),
        'model': os.environ.get('OPENROUTER_MODEL', 'google/gemini-2.5-flash')
    }


def build_title_block_prompt(image_width: int, image_height: int) -> str:
    """Build prompt for detecting title block information (sheet number, title)"""
    return f"""You are analyzing a construction drawing to extract TITLE BLOCK information.

**TITLE BLOCK IDENTIFICATION:**
The title block is a distinct, structured information area on the drawing. Identify it by these VISUAL CHARACTERISTICS, not by position (as the drawing may be rotated):

**Visual Characteristics:**
- **Structured layout**: Contains multiple labeled fields organized in rows/columns
- **Bordered area**: Usually has visible borders, boxes, or lines separating fields
- **Labeled fields**: Contains text labels like "SHEET NUMBER", "SHEET NO.", "TITLE", "DATE", "SCALE", "PROJECT", etc.
- **Project information**: Typically includes project name, address, or client information
- **Dense text area**: More text-dense than the main drawing area
- **Standard elements**: Usually contains: project name, date, scale, sheet number, sheet title, sometimes revision info
- **Position-independent**: Can be in any corner or edge (bottom-right, top-right, bottom-left, etc.) depending on drawing orientation
- **May be rotated**: If the drawing is rotated, the title block rotates with it - look for the structured information area

**WHAT TO DETECT:**

1. **SHEET NUMBER** (Required):
   - Look for labels like "SHEET NUMBER", "SHEET NO.", "DWG NO.", "DRAWING NO.", or just a number/letter combination
   - Common formats: "A1", "A2", "A2.01", "S-101", "M1.1", "E2", "A-101"
   - Usually in a clearly labeled field or box
   - This is the unique identifier for this specific sheet

2. **SHEET TITLE** (Required):
   - The descriptive name of what this sheet shows
   - Usually near the sheet number
   - Examples: "FOUNDATION PLAN", "FIRST FLOOR FRAMING", "ELEVATIONS", "SITE PLAN"
   - May be labeled as "TITLE", "SHEET TITLE", "DRAWING TITLE", or unlabeled
   - Often in larger text than other title block fields

3. **DISCIPLINE** (Optional):
   - Infer from sheet number prefix: A=Architectural, S=Structural, M=Mechanical, E=Electrical, P=Plumbing
   - Or from title content

**DETECTION STRATEGY:**
- Scan the ENTIRE image for a structured information area with the visual characteristics above
- Look for areas with multiple labeled fields (e.g., "SHEET NUMBER:", "TITLE:", "DATE:", "SCALE:")
- Identify the region that contains project information, dates, and sheet metadata
- The title block is usually a rectangular or boxed area, but its position depends on drawing orientation
- Don't assume position - identify by structure and content, not location
- Check all corners and edges - the title block could be anywhere if the drawing is rotated

**IMAGE DIMENSIONS:** {image_width} x {image_height} pixels

**INSTRUCTIONS:**
- Scan the ENTIRE image systematically to find the structured title block area
- Identify it by its visual characteristics (labeled fields, borders, structured layout), not by position
- Look for the area containing project info, dates, scale, and sheet metadata
- Extract the sheet number and sheet title accurately from the identified title block
- If you cannot find certain information, use null for that field
- Report the region where you found the title block (this helps verify correct identification)

Return your response as JSON only, with no additional text:

{{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION AND LOWER FLOOR FRAMING PLAN",
  "discipline": "Architectural",
  "titleBlockLocation": {{
    "region": "bottom-right",
    "confidence": 0.95
  }}
}}

If you cannot determine a field, use null for that field."""


def call_openrouter_vision(prompt: str, image_base64: str, mime_type: str = "image/png") -> dict:
    """Call OpenRouter API with vision model for image analysis"""
    config = get_openrouter_config()
    api_key = config['api_key']
    model = config['model']

    if not api_key:
        print("[LLM] No OPENROUTER_API_KEY configured, falling back to OCR")
        return None

    print(f"[LLM] Calling OpenRouter with model={model}")

    try:
        image_url = f"data:{mime_type};base64,{image_base64}"

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sitelink.dev",
                "X-Title": "Sitelink PDF Processor"
            },
            json={
                "model": model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }],
                "temperature": 0
            },
            timeout=60
        )

        if response.status_code != 200:
            print(f"[LLM] OpenRouter error {response.status_code}: {response.text}")
            return None

        result_text = response.json()['choices'][0]['message']['content']
        print(f"[LLM] Raw response: {result_text[:300]}...")

        # Parse JSON from response (handle markdown code blocks)
        cleaned = result_text.strip()
        if cleaned.startswith('```json'):
            cleaned = cleaned.split('```json')[1].split('```')[0]
        elif cleaned.startswith('```'):
            cleaned = cleaned.split('```')[1].split('```')[0]

        return json.loads(cleaned.strip())

    except Exception as e:
        print(f"[LLM] Error calling OpenRouter: {e}")
        traceback.print_exc()
        return None


import re

# Sheet name patterns from backend-dev (common formats)
SHEET_NAME_PATTERNS = [
    # Standard format: "SHEET: A7" or "SHEET NO: A7"
    r'SHEET\s*(?:NO\.?|NUM\.?|NUMBER)?[:\s]+([A-Z]\d{1,2})',
    # Drawing number format: "DWG NO: A-007" or "DWG NO: A007"
    r'DWG\.?\s*(?:NO\.?|NUM\.?)?[:\s]+([A-Z])-?(\d{1,3})',
    # Sheet with dash: "A7 - Floor Plan"
    r'\b([A-Z]\d{1,2})\s*[-–]\s*[A-Za-z]',
    # Sheet name label: "SHEET NAME: A7"
    r'SHEET\s*NAME[:\s]+([A-Z]\d{1,2})',
    # Drawing title format: "A-007" or "A007"
    r'\b([A-Z])-?(\d{3})\b',
    # Simple alphanumeric: "A7", "A10", etc.
    r'\b([A-Z])(\d{1,2})\b',
    # Architectural sheet convention: "A5.1", "A7.2"
    r'\b([A-Z]\d{1,2}\.?\d?)\b',
]

SHEET_TITLE_PATTERNS = [
    # Title after dash: "A7 - Floor Plan Level 2"
    r'[A-Z]\d{1,2}\s*[-–]\s*(.+?)(?:\n|$)',
    # Title with label: "TITLE: Floor Plan"
    r'TITLE[:\s]+(.+?)(?:\n|$)',
    # Drawing title label
    r'DRAWING\s*TITLE[:\s]+(.+?)(?:\n|$)',
    # Sheet description
    r'DESCRIPTION[:\s]+(.+?)(?:\n|$)',
]

DISCIPLINE_MAP = {
    'A': 'Architectural',
    'S': 'Structural',
    'M': 'Mechanical',
    'E': 'Electrical',
    'P': 'Plumbing',
    'C': 'Civil',
    'L': 'Landscape',
    'G': 'General',
}


def parse_sheet_number(text: str) -> str | None:
    """Extract sheet number using regex patterns"""
    text_upper = text.upper()

    for pattern in SHEET_NAME_PATTERNS:
        matches = re.search(pattern, text_upper, re.IGNORECASE)
        if matches:
            groups = matches.groups()
            if len(groups) == 1:
                return groups[0].strip()
            elif len(groups) == 2:
                letter, number = groups
                return f"{letter}{int(number)}"
    return None


def parse_sheet_title(text: str) -> str | None:
    """Extract sheet title using regex patterns"""
    for pattern in SHEET_TITLE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            title = re.sub(r'\s+', ' ', title)
            return title[:100]
    return None


def infer_discipline(sheet_number: str) -> str | None:
    """Infer discipline from sheet number prefix"""
    if sheet_number and len(sheet_number) > 0:
        prefix = sheet_number[0].upper()
        return DISCIPLINE_MAP.get(prefix)
    return None


def get_title_block_regions(image: Image.Image) -> list:
    """
    Get multiple title block regions to try (ordered by priority)
    Construction plans typically have title blocks in various corners
    """
    width, height = image.size
    regions = []

    # Bottom-right (most common)
    tb_width = int(width * 0.25)
    tb_height = int(height * 0.15)
    regions.append(('bottom_right', image.crop((width - tb_width, height - tb_height, width, height))))

    # Bottom-right extended (larger region)
    tb_width_ext = int(width * 0.35)
    tb_height_ext = int(height * 0.20)
    regions.append(('bottom_right_extended', image.crop((width - tb_width_ext, height - tb_height_ext, width, height))))

    # Right edge vertical (for vertical title blocks like your sample PDF)
    right_width = int(width * 0.12)
    regions.append(('right_edge', image.crop((width - right_width, 0, width, height))))

    # Top-right
    tb_height_top = int(height * 0.15)
    regions.append(('top_right', image.crop((width - tb_width, 0, width, tb_height_top))))

    # Bottom-left (rare)
    regions.append(('bottom_left', image.crop((0, height - tb_height, tb_width, height))))

    return regions


def extract_with_tesseract(image: Image.Image, sheet_id: str) -> dict:
    """Fallback OCR extraction using Tesseract with multiple region attempts"""
    best_result = None
    best_confidence = 0.0

    for location, region in get_title_block_regions(image):
        text = pytesseract.image_to_string(region, config='--psm 6')

        if not text.strip():
            continue

        sheet_number = parse_sheet_number(text)
        sheet_title = parse_sheet_title(text)

        # Score based on what we found
        confidence = 0.0
        if sheet_number:
            confidence += 0.5
        if sheet_title:
            confidence += 0.3
        if len(text) > 50:
            confidence += 0.1

        print(f"[OCR] Region {location}: found sheet={sheet_number}, title={sheet_title}, conf={confidence}")

        if confidence > best_confidence:
            best_confidence = confidence
            discipline = infer_discipline(sheet_number) if sheet_number else None
            best_result = {
                "sheetNumber": sheet_number,
                "sheetTitle": sheet_title,
                "discipline": discipline,
                "titleBlockLocation": {"region": location, "confidence": confidence},
                "method": "tesseract",
                "rawText": text[:200]
            }

    if best_result:
        return best_result

    # No results found
    return {
        "sheetNumber": None,
        "sheetTitle": None,
        "discipline": None,
        "titleBlockLocation": {"region": "unknown", "confidence": 0.0},
        "method": "tesseract",
        "rawText": ""
    }

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})

@app.route('/generate-images', methods=['POST'])
def generate_images():
    """
    Get PDF page count and metadata (no PNG generation)
    Headers: X-Plan-Id
    Body: PDF binary data
    Returns: {"sheets": [{"sheetId": "sheet-0", "width": ..., "height": ...}], "totalPages": N}
    """
    try:
        plan_id = request.headers.get('X-Plan-Id')

        if not plan_id:
            return jsonify({"error": "Missing X-Plan-Id header"}), 400

        pdf_data = request.get_data()
        if not pdf_data:
            return jsonify({"error": "No PDF data provided"}), 400

        sheets = []

        # Load PDF with pyvips - handle multi-page PDFs
        try:
            first_page = pyvips.Image.new_from_buffer(pdf_data, '', dpi=300, page=0, access='sequential')
            n_pages = first_page.get('n-pages') if 'n-pages' in first_page.get_fields() else 1
        except:
            n_pages = 1

        # Get metadata for each page
        for page_num in range(n_pages):
            try:
                image = pyvips.Image.new_from_buffer(pdf_data, '', dpi=300, page=page_num, access='sequential')
                sheet_id = f"sheet-{page_num}"

                sheets.append({
                    "sheetId": sheet_id,
                    "width": image.width,
                    "height": image.height,
                    "dpi": 300,
                    "pageNumber": page_num
                })
            except Exception as page_error:
                print(f"Error processing page {page_num}: {page_error}")
                continue

        return jsonify({
            "sheets": sheets,
            "totalPages": len(sheets)
        })

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route('/render-page', methods=['POST'])
def render_page():
    """
    Render a single PDF page to PNG at 300 DPI
    Headers: X-Plan-Id, X-Page-Number
    Body: PDF binary data
    Returns: PNG binary data
    """
    try:
        plan_id = request.headers.get('X-Plan-Id')
        page_number = request.headers.get('X-Page-Number')

        if not plan_id:
            return jsonify({"error": "Missing X-Plan-Id header"}), 400
        if page_number is None:
            return jsonify({"error": "Missing X-Page-Number header"}), 400

        page_num = int(page_number)

        pdf_data = request.get_data()
        if not pdf_data:
            return jsonify({"error": "No PDF data provided"}), 400

        # Load specific page from PDF
        image = pyvips.Image.new_from_buffer(pdf_data, '', dpi=300, page=page_num, access='sequential')

        # Convert to PNG bytes
        png_data = image.pngsave_buffer(compression=6)

        return Response(
            png_data,
            mimetype='image/png',
            headers={
                'X-Width': str(image.width),
                'X-Height': str(image.height),
                'X-Page-Number': str(page_num)
            }
        )

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route('/extract-metadata', methods=['POST'])
def extract_metadata():
    """
    Extract metadata from title block using LLM (with Tesseract fallback)
    Headers: X-Sheet-Id, X-Plan-Id
    Body: PNG binary data
    Returns: {"sheetNumber": "A1", "sheetTitle": "FLOOR PLAN", "discipline": "Architectural", "isValid": true}
    """
    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        plan_id = request.headers.get('X-Plan-Id')

        if not sheet_id:
            return jsonify({"error": "Missing X-Sheet-Id header"}), 400

        image_data = request.get_data()
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Load image
        image = Image.open(io.BytesIO(image_data))
        width, height = image.size

        print(f"[Metadata] Processing sheet {sheet_id} ({width}x{height})")
        config = get_openrouter_config()
        api_key = config['api_key']
        model = config['model']
        print(f"[Metadata] API key configured: {bool(api_key)}, model: {model}")

        result = None

        # Try LLM-based extraction first
        if api_key:
            print(f"[Metadata] Attempting LLM extraction with {model}...")

            # Encode image to base64
            image_b64 = base64.b64encode(image_data).decode('utf-8')

            # Build prompt and call LLM
            prompt = build_title_block_prompt(width, height)
            llm_result = call_openrouter_vision(prompt, image_b64)

            if llm_result and llm_result.get('sheetNumber'):
                result = {
                    "sheetNumber": llm_result.get('sheetNumber'),
                    "sheetTitle": llm_result.get('sheetTitle'),
                    "discipline": llm_result.get('discipline') or infer_discipline(llm_result.get('sheetNumber')),
                    "titleBlockLocation": llm_result.get('titleBlockLocation', {}),
                    "method": "llm",
                    "isValid": True
                }
                print(f"[Metadata] LLM found: sheet={result['sheetNumber']}, title={result['sheetTitle']}")
            else:
                print(f"[Metadata] LLM extraction failed, falling back to OCR")

        # Fall back to Tesseract OCR
        if not result:
            print(f"[Metadata] Using Tesseract OCR fallback...")
            result = extract_with_tesseract(image, sheet_id)
            result['isValid'] = result.get('sheetNumber') is not None

        # Validate sheet number format (must match pattern like A1, A2, S-101, etc.)
        sheet_number = result.get('sheetNumber')
        if sheet_number:
            # Normalize and validate
            sheet_number = sheet_number.strip().upper()
            is_valid = bool(re.match(r'^[A-Z]-?\d+\.?\d*$', sheet_number))
            result['isValid'] = is_valid
            result['sheetNumber'] = sheet_number
            print(f"[Metadata] Sheet {sheet_id}: number={sheet_number}, valid={is_valid}")
        else:
            result['isValid'] = False
            print(f"[Metadata] Sheet {sheet_id}: No sheet number found")

        return jsonify(result)

    except Exception as e:
        print(f"[Metadata] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

# =============================================================================
# CV+LLM Hybrid Callout Detection (ported from backend-dev)
# =============================================================================

# Configuration constants
DEDUP_DISTANCE_PX = 200  # Distance threshold for deduplicating nearby callouts
CROP_PADDING_PX = 70     # Padding around shapes when cropping
CONFIDENCE_THRESHOLD = 0.90  # Minimum confidence for accepting callouts
CALLOUT_REF_PATTERN = r'^[A-Z0-9.-]+/[A-Z0-9.-]+$'  # Valid callout format


def preprocess_for_shape_detection(image: np.ndarray) -> tuple:
    """Preprocess image for shape detection with adaptive thresholding."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 7)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)
    return gray, thresh, cleaned


def detect_shapes_cv(image: np.ndarray, dpi: int = 300) -> list:
    """
    Multi-technique shape detection for callout candidates.
    Combines Hough circles, contour analysis, and blob detection.
    """
    h, w = image.shape[:2]
    gray, thresh, cleaned = preprocess_for_shape_detection(image)
    scale = dpi / 300.0
    found = []

    # 1. Hough Circle Detection
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    min_radius = int(12 * scale)
    max_radius = int(50 * scale)
    min_dist = int(40 * scale)

    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, 1, min_dist,
        param1=50, param2=30,
        minRadius=min_radius, maxRadius=max_radius
    )

    if circles is not None:
        for cx, cy, r in circles[0, :]:
            found.append({
                "type": "circle",
                "method": "hough",
                "centerX": int(cx),
                "centerY": int(cy),
                "bbox": {"x1": int(cx - r), "y1": int(cy - r), "x2": int(cx + r), "y2": int(cy + r)},
                "confidence": 0.85
            })

    # 2. Contour Detection (triangles, section flags)
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = int(600 * scale ** 2)
    max_area = int(8500 * scale ** 2)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not (min_area < area < max_area):
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)
        perimeter = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0

        shape_type = None
        if circularity > 0.65:
            shape_type = "circle"
        elif len(approx) == 3:
            shape_type = "triangle"
        elif circularity < 0.6 and len(approx) > 4:
            aspect_ratio = bw / bh if bh > 0 else 0
            if 0.6 < aspect_ratio < 1.6:
                shape_type = "section_flag"

        if shape_type:
            found.append({
                "type": shape_type,
                "method": "contour",
                "centerX": x + bw // 2,
                "centerY": y + bh // 2,
                "bbox": {"x1": x, "y1": y, "x2": x + bw, "y2": y + bh},
                "confidence": 0.75
            })

    # 3. Deduplicate shapes that are too close together
    type_priority = {"section_flag": 0, "triangle": 1, "circle": 2}
    found.sort(key=lambda x: type_priority.get(x['type'], 99))

    final = []
    dedup_radius = 35
    for shape in found:
        is_dup = any(
            np.hypot(shape['centerX'] - f['centerX'], shape['centerY'] - f['centerY']) < dedup_radius
            for f in final
        )
        if not is_dup:
            # Add padding to bbox
            pad = 5
            shape['bbox']['x1'] = max(0, shape['bbox']['x1'] - pad)
            shape['bbox']['y1'] = max(0, shape['bbox']['y1'] - pad)
            shape['bbox']['x2'] = min(w, shape['bbox']['x2'] + pad)
            shape['bbox']['y2'] = min(h, shape['bbox']['y2'] + pad)
            final.append(shape)

    return final


def crop_shape(image: np.ndarray, bbox: dict, padding: int = CROP_PADDING_PX) -> np.ndarray:
    """Crop a shape from the image with padding."""
    h, w = image.shape[:2]
    x1 = max(0, bbox['x1'] - padding)
    y1 = max(0, bbox['y1'] - padding)
    x2 = min(w, bbox['x2'] + padding)
    y2 = min(h, bbox['y2'] + padding)
    return image[y1:y2, x1:x2]


def build_batch_validation_prompt(image_count: int, valid_sheets: list) -> str:
    """Build prompt for batch validation of cropped shapes."""
    sheet_list = ', '.join(valid_sheets) if valid_sheets else 'Any valid sheet number'

    return f"""You are analyzing {image_count} cropped images from construction plan sheets.

**TASK**: For EACH image (numbered 0 to {image_count - 1}), determine if it contains a callout symbol.

**What ARE callouts:**
1. **Section Flags**: Circle with triangle/arrow attached, containing text like "1/A6", "2/A6"
2. **Detail Markers**: Circle with horizontal line divider, detail number on top, sheet on bottom (e.g., "2/A5")
3. **Triangular Markers**: Standalone triangles with number/letter (e.g., "1/A5")
4. **Borderless Text**: Plain "XX/XX" text acting as callout

**What are NOT callouts:**
- Scale Indicators (e.g., "1/4\\" = 1'-0\\"")
- Dimensions (e.g., "12'-6\\"")
- North Arrows
- Grid bubbles (just "A" or "1" in circle)
- Room names

**Valid target sheets:** {sheet_list}

**CRITICAL INSTRUCTIONS:**
1. Analyze EACH image in order (Image 0, Image 1, ...)
2. Return a result for EVERY image
3. For detectedRef, use format "detail/sheet" (e.g., "1/A6")

**Response format (JSON only, no markdown):**
{{
  "results": [
    {{
      "index": 0,
      "isCallout": true,
      "detectedRef": "1/A6",
      "targetSheet": "A6",
      "confidence": 0.95
    }}
  ]
}}

Analyze all {image_count} images now:"""


def is_valid_callout_ref(ref: str) -> bool:
    """Check if reference matches expected callout format."""
    import re
    if not ref:
        return False
    clean_ref = ref.upper().strip()
    if not re.match(CALLOUT_REF_PATTERN, clean_ref, re.IGNORECASE):
        return False
    # Reject scale fractions
    if re.match(r'^[1-9]/[248]$', clean_ref):
        return False
    return True


def validate_shapes_with_llm(shapes: list, image: np.ndarray, valid_sheets: list, sheet_id: str) -> list:
    """
    Batch validate detected shapes with LLM.
    Crops each shape, sends all crops to LLM for validation.
    Returns list of validated callouts with coordinates.
    """
    config = get_openrouter_config()
    if not config['api_key'] or len(shapes) == 0:
        return []

    h, w = image.shape[:2]
    crops_b64 = []
    shape_map = {}

    # Crop each shape and encode as base64
    for i, shape in enumerate(shapes):
        crop = crop_shape(image, shape['bbox'])
        if crop.size == 0:
            continue

        # Encode crop as PNG base64
        success, buffer = cv2.imencode('.png', crop)
        if success:
            crop_b64 = base64.b64encode(buffer).decode('utf-8')
            crops_b64.append(crop_b64)
            shape_map[len(crops_b64) - 1] = shape

    if len(crops_b64) == 0:
        return []

    print(f"[Callouts] Validating {len(crops_b64)} shape candidates with LLM...")

    # Build prompt
    prompt = build_batch_validation_prompt(len(crops_b64), valid_sheets)

    # Call LLM with multiple images
    result = call_openrouter_vision_batch(prompt, crops_b64)

    if not result or 'results' not in result:
        print(f"[Callouts] LLM batch validation failed")
        return []

    # Process results
    import uuid
    validated = []
    normalized_sheets = [s.upper() for s in valid_sheets] if valid_sheets else []

    for item in result.get('results', []):
        idx = item.get('index')
        if idx is None or idx not in shape_map:
            continue

        is_callout = item.get('isCallout', False)
        confidence = item.get('confidence', 0)
        detected_ref = item.get('detectedRef', '')
        target_sheet = item.get('targetSheet', '')

        # Apply filters
        if not is_callout:
            continue
        if confidence < CONFIDENCE_THRESHOLD:
            continue
        if detected_ref and not is_valid_callout_ref(detected_ref):
            continue
        if normalized_sheets and target_sheet.upper() not in normalized_sheets:
            continue

        shape = shape_map[idx]
        validated.append({
            "id": f"marker-{sheet_id}-{len(validated)}-{uuid.uuid4().hex[:8]}",
            "label": detected_ref,
            "targetSheetRef": target_sheet.upper() if target_sheet else None,
            "x": float(shape['centerX']) / w,  # Normalized 0-1
            "y": float(shape['centerY']) / h,  # Normalized 0-1
            "confidence": confidence,
            "needsReview": False
        })
        print(f"   ✅ {detected_ref} @ ({shape['centerX']}, {shape['centerY']}) conf={confidence*100:.0f}%")

    return validated


def deduplicate_callouts(callouts: list, distance_threshold: int = DEDUP_DISTANCE_PX) -> list:
    """Remove duplicate callouts that are too close together with same reference."""
    if len(callouts) <= 1:
        return callouts

    result = []
    used = set()

    # Group by reference
    by_ref = {}
    for i, c in enumerate(callouts):
        ref = (c.get('targetSheetRef') or '').upper()
        if ref not in by_ref:
            by_ref[ref] = []
        by_ref[ref].append((i, c))

    for ref, items in by_ref.items():
        groups = []
        for idx, callout in items:
            if idx in used:
                continue

            group = [callout]
            used.add(idx)

            for other_idx, other in items:
                if other_idx in used:
                    continue
                # Calculate pixel distance (need to denormalize first)
                # Since coords are 0-1, we compare directly
                dist = np.hypot(callout['x'] - other['x'], callout['y'] - other['y'])
                # Use normalized threshold (200px / ~3000px image ≈ 0.067)
                if dist < 0.067:
                    group.append(other)
                    used.add(other_idx)

            groups.append(group)

        for group in groups:
            best = max(group, key=lambda c: c.get('confidence', 0))
            result.append(best)

    return sorted(result, key=lambda c: (c['y'], c['x']))


def call_openrouter_vision_batch(prompt: str, images_base64: list, mime_type: str = "image/png") -> dict:
    """Call OpenRouter API with multiple images for batch validation."""
    config = get_openrouter_config()
    api_key = config['api_key']
    model = config['model']

    if not api_key:
        return None

    print(f"[LLM] Batch validation with {len(images_base64)} images using {model}")

    try:
        # Build content array with text prompt and all images
        content = [{"type": "text", "text": prompt}]
        for img_b64 in images_base64:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{img_b64}"}
            })

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sitelink.dev",
                "X-Title": "Sitelink PDF Processor"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": content}],
                "temperature": 0
            },
            timeout=120  # Longer timeout for batch
        )

        if response.status_code != 200:
            print(f"[LLM] Batch validation error {response.status_code}: {response.text}")
            return None

        data = response.json()
        raw_content = data.get('choices', [{}])[0].get('message', {}).get('content', '')

        # Parse JSON response
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json\n", "").replace("```", "").strip()

        return json.loads(cleaned)

    except Exception as e:
        print(f"[LLM] Batch validation exception: {e}")
        traceback.print_exc()
        return None


def detect_callouts_cvllm(image_data: bytes, valid_sheets: list, sheet_id: str) -> dict | None:
    """
    CV+LLM hybrid callout detection.
    1. OpenCV multi-technique shape detection
    2. Crop each detected shape
    3. Batch validate with LLM
    4. Deduplicate and filter
    """
    config = get_openrouter_config()
    if not config['api_key']:
        print(f"[Callouts] No API key for CV+LLM detection")
        return None

    # Decode image
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        print(f"[Callouts] Failed to decode image")
        return None

    h, w = img.shape[:2]
    print(f"[Callouts] CV+LLM detection for {sheet_id} ({w}x{h})")

    # Step 1: Detect shape candidates with OpenCV
    print(f"[Callouts] Step 1: OpenCV shape detection...")
    shapes = detect_shapes_cv(img, dpi=300)
    print(f"[Callouts]   Found {len(shapes)} shape candidates")

    if len(shapes) == 0:
        return {"markers": [], "unmatchedCount": 0}

    # Step 2: Batch validate with LLM
    print(f"[Callouts] Step 2: LLM batch validation...")
    validated = validate_shapes_with_llm(shapes, img, valid_sheets, sheet_id)
    print(f"[Callouts]   LLM validated {len(validated)} callouts")

    # Step 3: Deduplicate
    print(f"[Callouts] Step 3: Deduplication...")
    deduped = deduplicate_callouts(validated)
    print(f"[Callouts]   After dedup: {len(deduped)} callouts")

    return {
        "markers": deduped,
        "unmatchedCount": 0  # All validated markers are matched
    }


@app.route('/detect-callouts', methods=['POST'])
def detect_callouts():
    """
    Detect callout markers using LLM (with CV shape detection fallback)
    Headers: X-Sheet-Id, X-Plan-Id, X-Sheet-Number, X-Valid-Sheet-Numbers
    Body: PNG binary data
    Returns: {"markers": [...], "unmatchedCount": N}
    """
    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        plan_id = request.headers.get('X-Plan-Id')
        sheet_number = request.headers.get('X-Sheet-Number', '')
        valid_sheets_json = request.headers.get('X-Valid-Sheet-Numbers', '[]')

        if not sheet_id:
            return jsonify({"error": "Missing X-Sheet-Id header"}), 400

        image_data = request.get_data()
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        # Parse valid sheet numbers
        try:
            valid_sheets = json.loads(valid_sheets_json)
        except:
            valid_sheets = []

        print(f"[Callouts] Processing sheet {sheet_id} (number: {sheet_number})")
        print(f"[Callouts] Valid sheet numbers: {valid_sheets}")
        config = get_openrouter_config()
        api_key = config['api_key']
        print(f"[Callouts] API key configured: {bool(api_key)}")

        # Use CV+LLM hybrid detection (shape detection + batch validation)
        if api_key:
            result = detect_callouts_cvllm(image_data, valid_sheets, sheet_id)
            if result is not None:
                print(f"[Callouts] CV+LLM returned {len(result.get('markers', []))} markers")
                return jsonify(result)

        # Fallback: no API key or CV+LLM failed
        print(f"[Callouts] No detection available for {sheet_id} (no API key)")
        markers = []

        return jsonify({
            "markers": markers,
            "unmatchedCount": len(markers)  # All need review since no LLM
        })

    except Exception as e:
        print(f"[Callouts] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

def flip_y(zoom, y):
    """Flip y coordinate for TMS scheme"""
    return (2**zoom - 1) - y


def create_mbtiles_from_tiles(tiles_dir, mbtiles_path, image_format='webp'):
    """
    Create MBTiles SQLite database from a directory of tiles.
    Similar to mbutil_zyx disk_to_mbtiles with --scheme=zyx
    """
    import sqlite3

    conn = sqlite3.connect(mbtiles_path)
    cur = conn.cursor()

    # Set up MBTiles schema
    cur.execute("""PRAGMA synchronous=0""")
    cur.execute("""PRAGMA locking_mode=EXCLUSIVE""")
    cur.execute("""PRAGMA journal_mode=DELETE""")

    cur.execute("""
        CREATE TABLE tiles (
            zoom_level integer,
            tile_column integer,
            tile_row integer,
            tile_data blob
        )
    """)
    cur.execute("""CREATE TABLE metadata (name text, value text)""")
    cur.execute("""CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)""")

    # Add metadata
    cur.execute("INSERT INTO metadata (name, value) VALUES (?, ?)", ('format', image_format))

    tile_count = 0
    # For Google layout, dzsave creates tiles directly in the directory (no _files suffix)
    # But some versions add _files suffix for DZI layout
    tiles_root = tiles_dir
    if not os.path.exists(tiles_root) or not any(d.isdigit() for d in os.listdir(tiles_root) if os.path.isdir(os.path.join(tiles_root, d))):
        tiles_root = tiles_dir + '_files'  # Fallback to _files suffix

    print(f"[MBTiles] Looking for tiles in: {tiles_root}")

    if os.path.exists(tiles_root):
        for z_dir in sorted(os.listdir(tiles_root)):
            z_path = os.path.join(tiles_root, z_dir)
            if not os.path.isdir(z_path) or not z_dir.isdigit():
                continue

            z = int(z_dir)

            # Google layout from dzsave is z/y/x
            for y_dir in sorted(os.listdir(z_path)):
                y_path = os.path.join(z_path, y_dir)
                if not os.path.isdir(y_path) or not y_dir.isdigit():
                    continue

                y = int(y_dir)
                # Flip y for TMS (MBTiles uses TMS y-coordinate)
                tms_y = flip_y(z, y)

                for x_file in sorted(os.listdir(y_path)):
                    if not x_file.endswith(f'.{image_format}'):
                        continue

                    x = int(x_file.replace(f'.{image_format}', ''))
                    tile_path = os.path.join(y_path, x_file)

                    with open(tile_path, 'rb') as f:
                        tile_data = f.read()

                    cur.execute(
                        "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
                        (z, x, tms_y, sqlite3.Binary(tile_data))
                    )
                    tile_count += 1

    conn.commit()
    cur.execute("ANALYZE")
    conn.close()

    return tile_count


@app.route('/generate-tiles', methods=['POST'])
def generate_tiles():
    """
    Generate PMTiles from PNG image.
    Pipeline: pyvips dzsave → MBTiles → pmtiles convert
    Headers: X-Sheet-Id, X-Plan-Id
    Body: PNG binary data
    Returns: PMTiles binary data
    """
    import tempfile
    import shutil
    import subprocess
    import math

    try:
        sheet_id = request.headers.get('X-Sheet-Id')
        plan_id = request.headers.get('X-Plan-Id')

        if not sheet_id or not plan_id:
            return jsonify({"error": "Missing X-Sheet-Id or X-Plan-Id header"}), 400

        image_data = request.get_data()
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400

        print(f"[Tiles] Generating PMTiles for sheet {sheet_id} ({len(image_data)} bytes)")

        # Load image with pyvips
        image = pyvips.Image.new_from_buffer(image_data, '')
        width, height = image.width, image.height
        print(f"[Tiles] Image dimensions: {width}x{height}")

        # Create temp directory for tile generation
        temp_dir = tempfile.mkdtemp(prefix='tiles_')
        tiles_dir = os.path.join(temp_dir, 'tiles')
        mbtiles_path = os.path.join(temp_dir, 'tiles.mbtiles')
        pmtiles_path = os.path.join(temp_dir, 'tiles.pmtiles')

        try:
            # Step 1: Use pyvips dzsave to generate tile pyramid (Google layout: z/y/x)
            print(f"[Tiles] Step 1: Generating tile pyramid with pyvips dzsave...")

            # Ensure image is RGB (3 bands) for consistent processing
            if image.bands == 1:
                image = image.colourspace('srgb')
            elif image.bands == 4:
                # Flatten alpha channel with white background
                image = image.flatten(background=[255, 255, 255])

            image.dzsave(
                tiles_dir,
                layout='google',
                suffix='.webp[Q=80]',
                tile_size=256,
                overlap=0,
                depth='onetile',
            )

            # Debug: List what dzsave created
            print(f"[Tiles] Checking output directory structure...")
            for item in os.listdir(temp_dir):
                item_path = os.path.join(temp_dir, item)
                if os.path.isdir(item_path):
                    print(f"[Tiles]   DIR: {item}/")
                    for subitem in os.listdir(item_path)[:5]:  # First 5 items
                        print(f"[Tiles]     - {subitem}")
                else:
                    print(f"[Tiles]   FILE: {item}")

            # Calculate zoom levels
            max_dim = max(width, height)
            max_zoom = max(0, math.ceil(math.log2(max_dim / 256)))
            min_zoom = 0
            print(f"[Tiles] Zoom levels: {min_zoom} to {max_zoom}")

            # Step 2: Create MBTiles from tiles
            print(f"[Tiles] Step 2: Creating MBTiles database...")
            tile_count = create_mbtiles_from_tiles(tiles_dir, mbtiles_path, 'webp')
            print(f"[Tiles] Packed {tile_count} tiles into MBTiles")

            # Step 3: Convert MBTiles to PMTiles using pmtiles CLI
            print(f"[Tiles] Step 3: Converting to PMTiles...")
            print(f"[Tiles] MBTiles path: {mbtiles_path}")
            print(f"[Tiles] PMTiles path: {pmtiles_path}")

            # Verify MBTiles was created
            if not os.path.exists(mbtiles_path):
                raise Exception(f"MBTiles file not created at {mbtiles_path}")

            mbtiles_size = os.path.getsize(mbtiles_path)
            print(f"[Tiles] MBTiles size: {mbtiles_size} bytes")

            result = subprocess.run(
                ['pmtiles', 'convert', mbtiles_path, pmtiles_path],
                capture_output=True,
                text=True,
                timeout=120
            )

            print(f"[Tiles] pmtiles convert returncode: {result.returncode}")
            print(f"[Tiles] pmtiles convert stdout: {result.stdout}")
            print(f"[Tiles] pmtiles convert stderr: {result.stderr}")

            if result.returncode != 0:
                raise Exception(f"pmtiles convert failed (code {result.returncode}): stdout={result.stdout}, stderr={result.stderr}")

            print(f"[Tiles] pmtiles convert output: {result.stdout}")

            # Read the PMTiles file
            with open(pmtiles_path, 'rb') as f:
                pmtiles_data = f.read()

            print(f"[Tiles] Generated PMTiles: {len(pmtiles_data)} bytes")

            return Response(
                pmtiles_data,
                mimetype='application/x-pmtiles',
                headers={
                    'X-Min-Zoom': str(min_zoom),
                    'X-Max-Zoom': str(max_zoom),
                    'X-Width': str(width),
                    'X-Height': str(height),
                    'X-Tile-Count': str(tile_count),
                }
            )

        finally:
            # Clean up temp directory
            shutil.rmtree(temp_dir, ignore_errors=True)

    except Exception as e:
        print(f"[Tiles] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=False)
