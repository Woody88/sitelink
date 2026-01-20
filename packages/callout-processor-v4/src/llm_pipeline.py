"""
LLM Pipeline for callout detection.

3-Stage Pipeline:
1. Pre-filter: Sheet triage (is this a drawing or notes page?)
2. Detection: CV-based circle/triangle detection (existing code)
3. Classification: Batch LLM classification of candidates

Uses Gemini 2.5 Flash via OpenRouter for cost-effective vision processing.
"""

import base64
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

import cv2
import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

MODEL_FLASH = "google/gemini-2.5-flash"
MODEL_PRO = "google/gemini-2.5-pro"


@dataclass
class SheetTriageResult:
    """Result from pre-filter stage."""
    sheet_index: int
    is_drawing: bool
    confidence: str  # 'high', 'medium', 'low'
    sheet_type: str  # 'drawing', 'notes', 'schedule', 'cover', 'unknown'
    reason: str


@dataclass
class CalloutCandidate:
    """A candidate callout from CV detection."""
    id: int
    x: int
    y: int
    radius: int
    crop_image: np.ndarray  # Cropped image of the candidate
    has_triangles: bool
    triangle_positions: List[str]
    ocr_text: Optional[str] = None
    ocr_confidence: float = 0.0


@dataclass
class ClassifiedCallout:
    """Result from LLM classification."""
    candidate_id: int
    callout_type: str  # 'detail', 'section', 'elevation', 'title', 'none'
    label: str  # Text inside the callout
    identifier: Optional[str] = None
    view_sheet: Optional[str] = None
    confidence: str = 'medium'  # 'high', 'medium', 'low'
    reason: Optional[str] = None


def encode_image_base64(image: np.ndarray, format: str = 'png') -> str:
    """Encode numpy image to base64 string."""
    if format == 'png':
        _, buffer = cv2.imencode('.png', image)
    else:
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode('utf-8')


def create_thumbnail(image: np.ndarray, max_size: int = 768) -> np.ndarray:
    """Create a thumbnail for pre-filter stage."""
    h, w = image.shape[:2]
    scale = min(max_size / w, max_size / h)
    if scale < 1:
        new_w, new_h = int(w * scale), int(h * scale)
        return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return image


def call_openrouter(
    messages: List[Dict],
    model: str = MODEL_FLASH,
    max_tokens: int = 1024,
    temperature: float = 0.1
) -> Optional[str]:
    """Call OpenRouter API with messages."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set. Check .env file.")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sitelink.app",
        "X-Title": "Sitelink Callout Processor"
    }

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature
    }

    try:
        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"OpenRouter API error: {e}")
        return None


def prefilter_sheet(
    image: np.ndarray,
    sheet_index: int = 0,
    model: str = MODEL_FLASH
) -> SheetTriageResult:
    """
    Stage 1: Pre-filter to determine if sheet should be processed.

    Uses a low-res thumbnail to quickly classify sheet type.
    Biased toward recall - if uncertain, says it's a drawing.
    """
    thumbnail = create_thumbnail(image, max_size=768)
    image_b64 = encode_image_base64(thumbnail, format='jpg')

    prompt = """Analyze this construction/engineering drawing sheet thumbnail.

Classify the sheet type:
- DRAWING: Contains structural/architectural diagrams with callout symbols (circles with numbers/letters)
- NOTES: Primarily text content (general notes, specifications)
- SCHEDULE: Tables or schedules (door schedule, finish schedule, etc.)
- COVER: Title sheet or cover page
- UNKNOWN: Cannot determine

IMPORTANT: If you see ANY circular callout symbols or section markers, classify as DRAWING.
When uncertain, default to DRAWING to avoid missing callouts.

Respond in JSON format:
{
    "sheet_type": "DRAWING|NOTES|SCHEDULE|COVER|UNKNOWN",
    "is_drawing": true|false,
    "confidence": "high|medium|low",
    "reason": "brief explanation"
}"""

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_b64}"
                    }
                }
            ]
        }
    ]

    response = call_openrouter(messages, model=model, max_tokens=256)

    if not response:
        # Default to processing if API fails
        return SheetTriageResult(
            sheet_index=sheet_index,
            is_drawing=True,
            confidence='low',
            sheet_type='unknown',
            reason='API call failed, defaulting to process'
        )

    # Parse JSON response
    try:
        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return SheetTriageResult(
                sheet_index=sheet_index,
                is_drawing=data.get('is_drawing', True),
                confidence=data.get('confidence', 'medium'),
                sheet_type=data.get('sheet_type', 'unknown').lower(),
                reason=data.get('reason', '')
            )
    except json.JSONDecodeError:
        pass

    # Default to processing if parsing fails
    return SheetTriageResult(
        sheet_index=sheet_index,
        is_drawing=True,
        confidence='low',
        sheet_type='unknown',
        reason='Failed to parse response, defaulting to process'
    )


def crop_candidate(
    image: np.ndarray,
    cx: int,
    cy: int,
    radius: int,
    padding: float = 0.5
) -> np.ndarray:
    """Crop image around a candidate callout with padding."""
    h, w = image.shape[:2]
    pad = int(radius * padding)

    x1 = max(0, cx - radius - pad)
    y1 = max(0, cy - radius - pad)
    x2 = min(w, cx + radius + pad)
    y2 = min(h, cy + radius + pad)

    crop = image[y1:y2, x1:x2].copy()

    # Ensure minimum size for LLM
    min_size = 100
    ch, cw = crop.shape[:2]
    if ch < min_size or cw < min_size:
        scale = max(min_size / ch, min_size / cw)
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    return crop


def classify_candidates_batch(
    candidates: List[CalloutCandidate],
    sheet_image: Optional[np.ndarray] = None,
    model: str = MODEL_FLASH
) -> List[ClassifiedCallout]:
    """
    Stage 3: Batch classify callout candidates using LLM.

    Sends multiple candidate crops in one API call for efficiency.
    """
    if not candidates:
        return []

    # Build image content for each candidate
    image_contents = []
    for i, cand in enumerate(candidates):
        img_b64 = encode_image_base64(cand.crop_image, format='png')
        image_contents.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{img_b64}"}
        })

    # Build prompt
    candidate_info = []
    for i, cand in enumerate(candidates):
        info = f"Image {i}: "
        if cand.has_triangles:
            info += f"Has triangles at positions: {cand.triangle_positions}. "
        if cand.ocr_text:
            info += f"OCR detected: '{cand.ocr_text}' (conf: {cand.ocr_confidence:.0%})"
        candidate_info.append(info)

    prompt = f"""You are analyzing callout symbols from structural/architectural drawings.

I'm sending you {len(candidates)} cropped images of potential callouts. For each image:

1. Determine if it's a valid CALLOUT or NOT:
   - Valid callouts reference OTHER drawings/details (e.g., "10/S2.0" means "see detail 10 on sheet S2.0")
   - NOT callouts: Column grid markers, random circled text, dimension circles, etc.

2. If valid callout, classify the type:
   - DETAIL: Circle with number/letter referencing a detail view (e.g., "10/S2.0", "A/A5", "3/S1.0")
   - SECTION: Circle with triangle pointer(s), indicates section cut view
   - ELEVATION: Circle with upward triangle, indicates elevation view
   - TITLE: Circle at bottom of detail box, labels a detail/section
   - NONE: Not a valid callout

CRITICAL - Reject these as NONE (they are NOT callouts):
- Column/grid line markers: Single letters like "A", "B", "R", "Q", "P", "N" that mark structural grid lines
  These appear along the edges of drawings to identify column grid lines (e.g., grid line R, grid line P)
- Grid line extensions like "Px", "Qx", "Rx" (grid lines with suffix)
- Single letters without sheet references that appear near drawing edges
- Circles that are part of column grid bubbles at top/bottom/sides of the plan

How to distinguish:
- CALLOUT: Contains sheet reference format like "10/S2.0", "3/A5" (number/sheet)
- GRID MARKER: Single letter (R, P, Q) or letter+suffix (Px, Qx) without sheet reference, located at edge of drawing

3. Extract the exact text inside the callout

Context for each candidate:
{chr(10).join(candidate_info)}

Respond with a JSON array, one object per image in order:
[
  {{"id": 0, "type": "DETAIL|SECTION|ELEVATION|TITLE|NONE", "label": "text inside", "confidence": "high|medium|low", "reason": "brief explanation"}},
  ...
]

If the circle contains no readable text or is clearly not a callout, use type "NONE" and label "".
"""

    # Build message with all images
    content = [{"type": "text", "text": prompt}]
    content.extend(image_contents)

    messages = [{"role": "user", "content": content}]

    response = call_openrouter(
        messages,
        model=model,
        max_tokens=1024 + len(candidates) * 100,
        temperature=0.1
    )

    if not response:
        # Return empty classifications if API fails
        return [
            ClassifiedCallout(
                candidate_id=c.id,
                callout_type='unknown',
                label=c.ocr_text or '',
                confidence='low',
                reason='API call failed'
            )
            for c in candidates
        ]

    # Parse JSON response
    results = []
    try:
        # Extract JSON array from response
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            data = json.loads(json_match.group())
            for i, item in enumerate(data):
                if i >= len(candidates):
                    break

                cand = candidates[i]
                callout_type = item.get('type', 'NONE').lower()
                label = item.get('label', '') or ''

                # Parse label for identifier and view_sheet
                identifier = None
                view_sheet = None
                if '/' in label:
                    parts = label.split('/')
                    identifier = parts[0].strip()
                    view_sheet = parts[1].strip() if len(parts) > 1 else None
                elif label:
                    identifier = label.strip()

                results.append(ClassifiedCallout(
                    candidate_id=cand.id,
                    callout_type=callout_type if callout_type != 'none' else 'none',
                    label=label,
                    identifier=identifier,
                    view_sheet=view_sheet,
                    confidence=item.get('confidence', 'medium'),
                    reason=item.get('reason', '')
                ))
    except json.JSONDecodeError as e:
        print(f"Failed to parse classification response: {e}")
        print(f"Response was: {response[:500]}...")

    # Fill in any missing results
    classified_ids = {r.candidate_id for r in results}
    for cand in candidates:
        if cand.id not in classified_ids:
            results.append(ClassifiedCallout(
                candidate_id=cand.id,
                callout_type='unknown',
                label=cand.ocr_text or '',
                confidence='low',
                reason='Not included in LLM response'
            ))

    return results


def should_skip_llm_classification(candidate: CalloutCandidate) -> Tuple[bool, Optional[ClassifiedCallout]]:
    """
    Check if we can skip LLM classification based on high-confidence OCR.

    If OCR text matches a clear callout pattern with high confidence,
    we can classify directly without LLM.
    """
    if not candidate.ocr_text or candidate.ocr_confidence < 0.85:
        return False, None

    text = candidate.ocr_text.strip().upper()

    # High-confidence patterns that don't need LLM validation
    # Pattern: number/sheet reference like "10/S2.0", "3/A5"
    sheet_ref_pattern = r'^[A-Z0-9]{1,2}\s*/\s*[A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?$'

    if re.match(sheet_ref_pattern, text):
        # Parse the reference
        parts = text.split('/')
        identifier = parts[0].strip()
        view_sheet = parts[1].strip() if len(parts) > 1 else None

        # Determine type based on triangles
        if candidate.has_triangles:
            if 'top' in candidate.triangle_positions:
                callout_type = 'elevation'
            else:
                callout_type = 'section'
        else:
            callout_type = 'detail'

        return True, ClassifiedCallout(
            candidate_id=candidate.id,
            callout_type=callout_type,
            label=text,
            identifier=identifier,
            view_sheet=view_sheet,
            confidence='high',
            reason='High-confidence OCR match'
        )

    return False, None


def process_sheet_with_llm(
    image: np.ndarray,
    candidates: List[CalloutCandidate],
    sheet_index: int = 0,
    model: str = MODEL_FLASH,
    skip_prefilter: bool = False
) -> Tuple[Optional[SheetTriageResult], List[ClassifiedCallout]]:
    """
    Full LLM pipeline for a single sheet.

    1. Pre-filter (optional)
    2. Filter candidates by OCR confidence
    3. Batch classify remaining candidates
    """
    # Stage 1: Pre-filter
    triage_result = None
    if not skip_prefilter:
        triage_result = prefilter_sheet(image, sheet_index, model)
        if not triage_result.is_drawing:
            print(f"  Sheet {sheet_index} skipped: {triage_result.sheet_type} ({triage_result.reason})")
            return triage_result, []

    # Stage 2: Filter by OCR confidence
    needs_llm = []
    auto_classified = []

    for cand in candidates:
        skip, result = should_skip_llm_classification(cand)
        if skip and result:
            auto_classified.append(result)
        else:
            needs_llm.append(cand)

    print(f"  Auto-classified (high-conf OCR): {len(auto_classified)}")
    print(f"  Needs LLM classification: {len(needs_llm)}")

    # Stage 3: Batch classify remaining
    llm_classified = []
    if needs_llm:
        # Batch in groups of 10 to avoid token limits
        batch_size = 10
        for i in range(0, len(needs_llm), batch_size):
            batch = needs_llm[i:i + batch_size]
            results = classify_candidates_batch(batch, sheet_image=image, model=model)
            llm_classified.extend(results)

    # Combine results
    all_classified = auto_classified + llm_classified

    # Filter out 'none' type
    valid_callouts = [c for c in all_classified if c.callout_type not in ('none', 'unknown')]

    return triage_result, valid_callouts
