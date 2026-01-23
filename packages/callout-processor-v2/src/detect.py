#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import fitz
import numpy as np

from .detector import detect_candidates, get_crop, Candidate
from .embedder import CalloutEmbedder, load_reference_embeddings, compute_similarity


_ocr = None


def is_valid_callout_text(text: Optional[str]) -> bool:
    """
    Check if extracted text matches a valid callout pattern.
    Used to reject non-callout text like 'TRIGGER SIZE'.
    """
    if not text:
        return True

    text = text.strip().upper()

    if len(text) > 10:
        return False

    if ' ' in text:
        parts = text.split()
        if len(parts) > 2 or any(len(p) > 5 for p in parts):
            return False

    callout_ref = re.compile(r'^(\d{1,2}|[A-Z])\s*/\s*[A-Z]\d{1,2}$')
    if callout_ref.match(text):
        return True

    simple = re.compile(r'^[A-Z0-9]{1,3}$')
    if simple.match(text):
        return True

    return False


def get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    return _ocr


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 300) -> Tuple[np.ndarray, int, int]:
    doc = fitz.open(pdf_path)
    page = doc[page_num]

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)

    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    if pix.n == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)

    doc.close()
    return img, pix.width, pix.height


def get_pdf_page_count(pdf_path: str) -> int:
    doc = fitz.open(pdf_path)
    count = len(doc)
    doc.close()
    return count


def extract_text(crop: np.ndarray) -> Optional[str]:
    try:
        ocr = get_ocr()
        results = ocr.ocr(crop, cls=True)

        if not results or not results[0]:
            return None

        texts = []
        for line in results[0]:
            _, (text, confidence) = line
            if confidence > 0.5:
                texts.append(text.strip())

        if not texts:
            return None

        full_text = ' '.join(texts)

        callout_pattern = re.compile(r'^(\d{1,2})\s*/\s*([A-Z]\d{1,2})$', re.IGNORECASE)
        match = callout_pattern.match(full_text)
        if match:
            return f"{match.group(1)}/{match.group(2).upper()}"

        simple_pattern = re.compile(r'^([A-Z]|\d{1,2})$', re.IGNORECASE)
        if simple_pattern.match(full_text):
            return full_text.upper()

        return full_text if full_text else None

    except Exception:
        return None


def parse_callout_text(text: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None

    ref_pattern = re.compile(r'^(\d{1,2}|[A-Z])\s*/\s*([A-Z]\d{1,2})$', re.IGNORECASE)
    match = ref_pattern.match(text)
    if match:
        callout_number = match.group(1)
        target_sheet = match.group(2).upper()
        return callout_number, target_sheet

    return text, None


def annotate_image(image: np.ndarray, candidates: List[Candidate],
                   markers: list, similarities: dict) -> np.ndarray:
    annotated = image.copy()
    h, w = image.shape[:2]

    for i, cand in enumerate(candidates):
        bbox = cand.bbox
        sim = similarities.get(i, 0)

        is_marker = any(
            abs(m.get('pixelX', 0) - cand.x) < 5 and
            abs(m.get('pixelY', 0) - cand.y) < 5
            for m in markers
        )

        if is_marker:
            color = (0, 0, 255)
            thickness = 2
        else:
            color = (200, 200, 200)
            thickness = 1

        cv2.rectangle(annotated,
                      (bbox['x1'], bbox['y1']),
                      (bbox['x2'], bbox['y2']),
                      color, thickness)

        if sim > 0:
            label = f"{sim:.2f}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.4
            cv2.putText(annotated, label, (bbox['x1'], bbox['y1'] - 5),
                        font, font_scale, color, 1)

    for marker in markers:
        label = marker.get('label', '')
        if not label:
            continue

        px = marker.get('pixelX', int(marker['x'] * w))
        py = marker.get('pixelY', int(marker['y'] * h))

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 2
        (text_w, text_h), _ = cv2.getTextSize(label, font, font_scale, thickness)

        label_x = px + 30
        label_y = py + text_h // 2

        if label_x + text_w > w:
            label_x = max(0, px - text_w - 30)

        cv2.rectangle(annotated,
                      (label_x - 2, label_y - text_h - 2),
                      (label_x + text_w + 2, label_y + 4),
                      (255, 255, 255), -1)

        cv2.putText(annotated, label, (label_x, label_y),
                    font, font_scale, (0, 0, 255), thickness)

    return annotated


def process_pdf(pdf_path: str, output_dir: str, threshold: float = 0.75,
                dpi: int = 300, debug: bool = False) -> dict:
    ref_path = Path(__file__).parent.parent / "reference_embeddings" / "callout_embeddings.npy"
    if not ref_path.exists():
        print(f"Error: Reference embeddings not found at {ref_path}")
        print("Run build_references.py first to generate embeddings.")
        return {"error": "Reference embeddings not found"}

    ref_embeddings = load_reference_embeddings(str(ref_path))
    print(f"Loaded {len(ref_embeddings)} reference embeddings")

    embedder = CalloutEmbedder()

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    try:
        n_pages = get_pdf_page_count(pdf_path)
    except Exception as e:
        print(f"Error loading PDF: {e}")
        return {"error": str(e)}

    print(f"\nEmbedding-based Callout Detection")
    print(f"{'='*60}")
    print(f"PDF: {pdf_path}")
    print(f"Pages: {n_pages}")
    print(f"DPI: {dpi}")
    print(f"Threshold: {threshold}")
    print(f"Debug: {debug}")
    print()

    results = {
        "pdf_path": pdf_path,
        "pages": n_pages,
        "dpi": dpi,
        "threshold": threshold,
        "sheets": []
    }

    for page_num in range(n_pages):
        sheet_id = f"sheet-{page_num}"
        sheet_dir = Path(output_dir) / sheet_id
        sheet_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nProcessing {sheet_id} (page {page_num + 1}/{n_pages})")
        print("-" * 50)

        print(f"Rendering at {dpi} DPI...")
        img_np, width, height = render_pdf_page(pdf_path, page_num, dpi=dpi)
        print(f"Dimensions: {width} x {height}")

        source_path = sheet_dir / "source.png"
        cv2.imwrite(str(source_path), img_np)

        if len(img_np.shape) == 2:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)

        print("Detecting candidates...")
        candidates = detect_candidates(img_np, dpi=dpi)
        print(f"Found {len(candidates)} candidates")

        if debug:
            crops_dir = sheet_dir / "crops"
            crops_dir.mkdir(parents=True, exist_ok=True)

        markers = []
        similarities = {}

        print("Computing embeddings and matching...")
        for i, candidate in enumerate(candidates):
            crop = get_crop(img_np, candidate)

            if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
                continue

            embedding = embedder.embed_image(crop)
            sims = compute_similarity(embedding, ref_embeddings)
            max_sim = float(np.max(sims))
            similarities[i] = max_sim

            if debug:
                crop_filename = f"crop_{i:04d}_sim{max_sim:.3f}.png"
                cv2.imwrite(str(crops_dir / crop_filename), crop)

            if max_sim > threshold:
                text = extract_text(crop)

                if not is_valid_callout_text(text):
                    if debug:
                        print(f"  Skip: crop_{i:04d} passed embedding ({max_sim:.3f}) but invalid text: '{text}'")
                    continue

                callout_number, target_sheet = parse_callout_text(text)

                if text:
                    label = text
                elif callout_number and target_sheet:
                    label = f"{callout_number}/{target_sheet}"
                else:
                    label = "?"

                marker = {
                    "id": f"marker-{sheet_id}-{len(markers)}-{uuid.uuid4().hex[:8]}",
                    "label": label,
                    "calloutNumber": callout_number,
                    "targetSheetRef": target_sheet,
                    "x": float(candidate.x) / width,
                    "y": float(candidate.y) / height,
                    "pixelX": int(candidate.x),
                    "pixelY": int(candidate.y),
                    "bbox": candidate.bbox,
                    "similarity": max_sim,
                    "confidence": candidate.confidence,
                    "source": candidate.source
                }
                markers.append(marker)
                print(f"  Callout: {label} @ ({int(candidate.x)}, {int(candidate.y)}) sim={max_sim:.3f}")

        print(f"Found {len(markers)} callouts above threshold")

        markers_path = sheet_dir / "markers.json"
        with open(markers_path, 'w') as f:
            json.dump(markers, f, indent=2)

        print("Generating annotated image...")
        annotated = annotate_image(img_np, candidates, markers, similarities)
        annotated_path = sheet_dir / "annotated.png"
        cv2.imwrite(str(annotated_path), annotated)

        metadata = {
            "sheetId": sheet_id,
            "pageNumber": page_num + 1,
            "width": width,
            "height": height,
            "dpi": dpi,
            "threshold": threshold,
            "candidatesFound": len(candidates),
            "markersFound": len(markers)
        }
        metadata_path = sheet_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"Saved: {sheet_dir}/")

        results["sheets"].append({
            "sheetId": sheet_id,
            "pageNumber": page_num + 1,
            "width": width,
            "height": height,
            "candidates": len(candidates),
            "markers": len(markers)
        })

    summary_path = Path(output_dir) / "summary.json"
    with open(summary_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSummary saved: {summary_path}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Embedding-based callout detection pipeline"
    )
    parser.add_argument(
        "--pdf", "-p",
        required=True,
        help="Input PDF file"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory"
    )
    parser.add_argument(
        "--threshold", "-t",
        type=float,
        default=0.75,
        help="Similarity threshold (default: 0.75)"
    )
    parser.add_argument(
        "--dpi", "-d",
        type=int,
        default=300,
        help="Render DPI (default: 300)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Save debug images and crops"
    )

    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: PDF not found: {args.pdf}")
        sys.exit(1)

    result = process_pdf(
        pdf_path=str(pdf_path),
        output_dir=args.output,
        threshold=args.threshold,
        dpi=args.dpi,
        debug=args.debug
    )

    if "error" in result:
        print(f"\nError: {result['error']}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("Processing Complete!")
    print("=" * 60)
    for sheet in result.get("sheets", []):
        print(f"  {sheet['sheetId']}: {sheet['width']}x{sheet['height']}")
        print(f"    Candidates: {sheet['candidates']} → Markers: {sheet['markers']}")

    sys.exit(0)


if __name__ == "__main__":
    main()
