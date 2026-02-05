#!/usr/bin/python3
"""
Render ALL pages from construction drawing PDFs at 150 DPI to PNG for Roboflow annotation.

Uses PyMuPDF (fitz) to render each page. Outputs to rendered_pages/ with a manifest.json.
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    import fitz
except ImportError:
    print("ERROR: PyMuPDF not installed. Run: pip install PyMuPDF")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
PLANS_BASE = Path("/home/woodson/Code/projects/sitelink/docs/plans")
OUTPUT_DIR = SCRIPT_DIR / "rendered_pages"
DPI = 150

PDF_SOURCES = [
    ("ca_4-Structural-Drawings", "ca/examples/4-Structural-Drawings.pdf"),
    ("ca_4-Structural-Drawings-4pages", "ca/examples/4-Structural-Drawings - 4pages.pdf"),
    ("us_dwl_ATTACHMENT_11_STRUCTURAL", "us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf"),
    ("us_rinker_Rinker_050", "us/examples/structural/rinker/Rinker_050.pdf"),
    ("us_rinker_Rinker_051", "us/examples/structural/rinker/Rinker_051.pdf"),
    ("us_rinker_Rinker_052", "us/examples/structural/rinker/Rinker_052.pdf"),
    ("us_rinker_Rinker_053", "us/examples/structural/rinker/Rinker_053.pdf"),
    ("us_rinker_Rinker_054", "us/examples/structural/rinker/Rinker_054.pdf"),
    ("us_rinker_Rinker_055", "us/examples/structural/rinker/Rinker_055.pdf"),
    ("us_rinker_Rinker_056", "us/examples/structural/rinker/Rinker_056.pdf"),
    ("us_rinker_Rinker_057", "us/examples/structural/rinker/Rinker_057.pdf"),
    ("us_rinker_Rinker_059", "us/examples/structural/rinker/Rinker_059.pdf"),
    ("us_RTA_DRAWINGS_VOL1_US_PLAN", "us/examples/RTA_DRAWINGS_VOL1_US_PLAN.pdf"),
    ("us_Architectural-Structural-Holabird-Bid-Set-Drawings", "us/examples/Architectural-Structural-Holabird-Bid-Set-Drawings.pdf"),
]


def render_pdf(prefix: str, rel_path: str) -> list[dict]:
    pdf_path = PLANS_BASE / rel_path
    if not pdf_path.exists():
        print(f"WARNING: {pdf_path} not found, skipping.")
        return []

    doc = fitz.open(str(pdf_path))
    total = len(doc)
    mat = fitz.Matrix(DPI / 72, DPI / 72)
    rendered = []

    for page_num in range(total):
        filename = f"{prefix}_{page_num:03d}.png"
        out_path = OUTPUT_DIR / filename
        print(f"Rendering {rel_path} page {page_num + 1}/{total}...")

        page = doc[page_num]
        pix = page.get_pixmap(matrix=mat)
        pix.save(str(out_path))

        rendered.append({
            "filename": filename,
            "source_pdf": rel_path,
            "page": page_num,
            "width": pix.width,
            "height": pix.height,
        })

    doc.close()
    return rendered


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    start = time.time()
    all_files: list[dict] = []
    per_pdf_counts: list[tuple[str, int]] = []

    for prefix, rel_path in PDF_SOURCES:
        rendered = render_pdf(prefix, rel_path)
        all_files.extend(rendered)
        per_pdf_counts.append((rel_path, len(rendered)))

    manifest = {
        "dpi": DPI,
        "total_pages": len(all_files),
        "files": all_files,
    }
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    total_bytes = sum(
        os.path.getsize(OUTPUT_DIR / entry["filename"])
        for entry in all_files
        if (OUTPUT_DIR / entry["filename"]).exists()
    )
    elapsed = time.time() - start

    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total pages rendered: {len(all_files)}")
    print(f"Total file size:      {total_bytes / (1024 * 1024):.1f} MB")
    print(f"Time elapsed:         {elapsed:.1f}s")
    print(f"\nPer-PDF counts:")
    for rel_path, count in per_pdf_counts:
        print(f"  {count:4d}  {rel_path}")
    print(f"\nManifest written to: {manifest_path}")
    print(f"Output directory:    {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
