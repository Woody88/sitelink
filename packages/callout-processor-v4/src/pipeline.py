#!/usr/bin/env python3
"""
Callout Detection Pipeline v4

Combines CV-based detection with LLM classification for accurate callout detection.

Pipeline:
1. Pre-filter: LLM determines if sheet should be processed
2. Detection: CV finds circle/triangle candidates
3. Classification: LLM classifies and validates each candidate
"""

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import List, Tuple, Optional, Dict

import cv2
import fitz
import numpy as np

from detect import (
    render_pdf_page,
    find_circles_widened,
    check_interior_density,
    check_has_outline,
    check_is_letter_in_word,
    find_small_triangles_near_circle,
    find_filled_triangles,
    extract_text_inside_circle,
    get_text_search_regions,
    extract_text_from_region,
)
from llm_pipeline import (
    CalloutCandidate,
    ClassifiedCallout,
    SheetTriageResult,
    prefilter_sheet,
    process_sheet_with_llm,
    crop_candidate,
    MODEL_FLASH,
)


def find_candidates(
    image: np.ndarray,
    dpi: int = 300
) -> Tuple[List[CalloutCandidate], Dict]:
    """
    Stage 2: Find callout candidates using CV detection.

    Returns candidates with cropped images for LLM classification.
    """
    scale = dpi / 300.0
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    debug_info = {
        'circles_found': 0,
        'passed_filters': 0,
        'triangles_found': 0,
    }

    candidates = []
    candidate_id = 0

    # Find circles
    circles = find_circles_widened(gray, dpi)
    debug_info['circles_found'] = len(circles)

    for cx, cy, r in circles:
        # Basic filters
        is_valid_interior, whiteness = check_interior_density(gray, cx, cy, r)
        if whiteness < 0.40:
            continue

        has_outline, _ = check_has_outline(gray, cx, cy, r)
        if not has_outline:
            continue

        if check_is_letter_in_word(gray, cx, cy, r):
            continue

        debug_info['passed_filters'] = debug_info.get('passed_filters', 0) + 1

        # Find nearby triangles
        nearby_triangles = find_small_triangles_near_circle(
            gray, cx, cy, r,
            search_margin=int(15 * scale),
            min_tri_area=int(40 * scale**2),
            max_tri_area=int(800 * scale**2)
        )

        has_triangles = len(nearby_triangles) > 0
        triangle_positions = [t['position'] for t in nearby_triangles]

        # OCR the circle
        text, ocr_conf = extract_text_inside_circle(image, cx, cy, r)

        # Crop the candidate
        crop = crop_candidate(image, cx, cy, r, padding=0.5)

        candidates.append(CalloutCandidate(
            id=candidate_id,
            x=cx,
            y=cy,
            radius=r,
            crop_image=crop,
            has_triangles=has_triangles,
            triangle_positions=triangle_positions,
            ocr_text=text,
            ocr_confidence=ocr_conf
        ))
        candidate_id += 1

    # Also find standalone triangles (section cut markers)
    triangles = find_filled_triangles(gray,
                                       min_area=int(300 * scale**2),
                                       max_area=int(8000 * scale**2))
    debug_info['triangles_found'] = len(triangles)

    for tri_x, tri_y, tri_w, tri_h, tri_cnt in triangles:
        # Check if this triangle is already associated with a circle
        tri_cx = tri_x + tri_w // 2
        tri_cy = tri_y + tri_h // 2

        is_near_circle = any(
            np.hypot(tri_cx - c.x, tri_cy - c.y) < c.radius * 2
            for c in candidates
        )

        if is_near_circle:
            continue

        # This is a standalone section cut marker
        # Search for text near the triangle
        regions = get_text_search_regions(tri_x, tri_y, tri_w, tri_h, w, h)

        best_text = None
        best_conf = 0.0

        for region in regions:
            text, conf = extract_text_from_region(
                image, region['x1'], region['y1'], region['x2'], region['y2']
            )
            if text and conf > best_conf:
                best_text = text
                best_conf = conf

        # Crop around the triangle
        pad = 30
        x1 = max(0, tri_x - pad)
        y1 = max(0, tri_y - pad)
        x2 = min(w, tri_x + tri_w + pad)
        y2 = min(h, tri_y + tri_h + pad)
        crop = image[y1:y2, x1:x2].copy()

        # Ensure minimum size
        if crop.shape[0] < 100 or crop.shape[1] < 100:
            scale_up = max(100 / crop.shape[0], 100 / crop.shape[1])
            crop = cv2.resize(crop, None, fx=scale_up, fy=scale_up)

        candidates.append(CalloutCandidate(
            id=candidate_id,
            x=tri_cx,
            y=tri_cy,
            radius=max(tri_w, tri_h) // 2,
            crop_image=crop,
            has_triangles=True,
            triangle_positions=['standalone'],
            ocr_text=best_text,
            ocr_confidence=best_conf
        ))
        candidate_id += 1

    return candidates, debug_info


def process_pdf_with_llm(
    pdf_path: str,
    output_dir: str,
    dpi: int = 300,
    model: str = MODEL_FLASH,
    skip_prefilter: bool = False
):
    """Process PDF using the full LLM pipeline."""
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    num_pages = len(doc)
    doc.close()

    print(f"\n{'='*70}")
    print(f"Callout Pipeline v4 - LLM-Enhanced Detection")
    print(f"{'='*70}")
    print(f"PDF: {pdf_path.name}")
    print(f"Pages: {num_pages}, DPI: {dpi}")
    print(f"Model: {model}")
    print(f"Pre-filter: {'disabled' if skip_prefilter else 'enabled'}")
    print(f"{'='*70}")

    all_results = []

    for page_num in range(num_pages):
        sheet_dir = output_dir / f"sheet-{page_num}"
        sheet_dir.mkdir(exist_ok=True)

        print(f"\n{'='*50}")
        print(f"Sheet {page_num}:")

        # Render page
        image = render_pdf_page(str(pdf_path), page_num, dpi)
        h, w = image.shape[:2]
        print(f"  Rendered: {w}x{h}")

        cv2.imwrite(str(sheet_dir / "source.png"), image)

        # Stage 1: Pre-filter
        if not skip_prefilter:
            triage = prefilter_sheet(image, page_num, model)
            print(f"  Pre-filter: {triage.sheet_type} (is_drawing={triage.is_drawing})")
            print(f"    Reason: {triage.reason}")

            if not triage.is_drawing:
                print(f"  Skipping sheet - not a drawing")
                all_results.append({
                    'sheet': page_num,
                    'width': w,
                    'height': h,
                    'skipped': True,
                    'skip_reason': triage.reason,
                    'sheet_type': triage.sheet_type,
                    'total_callouts': 0,
                })
                continue

        # Stage 2: Find candidates
        print(f"  Finding candidates...")
        candidates, cv_debug = find_candidates(image, dpi)
        print(f"    Circles found: {cv_debug['circles_found']}")
        print(f"    Passed filters: {cv_debug['passed_filters']}")
        print(f"    Triangles found: {cv_debug['triangles_found']}")
        print(f"    Total candidates: {len(candidates)}")

        # Save candidate crops for debugging
        crops_dir = sheet_dir / "candidates"
        crops_dir.mkdir(exist_ok=True)
        for cand in candidates:
            cv2.imwrite(str(crops_dir / f"candidate-{cand.id}.png"), cand.crop_image)

        # Stage 3: Classify with LLM
        print(f"  Classifying with LLM...")
        _, classified = process_sheet_with_llm(
            image, candidates, page_num, model, skip_prefilter=True
        )

        print(f"  Valid callouts: {len(classified)}")

        # Count by type
        type_counts = {}
        for c in classified:
            type_counts[c.callout_type] = type_counts.get(c.callout_type, 0) + 1

        for ctype, count in sorted(type_counts.items()):
            print(f"    {ctype}: {count}")

        # Create annotated image
        annotated = image.copy()
        colors = {
            'detail': (255, 0, 0),      # Blue
            'section': (128, 0, 128),   # Purple
            'elevation': (0, 165, 255), # Orange
            'title': (0, 128, 0),       # Green
            'section_cut': (0, 0, 255), # Red
        }

        # Map classified back to candidates for positions
        cand_map = {c.id: c for c in candidates}

        for cls in classified:
            cand = cand_map.get(cls.candidate_id)
            if not cand:
                continue

            color = colors.get(cls.callout_type, (0, 0, 255))

            # Draw circle or box
            if 'standalone' in cand.triangle_positions:
                # Section cut marker - draw box
                pad = cand.radius
                cv2.rectangle(annotated,
                             (cand.x - pad, cand.y - pad),
                             (cand.x + pad, cand.y + pad),
                             color, 2)
            else:
                cv2.circle(annotated, (cand.x, cand.y), cand.radius, color, 2)

            # Draw label
            label = f"{cls.callout_type[0].upper()}:{cls.label} ({cls.confidence})"
            cv2.putText(annotated, label,
                       (cand.x - cand.radius, cand.y - cand.radius - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        cv2.imwrite(str(sheet_dir / "annotated.png"), annotated)

        # Save markers JSON
        markers = []
        for cls in classified:
            cand = cand_map.get(cls.candidate_id)
            if not cand:
                continue

            markers.append({
                'id': f"marker-{page_num}-{cls.candidate_id}",
                'label': cls.label,
                'type': cls.callout_type,
                'x': float(cand.x / w),
                'y': float(cand.y / h),
                'pixelX': cand.x,
                'pixelY': cand.y,
                'radius': cand.radius,
                'identifier': cls.identifier,
                'viewSheet': cls.view_sheet,
                'confidence': cls.confidence,
                'reason': cls.reason,
                'hasTriangles': cand.has_triangles,
                'trianglePositions': cand.triangle_positions,
            })

        with open(sheet_dir / "markers.json", 'w') as f:
            json.dump(markers, f, indent=2)

        # Print detected callouts
        if classified:
            print(f"  Detected callouts:")
            for cls in classified[:10]:  # Show first 10
                print(f"    [{cls.callout_type}] {cls.label} - {cls.reason}")
            if len(classified) > 10:
                print(f"    ... and {len(classified) - 10} more")

        all_results.append({
            'sheet': page_num,
            'width': w,
            'height': h,
            'skipped': False,
            'candidates_found': len(candidates),
            'callouts_classified': len(classified),
            'by_type': type_counts,
            'total_callouts': len(classified),
        })

    # Save summary
    with open(output_dir / "summary.json", 'w') as f:
        json.dump(all_results, f, indent=2)

    # Print summary
    print(f"\n{'='*70}")
    print("Summary:")

    total_callouts = sum(r.get('total_callouts', 0) for r in all_results)
    skipped = sum(1 for r in all_results if r.get('skipped', False))

    print(f"  Sheets processed: {num_pages - skipped} / {num_pages}")
    print(f"  Sheets skipped: {skipped}")
    print(f"  Total callouts: {total_callouts}")

    # Aggregate by type
    all_types = {}
    for r in all_results:
        for ctype, count in r.get('by_type', {}).items():
            all_types[ctype] = all_types.get(ctype, 0) + count

    for ctype, count in sorted(all_types.items()):
        print(f"    {ctype}: {count}")

    print(f"\nOutput: {output_dir}")
    print("Done!")


def main():
    parser = argparse.ArgumentParser(
        description='Callout Pipeline v4 - LLM-Enhanced Detection'
    )
    parser.add_argument('--pdf', required=True, help='Input PDF file')
    parser.add_argument('--output', required=True, help='Output directory')
    parser.add_argument('--dpi', type=int, default=150, help='Render DPI (default: 150)')
    parser.add_argument('--model', default=MODEL_FLASH,
                        help=f'LLM model (default: {MODEL_FLASH})')
    parser.add_argument('--skip-prefilter', action='store_true',
                        help='Skip pre-filter stage (process all sheets)')

    args = parser.parse_args()

    process_pdf_with_llm(
        args.pdf,
        args.output,
        args.dpi,
        args.model,
        args.skip_prefilter
    )


if __name__ == '__main__':
    main()
