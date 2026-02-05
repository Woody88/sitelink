#!/usr/bin/python3
"""
POC: Test YOLOE-26 text-prompted detection for document layout regions.

Compares against DocLayout-YOLO results to see if zero-shot text prompts
can detect schedule tables, notes blocks, legend boxes, and detail viewports
on construction structural drawings.

This uses the SAME test PDFs as test_doclayout_yolo.py for direct comparison.
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF not installed. Run: pip install PyMuPDF")
    sys.exit(1)

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

# Add src to path for sahi_tiling
sys.path.insert(0, str(Path(__file__).parent / "src"))

OUTPUT_DIR = Path("poc_yoloe_layout_results")

# Colors for each class
COLORS = {
    'schedule_table': (0, 255, 0),    # Green
    'notes_block': (255, 165, 0),     # Orange
    'legend_box': (255, 0, 255),      # Magenta
    'detail_viewport': (0, 0, 255),   # Red
}


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 150) -> tuple:
    """Render PDF page to image array and save PNG."""
    doc = fitz.open(pdf_path)

    if page_num >= len(doc):
        doc.close()
        raise ValueError(f"Page {page_num} does not exist. PDF has {len(doc)} pages.")

    page = doc[page_num]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    # Convert to numpy array (RGB)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = img[:, :, :3]

    # Convert RGB to BGR for OpenCV
    img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    # Save source image
    pdf_name = Path(pdf_path).stem.replace(" ", "_")
    temp_path = OUTPUT_DIR / f"temp_{pdf_name}_page{page_num:02d}.png"
    cv2.imwrite(str(temp_path), img_bgr)

    width, height = pix.width, pix.height
    doc.close()

    return str(temp_path), img_bgr, width, height


def draw_detections(image: np.ndarray, detections: list, output_path: str):
    """Draw detection boxes on image and save."""
    vis = image.copy()

    for det in detections:
        x, y, w, h = det['bbox']
        x, y, w, h = int(x), int(y), int(w), int(h)
        cls = det['callout_type']
        conf = det['confidence']

        color = COLORS.get(cls, (255, 255, 255))
        cv2.rectangle(vis, (x, y), (x + w, y + h), color, 3)

        label = f"{cls}: {conf:.2f}"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
        cv2.rectangle(vis, (x, y - label_size[1] - 10), (x + label_size[0], y), color, -1)
        cv2.putText(vis, label, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    cv2.imwrite(output_path, vis)


def test_yoloe_on_pdf(pdf_path: str, pages: list, model, prompts: dict) -> dict:
    """Test YOLOE text-prompted detection on specific PDF pages."""
    pdf_name = Path(pdf_path).stem

    callout_types = prompts["callout_types"]
    class_names = list(callout_types.keys())

    # Build text descriptions
    text_descriptions = []
    for ct in class_names:
        if "text_prompt" in callout_types[ct]:
            text_descriptions.append(callout_types[ct]["text_prompt"])
        else:
            text_descriptions.append(callout_types[ct].get("name", ct))

    # Set classes with text prompts
    print(f"Setting classes: {class_names}")
    model.set_classes(class_names, model.get_text_pe(text_descriptions))

    results_summary = {
        'pdf': pdf_path,
        'pages': {}
    }

    for page_num in pages:
        print(f"\n{'='*60}")
        print(f"YOLOE Text-Prompt: {pdf_name} - Page {page_num}")
        print('='*60)

        try:
            img_path, img_bgr, width, height = render_pdf_page(pdf_path, page_num)
            print(f"Image size: {width}x{height}")
        except ValueError as e:
            print(f"ERROR: {e}")
            continue

        # Run inference - try both with and without SAHI tiling
        # First: direct inference (full image)
        print("\n--- Direct inference (full image) ---")
        results = model.predict(
            img_path,
            conf=0.1,
            iou=0.5,
            verbose=False,
            device="cuda:0"
        )

        detections = []
        if results and len(results) > 0:
            result = results[0]
            if hasattr(result, 'boxes') and result.boxes is not None:
                for i in range(len(result.boxes)):
                    box = result.boxes[i]
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    cls_name = class_names[cls_id] if cls_id < len(class_names) else "unknown"

                    detections.append({
                        'bbox': [float(x1), float(y1), float(x2 - x1), float(y2 - y1)],
                        'confidence': conf,
                        'callout_type': cls_name,
                        'method': 'yoloe_text_direct'
                    })

        # Print detections
        class_counts = {}
        for det in detections:
            cls = det['callout_type']
            conf = det['confidence']
            x, y, w, h = det['bbox']
            print(f"  {cls:25s} conf={conf:.2f} bbox=[{x:.0f},{y:.0f}] size={w:.0f}x{h:.0f}")
            class_counts[cls] = class_counts.get(cls, 0) + 1

        print(f"\nSummary: {len(detections)} detections")
        for cls, count in class_counts.items():
            print(f"  {cls}: {count}")

        # Save annotated image
        safe_name = pdf_name.replace(' ', '_')
        output_path = str(OUTPUT_DIR / f"{safe_name}_page{page_num:02d}_yoloe.png")
        draw_detections(img_bgr, detections, output_path)
        print(f"Saved: {output_path}")

        results_summary['pages'][page_num] = {
            'image_size': [width, height],
            'total_detections': len(detections),
            'class_counts': class_counts,
            'detections': detections
        }

    return results_summary


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Load prompts
    prompt_path = Path(__file__).parent / "prompts" / "document_layout.json"
    print(f"Loading prompts from: {prompt_path}")
    with open(prompt_path) as f:
        prompts = json.load(f)

    print(f"Classes: {list(prompts['callout_types'].keys())}")

    # Load YOLOE model
    print("\nLoading YOLOE-26 model...")
    try:
        model = YOLO("yoloe-26n-seg.pt")
        print("Model loaded!")
    except Exception as e:
        print(f"ERROR loading model: {e}")
        print("Try: pip install ultralytics>=8.3.0")
        sys.exit(1)

    # Same test PDFs as DocLayout-YOLO POC
    test_cases = [
        ("/home/woodson/Code/projects/sitelink/docs/plans/ca/examples/4-Structural-Drawings.pdf",
         [0, 1, 2]),

        ("/home/woodson/Code/projects/sitelink/docs/plans/us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf",
         [0, 1, 5]),
    ]

    all_results = []

    for pdf_path, pages in test_cases:
        if Path(pdf_path).exists():
            results = test_yoloe_on_pdf(pdf_path, pages, model, prompts)
            all_results.append(results)
        else:
            print(f"\nSKIP: {pdf_path} not found")

    # Save results
    summary_path = OUTPUT_DIR / "poc_summary.json"
    with open(summary_path, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved summary: {summary_path}")

    # Print comparison header
    print(f"\n{'='*60}")
    print("YOLOE TEXT-PROMPT vs DocLayout-YOLO COMPARISON")
    print('='*60)

    total_by_class = {}
    for result in all_results:
        for page_num, page_data in result['pages'].items():
            for cls, count in page_data.get('class_counts', {}).items():
                total_by_class[cls] = total_by_class.get(cls, 0) + count

    print(f"\nYOLOE text-prompt totals:")
    for cls, count in sorted(total_by_class.items()):
        print(f"  {cls}: {count}")

    print(f"\nDocLayout-YOLO totals (from previous run):")
    print(f"  schedule_table: 6")
    print(f"  notes_block: 13")
    print(f"  detail_viewport_candidate: 4")
    print(f"  title_candidate: 16")

    print(f"\nResults saved to: {OUTPUT_DIR}/")
    print("Compare annotated images side-by-side with poc_doclayout_results/")


if __name__ == "__main__":
    main()
