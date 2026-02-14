#!/usr/bin/env python3
"""
Test schedule extraction pipeline on real structural drawing PDFs.

Renders PDF pages containing schedules, crops schedule regions, sends to LLM,
and evaluates extraction quality.

Usage:
    cd packages/callout-processor-v6-experimental
    OPENROUTER_API_KEY=sk-or-... python3 src/test_schedule_extraction.py

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
    full_page_to_base64,
    render_pdf_page,
)
from extract_schedule import extract_schedule_with_llm

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
PLANS_DIR = PROJECT_ROOT / "docs" / "plans"
OUTPUT_DIR = Path(__file__).parent.parent / "test_schedule_output"


# Known schedule pages with visual display-space bboxes.
# Format: (pdf_path, page_num, schedule_type, bbox_normalized_xywh, description)
# bbox = (x, y, w, h) in 0-1 normalized coordinates on the RENDERED image.
# IMPORTANT: These pages have rotation=90 in the PDF. PyMuPDF text coords
# are in the pre-rotation space, but the rendered image uses display space.
# Bboxes here are measured from visual inspection of the rendered page.
TEST_CASES = [
    # Holabird page 76: Column Schedule (C1-C7, steel columns with base plates)
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 76,
        "type": "column",
        "bbox": (0.71, 0.02, 0.20, 0.11),
        "desc": "Holabird Column Schedule",
    },
    # Holabird page 76: Concrete Pier Schedule (P1 only)
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 76,
        "type": "pier",
        "bbox": (0.71, 0.13, 0.20, 0.05),
        "desc": "Holabird Concrete Pier Schedule",
    },
    # Holabird page 76: Footing Schedule (F1-F6)
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 76,
        "type": "footing",
        "bbox": (0.71, 0.18, 0.20, 0.11),
        "desc": "Holabird Footing Schedule",
    },
    # Holabird page 76: Wall Footing Schedule (WF1-WF6)
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 76,
        "type": "footing",
        "bbox": (0.68, 0.28, 0.24, 0.14),
        "desc": "Holabird Wall Footing Schedule",
    },
    # Holabird page 79: ICF Wall Lintel Schedule (L1-L5)
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 79,
        "type": "generic",
        "bbox": (0.65, 0.26, 0.25, 0.10),
        "desc": "Holabird ICF Wall Lintel Schedule",
    },
    # Holabird page 79: Bearing Plate Schedule (BP1-BP8)
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 79,
        "type": "generic",
        "bbox": (0.67, 0.36, 0.20, 0.14),
        "desc": "Holabird Bearing Plate Schedule",
    },
]

# Full-page tests: send entire page and let LLM find all schedules
FULL_PAGE_TESTS = [
    {
        "pdf": "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf",
        "page": 76,
        "desc": "Holabird page 76 (footing/column/pier) - full page",
    },
]


def run_cropped_test(case: dict, dpi: int = 150) -> dict:
    """Run extraction on a cropped schedule region."""
    pdf_path = str(PLANS_DIR / case["pdf"])
    print(f"\n{'='*60}")
    print(f"TEST: {case['desc']}")
    print(f"  PDF: {case['pdf']}, Page: {case['page']}, DPI: {dpi}")
    print(f"  Type: {case['type']}, BBox: {case['bbox']}")
    print(f"{'='*60}")

    img = render_pdf_page(pdf_path, page_num=case["page"], dpi=dpi)
    print(f"  Rendered page: {img.shape[1]}x{img.shape[0]}")

    crop_result = crop_region_from_array(img, case["bbox"], padding_pct=0.01)
    print(f"  Crop size: {crop_result['width']}x{crop_result['height']}")
    print(f"  Base64 size: {len(crop_result['base64'])} chars (~{len(crop_result['base64'])*3//4//1024} KB)")

    import cv2
    crop_path = OUTPUT_DIR / f"{case['desc'].replace(' ', '_').replace('/', '_')}_{dpi}dpi_crop.png"
    cv2.imwrite(str(crop_path), crop_result["image"])
    print(f"  Crop saved: {crop_path.name}")

    result = extract_schedule_with_llm(
        crop_result["base64"],
        schedule_type=case["type"],
        region_title=case["desc"],
    )

    return _report_result(result, case)


def run_full_page_test(case: dict, dpi: int = 150) -> dict:
    """Run extraction on a full page (LLM identifies schedule regions)."""
    pdf_path = str(PLANS_DIR / case["pdf"])
    print(f"\n{'='*60}")
    print(f"FULL PAGE TEST: {case['desc']}")
    print(f"  PDF: {case['pdf']}, Page: {case['page']}, DPI: {dpi}")
    print(f"{'='*60}")

    img = render_pdf_page(pdf_path, page_num=case["page"], dpi=dpi)
    print(f"  Rendered page: {img.shape[1]}x{img.shape[0]}")

    b64 = full_page_to_base64(img, max_dimension=4096)
    print(f"  Base64 size: {len(b64)} chars (~{len(b64)*3//4//1024} KB)")

    result = extract_schedule_with_llm(
        b64,
        schedule_type="generic",
        region_title="Multiple schedules on structural sheet",
    )

    return _report_result(result, case)


def _report_result(result: dict, case: dict) -> dict:
    """Print and return extraction result."""
    if result.get("error"):
        print(f"\n  ERROR: {result['error']}")
        return {**case, "result": result, "success": False}

    entries = result.get("entries", [])
    print(f"\n  Schedule Type: {result.get('scheduleType')}")
    print(f"  Schedule Title: {result.get('scheduleTitle')}")
    print(f"  Columns: {result.get('columns')}")
    print(f"  Entries: {len(entries)} rows")
    print(f"  Confidence: {result.get('confidence', 0):.2f}")
    print(f"  Latency: {result.get('latencyMs', 0)} ms")
    print(f"  Token Usage: {result.get('tokenUsage', {})}")

    for i, entry in enumerate(entries[:10]):
        mark = entry.get("mark", "?")
        props = entry.get("properties", {})
        prop_str = ", ".join(f"{k}={v}" for k, v in list(props.items())[:4] if v is not None)
        print(f"    [{i}] {mark}: {prop_str}")

    if len(entries) > 10:
        print(f"    ... and {len(entries) - 10} more rows")

    footnotes = result.get("footnotes", [])
    if footnotes:
        print(f"  Footnotes: {len(footnotes)}")
        for fn in footnotes[:3]:
            print(f"    - {fn[:80]}")

    json_path = OUTPUT_DIR / f"{case['desc'].replace(' ', '_').replace('/', '_')}_result.json"
    with open(json_path, "w") as f:
        serializable = {k: v for k, v in result.items() if k != "rawResponse"}
        serializable["rawResponse_length"] = len(result.get("rawResponse", ""))
        json.dump(serializable, f, indent=2)
    print(f"  Result saved: {json_path.name}")

    return {**case, "result": result, "success": True}


def run_dpi_comparison(case: dict) -> dict:
    """Compare extraction at 150 DPI vs 300 DPI for a single case."""
    print(f"\n{'#'*60}")
    print(f"DPI COMPARISON: {case['desc']}")
    print(f"{'#'*60}")

    result_150 = run_cropped_test(case, dpi=150)
    result_300 = run_cropped_test({**case, "desc": case["desc"] + " (300dpi)"}, dpi=300)

    entries_150 = result_150.get("result", {}).get("entries", [])
    entries_300 = result_300.get("result", {}).get("entries", [])
    latency_150 = result_150.get("result", {}).get("latencyMs", 0)
    latency_300 = result_300.get("result", {}).get("latencyMs", 0)

    print(f"\n  DPI COMPARISON SUMMARY:")
    print(f"    150 DPI: {len(entries_150)} entries, {latency_150}ms")
    print(f"    300 DPI: {len(entries_300)} entries, {latency_300}ms")
    print(f"    300 DPI extracted {'more' if len(entries_300) > len(entries_150) else 'same or fewer'} entries")
    print(f"    Latency increase: {latency_300 - latency_150}ms ({((latency_300/max(latency_150,1))-1)*100:.0f}% slower)")

    return {
        "case": case["desc"],
        "entries_150": len(entries_150),
        "entries_300": len(entries_300),
        "latency_150": latency_150,
        "latency_300": latency_300,
    }


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

    all_results = []
    start_time = time.time()

    # Phase 1: Cropped region tests at 150 DPI
    print("\n" + "=" * 60)
    print("PHASE 1: CROPPED REGION EXTRACTION (150 DPI)")
    print("=" * 60)

    for case in TEST_CASES:
        pdf_path = PLANS_DIR / case["pdf"]
        if not pdf_path.exists():
            print(f"\nSKIP: {case['desc']} - PDF not found: {pdf_path}")
            continue
        result = run_cropped_test(case, dpi=150)
        all_results.append(result)

    # Phase 2: DPI comparison on first footing schedule
    print("\n" + "=" * 60)
    print("PHASE 2: DPI COMPARISON (150 vs 300)")
    print("=" * 60)

    footing_cases = [c for c in TEST_CASES if c["type"] == "footing"]
    dpi_results = []
    if footing_cases:
        pdf_path = PLANS_DIR / footing_cases[0]["pdf"]
        if pdf_path.exists():
            dpi_result = run_dpi_comparison(footing_cases[0])
            dpi_results.append(dpi_result)

    # Phase 3: Full page test
    print("\n" + "=" * 60)
    print("PHASE 3: FULL PAGE EXTRACTION")
    print("=" * 60)

    for case in FULL_PAGE_TESTS:
        pdf_path = PLANS_DIR / case["pdf"]
        if not pdf_path.exists():
            print(f"\nSKIP: {case['desc']} - PDF not found")
            continue
        result = run_full_page_test(case, dpi=150)
        all_results.append(result)

    # Summary
    total_time = time.time() - start_time
    print("\n" + "#" * 60)
    print("SUMMARY")
    print("#" * 60)

    successful = [r for r in all_results if r.get("success")]
    failed = [r for r in all_results if not r.get("success")]

    total_entries = 0
    total_latency = 0
    for r in successful:
        entries = r.get("result", {}).get("entries", [])
        total_entries += len(entries)
        total_latency += r.get("result", {}).get("latencyMs", 0)

    print(f"\nTests run: {len(all_results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Total entries extracted: {total_entries}")
    print(f"Total LLM latency: {total_latency}ms")
    print(f"Total wall time: {total_time:.1f}s")

    if successful:
        avg_latency = total_latency / len(successful)
        print(f"Avg latency per extraction: {avg_latency:.0f}ms")

    if dpi_results:
        print(f"\nDPI Comparison:")
        for dr in dpi_results:
            print(f"  {dr['case']}:")
            print(f"    150 DPI: {dr['entries_150']} entries, {dr['latency_150']}ms")
            print(f"    300 DPI: {dr['entries_300']} entries, {dr['latency_300']}ms")

    # Estimate cost (Gemini Flash pricing: ~$0.075/1M input tokens, ~$0.30/1M output tokens)
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
    print(f"Avg cost per schedule: ${est_cost / max(len(successful), 1):.4f}")

    for r in failed:
        print(f"\n  FAILED: {r.get('desc', '?')}: {r.get('result', {}).get('error', 'unknown')}")

    summary_path = OUTPUT_DIR / "summary.json"
    with open(summary_path, "w") as f:
        json.dump({
            "tests_run": len(all_results),
            "successful": len(successful),
            "failed": len(failed),
            "total_entries": total_entries,
            "total_latency_ms": total_latency,
            "total_wall_time_s": round(total_time, 1),
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "estimated_cost_usd": round(est_cost, 6),
            "dpi_comparison": dpi_results,
            "model": model,
        }, f, indent=2)
    print(f"\nSummary saved: {summary_path}")


if __name__ == "__main__":
    main()
