#!/usr/bin/env python3
"""
Run detection on PDF and create comparison visualizations.
Similar to callout-processor-v5/comparison_page2.png format.
"""

import cv2
import numpy as np
import fitz  # PyMuPDF
from pathlib import Path
from ultralytics import YOLO
import sys

# Class colors (BGR format for OpenCV)
CLASS_COLORS = {
    'detail': (0, 255, 0),      # Green
    'elevation': (255, 0, 0),   # Blue
    'title': (0, 0, 255)        # Red
}

def pdf_to_images(pdf_path, output_dir, dpi=150):
    """Convert PDF pages to images at specified DPI."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    image_paths = []

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Render at higher DPI for better quality
        mat = fitz.Matrix(dpi/72, dpi/72)
        pix = page.get_pixmap(matrix=mat)

        # Convert to numpy array
        img_data = pix.tobytes("ppm")
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Save image
        img_path = output_dir / f"page{page_num + 1}.png"
        cv2.imwrite(str(img_path), img)
        image_paths.append(str(img_path))

        print(f"Rendered page {page_num + 1}/{len(doc)}: {pix.width}x{pix.height}")

    doc.close()
    return image_paths


def run_detection_sahi(model, image_path, conf_threshold=0.25, tile_size=2048, overlap=0.2):
    """Run SAHI tiled detection on image."""
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction

    # Wrap YOLO model for SAHI
    detection_model = AutoDetectionModel.from_pretrained(
        model_type='yolov8',
        model_path=model.ckpt_path,
        confidence_threshold=conf_threshold,
        device='cuda:0'
    )

    # Run sliced prediction
    result = get_sliced_prediction(
        image_path,
        detection_model,
        slice_height=tile_size,
        slice_width=tile_size,
        overlap_height_ratio=overlap,
        overlap_width_ratio=overlap
    )

    # Convert to list of detections
    detections = []
    for obj in result.object_prediction_list:
        bbox = obj.bbox.to_xyxy()  # [x1, y1, x2, y2]
        detections.append({
            'bbox': [bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]],  # [x, y, w, h]
            'class': obj.category.name,
            'confidence': obj.score.value
        })

    return detections


def visualize_detections(image_path, detections, output_path, title="Detections"):
    """Draw detection boxes on image."""
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image {image_path}")
        return

    # Count by class
    count_by_class = {}
    for det in detections:
        cls = det['class']
        count_by_class[cls] = count_by_class.get(cls, 0) + 1

    # Draw boxes
    for det in detections:
        x, y, w, h = [int(v) for v in det['bbox']]
        cls = det['class']
        conf = det['confidence']

        color = CLASS_COLORS.get(cls, (128, 128, 128))
        cv2.rectangle(img, (x, y), (x+w, y+h), color, 3)

        # Draw label with confidence
        label = f"{cls} {conf:.2f}"
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Add summary text
    y_offset = 30
    total = len(detections)
    cv2.putText(img, f"{title}: {total} callouts", (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    y_offset += 35

    for cls, count in count_by_class.items():
        text = f"{cls}: {count}"
        color = CLASS_COLORS.get(cls, (128, 128, 128))
        cv2.putText(img, text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        y_offset += 30

    cv2.imwrite(output_path, img)
    print(f"Saved detection visualization to {output_path}")
    return count_by_class, total


def create_detection_panel(image_path, detections, output_path):
    """Create single detection panel with annotations."""
    img = cv2.imread(image_path)
    h, w = img.shape[:2]

    # Count by class
    stats = {}
    for det in detections:
        cls = det['class']
        stats[cls] = stats.get(cls, 0) + 1

    # Draw detections
    for det in detections:
        x, y, width, height = [int(v) for v in det['bbox']]
        cls = det['class']
        conf = det['confidence']

        color = CLASS_COLORS.get(cls, (128, 128, 128))
        cv2.rectangle(img, (x, y), (x+width, y+height), color, 2)

        # Label
        label = f"{cls}"
        cv2.putText(img, label, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    # Add header with label
    label_h = 50
    labeled = np.zeros((h + label_h, w, 3), dtype=np.uint8)
    labeled[label_h:] = img

    # Title
    total = len(detections)
    title_text = f"Detections: {total} callouts"
    cv2.putText(labeled, title_text, (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)

    cv2.imwrite(output_path, labeled)
    return labeled, stats


def create_comparison_single(original_path, detections_path, output_path, title):
    """Create side-by-side: Original | Detections"""
    orig = cv2.imread(original_path)
    dets = cv2.imread(detections_path)

    if orig is None or dets is None:
        print(f"Error loading images for {title}")
        return

    # Resize to same height
    h = min(orig.shape[0], dets.shape[0])
    orig = cv2.resize(orig, (int(orig.shape[1] * h / orig.shape[0]), h))
    dets = cv2.resize(dets, (int(dets.shape[1] * h / dets.shape[0]), h))

    # Add labels
    label_h = 50
    orig_labeled = np.zeros((h + label_h, orig.shape[1], 3), dtype=np.uint8)
    dets_labeled = np.zeros((h + label_h, dets.shape[1], 3), dtype=np.uint8)

    orig_labeled[label_h:] = orig
    dets_labeled[label_h:] = dets

    # Text labels
    cv2.putText(orig_labeled, "Original Plan", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(dets_labeled, "Iteration 4 Detections", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)

    # Concatenate
    comparison = np.hstack([orig_labeled, dets_labeled])

    # Add title
    title_h = 60
    final = np.zeros((comparison.shape[0] + title_h, comparison.shape[1], 3), dtype=np.uint8)
    final[title_h:] = comparison

    cv2.putText(final, title, (10, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)

    cv2.imwrite(output_path, final)
    print(f"Created comparison: {output_path}")


def main(pdf_path, model_path, output_dir):
    """Main processing pipeline."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("="*70)
    print("PDF DETECTION AND VISUALIZATION")
    print("="*70)
    print(f"PDF: {pdf_path}")
    print(f"Model: {model_path}")
    print(f"Output: {output_dir}")
    print("="*70)
    print()

    # Step 1: Convert PDF to images
    print("Step 1: Converting PDF to images...")
    images_dir = output_dir / "pdf_pages"
    image_paths = pdf_to_images(pdf_path, images_dir, dpi=150)
    print(f"Converted {len(image_paths)} pages\n")

    # Step 2: Load model
    print("Step 2: Loading model...")
    model = YOLO(model_path)
    print(f"Model loaded: {model_path}\n")

    # Step 3: Run detection on each page
    print("Step 3: Running detections...")
    for i, img_path in enumerate(image_paths):
        page_num = i + 1
        print(f"\nProcessing page {page_num}/{len(image_paths)}...")

        # Run SAHI detection
        detections = run_detection_sahi(model, img_path, conf_threshold=0.25)
        print(f"  Found {len(detections)} callouts")

        # Create detection visualization
        det_output = output_dir / f"page{page_num}_detections.png"
        stats, total = visualize_detections(img_path, detections, str(det_output),
                                           title=f"Page {page_num}")

        # Create comparison image
        comparison_output = output_dir / f"comparison_page{page_num}.png"
        title = f"Page {page_num}: {total} callouts detected"
        if stats:
            stats_str = ", ".join([f"{k}: {v}" for k, v in stats.items()])
            title += f" ({stats_str})"

        create_comparison_single(img_path, str(det_output),
                                str(comparison_output), title)

    print("\n" + "="*70)
    print("COMPLETE")
    print("="*70)
    print(f"Comparison images saved to: {output_dir}/comparison_page*.png")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python detect_and_visualize_pdf.py <pdf_path> <model_path> [output_dir]")
        print("\nExample:")
        print("  python detect_and_visualize_pdf.py file.pdf model.pt output/")
        sys.exit(1)

    pdf_path = sys.argv[1]
    model_path = sys.argv[2]
    output_dir = sys.argv[3] if len(sys.argv) > 3 else "pdf_detection_output"

    main(pdf_path, model_path, output_dir)
