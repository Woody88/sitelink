#!/usr/bin/env python3
"""
Generate reference crop images for annotation training.
Creates visual examples of each class to guide Roboflow annotation.
"""

import sys
sys.path.insert(0, '/home/woodson/.local/lib/python3.10/site-packages')

import fitz
from pathlib import Path

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "reference_crops"
OUTPUT_DIR.mkdir(exist_ok=True)

# Source PDFs
CA_PDF = Path("/home/woodson/Code/projects/sitelink/docs/plans/ca/examples/4-Structural-Drawings.pdf")
DWL_PDF = Path("/home/woodson/Code/projects/sitelink/docs/plans/us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf")

# DPI for rendering (72 = native PDF units)
DPI = 150  # Higher for better quality crops

# Crop specifications: (pdf_path, page_idx, x1, y1, x2, y2, class_name, description)
# Coordinates are in PDF points (72 DPI), will be scaled to render DPI
CROPS = [
    # notes_block examples
    (CA_PDF, 0, 30, 80, 350, 500, "notes_block", "general_notes_ca"),
    (DWL_PDF, 0, 30, 300, 400, 650, "notes_block", "structural_notes_dwl"),

    # schedule_table examples
    (CA_PDF, 0, 580, 80, 830, 200, "schedule_table", "column_schedule_ca"),
    (CA_PDF, 0, 580, 200, 830, 320, "schedule_table", "pile_schedule_ca"),

    # legend_box examples
    (CA_PDF, 0, 360, 400, 550, 520, "legend_box", "slab_legend_ca"),

    # detail_viewport examples
    (CA_PDF, 2, 30, 30, 280, 200, "detail_viewport", "foundation_detail_ca"),

    # grid_bubble examples (existing class, for reference)
    (CA_PDF, 1, 25, 70, 70, 115, "grid_bubble", "letter_bubble_ca"),
    (CA_PDF, 1, 70, 25, 115, 65, "grid_bubble", "number_bubble_ca"),
]

def render_crop(pdf_path, page_idx, x1, y1, x2, y2, class_name, description):
    """Render a crop from PDF and save as PNG."""
    doc = fitz.open(pdf_path)
    page = doc[page_idx]

    # Scale factor from 72 DPI to render DPI
    scale = DPI / 72

    # Create clip rectangle (in PDF points)
    clip = fitz.Rect(x1, y1, x2, y2)

    # Render with clip
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, clip=clip)

    # Save
    output_path = OUTPUT_DIR / f"{class_name}_{description}.png"
    pix.save(str(output_path))

    doc.close()

    print(f"  {output_path.name} ({pix.width}x{pix.height})")
    return output_path

def main():
    print(f"Generating reference crops to: {OUTPUT_DIR}\n")

    for crop in CROPS:
        pdf_path, page_idx, x1, y1, x2, y2, class_name, description = crop

        if not pdf_path.exists():
            print(f"  SKIP: {pdf_path.name} not found")
            continue

        try:
            render_crop(pdf_path, page_idx, x1, y1, x2, y2, class_name, description)
        except Exception as e:
            print(f"  ERROR: {description} - {e}")

    print(f"\nDone! {len(list(OUTPUT_DIR.glob('*.png')))} crops generated.")
    print(f"View at: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
