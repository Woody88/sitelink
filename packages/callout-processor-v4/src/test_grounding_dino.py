#!/usr/bin/env python3
"""
Test Grounding DINO for zero-shot callout detection.

Usage:
    python test_grounding_dino.py --pdf <path> --output <dir> --page <n>
"""

import argparse
import json
from pathlib import Path
import os

# Force CPU mode
os.environ['CUDA_VISIBLE_DEVICES'] = ''

import torch
import cv2
import fitz
import numpy as np
from PIL import Image

# Grounding DINO imports
from groundingdino.util.inference import load_model, load_image, predict, annotate
import groundingdino.datasets.transforms as T


def preprocess_image_for_dino(image_rgb: np.ndarray) -> torch.Tensor:
    """Preprocess image for Grounding DINO - same as load_image uses."""
    transform = T.Compose([
        T.RandomResize([800], max_size=1333),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    pil_image = Image.fromarray(image_rgb)
    image_transformed, _ = transform(pil_image, None)
    return image_transformed


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 150) -> np.ndarray:
    """Render a PDF page to numpy array."""
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


def test_grounding_dino(
    pdf_path: str,
    output_dir: str,
    page_num: int = 0,
    dpi: int = 150
):
    """Test Grounding DINO on a PDF page with various prompts."""

    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Testing Grounding DINO on: {pdf_path.name}, page {page_num}")

    # Render PDF page
    image = render_pdf_page(str(pdf_path), page_num, dpi)
    h, w = image.shape[:2]
    print(f"Image size: {w}x{h}")

    # Save source image
    source_path = output_dir / f"page-{page_num}-source.png"
    cv2.imwrite(str(source_path), image)

    # Convert BGR to RGB for Grounding DINO
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Load model (use CPU since GPU not available in WSL)
    print("Loading Grounding DINO model...")
    import groundingdino
    config_path = Path(groundingdino.__file__).parent / "config" / "GroundingDINO_SwinT_OGC.py"
    weights_path = Path(__file__).parent.parent / "weights" / "groundingdino_swint_ogc.pth"
    model = load_model(str(config_path), str(weights_path), device="cpu")

    # Preprocess image for Grounding DINO
    image_tensor = preprocess_image_for_dino(image_rgb)

    # Test prompts for callout detection
    prompts = [
        "circle with text inside",
        "callout symbol",
        "detail callout",
        "section marker",
        "circle with number",
        "grid line marker",
    ]

    all_results = {}

    for prompt in prompts:
        print(f"\nTesting prompt: '{prompt}'")

        # Run detection (use CPU since GPU not available in WSL)
        boxes, logits, phrases = predict(
            model=model,
            image=image_tensor,
            caption=prompt,
            box_threshold=0.25,
            text_threshold=0.25,
            device="cpu"
        )

        print(f"  Found {len(boxes)} detections")

        # Draw annotations
        annotated = image.copy()
        for box, score, phrase in zip(boxes, logits, phrases):
            # Convert normalized coords to pixel coords
            x1, y1, x2, y2 = box
            x1, y1 = int(x1 * w), int(y1 * h)
            x2, y2 = int(x2 * w), int(y2 * h)

            # Draw box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Draw label
            label = f"{phrase}: {score:.2f}"
            cv2.putText(annotated, label, (x1, y1 - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # Save annotated image
        safe_prompt = prompt.replace(" ", "_")
        cv2.imwrite(str(output_dir / f"page-{page_num}-{safe_prompt}.png"), annotated)

        # Store results
        all_results[prompt] = {
            'count': len(boxes),
            'detections': [
                {
                    'box': box.tolist(),
                    'score': float(score),
                    'phrase': phrase
                }
                for box, score, phrase in zip(boxes, logits, phrases)
            ]
        }

    # Save results JSON
    with open(output_dir / f"page-{page_num}-results.json", 'w') as f:
        json.dump(all_results, f, indent=2)

    print(f"\nResults saved to: {output_dir}")

    # Summary
    print("\n" + "="*50)
    print("Summary:")
    for prompt, result in all_results.items():
        print(f"  '{prompt}': {result['count']} detections")


def main():
    parser = argparse.ArgumentParser(description='Test Grounding DINO for callout detection')
    parser.add_argument('--pdf', required=True, help='Input PDF file')
    parser.add_argument('--output', required=True, help='Output directory')
    parser.add_argument('--page', type=int, default=0, help='Page number to test')
    parser.add_argument('--dpi', type=int, default=150, help='Render DPI')

    args = parser.parse_args()

    test_grounding_dino(args.pdf, args.output, args.page, args.dpi)


if __name__ == '__main__':
    main()
