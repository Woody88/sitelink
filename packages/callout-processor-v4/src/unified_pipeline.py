#!/usr/bin/env python3
"""
Unified YOLO + OCR Pipeline for Callout Detection.

This pipeline combines:
1. YOLO-based object detection (tiled inference for large images)
2. Crop extraction for each detection
3. PaddleOCR for text extraction
4. Label parsing and validation

Output per detection:
{
    "id": "det-0-1",
    "class_name": "detail",
    "bbox": {"x1": 1245, "y1": 892, "x2": 1298, "y2": 945},
    "confidence": 0.87,
    "ocr_text": "10/S2.0",
    "ocr_confidence": 0.92,
    "identifier": "10",
    "view_sheet": "S2.0",
    "standard": "ncs",
    "needs_review": false
}
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any

import cv2
import fitz
import numpy as np
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).parent))

from infer_yolo import tile_inference, full_page_inference, draw_detections, CLASS_NAMES
from standards import (
    is_valid_detail_label,
    is_valid_section_label,
    detect_standard,
    is_rejected_text,
)

_ocr = None


def get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    return _ocr


@dataclass
class Detection:
    id: str
    sheet_index: int
    class_name: str
    bbox: Dict[str, int]
    confidence: float
    ocr_text: Optional[str] = None
    ocr_confidence: float = 0.0
    identifier: Optional[str] = None
    view_sheet: Optional[str] = None
    standard: str = "auto"
    needs_review: bool = False
    crop_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 300) -> np.ndarray:
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
    return img


def crop_detection(image: np.ndarray, bbox: Dict[str, int], padding: int = 10) -> np.ndarray:
    h, w = image.shape[:2]
    x1 = max(0, bbox['x1'] - padding)
    y1 = max(0, bbox['y1'] - padding)
    x2 = min(w, bbox['x2'] + padding)
    y2 = min(h, bbox['y2'] + padding)
    return image[y1:y2, x1:x2]


def ocr_crop(crop: np.ndarray, min_size: int = 100) -> tuple[Optional[str], float]:
    if crop.size == 0 or crop.shape[0] < 5 or crop.shape[1] < 5:
        return None, 0.0

    try:
        h, w = crop.shape[:2]
        if h < min_size or w < min_size:
            scale_factor = max(min_size / h, min_size / w, 2.0)
            crop = cv2.resize(crop, None, fx=scale_factor, fy=scale_factor,
                             interpolation=cv2.INTER_CUBIC)

        ocr = get_ocr()
        result = ocr.ocr(crop, det=True, cls=True)

        if result and result[0]:
            texts = []
            confidences = []
            for line in result[0]:
                if len(line) >= 2 and len(line[1]) >= 2:
                    text, conf = line[1]
                    if conf > 0.3:
                        texts.append(text)
                        confidences.append(conf)

            if texts:
                avg_conf = sum(confidences) / len(confidences)
                combined = ' '.join(texts).strip().upper()
                combined = combined.replace(' / ', '/').replace('/ ', '/').replace(' /', '/')
                return combined, avg_conf
    except Exception as e:
        print(f"    OCR error: {e}")

    return None, 0.0


def parse_callout_label(text: str) -> Dict[str, Optional[str]]:
    import re

    if not text:
        return {'identifier': None, 'view_sheet': None}

    text = text.strip().upper()
    text = re.sub(r'\s+', ' ', text)

    result = {
        'identifier': None,
        'view_sheet': None,
    }

    # Pattern: "3/A5" or "A/S5.1" format
    match = re.match(r'^([A-Z0-9]{1,2})\s*/\s*([A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?)$', text)
    if match:
        result['identifier'] = match.group(1)
        result['view_sheet'] = match.group(2)
        return result

    # Pattern: Simple identifier "1", "2", "A"
    match = re.match(r'^([A-Z]?[0-9]{1,2}|[A-Z])$', text)
    if match:
        result['identifier'] = match.group(1)
        return result

    # Pattern: Two-part "1 A5" or "1 S5.1"
    match = re.match(r'^([A-Z0-9]{1,2})\s+([A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?)$', text)
    if match:
        result['identifier'] = match.group(1)
        result['view_sheet'] = match.group(2)
        return result

    # Fallback
    tokens = re.findall(r'[A-Z0-9]{1,5}', text)
    if tokens:
        result['identifier'] = tokens[0]
        if len(tokens) > 1:
            result['view_sheet'] = tokens[-1]

    return result


def validate_detection(det: Detection, strict: bool = False) -> bool:
    if not det.ocr_text:
        return not strict

    if is_rejected_text(det.ocr_text):
        return False

    if det.class_name in ('detail', 'title'):
        return is_valid_detail_label(det.ocr_text, det.standard)
    elif det.class_name in ('section', 'elevation'):
        return is_valid_section_label(det.ocr_text, det.standard)

    return True


def process_sheet(
    model: YOLO,
    image: np.ndarray,
    sheet_index: int,
    output_dir: Path,
    tile_size: int = 0,
    overlap: float = 0.25,
    conf_threshold: float = 0.25,
    validate: bool = True,
    standard: str = 'auto'
) -> List[Detection]:

    if tile_size <= 0:
        print(f"  Running YOLO full-page inference (no tiling)...")
        raw_detections = full_page_inference(model, image, conf_threshold=conf_threshold)
    else:
        print(f"  Running YOLO tiled inference (tile={tile_size})...")
        raw_detections = tile_inference(
            model, image,
            tile_size=tile_size,
            overlap=overlap,
            conf_threshold=conf_threshold
        )
    print(f"    Found {len(raw_detections)} raw detections")

    crops_dir = output_dir / "crops"
    crops_dir.mkdir(exist_ok=True)

    detections = []

    for i, raw in enumerate(raw_detections):
        det_id = f"det-{sheet_index}-{i}"

        bbox = {
            'x1': raw['x1'],
            'y1': raw['y1'],
            'x2': raw['x2'],
            'y2': raw['y2']
        }

        crop = crop_detection(image, bbox, padding=15)
        crop_filename = f"{det_id}.png"
        crop_path = crops_dir / crop_filename
        cv2.imwrite(str(crop_path), crop)

        ocr_text, ocr_conf = ocr_crop(crop)
        parsed = parse_callout_label(ocr_text or "")

        detected_std = standard
        if parsed['view_sheet']:
            detected_std = detect_standard(parsed['view_sheet'])

        combined_conf = raw['confidence'] * (0.5 + 0.5 * ocr_conf)
        needs_review = combined_conf < 0.7 or ocr_conf < 0.5

        det = Detection(
            id=det_id,
            sheet_index=sheet_index,
            class_name=raw['class_name'],
            bbox=bbox,
            confidence=raw['confidence'],
            ocr_text=ocr_text,
            ocr_confidence=ocr_conf,
            identifier=parsed['identifier'],
            view_sheet=parsed['view_sheet'],
            standard=detected_std if detected_std != 'unknown' else 'auto',
            needs_review=needs_review,
            crop_path=str(crop_path.relative_to(output_dir))
        )

        if validate:
            if not validate_detection(det, strict=False):
                print(f"    Rejected: {det_id} - '{ocr_text}' failed validation")
                continue

        detections.append(det)

    print(f"    Validated {len(detections)} detections")
    return detections


def process_pdf(
    pdf_path: str,
    output_dir: str,
    model_path: str = "weights/callout_detector.pt",
    dpi: int = 72,
    tile_size: int = 0,
    overlap: float = 0.25,
    conf_threshold: float = 0.25,
    validate: bool = True,
    standard: str = 'auto'
) -> Dict[str, Any]:

    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*70}")
    print(f"Unified YOLO + OCR Pipeline")
    print(f"{'='*70}")
    print(f"PDF: {pdf_path.name}")
    print(f"Model: {model_path}")
    print(f"DPI: {dpi}, Tile: {tile_size}, Overlap: {overlap}")
    print(f"Confidence threshold: {conf_threshold}")
    print(f"Standard: {standard}")
    print(f"{'='*70}")

    model = YOLO(model_path)
    print(f"Loaded model with classes: {CLASS_NAMES}")

    doc = fitz.open(str(pdf_path))
    num_pages = len(doc)
    doc.close()
    print(f"PDF has {num_pages} pages")

    all_detections: List[Detection] = []
    sheet_results = []

    for page_num in range(num_pages):
        print(f"\n--- Sheet {page_num} ---")

        sheet_dir = output_dir / f"sheet-{page_num}"
        sheet_dir.mkdir(exist_ok=True)

        print(f"  Rendering page at {dpi} DPI...")
        image = render_pdf_page(str(pdf_path), page_num, dpi)
        h, w = image.shape[:2]
        print(f"    Size: {w}x{h}")

        cv2.imwrite(str(sheet_dir / "source.png"), image)

        detections = process_sheet(
            model, image,
            sheet_index=page_num,
            output_dir=sheet_dir,
            tile_size=tile_size,
            overlap=overlap,
            conf_threshold=conf_threshold,
            validate=validate,
            standard=standard
        )

        annotated = draw_detections(image, [
            {
                'class_name': d.class_name,
                'confidence': d.confidence,
                'x1': d.bbox['x1'],
                'y1': d.bbox['y1'],
                'x2': d.bbox['x2'],
                'y2': d.bbox['y2'],
            }
            for d in detections
        ])
        cv2.imwrite(str(sheet_dir / "annotated.png"), annotated)

        with open(sheet_dir / "detections.json", 'w') as f:
            json.dump([d.to_dict() for d in detections], f, indent=2)

        by_class = {}
        for d in detections:
            by_class[d.class_name] = by_class.get(d.class_name, 0) + 1

        sheet_results.append({
            'sheet_index': page_num,
            'width': w,
            'height': h,
            'total_detections': len(detections),
            'by_class': by_class,
            'needs_review': sum(1 for d in detections if d.needs_review),
        })

        all_detections.extend(detections)

        print(f"  Results:")
        for cls, count in sorted(by_class.items()):
            print(f"    {cls}: {count}")

    summary = {
        'pdf_path': str(pdf_path),
        'model': model_path,
        'dpi': dpi,
        'standard': standard,
        'total_sheets': num_pages,
        'total_detections': len(all_detections),
        'needs_review': sum(1 for d in all_detections if d.needs_review),
        'by_class': {},
        'sheets': sheet_results,
    }

    for d in all_detections:
        summary['by_class'][d.class_name] = summary['by_class'].get(d.class_name, 0) + 1

    with open(output_dir / "summary.json", 'w') as f:
        json.dump(summary, f, indent=2)

    with open(output_dir / "all_detections.json", 'w') as f:
        json.dump([d.to_dict() for d in all_detections], f, indent=2)

    print(f"\n{'='*70}")
    print("Summary:")
    print(f"  Total sheets: {num_pages}")
    print(f"  Total detections: {len(all_detections)}")
    print(f"  Needs review: {summary['needs_review']}")
    for cls, count in sorted(summary['by_class'].items()):
        print(f"    {cls}: {count}")
    print(f"\nOutput: {output_dir}")
    print("Done!")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description='Unified YOLO + OCR Pipeline for Callout Detection'
    )
    parser.add_argument('--pdf', required=True, help='Input PDF file')
    parser.add_argument('--output', required=True, help='Output directory')
    parser.add_argument('--model', default='weights/callout_detector.pt',
                        help='YOLO model weights path (YOLO26 trained on callouts)')
    parser.add_argument('--dpi', type=int, default=72,
                        help='Render DPI (72 recommended - matches training scale, see sitelink-e1z)')
    parser.add_argument('--tile-size', type=int, default=0,
                        help='Tile size for inference (0=full page, recommended at 72 DPI)')
    parser.add_argument('--overlap', type=float, default=0.25, help='Tile overlap fraction')
    parser.add_argument('--conf', type=float, default=0.1, help='Confidence threshold')
    parser.add_argument('--standard', choices=['auto', 'pspc', 'ncs'], default='auto',
                        help='Drawing standard')
    parser.add_argument('--no-validate', action='store_true',
                        help='Skip validation (keep all detections)')

    args = parser.parse_args()

    process_pdf(
        pdf_path=args.pdf,
        output_dir=args.output,
        model_path=args.model,
        dpi=args.dpi,
        tile_size=args.tile_size,
        overlap=args.overlap,
        conf_threshold=args.conf,
        validate=not args.no_validate,
        standard=args.standard
    )


if __name__ == '__main__':
    main()
