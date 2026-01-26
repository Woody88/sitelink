#!/usr/bin/env python3
"""
Extract sheet number and title from title block using Gemini Flash 2.
Title blocks are typically in the bottom-right corner of construction drawings.
Supports batch processing for efficiency.
"""

import sys
import json
import os
import base64
import httpx
import cv2
import re

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_MODEL = "google/gemini-2.0-flash-001"


def crop_title_block(image_path: str) -> tuple[bytes | None, str | None]:
    """Crop the title block region from an image and return as PNG bytes."""
    img = cv2.imread(image_path)
    if img is None:
        return None, f"Could not read image: {image_path}"

    h, w = img.shape[:2]
    title_block_x = int(w * 0.6)
    title_block_y = int(h * 0.7)
    title_block = img[title_block_y:h, title_block_x:w]

    _, buffer = cv2.imencode('.png', title_block)
    return buffer.tobytes(), None


def validate_sheet_number(sheet_number: str | None) -> str | None:
    """Validate and normalize sheet number."""
    if not sheet_number:
        return None
    sheet_number = str(sheet_number).strip().upper()
    if not re.match(r'^[A-Z]{1,2}[-.]?\d', sheet_number):
        return None
    return sheet_number


def validate_sheet_title(sheet_title: str | None) -> str | None:
    """Validate and normalize sheet title."""
    if not sheet_title:
        return None
    sheet_title = str(sheet_title).strip().upper()
    if len(sheet_title) < 3:
        return None
    return sheet_title


def extract_sheet_info_batch(
    image_paths: list[str],
    api_key: str | None = None,
    batch_size: int = 10
) -> list[dict]:
    """
    Extract sheet number and title from multiple images using batched API calls.
    Returns a list of results in the same order as input image_paths.
    """
    if api_key is None:
        api_key = os.environ.get("OPENROUTER_API_KEY")

    if not api_key:
        return [
            {"sheet_number": None, "sheet_title": None, "error": "No API key provided"}
            for _ in image_paths
        ]

    results: list[dict] = [None] * len(image_paths)  # type: ignore
    crops_with_indices: list[tuple[int, bytes]] = []

    for idx, image_path in enumerate(image_paths):
        crop_bytes, error = crop_title_block(image_path)
        if error:
            results[idx] = {"sheet_number": None, "sheet_title": None, "error": error}
        elif crop_bytes:
            crops_with_indices.append((idx, crop_bytes))

    for batch_start in range(0, len(crops_with_indices), batch_size):
        batch = crops_with_indices[batch_start:batch_start + batch_size]

        content = []
        content.append({
            "type": "text",
            "text": f"""Extract sheet number and title from {len(batch)} title block images from construction drawings.

For each image, extract:
1. Sheet number (e.g., "S2.0", "A1.01", "A-201", "E101")
   - First character is a discipline letter: A=Architectural, S=Structural, M=Mechanical, E=Electrical, C=Civil
   - Followed by sheet type and sequence number

2. Sheet title (e.g., "FOUNDATION PLAN", "FIRST FLOOR PLAN", "ROOF FRAMING PLAN")
   - The main description of what the drawing shows

Return a JSON array with {len(batch)} objects in order:
[
  {{"idx": 0, "sheet_number": "S2.0", "sheet_title": "FOUNDATION PLAN"}},
  {{"idx": 1, "sheet_number": "A1.01", "sheet_title": "FIRST FLOOR PLAN"}},
  ...
]

Use null for any field that cannot be determined. Return ONLY the JSON array."""
        })

        for i, (_, crop_bytes) in enumerate(batch):
            img_base64 = base64.b64encode(crop_bytes).decode('utf-8')
            content.append({
                "type": "text",
                "text": f"Image {i}:"
            })
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{img_base64}"}
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
                    "messages": [{"role": "user", "content": content}],
                    "max_tokens": 2000,
                    "temperature": 0,
                },
                timeout=60.0
            )

            if response.status_code != 200:
                error_msg = f"API request failed: {response.status_code}"
                for original_idx, _ in batch:
                    if results[original_idx] is None:
                        results[original_idx] = {"sheet_number": None, "sheet_title": None, "error": error_msg}
                continue

            result = response.json()
            answer = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            json_match = re.search(r'\[[\s\S]*\]', answer)
            if json_match:
                parsed = json.loads(json_match.group())
                for i, item in enumerate(parsed):
                    if i < len(batch):
                        original_idx = batch[i][0]
                        sheet_number = validate_sheet_number(item.get("sheet_number"))
                        sheet_title = validate_sheet_title(item.get("sheet_title"))
                        results[original_idx] = {
                            "sheet_number": sheet_number,
                            "sheet_title": sheet_title,
                        }
            else:
                for original_idx, _ in batch:
                    if results[original_idx] is None:
                        results[original_idx] = {
                            "sheet_number": None,
                            "sheet_title": None,
                            "error": "Could not parse JSON array from response"
                        }

        except Exception as e:
            error_msg = f"API call failed: {str(e)}"
            for original_idx, _ in batch:
                if results[original_idx] is None:
                    results[original_idx] = {"sheet_number": None, "sheet_title": None, "error": error_msg}

    for i, r in enumerate(results):
        if r is None:
            results[i] = {"sheet_number": None, "sheet_title": None, "error": "Unknown error"}

    return results


def extract_sheet_info(image_path: str, api_key: str | None = None) -> dict:
    """Extract sheet number and title from a single image (convenience wrapper)."""
    results = extract_sheet_info_batch([image_path], api_key, batch_size=1)
    return results[0] if results else {"sheet_number": None, "sheet_title": None, "error": "No result"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python extract_sheet_info_gemini.py <image_path> [image_path2 ...] [--openrouter-key KEY]"}))
        sys.exit(1)

    api_key = None
    image_paths = []

    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--openrouter-key":
            if i + 1 < len(sys.argv):
                api_key = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        else:
            image_paths.append(sys.argv[i])
            i += 1

    if not image_paths:
        print(json.dumps({"error": "No image paths provided"}))
        sys.exit(1)

    if len(image_paths) == 1:
        result = extract_sheet_info(image_paths[0], api_key)
        print(json.dumps(result))
    else:
        results = extract_sheet_info_batch(image_paths, api_key)
        print(json.dumps(results))
