#!/usr/bin/python3
"""
Test Grounding DINO for detecting text labels near callout symbols on construction plans.

Uses HuggingFace Transformers implementation of Grounding DINO.

This script tests various text prompts to see if Grounding DINO can detect:
- Detail numbers like "17/S2.0", "11/A6", "A2", "C4"
- Sheet references near callout markers
- Alphanumeric identifiers with forward slashes

Success Criteria:
- Detection rate >50% on test sheets
- Bounding boxes include full text (not cut off)
- Confidence >0.3
"""

import cv2
import torch
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import json
import os
import sys
import time

sys.path.insert(0, str(Path(__file__).parent))

from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor
from PIL import Image
from sahi_tiling import tile_image, merge_detections, adjust_coordinates, TILE_SIZE, OVERLAP, DPI
import fitz


TEXT_PROMPTS = [
    "small text label with slash connected by line to circular symbol",
    "detail number slash sheet number near callout marker",
    "alphanumeric identifier with forward slash extending from circle",
    "callout text label on technical drawing",
    "text with numbers and letters inside circle",
    "reference marker with slash notation",
    "detail callout label",
    "sheet reference text",
]


class GroundingDINOTextDetector:
    def __init__(self, model_id: str = "IDEA-Research/grounding-dino-tiny"):
        print(f"Loading Grounding DINO from HuggingFace: {model_id}")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        
        self.processor = AutoProcessor.from_pretrained(model_id)
        self.model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id).to(self.device)
        self.model.eval()
        print("Model loaded successfully")

    def detect_text_labels(
        self,
        image: np.ndarray,
        text_prompt: str,
        box_threshold: float = 0.25,
        text_threshold: float = 0.25
    ) -> List[Dict]:
        if len(image.shape) == 3 and image.shape[2] == 3:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            image_rgb = image

        image_pil = Image.fromarray(image_rgb)
        h, w = image.shape[:2]

        inputs = self.processor(images=image_pil, text=text_prompt, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            outputs = self.model(**inputs)

        results = self.processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=box_threshold,
            text_threshold=text_threshold,
            target_sizes=[(h, w)]
        )

        detections = []
        if len(results) > 0:
            result = results[0]
            boxes = result["boxes"]
            scores = result["scores"]
            labels = result["labels"]
            
            for box, score, label in zip(boxes, scores, labels):
                x1, y1, x2, y2 = box.tolist()
                
                x = int(x1)
                y = int(y1)
                width = int(x2 - x1)
                height = int(y2 - y1)

                detections.append({
                    'bbox': [x, y, width, height],
                    'confidence': float(score),
                    'phrase': label,
                    'class': label,
                    'prompt': text_prompt
                })

        return detections

    def detect_on_image_with_sahi(
        self,
        image: np.ndarray,
        text_prompt: str,
        tile_size: int = TILE_SIZE,
        overlap: float = OVERLAP,
        box_threshold: float = 0.25,
        text_threshold: float = 0.25
    ) -> List[Dict]:
        tiles = tile_image(image, tile_size, overlap)
        print(f"  Generated {len(tiles)} tiles")

        all_detections = []
        for i, (tile, offset) in enumerate(tiles):
            print(f"  Processing tile {i+1}/{len(tiles)}...", end='\r')

            detections = self.detect_text_labels(
                tile, text_prompt, box_threshold, text_threshold
            )

            for det in detections:
                det['bbox'] = adjust_coordinates(det['bbox'], offset)
                det['tile_index'] = i
                all_detections.append(det)

        print()
        merged = merge_detections(all_detections, iou_threshold=0.5)
        return merged

    def render_pdf_page(self, pdf_path: str, page_num: int = 0, dpi: int = DPI) -> np.ndarray:
        doc = fitz.open(pdf_path)
        page = doc[page_num]

        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)

        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        doc.close()
        return img_bgr


def save_visualization(
    image: np.ndarray,
    detections: List[Dict],
    output_path: str,
    prompt: str
):
    vis = image.copy()

    colors = [
        (255, 0, 0),     # Blue
        (0, 255, 0),     # Green
        (0, 0, 255),     # Red
        (255, 165, 0),   # Orange
        (128, 0, 128),   # Purple
    ]

    for i, det in enumerate(detections):
        x, y, w, h = det['bbox']
        x, y, w, h = int(x), int(y), int(w), int(h)

        color = colors[i % len(colors)]
        cv2.rectangle(vis, (x, y), (x+w, y+h), color, 2)

        label = f"{det['confidence']:.2f}"
        if det.get('phrase'):
            label = f"{det['phrase']}: {label}"

        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
        cv2.rectangle(vis, (x, y-label_size[1]-5), (x+label_size[0]+5, y), color, -1)
        cv2.putText(vis, label, (x+2, y-3), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    prompt_short = prompt[:60] + "..." if len(prompt) > 60 else prompt
    cv2.putText(vis, f"Prompt: {prompt_short}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(vis, f"Detections: {len(detections)}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    cv2.imwrite(output_path, vis)
    return output_path


def run_test(
    detector: GroundingDINOTextDetector,
    test_images: List[str],
    prompts: List[str],
    output_dir: str,
    use_sahi: bool = True,
    box_threshold: float = 0.25,
    text_threshold: float = 0.25
) -> Dict:
    os.makedirs(output_dir, exist_ok=True)

    results = {
        'by_prompt': {},
        'by_image': {},
        'total_detections': 0,
        'parameters': {
            'box_threshold': box_threshold,
            'text_threshold': text_threshold,
            'use_sahi': use_sahi,
            'tile_size': TILE_SIZE if use_sahi else None,
            'overlap': OVERLAP if use_sahi else None,
        }
    }

    for prompt in prompts:
        results['by_prompt'][prompt] = {
            'total_detections': 0,
            'avg_confidence': 0.0,
            'images_with_detections': 0,
            'all_confidences': []
        }

    for img_idx, img_path in enumerate(test_images):
        img_name = Path(img_path).stem
        print(f"\n{'='*60}")
        print(f"Testing image {img_idx+1}/{len(test_images)}: {img_name}")
        print(f"{'='*60}")

        if img_path.endswith('.pdf'):
            image = detector.render_pdf_page(img_path, page_num=0)
        else:
            image = cv2.imread(img_path)

        if image is None:
            print(f"  ERROR: Could not load image from {img_path}")
            continue

        print(f"  Image size: {image.shape[1]}x{image.shape[0]}")

        results['by_image'][img_name] = {
            'path': img_path,
            'size': [image.shape[1], image.shape[0]],
            'by_prompt': {}
        }

        for prompt_idx, prompt in enumerate(prompts):
            prompt_key = f"prompt_{prompt_idx}"
            print(f"\n  Prompt {prompt_idx+1}/{len(prompts)}: '{prompt[:50]}...'")

            start_time = time.time()

            if use_sahi:
                detections = detector.detect_on_image_with_sahi(
                    image, prompt, box_threshold=box_threshold, text_threshold=text_threshold
                )
            else:
                detections = detector.detect_text_labels(
                    image, prompt, box_threshold=box_threshold, text_threshold=text_threshold
                )

            elapsed = time.time() - start_time
            print(f"  Detection time: {elapsed:.2f}s")
            print(f"  Found {len(detections)} detections")

            results['by_image'][img_name]['by_prompt'][prompt] = {
                'detections': len(detections),
                'confidences': [d['confidence'] for d in detections],
                'avg_confidence': np.mean([d['confidence'] for d in detections]) if detections else 0.0,
                'bboxes': [d['bbox'] for d in detections],
                'phrases': [d.get('phrase', '') for d in detections],
                'elapsed_time': elapsed
            }

            results['by_prompt'][prompt]['total_detections'] += len(detections)
            results['by_prompt'][prompt]['all_confidences'].extend([d['confidence'] for d in detections])
            if detections:
                results['by_prompt'][prompt]['images_with_detections'] += 1

            results['total_detections'] += len(detections)

            vis_path = os.path.join(output_dir, f"{img_name}_prompt{prompt_idx}.png")
            save_visualization(image, detections, vis_path, prompt)
            print(f"  Saved visualization: {vis_path}")

    for prompt in prompts:
        confs = results['by_prompt'][prompt]['all_confidences']
        if confs:
            results['by_prompt'][prompt]['avg_confidence'] = float(np.mean(confs))
        results['by_prompt'][prompt]['detection_rate'] = (
            results['by_prompt'][prompt]['images_with_detections'] / len(test_images)
            if test_images else 0.0
        )

    return results


def print_summary(results: Dict, prompts: List[str]):
    print("\n" + "="*80)
    print("GROUNDING DINO TEXT DETECTION RESULTS SUMMARY")
    print("="*80)

    print("\n--- By Prompt ---")
    for i, prompt in enumerate(prompts):
        prompt_results = results['by_prompt'][prompt]
        print(f"\nPrompt {i+1}: '{prompt[:60]}...'")
        print(f"  Total detections: {prompt_results['total_detections']}")
        print(f"  Detection rate: {prompt_results['detection_rate']*100:.1f}% of images")
        print(f"  Avg confidence: {prompt_results['avg_confidence']:.3f}")

    print("\n--- By Image ---")
    for img_name, img_results in results['by_image'].items():
        total_dets = sum(p['detections'] for p in img_results['by_prompt'].values())
        print(f"\n{img_name}: {total_dets} total detections")
        for prompt, prompt_data in img_results['by_prompt'].items():
            if prompt_data['detections'] > 0:
                print(f"  - '{prompt[:40]}...': {prompt_data['detections']} (avg conf: {prompt_data['avg_confidence']:.3f})")

    print("\n--- Overall Statistics ---")
    print(f"Total detections across all images/prompts: {results['total_detections']}")

    best_prompt = max(prompts, key=lambda p: results['by_prompt'][p]['total_detections'])
    print(f"Best performing prompt: '{best_prompt[:50]}...'")
    print(f"  with {results['by_prompt'][best_prompt]['total_detections']} detections")

    viable_prompts = [p for p in prompts if results['by_prompt'][p]['detection_rate'] >= 0.5]
    print(f"\nPrompts with >50% detection rate: {len(viable_prompts)}/{len(prompts)}")

    high_conf_prompts = [p for p in prompts if results['by_prompt'][p]['avg_confidence'] >= 0.3]
    print(f"Prompts with avg confidence >0.3: {len(high_conf_prompts)}/{len(prompts)}")

    success_prompts = [p for p in prompts
                       if results['by_prompt'][p]['detection_rate'] >= 0.5
                       and results['by_prompt'][p]['avg_confidence'] >= 0.3]

    print("\n" + "="*80)
    if success_prompts:
        print("VERDICT: VIABLE - Grounding DINO can detect text labels")
        print(f"  Successful prompts: {len(success_prompts)}")
        for p in success_prompts:
            print(f"    - '{p[:50]}...'")
    elif results['total_detections'] > 0:
        print("VERDICT: PARTIALLY VIABLE - Some detections but below threshold")
        print("  Consider adjusting thresholds or prompts")
    else:
        print("VERDICT: NOT VIABLE - Grounding DINO cannot reliably detect text labels")
        print("  Recommend: Smart Post-Processing approach instead")
    print("="*80)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Test Grounding DINO for text label detection")
    parser.add_argument("--images", nargs="*", help="Test image paths (PNG, JPG, or PDF)")
    parser.add_argument("--output", default="test_grounding_text_output", help="Output directory")
    parser.add_argument("--box-threshold", type=float, default=0.25, help="Box detection threshold")
    parser.add_argument("--text-threshold", type=float, default=0.25, help="Text matching threshold")
    parser.add_argument("--no-sahi", action="store_true", help="Disable SAHI tiling")
    parser.add_argument("--prompts", nargs="*", help="Custom prompts (optional)")
    parser.add_argument("--model", default="IDEA-Research/grounding-dino-tiny", help="HuggingFace model ID")

    args = parser.parse_args()

    base_dir = Path(__file__).parent.parent

    if args.images:
        test_images = args.images
    else:
        test_images = [
            str(base_dir / "archive_2026-01-25" / "test_us_plan_output" / "page96_raw.png"),
            str(base_dir / "archive_2026-01-25" / "test_us_plan_output" / "page97_raw.png"),
            str(base_dir / "archive_2026-01-25" / "test_us_plan_output" / "page98_raw.png"),
            str(base_dir / "examples" / "us" / "ncs" / "detail" / "image1.png"),
            str(base_dir / "examples" / "us" / "ncs" / "section" / "image1.png"),
        ]
        test_images = [p for p in test_images if Path(p).exists()]

    if not test_images:
        print("ERROR: No test images found!")
        print("Specify images with --images flag or ensure default images exist")
        return 1

    print("Test images:")
    for img in test_images:
        print(f"  - {img}")

    prompts = args.prompts if args.prompts else TEXT_PROMPTS

    print("\nText prompts to test:")
    for i, p in enumerate(prompts):
        print(f"  {i+1}. {p}")

    output_dir = str(base_dir / args.output)

    print(f"\nInitializing GroundingDINO detector...")
    detector = GroundingDINOTextDetector(model_id=args.model)

    print(f"\nRunning tests...")
    results = run_test(
        detector,
        test_images,
        prompts,
        output_dir,
        use_sahi=not args.no_sahi,
        box_threshold=args.box_threshold,
        text_threshold=args.text_threshold
    )

    results_path = os.path.join(output_dir, "results.json")
    with open(results_path, 'w') as f:
        results_serializable = {
            k: v for k, v in results.items()
            if k != 'by_prompt' or not any(isinstance(x, np.ndarray) for x in v.values())
        }
        for prompt in prompts:
            results_serializable['by_prompt'] = results_serializable.get('by_prompt', {})
            results_serializable['by_prompt'][prompt] = {
                k: v for k, v in results['by_prompt'][prompt].items()
                if k != 'all_confidences'
            }
        json.dump(results_serializable, f, indent=2, default=str)
    print(f"\nResults saved to: {results_path}")

    print_summary(results, prompts)

    return 0


if __name__ == "__main__":
    sys.exit(main())
