#!/usr/bin/env python3
"""
Test notes extraction pipeline on real structural drawing PDFs.

Renders PDF pages, detects notes regions via DocLayout-YOLO, crops them,
sends to LLM for text extraction, and evaluates quality.

Usage:
    cd packages/callout-processor-v6-experimental
    OPENROUTER_API_KEY=sk-or-... python3 src/test_notes_extraction.py

Env vars:
    OPENROUTER_API_KEY  - Required
    OPENROUTER_MODEL    - Optional (default: google/gemini-2.5-flash)
"""

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from crop_region import (
    crop_region_from_array,
    pixel_bbox_to_normalized,
    render_pdf_page,
)
from doclayout_detect import detect_layout_regions
from extract_notes import classify_note_type, extract_notes_with_llm

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
PLANS_DIR = PROJECT_ROOT / "docs" / "plans"
OUTPUT_DIR = Path(__file__).parent.parent / "test_notes_output"

HOLABIRD_PDF = "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf"

STRUCTURAL_PAGES = list(range(70, 85))


def discover_notes_regions(pdf_path: str, pages: list[int], dpi: int = 72) -> list[dict]:
    """Run DocLayout-YOLO on pages to find notes_block regions."""
    all_regions = []

    for page_num in pages:
        try:
            img = render_pdf_page(pdf_path, page_num=page_num, dpi=dpi)
        except ValueError:
            continue

        detections = detect_layout_regions(img, conf=0.25)
        notes_detections = [d for d in detections if d["class"] == "notes_block"]

        if notes_detections:
            img_h, img_w = img.shape[:2]
            for det in notes_detections:
                norm_bbox = pixel_bbox_to_normalized(
                    tuple(det["bbox"]), img_w, img_h
                )
                all_regions.append({
                    "pdf": pdf_path,
                    "page": page_num,
                    "bbox_pixel": det["bbox"],
                    "bbox_norm": norm_bbox,
                    "confidence": det["confidence"],
                    "img_size": (img_w, img_h),
                })
                print(f"  Page {page_num}: notes_block at {det['bbox'][:2]} "
                      f"({det['bbox'][2]:.0f}x{det['bbox'][3]:.0f}px, "
                      f"conf={det['confidence']:.2f})")

    return all_regions


def run_notes_test(region: dict, dpi: int = 150) -> dict:
    """Run extraction on a single detected notes region."""
    pdf_path = region["pdf"]
    page_num = region["page"]
    bbox_norm = region["bbox_norm"]

    print(f"\n{'='*60}")
    print(f"NOTES TEST: Page {page_num}")
    print(f"  BBox (norm): {bbox_norm}")
    print(f"  Detection confidence: {region['confidence']:.2f}")
    print(f"{'='*60}")

    img = render_pdf_page(pdf_path, page_num=page_num, dpi=dpi)
    print(f"  Rendered page at {dpi} DPI: {img.shape[1]}x{img.shape[0]}")

    crop_result = crop_region_from_array(img, bbox_norm, padding_pct=0.01)
    print(f"  Crop size: {crop_result['width']}x{crop_result['height']}")
    print(f"  Base64 size: {len(crop_result['base64'])} chars (~{len(crop_result['base64'])*3//4//1024} KB)")

    import cv2
    crop_filename = f"page{page_num}_notes_{int(bbox_norm[0]*100)}_{int(bbox_norm[1]*100)}_{dpi}dpi.png"
    crop_path = OUTPUT_DIR / crop_filename
    cv2.imwrite(str(crop_path), crop_result["image"])
    print(f"  Crop saved: {crop_filename}")

    result = extract_notes_with_llm(crop_result["base64"])

    return _report_result(result, region)


def _report_result(result: dict, region: dict) -> dict:
    """Print and return extraction result."""
    page_num = region["page"]

    if result.get("error"):
        print(f"\n  ERROR: {result['error']}")
        return {**region, "result": result, "success": False}

    items = result.get("items", [])
    title = result.get("title", "?")
    note_type = result.get("noteType", "?")

    print(f"\n  Note Type: {note_type}")
    print(f"  Title: {title}")
    print(f"  Items: {len(items)}")
    print(f"  Confidence: {result.get('confidence', 0):.2f}")
    print(f"  Latency: {result.get('latencyMs', 0)} ms")
    print(f"  Token Usage: {result.get('tokenUsage', {})}")

    for i, item in enumerate(items[:8]):
        num = item.get("number", "?")
        text = item.get("text", "")
        text_preview = text[:80] + "..." if len(text) > 80 else text

        if item.get("abbreviation"):
            print(f"    [{num}] {item['abbreviation']} → {item.get('definition', '?')}")
        else:
            print(f"    [{num}] {text_preview}")

        sub_items = item.get("subItems", [])
        for sub in sub_items[:3]:
            letter = sub.get("letter", sub.get("roman", "?"))
            sub_text = sub.get("text", "")[:60]
            print(f"         {letter}) {sub_text}")
        if len(sub_items) > 3:
            print(f"         ... and {len(sub_items) - 3} more sub-items")

    if len(items) > 8:
        print(f"    ... and {len(items) - 8} more items")

    json_filename = f"page{page_num}_notes_{note_type}_result.json"
    json_path = OUTPUT_DIR / json_filename
    with open(json_path, "w") as f:
        serializable = {k: v for k, v in result.items() if k != "rawResponse"}
        serializable["rawResponse_length"] = len(result.get("rawResponse", ""))
        serializable["page"] = page_num
        serializable["bbox_norm"] = region["bbox_norm"]
        json.dump(serializable, f, indent=2)
    print(f"  Result saved: {json_filename}")

    return {**region, "result": result, "success": True}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        env_file = PROJECT_ROOT / "packages" / "sitelink-interpreter" / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("OPENROUTER_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    os.environ["OPENROUTER_API_KEY"] = api_key
                    print(f"Loaded API key from {env_file}")
                    break

    if not api_key:
        print("ERROR: Set OPENROUTER_API_KEY env var or ensure packages/sitelink-interpreter/.env exists")
        sys.exit(1)

    model = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.5-flash")
    print(f"Using model: {model}")
    print(f"Output dir: {OUTPUT_DIR}")

    pdf_path = str(PLANS_DIR / HOLABIRD_PDF)
    if not Path(pdf_path).exists():
        print(f"ERROR: PDF not found at {pdf_path}")
        sys.exit(1)

    # Phase 1: Discover notes regions via DocLayout-YOLO
    print("\n" + "=" * 60)
    print("PHASE 1: DISCOVERING NOTES REGIONS (DocLayout-YOLO at 72 DPI)")
    print("=" * 60)

    regions = discover_notes_regions(pdf_path, STRUCTURAL_PAGES, dpi=72)
    print(f"\nFound {len(regions)} notes regions across {len(set(r['page'] for r in regions))} pages")

    if not regions:
        print("No notes regions detected. Exiting.")
        sys.exit(0)

    # Phase 2: Extract notes from each detected region
    print("\n" + "=" * 60)
    print("PHASE 2: LLM NOTES EXTRACTION (150 DPI crops)")
    print("=" * 60)

    all_results = []
    start_time = time.time()

    for region in regions:
        result = run_notes_test(region, dpi=150)
        all_results.append(result)

    # Summary
    total_time = time.time() - start_time
    print("\n" + "#" * 60)
    print("SUMMARY")
    print("#" * 60)

    successful = [r for r in all_results if r.get("success")]
    failed = [r for r in all_results if not r.get("success")]

    total_items = 0
    total_latency = 0
    type_counts = {}
    for r in successful:
        items = r.get("result", {}).get("items", [])
        total_items += len(items)
        total_latency += r.get("result", {}).get("latencyMs", 0)
        note_type = r.get("result", {}).get("noteType", "unknown")
        type_counts[note_type] = type_counts.get(note_type, 0) + 1

    print(f"\nRegions tested: {len(all_results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Total items extracted: {total_items}")
    print(f"Total LLM latency: {total_latency}ms")
    print(f"Total wall time: {total_time:.1f}s")

    if successful:
        avg_latency = total_latency / len(successful)
        print(f"Avg latency per extraction: {avg_latency:.0f}ms")

    print(f"\nNote types found:")
    for nt, count in sorted(type_counts.items()):
        print(f"  {nt}: {count}")

    total_input_tokens = sum(
        r.get("result", {}).get("tokenUsage", {}).get("prompt_tokens", 0)
        for r in successful
    )
    total_output_tokens = sum(
        r.get("result", {}).get("tokenUsage", {}).get("completion_tokens", 0)
        for r in successful
    )
    est_cost = (total_input_tokens * 0.075 / 1_000_000) + (total_output_tokens * 0.30 / 1_000_000)
    print(f"\nToken usage: {total_input_tokens} input, {total_output_tokens} output")
    print(f"Estimated cost: ${est_cost:.4f}")
    if successful:
        print(f"Avg cost per notes block: ${est_cost / len(successful):.4f}")

    for r in failed:
        print(f"\n  FAILED page {r.get('page', '?')}: {r.get('result', {}).get('error', 'unknown')}")

    summary_path = OUTPUT_DIR / "summary.json"
    with open(summary_path, "w") as f:
        json.dump({
            "tests_run": len(all_results),
            "successful": len(successful),
            "failed": len(failed),
            "total_items": total_items,
            "total_latency_ms": total_latency,
            "total_wall_time_s": round(total_time, 1),
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "estimated_cost_usd": round(est_cost, 6),
            "note_types_found": type_counts,
            "model": model,
            "regions": [
                {
                    "page": r["page"],
                    "bbox_norm": r["bbox_norm"],
                    "detection_confidence": r["confidence"],
                    "note_type": r.get("result", {}).get("noteType"),
                    "title": r.get("result", {}).get("title"),
                    "item_count": len(r.get("result", {}).get("items", [])),
                    "extraction_confidence": r.get("result", {}).get("confidence"),
                    "latency_ms": r.get("result", {}).get("latencyMs"),
                    "success": r.get("success", False),
                }
                for r in all_results
            ],
        }, f, indent=2)
    print(f"\nSummary saved: {summary_path}")


if __name__ == "__main__":
    main()
