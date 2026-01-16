#!/usr/bin/env python3
"""
Local Callout Processor CLI - Generate, Merge, Validate architecture.

Usage:
    python3 detect.py --pdf <path> --output <dir> [--llm] [--model <model>] [--valid-sheets A1,A2,A3]
    python3 detect.py --pdf <path> --output <dir> --llm --no-ocr  # Skip OCR detection

Outputs:
    - sheet-N/source.png - rendered image at 300 DPI
    - sheet-N/annotated.png - debug image with detected callouts
    - sheet-N/markers.json - detected callout markers
    - sheet-N/metadata.json - sheet dimensions and processing info

Environment:
    Create a .env file in packages/callout-processor/ with:
        OPENROUTER_API_KEY=your-api-key
        OPENROUTER_MODEL=google/gemini-2.5-flash  # optional, can override with --model
"""

import argparse
import json
import os
import re
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
import pyvips
from dotenv import load_dotenv

# Load .env from package directory or current directory
_script_dir = Path(__file__).parent.parent
load_dotenv(_script_dir / ".env")  # packages/callout-processor/.env
load_dotenv()  # Also check current working directory

# PaddleOCR is imported lazily in detect_callouts_ocr() to avoid slow startup
PADDLEOCR_AVAILABLE = None  # Will be set on first use
_paddleocr_instance = None


def find_project_root() -> Path:
    """Find the sitelink project root by looking for package.json with 'sitelink' name."""
    current = Path(__file__).resolve().parent
    for _ in range(10):
        pkg_json = current / "package.json"
        if pkg_json.exists():
            try:
                with open(pkg_json) as f:
                    data = json.load(f)
                    if data.get("name") == "sitelink":
                        return current
            except:
                pass
        if current.parent == current:
            break
        current = current.parent
    return Path.cwd()


def resolve_path(path: str) -> Path:
    """Resolve a path, checking both relative to cwd and project root."""
    p = Path(path)
    if p.is_absolute() and p.exists():
        return p
    if p.exists():
        return p.resolve()
    project_root = find_project_root()
    root_relative = project_root / path
    if root_relative.exists():
        return root_relative.resolve()
    return p


# Configuration - Generate, Merge, Validate architecture
CONFIG = {
    # Rendering
    "dpi": 300,

    # CV Detection - Multi-pass with different parameters
    "cv_passes": [
        # Pass 1: Standard circles
        {"dp": 1.0, "param1": 50, "param2": 30, "minRadius": 12, "maxRadius": 50},
        # Pass 2: Faint circles (lower edge threshold)
        {"dp": 1.0, "param1": 30, "param2": 20, "minRadius": 12, "maxRadius": 50},
        # Pass 3: Large circles (section callouts)
        {"dp": 1.0, "param1": 50, "param2": 30, "minRadius": 40, "maxRadius": 120},
        # Pass 4: Small circles (detail callouts at scale)
        {"dp": 1.0, "param1": 50, "param2": 25, "minRadius": 8, "maxRadius": 20},
    ],

    # OCR Detection
    "ocr_enabled": True,
    "ocr_callout_pattern": r"^(\d{1,2})\s*/\s*([A-Z]\d{1,2})$",

    # Candidate Merging
    "iou_threshold": 0.3,
    "dedup_distance_px": 200,
    "cv_dedup_radius": 35,

    # LLM Validation
    "context_multiplier": 1.5,  # 1.5x radius for contextual crops
    "confidence_threshold": 0.80,  # Lowered from 0.90 for better recall
    "batch_size": 20,
}

DPI = CONFIG["dpi"]
DEDUP_DISTANCE_PX = CONFIG["dedup_distance_px"]
CONFIDENCE_THRESHOLD = CONFIG["confidence_threshold"]
CALLOUT_REF_PATTERN = r'^[A-Z0-9.-]+/[A-Z0-9.-]+$'


@dataclass
class Candidate:
    """Represents a detected callout candidate from any source."""
    source: str  # "cv_hough", "cv_contour", "ocr"
    x: float  # Center X in pixels
    y: float  # Center Y in pixels
    radius: float  # Approximate radius in pixels
    confidence: float  # Detection confidence 0-1
    text: Optional[str] = None  # Detected text (for OCR)
    shape_type: Optional[str] = None  # "circle", "triangle", "section_flag"
    bbox: dict = field(default_factory=dict)  # Bounding box

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "centerX": int(self.x),
            "centerY": int(self.y),
            "radius": int(self.radius),
            "confidence": self.confidence,
            "text": self.text,
            "type": self.shape_type,
            "bbox": self.bbox
        }


def preprocess_for_shape_detection(image: np.ndarray) -> tuple:
    """Preprocess image for shape detection with adaptive thresholding."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 7)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)
    return gray, thresh, cleaned


def detect_shapes_cv(image: np.ndarray, dpi: int = 300) -> List[Candidate]:
    """
    Multi-pass CV detection using Hough circles and contour analysis.
    Returns Candidate objects for merging with OCR results.
    """
    h, w = image.shape[:2]
    gray, thresh, cleaned = preprocess_for_shape_detection(image)
    scale = dpi / 300.0
    candidates = []

    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    min_dist = int(40 * scale)

    # Multi-pass Hough Circle Detection
    for pass_idx, params in enumerate(CONFIG["cv_passes"]):
        min_radius = int(params["minRadius"] * scale)
        max_radius = int(params["maxRadius"] * scale)

        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT,
            dp=params["dp"],
            minDist=min_dist,
            param1=params["param1"],
            param2=params["param2"],
            minRadius=min_radius,
            maxRadius=max_radius
        )

        if circles is not None:
            for cx, cy, r in circles[0, :]:
                candidates.append(Candidate(
                    source=f"cv_hough_pass{pass_idx}",
                    x=float(cx),
                    y=float(cy),
                    radius=float(r),
                    confidence=0.85 if pass_idx == 0 else 0.75,
                    shape_type="circle",
                    bbox={
                        "x1": int(cx - r),
                        "y1": int(cy - r),
                        "x2": int(cx + r),
                        "y2": int(cy + r)
                    }
                ))

    # Contour Detection (triangles, section flags)
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
            radius = max(bw, bh) / 2
            candidates.append(Candidate(
                source="cv_contour",
                x=float(x + bw // 2),
                y=float(y + bh // 2),
                radius=float(radius),
                confidence=0.75,
                shape_type=shape_type,
                bbox={"x1": x, "y1": y, "x2": x + bw, "y2": y + bh}
            ))

    # Deduplicate CV candidates
    type_priority = {"section_flag": 0, "triangle": 1, "circle": 2}
    candidates.sort(key=lambda c: type_priority.get(c.shape_type or "circle", 99))

    deduped = []
    dedup_radius = CONFIG["cv_dedup_radius"]
    for cand in candidates:
        is_dup = any(
            np.hypot(cand.x - d.x, cand.y - d.y) < dedup_radius
            for d in deduped
        )
        if not is_dup:
            # Add padding to bbox
            pad = 5
            cand.bbox['x1'] = max(0, cand.bbox['x1'] - pad)
            cand.bbox['y1'] = max(0, cand.bbox['y1'] - pad)
            cand.bbox['x2'] = min(w, cand.bbox['x2'] + pad)
            cand.bbox['y2'] = min(h, cand.bbox['y2'] + pad)
            deduped.append(cand)

    return deduped


def detect_callouts_ocr(image: np.ndarray) -> List[Candidate]:
    """
    Detect callout-like text patterns using PaddleOCR.
    Finds borderless callouts like "1/A2", "3/B1".
    """
    global PADDLEOCR_AVAILABLE, _paddleocr_instance

    # Lazy import PaddleOCR to avoid slow startup connectivity checks
    if PADDLEOCR_AVAILABLE is None:
        try:
            from paddleocr import PaddleOCR
            PADDLEOCR_AVAILABLE = True
            print("[OCR] Initializing PaddleOCR (first use)...")
            _paddleocr_instance = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        except ImportError:
            PADDLEOCR_AVAILABLE = False
            print("[OCR] PaddleOCR not installed. Install with: pip install paddlepaddle paddleocr")

    if not PADDLEOCR_AVAILABLE:
        return []

    candidates = []
    callout_pattern = re.compile(CONFIG["ocr_callout_pattern"], re.IGNORECASE)

    try:
        results = _paddleocr_instance.ocr(image, cls=True)

        if not results or not results[0]:
            return []

        for line in results[0]:
            bbox_points, (text, confidence) = line
            text = text.strip()

            if callout_pattern.match(text):
                x_center = (bbox_points[0][0] + bbox_points[2][0]) / 2
                y_center = (bbox_points[0][1] + bbox_points[2][1]) / 2
                width = bbox_points[2][0] - bbox_points[0][0]
                height = bbox_points[2][1] - bbox_points[0][1]
                radius = max(width, height) / 2 * 1.5  # Expand for context

                candidates.append(Candidate(
                    source="ocr",
                    x=x_center,
                    y=y_center,
                    radius=radius,
                    confidence=confidence,
                    text=text,
                    shape_type="borderless",
                    bbox={
                        "x1": int(bbox_points[0][0]),
                        "y1": int(bbox_points[0][1]),
                        "x2": int(bbox_points[2][0]),
                        "y2": int(bbox_points[2][1])
                    }
                ))

    except Exception as e:
        print(f"[OCR] Error during detection: {e}")

    return candidates


def calculate_iou(c1: Candidate, c2: Candidate) -> float:
    """Calculate IoU (Intersection over Union) between two candidates."""
    b1, b2 = c1.bbox, c2.bbox
    if not b1 or not b2:
        # Fall back to distance-based overlap
        dist = np.hypot(c1.x - c2.x, c1.y - c2.y)
        max_radius = max(c1.radius, c2.radius)
        return max(0, 1 - dist / (2 * max_radius))

    x1 = max(b1['x1'], b2['x1'])
    y1 = max(b1['y1'], b2['y1'])
    x2 = min(b1['x2'], b2['x2'])
    y2 = min(b1['y2'], b2['y2'])

    if x2 <= x1 or y2 <= y1:
        return 0.0

    intersection = (x2 - x1) * (y2 - y1)
    area1 = (b1['x2'] - b1['x1']) * (b1['y2'] - b1['y1'])
    area2 = (b2['x2'] - b2['x1']) * (b2['y2'] - b2['y1'])
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0.0


def merge_candidates(cv_candidates: List[Candidate],
                     ocr_candidates: List[Candidate]) -> List[Candidate]:
    """
    Merge candidates from CV and OCR using IoU-based matching.
    Boosts confidence for candidates detected by both sources.
    """
    all_candidates = cv_candidates + ocr_candidates
    if not all_candidates:
        return []

    merged = []
    used = set()
    iou_threshold = CONFIG["iou_threshold"]

    for i, c1 in enumerate(all_candidates):
        if i in used:
            continue

        group = [c1]
        used.add(i)

        for j, c2 in enumerate(all_candidates[i+1:], i+1):
            if j in used:
                continue
            if calculate_iou(c1, c2) >= iou_threshold:
                group.append(c2)
                used.add(j)

        # Merge group into single candidate
        best = max(group, key=lambda c: c.confidence)
        sources = set(c.source.split('_')[0] for c in group)

        # Boost confidence if detected by multiple sources (CV + OCR)
        if "cv" in sources and "ocr" in sources:
            best.confidence = min(1.0, best.confidence * 1.2)
            best.source = "cv+ocr"

        # Prefer OCR text if available
        ocr_texts = [c.text for c in group if c.text]
        if ocr_texts:
            best.text = ocr_texts[0]

        merged.append(best)

    return merged


def get_contextual_crop(image: np.ndarray, candidate: Candidate) -> np.ndarray:
    """
    Extract crop with contextual padding based on candidate size (1.5x radius).
    This provides better context for LLM validation than fixed 70px padding.
    """
    h, w = image.shape[:2]
    context_multiplier = CONFIG["context_multiplier"]
    padding = int(candidate.radius * context_multiplier)
    padding = max(padding, 50)  # Minimum 50px context

    x1 = max(0, int(candidate.x - padding))
    y1 = max(0, int(candidate.y - padding))
    x2 = min(w, int(candidate.x + padding))
    y2 = min(h, int(candidate.y + padding))

    return image[y1:y2, x1:x2]


def crop_shape(image: np.ndarray, bbox: dict, padding: int = 70) -> np.ndarray:
    """Legacy crop function for backwards compatibility."""
    h, w = image.shape[:2]
    x1 = max(0, bbox['x1'] - padding)
    y1 = max(0, bbox['y1'] - padding)
    x2 = min(w, bbox['x2'] + padding)
    y2 = min(h, bbox['y2'] + padding)
    return image[y1:y2, x1:x2]


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


def build_batch_validation_prompt(image_count: int, valid_sheets: list) -> str:
    """Build prompt for batch validation of cropped candidates (per PSPC National CADD Standard)."""
    sheet_list = ', '.join(valid_sheets) if valid_sheets else 'Any valid sheet number'

    return f"""Analyze these {image_count} construction plan image crops for callout symbols.

**CALLOUT TYPES** (per PSPC National CADD Standard):

1. **Detail Callout**: Circle with number on top, sheet reference below (e.g., "1/A2", "3/B1")
   - May have horizontal divider line inside circle
   - Number identifies the detail, sheet identifies where it's drawn

2. **Elevation Callout**: Circle with triangle pointer indicating viewing direction
   - Triangle points toward the elevation view
   - Contains elevation number and sheet reference

3. **Section Callout**: Circle with triangle pointer and section letter (e.g., "A-A")
   - Triangle indicates cut direction
   - Section letters appear at both ends of the cut line

4. **Borderless Callout**: Just text in "number/sheet" format without circle
   - Plain text like "1/A2" acting as callout reference

**What are NOT callouts:**
- Scale Indicators (e.g., "1/4\\" = 1'-0\\"", "SCALE: 1/8\\" = 1'-0\\"")
- Dimensions (e.g., "12'-6\\"", "24'-0\\"")
- North Arrows or compass symbols
- Grid bubbles (just "A" or "1" in circle without sheet reference)
- Room names or labels
- Drawing titles

**Valid target sheets:** {sheet_list}

**For EACH crop (0 to {image_count - 1}), provide:**
- index: The image number
- isCallout: true/false
- calloutType: "detail" | "elevation" | "section" | "borderless" | null
- calloutNumber: The number/letter identifier (e.g., "1", "A")
- detectedRef: Full reference in "number/sheet" format (e.g., "1/A6")
- targetSheet: The target sheet reference (e.g., "A6", "B1")
- confidence: 0.0-1.0

**Response format (JSON only, no markdown):**
{{
  "results": [
    {{
      "index": 0,
      "isCallout": true,
      "calloutType": "detail",
      "calloutNumber": "1",
      "detectedRef": "1/A6",
      "targetSheet": "A6",
      "confidence": 0.92
    }}
  ]
}}

Analyze all {image_count} images now:"""


def call_openrouter_vision_batch(prompt: str, images_base64: list, api_key: str, model: str) -> dict:
    """Call OpenRouter API with multiple images for batch validation."""
    import requests

    if not api_key or len(images_base64) == 0:
        return None

    print(f"[LLM] Batch validation with {len(images_base64)} images using {model}")

    try:
        # Build content array with text prompt and all images
        content = [{"type": "text", "text": prompt}]
        for img_b64 in images_base64:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{img_b64}"}
            })

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sitelink.dev",
                "X-Title": "Sitelink Callout Processor"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": content}],
                "temperature": 0
            },
            timeout=120
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
        return None


def validate_candidates_with_llm(candidates: List[Candidate], image: np.ndarray,
                                  valid_sheets: list, sheet_id: str,
                                  api_key: str, model: str) -> list:
    """Batch validate merged candidates with LLM using contextual crops."""
    import base64

    if not api_key or len(candidates) == 0:
        return []

    h, w = image.shape[:2]
    batch_size = CONFIG["batch_size"]  # Max 20 images per LLM request

    # Prepare all crops
    all_crops = []
    candidate_map = {}

    for i, cand in enumerate(candidates):
        crop = get_contextual_crop(image, cand)
        if crop.size == 0:
            continue

        success, buffer = cv2.imencode('.png', crop)
        if success:
            crop_b64 = base64.b64encode(buffer).decode('utf-8')
            all_crops.append(crop_b64)
            candidate_map[len(all_crops) - 1] = cand

    if len(all_crops) == 0:
        return []

    # Process in batches
    validated = []
    normalized_sheets = [s.upper() for s in valid_sheets] if valid_sheets else []
    num_batches = (len(all_crops) + batch_size - 1) // batch_size

    print(f"[Validate] Processing {len(all_crops)} candidates in {num_batches} batches...")

    for batch_idx in range(num_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, len(all_crops))
        batch_crops = all_crops[start:end]

        print(f"[Validate] Batch {batch_idx + 1}/{num_batches} ({len(batch_crops)} images)...")

        prompt = build_batch_validation_prompt(len(batch_crops), valid_sheets)
        result = call_openrouter_vision_batch(prompt, batch_crops, api_key, model)

        if not result or 'results' not in result:
            print(f"[Validate] Batch {batch_idx + 1} failed, skipping...")
            continue

        for item in result.get('results', []):
            local_idx = item.get('index')
            if local_idx is None:
                continue

            # Map back to global index
            global_idx = start + local_idx
            if global_idx not in candidate_map:
                continue

            is_callout = item.get('isCallout', False)
            confidence = item.get('confidence', 0)
            detected_ref = item.get('detectedRef', '')
            target_sheet = item.get('targetSheet', '')
            callout_type = item.get('calloutType', 'detail')
            callout_number = item.get('calloutNumber', '')

            if not is_callout:
                continue
            if confidence < CONFIDENCE_THRESHOLD:
                continue
            if detected_ref and not is_valid_callout_ref(detected_ref):
                continue
            if normalized_sheets and target_sheet.upper() not in normalized_sheets:
                continue

            cand = candidate_map[global_idx]
            validated.append({
                "id": f"marker-{sheet_id}-{len(validated)}-{uuid.uuid4().hex[:8]}",
                "label": detected_ref,
                "targetSheetRef": target_sheet.upper() if target_sheet else None,
                "calloutType": callout_type,
                "calloutNumber": callout_number,
                "x": float(cand.x) / w,
                "y": float(cand.y) / h,
                "pixelX": int(cand.x),
                "pixelY": int(cand.y),
                "bbox": cand.bbox,
                "confidence": confidence,
                "source": cand.source,
                "needsReview": False
            })
            print(f"   [OK] {detected_ref} ({callout_type}) @ ({int(cand.x)}, {int(cand.y)}) conf={confidence*100:.0f}%")

    return validated


def validate_shapes_with_llm(shapes: list, image: np.ndarray, valid_sheets: list,
                             sheet_id: str, api_key: str, model: str) -> list:
    """Legacy wrapper - converts old shape dicts to Candidates."""
    candidates = []
    for shape in shapes:
        cand = Candidate(
            source=shape.get('method', 'cv'),
            x=float(shape['centerX']),
            y=float(shape['centerY']),
            radius=float((shape['bbox']['x2'] - shape['bbox']['x1']) / 2),
            confidence=shape.get('confidence', 0.75),
            shape_type=shape.get('type'),
            bbox=shape['bbox']
        )
        candidates.append(cand)

    return validate_candidates_with_llm(candidates, image, valid_sheets, sheet_id, api_key, model)


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
                dist = np.hypot(callout['x'] - other['x'], callout['y'] - other['y'])
                if dist < 0.067:
                    group.append(other)
                    used.add(other_idx)

            groups.append(group)

        for group in groups:
            best = max(group, key=lambda c: c.get('confidence', 0))
            result.append(best)

    return sorted(result, key=lambda c: (c['y'], c['x']))


def annotate_image(image: np.ndarray, shapes: list, markers: list) -> np.ndarray:
    """Draw annotations on image - bounding boxes for all candidates, labels for markers."""
    annotated = image.copy()
    h, w = image.shape[:2]

    # Draw all detected shapes/candidates as light gray boxes
    for shape in shapes:
        bbox = shape.get('bbox', {})
        if not bbox:
            continue
        cv2.rectangle(annotated,
                     (bbox['x1'], bbox['y1']),
                     (bbox['x2'], bbox['y2']),
                     (200, 200, 200), 1)

    # Draw validated markers as red boxes with labels
    for marker in markers:
        if 'bbox' in marker:
            bbox = marker['bbox']
        else:
            # Reconstruct bbox from pixel coordinates
            px, py = marker.get('pixelX', int(marker['x'] * w)), marker.get('pixelY', int(marker['y'] * h))
            bbox = {'x1': px - 25, 'y1': py - 25, 'x2': px + 25, 'y2': py + 25}

        # Red rectangle
        cv2.rectangle(annotated,
                     (bbox['x1'], bbox['y1']),
                     (bbox['x2'], bbox['y2']),
                     (0, 0, 255), 2)

        # Label
        label = marker.get('label', '')
        if label:
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.5
            thickness = 2
            (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)

            label_x = bbox['x2'] + 5
            label_y = bbox['y1'] + text_h

            # Ensure within bounds
            if label_x + text_w > w:
                label_x = max(0, bbox['x1'] - text_w - 5)

            # White background
            cv2.rectangle(annotated,
                         (label_x - 2, label_y - text_h - 2),
                         (label_x + text_w + 2, label_y + 4),
                         (255, 255, 255), -1)

            # Red text
            cv2.putText(annotated, label, (label_x, label_y), font, font_scale, (0, 0, 255), thickness)

    return annotated


def process_pdf(pdf_path: str, output_dir: str, use_llm: bool = False,
                valid_sheets: Optional[list] = None, model: Optional[str] = None,
                use_ocr: bool = True) -> dict:
    """
    Process a PDF using Generate-Merge-Validate architecture.

    Pipeline:
    1. GENERATE: Multi-pass CV detection + OCR text detection (parallel)
    2. MERGE: IoU-based candidate merging with confidence boosting
    3. VALIDATE: LLM batch validation with contextual crops

    Args:
        pdf_path: Path to PDF file
        output_dir: Directory to write outputs
        use_llm: Whether to use LLM validation (requires OPENROUTER_API_KEY env var)
        valid_sheets: List of valid sheet numbers for callout target validation
        model: LLM model to use (e.g., 'google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet')
        use_ocr: Whether to use OCR detection (default True)

    Returns:
        Summary of processing results
    """
    api_key = os.environ.get('OPENROUTER_API_KEY', '')
    if model is None:
        model = os.environ.get('OPENROUTER_MODEL', 'google/gemini-2.5-flash')

    if use_llm and not api_key:
        print("Warning: --llm flag set but OPENROUTER_API_KEY not found. Skipping LLM validation.")
        use_llm = False

    # OCR availability is checked lazily when first used
    ocr_enabled = use_ocr

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()

    try:
        first_page = pyvips.Image.new_from_buffer(pdf_data, '', dpi=DPI, page=0, access='sequential')
        n_pages = first_page.get('n-pages') if 'n-pages' in first_page.get_fields() else 1
    except Exception as e:
        print(f"Error loading PDF: {e}")
        return {"error": str(e)}

    print(f"\n{'='*60}")
    print(f"Generate-Merge-Validate Callout Detection")
    print(f"{'='*60}")
    print(f"PDF: {pdf_path}")
    print(f"Pages: {n_pages}")
    print(f"DPI: {DPI}")
    print(f"Multi-pass CV: {len(CONFIG['cv_passes'])} passes")
    print(f"OCR detection: {'enabled' if ocr_enabled else 'disabled'}")
    print(f"LLM validation: {'enabled' if use_llm else 'disabled'}")
    if use_llm:
        print(f"Model: {model}")
        print(f"Confidence threshold: {CONFIDENCE_THRESHOLD}")
    if valid_sheets:
        print(f"Valid sheets: {', '.join(valid_sheets)}")
    print()

    results = {
        "pdf_path": pdf_path,
        "pages": n_pages,
        "dpi": DPI,
        "architecture": "generate-merge-validate",
        "llm_enabled": use_llm,
        "ocr_enabled": ocr_enabled,
        "sheets": []
    }

    for page_num in range(n_pages):
        sheet_id = f"sheet-{page_num}"
        sheet_dir = Path(output_dir) / sheet_id
        sheet_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n{'='*50}")
        print(f"Processing {sheet_id} (page {page_num + 1}/{n_pages})")
        print(f"{'='*50}")

        # Render page at 300 DPI
        print(f"\n[Render] Rendering at {DPI} DPI...")
        image = pyvips.Image.new_from_buffer(pdf_data, '', dpi=DPI, page=page_num, access='sequential')
        width, height = image.width, image.height
        print(f"[Render] Dimensions: {width} x {height}")

        source_path = sheet_dir / "source.png"
        image.pngsave(str(source_path), compression=6)

        # Convert to OpenCV format
        img_np = np.ndarray(
            buffer=image.write_to_memory(),
            dtype=np.uint8,
            shape=[height, width, image.bands]
        )
        if image.bands == 4:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        elif image.bands == 1:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)

        # STAGE 1: GENERATE - Multi-pass CV + OCR
        print(f"\n[Generate] Stage 1: Candidate Generation")

        print(f"[Generate] Running multi-pass CV detection...")
        cv_candidates = detect_shapes_cv(img_np, dpi=DPI)
        print(f"[Generate] CV found {len(cv_candidates)} candidates")

        ocr_candidates = []
        if ocr_enabled:
            print(f"[Generate] Running OCR text detection...")
            ocr_candidates = detect_callouts_ocr(img_np)
            print(f"[Generate] OCR found {len(ocr_candidates)} candidates")

        # STAGE 2: MERGE - IoU-based candidate merging
        print(f"\n[Merge] Stage 2: Candidate Merging")
        merged_candidates = merge_candidates(cv_candidates, ocr_candidates)
        print(f"[Merge] {len(cv_candidates)} CV + {len(ocr_candidates)} OCR → {len(merged_candidates)} merged")

        # Save candidates JSON
        candidates_path = sheet_dir / "candidates.json"
        with open(candidates_path, 'w') as f:
            json.dump([c.to_dict() for c in merged_candidates], f, indent=2)

        # STAGE 3: VALIDATE - LLM batch validation
        markers = []
        if use_llm and len(merged_candidates) > 0:
            print(f"\n[Validate] Stage 3: LLM Validation")
            validated = validate_candidates_with_llm(
                merged_candidates, img_np, valid_sheets or [], sheet_id, api_key, model
            )
            markers = deduplicate_callouts(validated)
            print(f"[Validate] {len(merged_candidates)} candidates → {len(markers)} validated markers")
        else:
            # Without LLM, convert candidates to marker format
            for i, cand in enumerate(merged_candidates):
                markers.append({
                    "id": f"marker-{sheet_id}-{i}-{uuid.uuid4().hex[:8]}",
                    "label": cand.text or "?/?",
                    "targetSheetRef": None,
                    "x": float(cand.x) / width,
                    "y": float(cand.y) / height,
                    "pixelX": int(cand.x),
                    "pixelY": int(cand.y),
                    "bbox": cand.bbox,
                    "confidence": cand.confidence,
                    "source": cand.source,
                    "needsReview": True,
                    "type": cand.shape_type
                })

        # Save markers JSON
        markers_path = sheet_dir / "markers.json"
        with open(markers_path, 'w') as f:
            json.dump(markers, f, indent=2)

        # Convert candidates to shape dicts for annotation
        shapes_for_annotation = [c.to_dict() for c in merged_candidates]

        # Generate annotated image
        print(f"\n[Output] Generating annotated image...")
        annotated = annotate_image(img_np, shapes_for_annotation, markers)
        annotated_path = sheet_dir / "annotated.png"
        cv2.imwrite(str(annotated_path), annotated)

        # Save metadata
        metadata = {
            "sheetId": sheet_id,
            "pageNumber": page_num + 1,
            "width": width,
            "height": height,
            "dpi": DPI,
            "cvCandidates": len(cv_candidates),
            "ocrCandidates": len(ocr_candidates),
            "mergedCandidates": len(merged_candidates),
            "markersFound": len(markers),
            "llmValidated": use_llm,
            "ocrEnabled": ocr_enabled
        }
        metadata_path = sheet_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"[Output] Saved: {sheet_dir}/")

        results["sheets"].append({
            "sheetId": sheet_id,
            "pageNumber": page_num + 1,
            "width": width,
            "height": height,
            "cvCandidates": len(cv_candidates),
            "ocrCandidates": len(ocr_candidates),
            "mergedCandidates": len(merged_candidates),
            "markers": len(markers)
        })

    # Save summary
    summary_path = Path(output_dir) / "summary.json"
    with open(summary_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"Summary saved: {summary_path}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Local callout processor CLI - matches production backend behavior"
    )
    parser.add_argument(
        "--pdf", "-p",
        required=True,
        help="Path to PDF file"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory for results"
    )
    parser.add_argument(
        "--llm",
        action="store_true",
        help="Enable LLM validation (requires OPENROUTER_API_KEY env var or .env file)"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=None,
        help="LLM model to use (e.g., google/gemini-2.5-flash, anthropic/claude-3.5-sonnet). "
             "Defaults to OPENROUTER_MODEL env var or google/gemini-2.5-flash"
    )
    parser.add_argument(
        "--no-ocr",
        action="store_true",
        help="Disable OCR text detection (only use CV detection)"
    )
    parser.add_argument(
        "--valid-sheets", "-s",
        type=str,
        default="",
        help="Comma-separated list of valid sheet numbers (e.g., A1,A2,A3)"
    )

    args = parser.parse_args()

    # Resolve PDF path (works from project root or packages/callout-processor/)
    pdf_path = resolve_path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: PDF not found: {args.pdf}")
        print(f"  Tried: {pdf_path}")
        print(f"  Project root: {find_project_root()}")
        sys.exit(1)

    # Parse valid sheets
    valid_sheets = [s.strip().upper() for s in args.valid_sheets.split(",") if s.strip()]

    # Process PDF
    result = process_pdf(
        pdf_path=str(pdf_path),
        output_dir=args.output,
        use_llm=args.llm,
        valid_sheets=valid_sheets if valid_sheets else None,
        model=args.model,
        use_ocr=not args.no_ocr
    )

    if "error" in result:
        print(f"\nError: {result['error']}")
        sys.exit(1)

    # Print summary
    print("\n" + "=" * 60)
    print("Processing Complete!")
    print("=" * 60)
    for sheet in result.get("sheets", []):
        cv_count = sheet.get('cvCandidates', sheet.get('shapeCandidates', 0))
        ocr_count = sheet.get('ocrCandidates', 0)
        merged = sheet.get('mergedCandidates', cv_count)
        print(f"  {sheet['sheetId']}: {sheet['width']}x{sheet['height']}")
        print(f"    CV: {cv_count}, OCR: {ocr_count} → Merged: {merged} → Markers: {sheet['markers']}")

    sys.exit(0)


if __name__ == "__main__":
    main()
