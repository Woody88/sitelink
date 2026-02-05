#!/usr/bin/env python3
"""Generate full page images from PDFs for annotation reference."""

import sys
sys.path.insert(0, '/home/woodson/.local/lib/python3.10/site-packages')

import fitz
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / "reference_crops" / "full_pages"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PDFS = [
    ("/home/woodson/Code/projects/sitelink/docs/plans/ca/examples/4-Structural-Drawings.pdf", "ca_structural"),
    ("/home/woodson/Code/projects/sitelink/docs/plans/us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf", "dwl_structural"),
]

DPI = 150

def main():
    for pdf_path, prefix in PDFS:
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            print(f"SKIP: {pdf_path}")
            continue

        doc = fitz.open(pdf_path)
        print(f"\n{pdf_path.name} ({len(doc)} pages)")

        for i, page in enumerate(doc):
            mat = fitz.Matrix(DPI / 72, DPI / 72)
            pix = page.get_pixmap(matrix=mat)
            out = OUTPUT_DIR / f"{prefix}_page_{i:02d}.png"
            pix.save(str(out))
            print(f"  Page {i}: {out.name} ({pix.width}x{pix.height})")

        doc.close()

if __name__ == "__main__":
    main()
