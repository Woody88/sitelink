#!/usr/bin/env python3
"""
Convert PDFs to individual PNG images for Roboflow upload.
Each page becomes a separate PNG file.
"""

import fitz  # PyMuPDF
import cv2
import numpy as np
from pathlib import Path
import sys


def pdf_to_pngs(pdf_path, output_dir, dpi=150):
    """Convert each PDF page to a separate PNG file."""
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Clean filename for directory name
    pdf_name = pdf_path.stem.replace(' ', '_').replace('-', '_')

    doc = fitz.open(str(pdf_path))
    image_paths = []

    print(f"\nProcessing: {pdf_path.name}")
    print(f"Pages: {len(doc)}")
    print(f"Output: {output_dir}/")
    print()

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Render at specified DPI
        mat = fitz.Matrix(dpi/72, dpi/72)
        pix = page.get_pixmap(matrix=mat)

        # Convert to numpy array
        img_data = pix.tobytes("ppm")
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Save with clear naming: pdfname_page001.png
        img_filename = f"{pdf_name}_page{page_num + 1:03d}.png"
        img_path = output_dir / img_filename
        cv2.imwrite(str(img_path), img)
        image_paths.append(str(img_path))

        print(f"  ✓ Page {page_num + 1}/{len(doc)}: {img_filename} ({pix.width}x{pix.height})")

    doc.close()
    print(f"\n✓ Converted {len(image_paths)} pages from {pdf_path.name}\n")
    return image_paths


def main():
    output_base = Path("roboflow_upload_images")

    # US PDFs (remaining to convert)
    us_dir = Path("/mnt/c/Users/Woodson/Downloads/plans/us/")
    us_pdfs = [
        "2022-02-28-NAPLES-AOB-CONSTRUCTION-DRAWINGS.pdf",
        "FM-Chancellors-Residence-Partial-Renovation-Drawings-Bid-Set.pdf",
        "FM22314_ITB_Drawings.pdf",
        "ML13219A203.pdf",
        "grandview.pdf"
    ]

    # CA PDFs (new)
    ca_dir = Path("/mnt/c/Users/Woodson/Downloads/plans/ca/")
    ca_pdfs = [
        "Addendum-1B.pdf",
        "Architectural.pdf"
    ]

    print("="*70)
    print("PDF TO PNG CONVERSION FOR ROBOFLOW UPLOAD")
    print("="*70)

    total_pages = 0

    print("\nUS PDFs (5 remaining):")
    for pdf_name in us_pdfs:
        pdf_path = us_dir / pdf_name
        if not pdf_path.exists():
            print(f"⚠️  Not found: {pdf_name}")
            continue

        image_paths = pdf_to_pngs(pdf_path, output_base, dpi=150)
        total_pages += len(image_paths)

    print("\nCA PDFs (2 new):")
    for pdf_name in ca_pdfs:
        pdf_path = ca_dir / pdf_name
        if not pdf_path.exists():
            print(f"⚠️  Not found: {pdf_name}")
            continue

        image_paths = pdf_to_pngs(pdf_path, output_base, dpi=150)
        total_pages += len(image_paths)

    print("="*70)
    print(f"COMPLETE: {total_pages} NEW images added")
    print(f"Location: {output_base.absolute()}")
    print("="*70)
    print()
    print("Next steps:")
    print("1. Upload all PNG files to Roboflow project")
    print("2. Use SAM auto-annotation for initial labels")
    print("3. Review and correct annotations")
    print("4. Export as dataset_v8 with 3x augmentation")


if __name__ == "__main__":
    main()
