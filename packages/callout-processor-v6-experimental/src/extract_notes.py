"""
LLM-based notes text extraction from construction drawing images.

Pipeline: DocLayout-YOLO detects notes region -> crop -> this module -> structured JSON

Supports:
  - General notes (GENERAL NOTES, GENERAL STRUCTURAL NOTES)
  - Concrete notes (CONCRETE NOTES, CONCRETE AND FOUNDATION NOTES)
  - Steel notes (REINFORCING STEEL NOTES, STRUCTURAL STEEL NOTES)
  - Masonry notes (MASONRY NOTES)
  - Abbreviations (ABBREVIATIONS, SYMBOLS & ABBREVIATIONS)
  - Generic fallback for unrecognized note headers

Uses Gemini Flash via OpenRouter (same pattern as extract_schedule.py).
"""

import json
import os
import re
import time
from typing import Optional

import httpx

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "google/gemini-2.5-flash"


def get_config() -> dict:
    return {
        "api_key": os.environ.get("OPENROUTER_API_KEY", ""),
        "model": os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL),
    }


NOTES_EXTRACTION_PROMPT = """You are analyzing a **NOTES BLOCK** from a structural/architectural construction drawing.

**Your task:** Extract all text content from this notes block, preserving the numbered list structure and hierarchy.

**What construction notes look like:**
- A title/header like "GENERAL NOTES", "CONCRETE NOTES", "REINFORCING STEEL NOTES", etc.
- Numbered items (1, 2, 3...) each containing a specification or instruction
- Sub-items under numbered items using letters (a, b, c...) or roman numerals (i, ii, iii...)
- Dense technical text with engineering abbreviations and specifications
- May span multiple columns on the drawing

**Extraction rules:**
1. First, identify the title/header text at the top of the notes block
2. Extract every numbered item with its full text content
3. Preserve sub-item hierarchy (letters a, b, c or roman numerals under numbered items)
4. Preserve exact text — do NOT paraphrase or summarize
5. If text is cut off at edges, include what is visible and note "[text cut off]"
6. Include all specification references (ASTM, ACI, etc.) exactly as shown
7. Combine multi-line text within a single item into one continuous string
8. If the notes block has multiple sections with sub-headers, capture each section

**Return JSON in exactly this format:**
```json
{
  "noteType": "general_notes",
  "title": "GENERAL STRUCTURAL NOTES",
  "items": [
    {
      "number": 1,
      "text": "All concrete shall be 4000 PSI minimum 28-day strength unless noted otherwise."
    },
    {
      "number": 2,
      "text": "Reinforcing steel shall be ASTM A615 Grade 60.",
      "subItems": [
        {"letter": "a", "text": "Minimum cover: 3\" for footings and grade beams."},
        {"letter": "b", "text": "Minimum cover: 1.5\" for walls and columns."}
      ]
    }
  ]
}
```

**Note type classification** — identify from the header text:
- "general_notes" → GENERAL NOTES, GENERAL STRUCTURAL NOTES
- "concrete_notes" → CONCRETE NOTES, CONCRETE AND FOUNDATION NOTES
- "steel_notes" → REINFORCING STEEL NOTES, STRUCTURAL STEEL NOTES, STEEL NOTES
- "masonry_notes" → MASONRY NOTES
- "abbreviations" → ABBREVIATIONS, SYMBOLS & ABBREVIATIONS, SYMBOLS AND ABBREVIATIONS
- "other" → anything else

**Important:**
- Extract EVERY numbered item — do NOT skip any
- Preserve the exact wording from the drawing
- Sub-items should use "letter" for a/b/c and "roman" for i/ii/iii
- Return ONLY the JSON object, no additional text"""


ABBREVIATIONS_PROMPT = """You are analyzing an **ABBREVIATIONS** or **SYMBOLS & ABBREVIATIONS** block from a construction drawing.

**Your task:** Extract all abbreviation definitions as structured data.

**What abbreviation sections look like:**
- A title like "ABBREVIATIONS" or "SYMBOLS & ABBREVIATIONS"
- List of abbreviation-definition pairs, typically formatted as:
  - "CMU - CONCRETE MASONRY UNIT"
  - "E.W. = EACH WAY"
  - "TYP. TYPICAL"
- May be arranged in multiple columns
- May include section symbols mixed with text abbreviations

**Extraction rules:**
1. Extract every abbreviation-definition pair
2. Preserve exact abbreviation text (including periods, slashes)
3. Preserve exact definition text
4. Handle multi-column layouts — read left column first, then right
5. Skip graphical symbols (hatches, line types) — those belong in legends, not abbreviations

**Return JSON in exactly this format:**
```json
{
  "noteType": "abbreviations",
  "title": "ABBREVIATIONS",
  "items": [
    {"number": 1, "text": "CMU - CONCRETE MASONRY UNIT", "abbreviation": "CMU", "definition": "CONCRETE MASONRY UNIT"},
    {"number": 2, "text": "E.W. - EACH WAY", "abbreviation": "E.W.", "definition": "EACH WAY"}
  ]
}
```

**Important:**
- Extract EVERY abbreviation pair — do NOT skip any
- Keep the full "text" field as the raw line text
- Also split into "abbreviation" and "definition" fields
- Return ONLY the JSON object, no additional text"""


NOTE_TYPE_PATTERNS = {
    "general_notes": [
        r"general\s*(structural\s*)?notes",
        r"general\s*notes",
    ],
    "concrete_notes": [
        r"concrete\s*(and\s*foundation\s*)?notes",
        r"concrete\s*notes",
        r"foundation\s*(and\s*slab\s*)?(on\s*grade\s*)?notes",
        r"concrete\s*continued",
    ],
    "steel_notes": [
        r"reinforc(ing|ement)\s*steel\s*notes",
        r"structural\s*steel\s*notes",
        r"steel\s*notes",
    ],
    "masonry_notes": [
        r"masonry\s*notes",
    ],
    "abbreviations": [
        r"symbols?\s*(&|and)\s*abbreviations?",
        r"abbreviations?",
    ],
}


def classify_note_type(title: str) -> str:
    title_lower = title.lower().strip()
    for note_type, patterns in NOTE_TYPE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, title_lower):
                return note_type
    return "other"


def _parse_json_response(text: str) -> Optional[dict]:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
    elif cleaned.startswith("```"):
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]

    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                return None
    return None


def extract_notes_with_llm(
    image_b64: str,
    mime_type: str = "image/png",
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    """
    Send a cropped notes image to LLM and extract structured text content.

    Args:
        image_b64: Base64-encoded image of the notes region.
        mime_type: Image MIME type.
        api_key: OpenRouter API key (falls back to env var).
        model: Model to use (falls back to env var or default).

    Returns:
        dict with keys:
            - "noteType": classified type (general_notes, concrete_notes, etc.)
            - "title": header text from the notes block
            - "items": list of {number, text, subItems?} dicts
            - "rawResponse": raw LLM response text
            - "confidence": float 0-1 (based on parsing success)
            - "latencyMs": LLM call time in milliseconds
            - "error": error message if failed, else None
    """
    config = get_config()
    api_key = api_key or config["api_key"]
    model = model or config["model"]

    if not api_key:
        return {"error": "No OPENROUTER_API_KEY configured", "items": []}

    prompt = NOTES_EXTRACTION_PROMPT
    image_url = f"data:{mime_type};base64,{image_b64}"

    start = time.time()

    try:
        response = httpx.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sitelink.dev",
                "X-Title": "Sitelink Notes Extraction",
            },
            json={
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    }
                ],
                "temperature": 0,
                "max_tokens": 8192,
            },
            timeout=120.0,
        )

        latency_ms = int((time.time() - start) * 1000)

        if response.status_code != 200:
            return {
                "error": f"API error {response.status_code}: {response.text[:200]}",
                "items": [],
                "latencyMs": latency_ms,
            }

        result = response.json()
        raw_text = result["choices"][0]["message"]["content"]
        usage = result.get("usage", {})

        parsed = _parse_json_response(raw_text)

        if parsed is None:
            return {
                "error": "Failed to parse JSON from LLM response",
                "rawResponse": raw_text[:500],
                "items": [],
                "latencyMs": latency_ms,
            }

        items = parsed.get("items", [])
        title = parsed.get("title", "")
        note_type = parsed.get("noteType", "")

        if title and not note_type:
            note_type = classify_note_type(title)
        elif not note_type:
            note_type = "other"

        if note_type == "abbreviations" and items:
            has_abbrev_fields = any(
                item.get("abbreviation") and item.get("definition")
                for item in items
            )
            if not has_abbrev_fields:
                prompt = ABBREVIATIONS_PROMPT
                start2 = time.time()
                response2 = httpx.post(
                    OPENROUTER_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://sitelink.dev",
                        "X-Title": "Sitelink Notes Extraction",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {"type": "image_url", "image_url": {"url": image_url}},
                                ],
                            }
                        ],
                        "temperature": 0,
                        "max_tokens": 8192,
                    },
                    timeout=120.0,
                )
                latency_ms += int((time.time() - start2) * 1000)
                if response2.status_code == 200:
                    result2 = response2.json()
                    raw_text2 = result2["choices"][0]["message"]["content"]
                    parsed2 = _parse_json_response(raw_text2)
                    if parsed2 and parsed2.get("items"):
                        items = parsed2["items"]
                        usage2 = result2.get("usage", {})
                        usage = {
                            "prompt_tokens": usage.get("prompt_tokens", 0) + usage2.get("prompt_tokens", 0),
                            "completion_tokens": usage.get("completion_tokens", 0) + usage2.get("completion_tokens", 0),
                        }

        confidence = 1.0
        if len(items) == 0:
            confidence = 0.3
        else:
            valid_items = sum(1 for item in items if item.get("text"))
            numbered_items = sum(1 for item in items if item.get("number") is not None)
            if len(items) > 0:
                confidence = min(1.0, (valid_items + numbered_items) / (2 * len(items)))

        return {
            "noteType": note_type,
            "title": title,
            "items": items,
            "rawResponse": raw_text,
            "confidence": confidence,
            "latencyMs": latency_ms,
            "tokenUsage": usage,
            "error": None,
        }

    except httpx.TimeoutException:
        latency_ms = int((time.time() - start) * 1000)
        return {
            "error": "LLM request timed out",
            "items": [],
            "latencyMs": latency_ms,
        }
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        return {
            "error": f"LLM call failed: {str(e)}",
            "items": [],
            "latencyMs": latency_ms,
        }
