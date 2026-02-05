#!/usr/bin/python3
"""
POC: Test DocLayout-YOLO on construction structural drawings.
Validates if pre-trained document layout model works for our use case.

DocLayout-YOLO is trained on DocStructBench and can detect:
- Title, Plain Text, Abandoned Text
- Figure, Figure Caption
- Table, Table Caption, Table Footnote
- Isolated Formula, Formula Caption

We map these to our Sitelink classes:
- Table -> schedule_table
- Plain Text -> notes_block (with size filtering)
- Figure -> detail_viewport_candidate
- Title -> title_candidate
"""

import os
# Disable xet download to work around network issues
os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"

from pathlib import Path
import sys
import json

try:
    from doclayout_yolo import YOLOv10
except ImportError:
    print("ERROR: doclayout-yolo not installed.")
    print("Run: pip install doclayout-yolo")
    sys.exit(1)

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF not installed.")
    print("Run: pip install PyMuPDF")
    sys.exit(1)

# DocStructBench classes (10 classes)
CLASS_NAMES = [
    "Title",           # 0
    "Plain Text",      # 1 -> maps to notes_block
    "Abandoned Text",  # 2
    "Figure",          # 3 -> may capture detail_viewport
    "Figure Caption",  # 4
    "Table",           # 5 -> maps to schedule_table
    "Table Caption",   # 6
    "Table Footnote",  # 7
    "Isolated Formula",# 8
    "Formula Caption"  # 9
]

# Our mapping to Sitelink classes
SITELINK_MAPPING = {
    "Table": "schedule_table",
    "Plain Text": "notes_block",
    "Figure": "detail_viewport_candidate",
    "Title": "title_candidate",
}

OUTPUT_DIR = Path("poc_doclayout_results")


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 150) -> tuple[Path, int, int]:
    """Render PDF page to PNG image."""
    doc = fitz.open(pdf_path)

    if page_num >= len(doc):
        doc.close()
        raise ValueError(f"Page {page_num} does not exist. PDF has {len(doc)} pages.")

    page = doc[page_num]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    # Save to temp file for model input
    pdf_name = Path(pdf_path).stem.replace(" ", "_")
    temp_path = OUTPUT_DIR / f"temp_{pdf_name}_page{page_num:02d}.png"
    pix.save(str(temp_path))

    width, height = pix.width, pix.height
    doc.close()

    return temp_path, width, height


def filter_for_sitelink(detections: list[dict], img_width: int, img_height: int) -> list[dict]:
    """Filter detections to classes relevant for Sitelink provenance."""
    filtered = []

    for det in detections:
        cls_name = det['class_name']
        x1, y1, x2, y2 = det['bbox']
        w = x2 - x1
        h = y2 - y1
        conf = det['confidence']

        # Skip low confidence detections
        if conf < 0.3:
            continue

        sitelink_class = SITELINK_MAPPING.get(cls_name)
        if not sitelink_class:
            continue

        # Apply class-specific size filters
        if sitelink_class == "notes_block":
            # Only large text blocks are notes (filter out small text)
            if w < 200 or h < 100:
                continue

        elif sitelink_class == "detail_viewport_candidate":
            # Medium-sized figures may be detail viewports
            # Filter out very small or very large figures
            if w < 100 or h < 100:
                continue
            if w > img_width * 0.8 or h > img_height * 0.8:
                continue

        elif sitelink_class == "schedule_table":
            # Accept most tables but filter tiny ones
            if w < 80 or h < 40:
                continue

        det['sitelink_class'] = sitelink_class
        filtered.append(det)

    return filtered


def test_on_pdf(pdf_path: str, pages: list[int], model) -> dict:
    """Test DocLayout-YOLO on specific PDF pages."""
    pdf_name = Path(pdf_path).stem
    results_summary = {
        'pdf': pdf_path,
        'pages': {}
    }

    for page_num in pages:
        print(f"\n{'='*60}")
        print(f"Testing: {pdf_name} - Page {page_num}")
        print('='*60)

        try:
            # Render page
            img_path, width, height = render_pdf_page(pdf_path, page_num)
            print(f"Image size: {width}x{height}")
        except ValueError as e:
            print(f"ERROR: {e}")
            continue

        # Run inference
        results = model.predict(
            str(img_path),
            imgsz=1024,
            conf=0.2,
            device="cuda:0"  # Use GPU if available
        )

        # Save annotated image
        annotated = results[0].plot(line_width=3, font_size=15)
        output_path = OUTPUT_DIR / f"{pdf_name.replace(' ', '_')}_page{page_num:02d}_detected.png"

        # Handle both numpy array and PIL Image returns
        if hasattr(annotated, 'save'):
            annotated.save(str(output_path))
        else:
            import cv2
            cv2.imwrite(str(output_path), annotated)
        print(f"Saved: {output_path}")

        # Extract detections
        detections = []
        for box in results[0].boxes:
            cls_id = int(box.cls)
            cls_name = CLASS_NAMES[cls_id]
            conf = float(box.conf)
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detections.append({
                'class_id': cls_id,
                'class_name': cls_name,
                'confidence': conf,
                'bbox': [x1, y1, x2, y2]
            })

        # Print all detections
        print("\nAll Detections:")
        class_counts = {}
        for det in detections:
            cls_name = det['class_name']
            conf = det['confidence']
            x1, y1, x2, y2 = det['bbox']
            sitelink_class = SITELINK_MAPPING.get(cls_name, "other")
            print(f"  {cls_name:20s} ({sitelink_class:25s}) conf={conf:.2f} bbox=[{x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f}]")

            class_counts[cls_name] = class_counts.get(cls_name, 0) + 1

        # Filter for Sitelink-relevant detections
        sitelink_detections = filter_for_sitelink(detections, width, height)

        print(f"\nSitelink-Relevant Detections (filtered):")
        sitelink_counts = {}
        for det in sitelink_detections:
            sitelink_class = det['sitelink_class']
            conf = det['confidence']
            x1, y1, x2, y2 = det['bbox']
            w = x2 - x1
            h = y2 - y1
            print(f"  {sitelink_class:25s} conf={conf:.2f} size={w:.0f}x{h:.0f}")

            sitelink_counts[sitelink_class] = sitelink_counts.get(sitelink_class, 0) + 1

        # Summary
        print(f"\nSummary:")
        print(f"  Total detections: {len(detections)}")
        print(f"  Sitelink-relevant: {len(sitelink_detections)}")
        print(f"  Class breakdown: {class_counts}")
        print(f"  Sitelink breakdown: {sitelink_counts}")

        results_summary['pages'][page_num] = {
            'image_size': [width, height],
            'total_detections': len(detections),
            'sitelink_detections': len(sitelink_detections),
            'class_counts': class_counts,
            'sitelink_counts': sitelink_counts,
            'detections': detections,
            'sitelink_detections_filtered': sitelink_detections
        }

    return results_summary


def get_model_path() -> str:
    """Get the path to the DocLayout-YOLO model, downloading if necessary."""
    from huggingface_hub import hf_hub_download

    filepath = hf_hub_download(
        repo_id="juliozhao/DocLayout-YOLO-DocStructBench",
        filename="doclayout_yolo_docstructbench_imgsz1024.pt"
    )
    return filepath


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Load pre-trained model
    print("Loading DocLayout-YOLO model...")
    print("(This downloads the model on first run, ~40MB)")

    try:
        # Get model path from HuggingFace Hub cache
        model_path = get_model_path()
        print(f"Model path: {model_path}")

        # Load model directly from weights file
        model = YOLOv10(model_path)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"ERROR loading model: {e}")
        import traceback
        traceback.print_exc()
        print("\nTroubleshooting:")
        print("1. Ensure you have CUDA/GPU support or use CPU")
        print("2. Try: pip install --upgrade doclayout-yolo huggingface_hub")
        sys.exit(1)

    # Test PDFs with specific pages containing our target elements
    test_cases = [
        # CA Structural - has notes, schedules, details
        ("/home/woodson/Code/projects/sitelink/docs/plans/ca/examples/4-Structural-Drawings.pdf",
         [0, 1, 2]),  # Multiple pages to test

        # DWL Structural - has notes, schedules
        ("/home/woodson/Code/projects/sitelink/docs/plans/us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf",
         [0, 1, 5]),  # First pages and a middle page
    ]

    all_results = []

    for pdf_path, pages in test_cases:
        if Path(pdf_path).exists():
            results = test_on_pdf(pdf_path, pages, model)
            all_results.append(results)
        else:
            print(f"\nSKIP: {pdf_path} not found")

    # Save results summary
    summary_path = OUTPUT_DIR / "poc_summary.json"
    with open(summary_path, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved summary: {summary_path}")

    # Print overall assessment
    print(f"\n{'='*60}")
    print("POC ASSESSMENT")
    print('='*60)

    total_tables = 0
    total_notes = 0
    total_figures = 0

    for result in all_results:
        for page_num, page_data in result['pages'].items():
            counts = page_data.get('sitelink_counts', {})
            total_tables += counts.get('schedule_table', 0)
            total_notes += counts.get('notes_block', 0)
            total_figures += counts.get('detail_viewport_candidate', 0)

    print(f"\nTotal Sitelink-relevant detections across all test pages:")
    print(f"  schedule_table: {total_tables}")
    print(f"  notes_block: {total_notes}")
    print(f"  detail_viewport_candidate: {total_figures}")

    print(f"\nResults saved to: {OUTPUT_DIR}/")
    print("Review the *_detected.png files to evaluate detection quality.")
    print("\nSuccess criteria:")
    print("  - Tables (schedules): >=80% of visible tables detected")
    print("  - Notes blocks: Major notes sections detected")
    print("  - False positives: <20% of detections are spurious")


if __name__ == "__main__":
    main()
