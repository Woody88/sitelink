"""
YOLO-based callout detection with SAHI tiling.
Port of callout-processor-v5 detection logic for container deployment.
"""
import base64
import json
import os
import re
from pathlib import Path

import cv2
import httpx
import numpy as np
from ultralytics import YOLO

MODEL_PATH = Path(__file__).parent / "weights" / "callout_detector.pt"

# Critical parameters - must match training config
DETECTION_DPI = 72  # Model was trained on 72 DPI images
RENDER_DPI = 300    # Container renders at 300 DPI
TILE_SIZE = 2048    # SAHI tile size
OVERLAP = 0.2       # SAHI overlap
CONF_THRESHOLD = 0.25  # v5/v6 optimal confidence
IOU_THRESHOLD = 0.5

CLASS_NAMES = ["detail", "elevation", "title"]

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_MODEL = "google/gemini-2.0-flash-001"

_model = None


def get_model() -> YOLO:
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"YOLO model not found at {MODEL_PATH}")
        _model = YOLO(str(MODEL_PATH))
    return _model


def tile_image(image: np.ndarray, tile_size: int = TILE_SIZE, overlap: float = OVERLAP) -> list:
    h, w = image.shape[:2]
    stride = int(tile_size * (1 - overlap))
    tiles = []

    for y in range(0, max(1, h - tile_size + 1), stride):
        for x in range(0, max(1, w - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]

            if tile.shape[0] < tile_size or tile.shape[1] < tile_size:
                padded = np.zeros((tile_size, tile_size, 3), dtype=np.uint8) if len(tile.shape) == 3 else np.zeros((tile_size, tile_size), dtype=np.uint8)
                padded[:tile.shape[0], :tile.shape[1]] = tile
                tile = padded

            tiles.append((tile, (x, y)))

    if w > tile_size:
        x = w - tile_size
        for y in range(0, max(1, h - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]
            tiles.append((tile, (x, y)))

    if h > tile_size:
        y = h - tile_size
        for x in range(0, max(1, w - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]
            tiles.append((tile, (x, y)))

    if w > tile_size and h > tile_size:
        tile = image[h-tile_size:h, w-tile_size:w]
        tiles.append((tile, (w-tile_size, h-tile_size)))

    return tiles


def merge_detections(detections: list, iou_threshold: float = 0.5) -> list:
    if not detections:
        return []

    by_class = {}
    for det in detections:
        cls = det['class']
        if cls not in by_class:
            by_class[cls] = []
        by_class[cls].append(det)

    merged = []
    for cls, dets in by_class.items():
        boxes = [d['bbox'] for d in dets]
        scores = [d['confidence'] for d in dets]

        indices = cv2.dnn.NMSBoxes(boxes, scores, 0.0, iou_threshold)

        if len(indices) > 0:
            for idx in indices.flatten():
                merged.append(dets[idx])

    return merged


def filter_by_size(detections: list, min_size: int = 10, max_size: int = 150) -> list:
    filtered = []
    for det in detections:
        x, y, w, h = det['bbox']
        if w < min_size or h < min_size:
            continue
        if w > max_size or h > max_size:
            continue
        filtered.append(det)
    return filtered


def filter_by_aspect_ratio(detections: list, min_ratio: float = 0.3, max_ratio: float = 3.0) -> list:
    filtered = []
    for det in detections:
        x, y, w, h = det['bbox']
        if w == 0 or h == 0:
            continue
        aspect_ratio = h / w
        if aspect_ratio < min_ratio or aspect_ratio > max_ratio:
            continue
        filtered.append(det)
    return filtered


def filter_by_area(detections: list, min_area: int = 200, max_area: int = 15000) -> list:
    filtered = []
    for det in detections:
        x, y, w, h = det['bbox']
        area = w * h
        if area < min_area or area > max_area:
            continue
        filtered.append(det)
    return filtered


def filter_by_class_specific_rules(detections: list) -> list:
    filtered = []
    for det in detections:
        x, y, w, h = det['bbox']
        callout_type = det.get('class', 'unknown')

        if callout_type == 'detail':
            if w > 100 or h > 100:
                continue
            if w < 15 or h < 15:
                continue
            aspect_ratio = h / w if w > 0 else 0
            if aspect_ratio < 0.5 or aspect_ratio > 2.0:
                continue

        elif callout_type == 'elevation':
            if w > 120 or h > 120:
                continue
            if w < 15 or h < 15:
                continue

        elif callout_type == 'title':
            if w > 500 or h > 200:
                continue
            if w < 12 or h < 12:
                continue
            aspect_ratio = h / w if w > 0 else 0
            if aspect_ratio < 0.05 or aspect_ratio > 5.0:
                continue

        filtered.append(det)

    return filtered


def apply_all_filters(detections: list) -> list:
    title_callouts = [d for d in detections if d.get('class') == 'title']
    other_callouts = [d for d in detections if d.get('class') != 'title']

    current = other_callouts
    current = filter_by_size(current)
    current = filter_by_aspect_ratio(current)
    current = filter_by_area(current)
    current = filter_by_class_specific_rules(current)

    title_callouts = filter_by_class_specific_rules(title_callouts)

    return current + title_callouts


def extract_callouts_with_gemini(
    crop_images: list,
    api_key: str,
    batch_size: int = 10
) -> dict:
    results = {}

    for batch_start in range(0, len(crop_images), batch_size):
        batch = crop_images[batch_start:batch_start + batch_size]

        content = []
        content.append({
            "type": "text",
            "text": """Extract detail number and sheet reference from construction plan callout bubbles.

CALLOUT STRUCTURE:
Each callout is a CIRCLE with a horizontal dividing line:
- TOP HALF: Detail number (ALWAYS a simple number like 1, 5, 10, 18 - just digits, nothing else)
- BOTTOM HALF: Sheet reference following standard format

SHEET REFERENCE FORMAT (NCS/UDS Standard):
Valid patterns:
- "S2.0" or "S1.0" (discipline + sheet type + decimal)
- "S20" or "A10" (discipline + two digits)
- "A-101" or "S-201" (discipline-hyphen-three digits)
The first character is ALWAYS a letter (A=Architectural, S=Structural, M=Mechanical, E=Electrical, C=Civil)
Must contain at least one digit after the letter.

STRICT RULES:
1. Detail number: ONLY digits (1-99). If you see letters, it's NOT a detail number - return null
2. Sheet reference: MUST start with a letter and contain digits. Random text like "SDF", "FROS", "OTS" is NOT valid - return null
3. Focus ONLY on the circular callout bubble in the CENTER of each image
4. Ignore all surrounding text, labels, and notes - they are NOT part of the callout

Return JSON array:
[
  {"idx": 0, "identifier": "10", "target_sheet": "S2.0"},
  {"idx": 1, "identifier": "5", "target_sheet": "S20"},
  ...
]

Return null for any value that doesn't match the rules above. Only return the JSON array."""
        })

        for i, (det_idx, crop) in enumerate(batch):
            _, buffer = cv2.imencode('.png', crop)
            img_base64 = base64.b64encode(buffer).decode('utf-8')

            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{img_base64}"
                }
            })

        try:
            response = httpx.post(
                OPENROUTER_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GEMINI_MODEL,
                    "messages": [
                        {"role": "user", "content": content}
                    ],
                    "max_tokens": 2000,
                    "temperature": 0,
                },
                timeout=60.0
            )
            response.raise_for_status()

            result_json = response.json()
            answer = result_json["choices"][0]["message"]["content"]

            def is_valid_identifier(val):
                if not val:
                    return False
                val = str(val).strip()
                return val.isdigit() and 1 <= int(val) <= 99

            def is_valid_sheet_ref(val):
                if not val:
                    return False
                val = str(val).strip().upper()
                if not val or not val[0].isalpha():
                    return False
                if not any(c.isdigit() for c in val):
                    return False
                if re.match(r'^[A-Z]{1,2}-?\d+\.?\d*$', val):
                    return True
                return False

            json_match = re.search(r'\[[\s\S]*\]', answer)
            if json_match:
                parsed = json.loads(json_match.group())
                for i, item in enumerate(parsed):
                    if i < len(batch):
                        det_idx = batch[i][0]
                        identifier = item.get("identifier")
                        target_sheet = item.get("target_sheet")

                        if identifier and is_valid_identifier(identifier):
                            identifier = str(identifier).strip()
                        else:
                            identifier = None

                        if target_sheet and is_valid_sheet_ref(target_sheet):
                            target_sheet = str(target_sheet).strip().upper()
                        else:
                            target_sheet = None

                        results[det_idx] = (identifier, target_sheet)

        except Exception as e:
            print(f"Gemini API error: {e}")
            for det_idx, _ in batch:
                results[det_idx] = (None, None)

    return results


def validate_target_sheet(target_sheet: str, valid_sheets: list) -> str | None:
    if not target_sheet or not valid_sheets:
        return target_sheet

    normalized = target_sheet.upper()

    for valid in valid_sheets:
        if normalized == valid.upper():
            return valid

    return None


def detect_callouts_yolo(
    image_data: bytes,
    valid_sheets: list,
    sheet_id: str,
    api_key: str | None = None,
    use_gemini: bool = True,
    input_dpi: int = RENDER_DPI
) -> dict:
    nparr = np.frombuffer(image_data, np.uint8)
    img_original = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_original is None:
        print(f"[YOLO] Failed to decode image")
        return {"markers": [], "unmatchedCount": 0}

    h_orig, w_orig = img_original.shape[:2]
    print(f"[YOLO] Processing sheet {sheet_id} ({w_orig}x{h_orig} @ {input_dpi} DPI)")

    # Downsample to 72 DPI for detection (model was trained on 72 DPI)
    scale_factor = DETECTION_DPI / input_dpi
    if abs(scale_factor - 1.0) > 0.01:
        new_w = int(w_orig * scale_factor)
        new_h = int(h_orig * scale_factor)
        img = cv2.resize(img_original, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        print(f"[YOLO] Downsampled to {new_w}x{new_h} ({DETECTION_DPI} DPI)")
    else:
        img = img_original
        new_w, new_h = w_orig, h_orig

    h, w = img.shape[:2]
    model = get_model()
    all_detections = []

    # Always use SAHI tiling (this is how the model was trained)
    tiles = tile_image(img, TILE_SIZE, OVERLAP)
    print(f"[YOLO] Split into {len(tiles)} tiles (SAHI tiling)")

    for tile, (offset_x, offset_y) in tiles:
        results = model.predict(tile, conf=CONF_THRESHOLD, iou=IOU_THRESHOLD, verbose=False)

        for r in results:
            boxes = r.boxes
            for i in range(len(boxes)):
                box = boxes[i]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                # Adjust to global coordinates in downsampled image
                x1_global = x1 + offset_x
                y1_global = y1 + offset_y
                x2_global = x2 + offset_x
                y2_global = y2 + offset_y

                conf_score = float(box.conf[0])
                cls_id = int(box.cls[0])
                class_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown"

                all_detections.append({
                    'bbox': [
                        float(x1_global),
                        float(y1_global),
                        float(x2_global - x1_global),
                        float(y2_global - y1_global)
                    ],
                    'class': class_name,
                    'confidence': conf_score
                })

    print(f"[YOLO] Raw detections: {len(all_detections)}")

    merged = merge_detections(all_detections, iou_threshold=IOU_THRESHOLD)
    print(f"[YOLO] After NMS: {len(merged)}")

    filtered = apply_all_filters(merged)
    print(f"[YOLO] After filters: {len(filtered)}")

    # Scale factor to convert 72 DPI coords back to original resolution
    upscale_factor = 1.0 / scale_factor if scale_factor != 1.0 else 1.0

    markers = []
    crop_images = []

    for i, det in enumerate(filtered):
        x, y, bw, bh = det['bbox']
        x, y, bw, bh = int(x), int(y), int(bw), int(bh)

        # Crop from original high-res image for better Gemini OCR
        # Scale bbox coordinates back to original resolution
        x_orig = int(x * upscale_factor)
        y_orig = int(y * upscale_factor)
        bw_orig = int(bw * upscale_factor)
        bh_orig = int(bh * upscale_factor)

        x1_orig = max(0, x_orig)
        y1_orig = max(0, y_orig)
        x2_orig = min(w_orig, x_orig + bw_orig)
        y2_orig = min(h_orig, y_orig + bh_orig)
        crop = img_original[y1_orig:y2_orig, x1_orig:x2_orig]

        if crop.size > 0:
            crop_images.append((i, crop))

        # Use normalized coordinates (0-1 range) for markers
        # These are based on the downsampled image dimensions but normalize the same
        center_x = (x + bw / 2) / w
        center_y = (y + bh / 2) / h

        markers.append({
            "id": f"marker-{sheet_id}-{i}",
            "label": None,
            "targetSheetRef": None,
            "x": center_x,
            "y": center_y,
            "confidence": det['confidence'],
            "detectionClass": det['class'],
            "needsReview": True
        })

    if use_gemini and api_key and crop_images:
        print(f"[YOLO] Running Gemini extraction on {len(crop_images)} crops...")
        gemini_results = extract_callouts_with_gemini(crop_images, api_key, batch_size=10)

        for i, marker in enumerate(markers):
            if i in gemini_results:
                identifier, target_sheet = gemini_results[i]

                validated_sheet = validate_target_sheet(target_sheet, valid_sheets) if target_sheet else None

                if identifier and validated_sheet:
                    marker['label'] = f"{identifier}/{validated_sheet}"
                    marker['targetSheetRef'] = validated_sheet
                    marker['needsReview'] = False
                elif identifier:
                    marker['label'] = identifier
                elif validated_sheet:
                    marker['label'] = validated_sheet
                    marker['targetSheetRef'] = validated_sheet

        print(f"[YOLO] Gemini extraction complete")

    matched = sum(1 for m in markers if m.get('targetSheetRef'))
    unmatched = len(markers) - matched

    print(f"[YOLO] Final: {len(markers)} markers, {matched} matched, {unmatched} unmatched")

    return {
        "markers": markers,
        "unmatchedCount": unmatched
    }
