#!/usr/bin/env python3
"""
Simple PDF to images converter.
"""

import argparse
from pathlib import Path

import cv2
import fitz  # PyMuPDF
import numpy as np


def render_pdf_to_images(pdf_path: Path, output_dir: Path, dpi: int = 150):
    """Convert PDF pages to images."""
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    pdf_name = pdf_path.stem.replace(' ', '_').replace('-', '_')

    print(f"\n{pdf_path.name}: {len(doc)} pages")

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Render at specified DPI
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)

        # Convert to numpy array
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)

        # Convert RGB to BGR for OpenCV
        if pix.n == 4:  # RGBA
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:  # RGB
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        # Save image
        image_name = f"{pdf_name}_page_{page_num:02d}.png"
        image_path = output_dir / image_name
        cv2.imwrite(str(image_path), img)

        print(f"  Page {page_num}: {pix.w}x{pix.h} → {image_name}")

    num_pages = len(doc)
    doc.close()
    return num_pages


def main():
    parser = argparse.ArgumentParser(description='Convert PDFs to images')
    parser.add_argument('--pdf-dirs', nargs='+', required=True,
                        help='Directories containing PDFs')
    parser.add_argument('--output', required=True,
                        help='Output directory for images')
    parser.add_argument('--dpi', type=int, default=150,
                        help='Render DPI (default: 150)')

    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Converting PDFs to Images")
    print("=" * 60)

    total_pages = 0

    for pdf_dir in args.pdf_dirs:
        pdf_dir = Path(pdf_dir)
        if not pdf_dir.exists():
            print(f"Warning: {pdf_dir} does not exist")
            continue

        for pdf_path in sorted(pdf_dir.glob("*.pdf")):
            pages = render_pdf_to_images(pdf_path, output_dir, args.dpi)
            total_pages += pages

    print("\n" + "=" * 60)
    print(f"Done! Created {total_pages} images in {output_dir}")
    print("=" * 60)


if __name__ == '__main__':
    main()
