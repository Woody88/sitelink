import cv2
import torch
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple
import json
import fitz

from groundingdino.util.inference import load_model, predict, load_image
from groundingdino.util.utils import clean_state_dict, get_phrases_from_posmap
import groundingdino.datasets.transforms as T
from sahi_tiling import tile_image, merge_detections, adjust_coordinates, TILE_SIZE, OVERLAP, DPI
from PIL import Image


class GroundingDINODetector:
    def __init__(self, config_path: str = None, weights_path: str = None):
        """
        Initialize GroundingDINO model.

        Args:
            config_path: Path to config file (default: groundingdino/config/GroundingDINO_SwinT_OGC.py)
            weights_path: Path to weights (default: weights/groundingdino_swint_ogc.pth)
        """
        if config_path is None:
            config_path = "groundingdino/config/GroundingDINO_SwinT_OGC.py"
        if weights_path is None:
            weights_path = "weights/groundingdino_swint_ogc.pth"

        self.model = load_model(config_path, weights_path)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"GroundingDINO loaded on device: {self.device}")

    def prepare_text_prompt(self, prompts_json: Dict) -> str:
        """
        Prepare text prompt from v5's JSON format.

        GroundingDINO format: "detail callout. elevation callout. section callout"
        """
        callout_types = prompts_json["callout_types"]

        text_parts = []
        for callout_type, config in callout_types.items():
            text_parts.append(f"{callout_type} callout")

        return ". ".join(text_parts)

    def _preprocess_image(self, image: np.ndarray) -> torch.Tensor:
        """Convert numpy image to GroundingDINO tensor format."""
        transform = T.Compose([
            T.RandomResize([800], max_size=1333),
            T.ToTensor(),
            T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image_pil = Image.fromarray(image_rgb)
        image_transformed, _ = transform(image_pil, None)

        return image_transformed

    def detect_on_tile(
        self,
        tile: np.ndarray,
        text_prompt: str,
        box_threshold: float = 0.25,
        text_threshold: float = 0.25
    ) -> Tuple[List, List, List]:
        """
        Run detection on single tile.

        Returns:
            boxes: List of [x, y, w, h] bounding boxes
            confidences: List of confidence scores
            labels: List of class labels
        """
        image_tensor = self._preprocess_image(tile)

        boxes, logits, phrases = predict(
            model=self.model,
            image=image_tensor,
            caption=text_prompt,
            box_threshold=box_threshold,
            text_threshold=text_threshold,
            device=self.device
        )

        h, w = tile.shape[:2]
        boxes_pixel = []
        confidences = []
        labels = []

        for box, logit, phrase in zip(boxes, logits, phrases):
            cx, cy, bw, bh = box.cpu().numpy()

            x = int((cx - bw/2) * w)
            y = int((cy - bh/2) * h)
            width = int(bw * w)
            height = int(bh * h)

            boxes_pixel.append([x, y, width, height])
            confidences.append(float(logit))

            label = phrase.split()[0] if phrase else "unknown"
            labels.append(label)

        return boxes_pixel, confidences, labels

    def detect_callouts(
        self,
        image_path: str,
        prompts_json: Dict,
        tile_size: int = TILE_SIZE,
        overlap: float = OVERLAP,
        box_threshold: float = 0.25,
        text_threshold: float = 0.25,
        output_path: str = None
    ) -> List[Dict]:
        """
        Detect callouts using SAHI tiling + GroundingDINO.

        Args:
            image_path: Path to plan image or PDF
            prompts_json: Loaded prompts JSON (from v5/prompts/)
            tile_size: Tile size in pixels
            overlap: Overlap ratio (0-1)
            box_threshold: Detection confidence threshold
            text_threshold: Text matching threshold
            output_path: Optional path to save annotated image

        Returns:
            List of detections with bbox, confidence, class, method
        """
        if image_path.endswith('.pdf'):
            image = self._render_pdf(image_path, dpi=DPI)
        else:
            image = cv2.imread(image_path)

        text_prompt = self.prepare_text_prompt(prompts_json)
        print(f"Text prompt: {text_prompt}")

        tiles = tile_image(image, tile_size, overlap)
        print(f"Generated {len(tiles)} tiles")

        all_detections = []
        for i, (tile, offset) in enumerate(tiles):
            print(f"Processing tile {i+1}/{len(tiles)}...", end='\r')

            boxes, confidences, labels = self.detect_on_tile(
                tile, text_prompt, box_threshold, text_threshold
            )

            for box, conf, label in zip(boxes, confidences, labels):
                bbox_global = adjust_coordinates(box, offset)
                all_detections.append({
                    'bbox': bbox_global,
                    'confidence': conf,
                    'class': label,
                    'method': 'grounding_dino',
                    'tile_index': i
                })

        print(f"\nDetected {len(all_detections)} callouts before NMS")

        merged = merge_detections(all_detections, iou_threshold=0.5)
        print(f"After NMS: {len(merged)} callouts")

        if output_path:
            self._save_annotated(image, merged, output_path)
            print(f"Annotated image saved: {output_path}")

        return merged

    def _render_pdf(self, pdf_path: str, dpi: int = DPI, page_num: int = 0) -> np.ndarray:
        """Render PDF page to numpy array at specified DPI."""
        doc = fitz.open(pdf_path)
        page = doc[page_num]

        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)

        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        doc.close()
        return img_bgr

    def _save_annotated(self, image: np.ndarray, detections: List[Dict], output_path: str):
        """Draw bounding boxes on image and save."""
        vis = image.copy()

        colors = {
            'detail': (255, 0, 0),
            'elevation': (0, 255, 0),
            'section': (0, 0, 255),
            'title': (255, 165, 0)
        }

        for det in detections:
            x, y, w, h = det['bbox']
            x, y, w, h = int(x), int(y), int(w), int(h)

            color = colors.get(det['class'], (255, 255, 255))

            cv2.rectangle(vis, (x, y), (x+w, y+h), color, 3)

            label = f"{det['class']}: {det['confidence']:.2f}"
            cv2.putText(vis, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        cv2.imwrite(output_path, vis)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="GroundingDINO Callout Detection with SAHI")
    parser.add_argument("image", help="Path to plan image or PDF")
    parser.add_argument("--prompts", required=True, help="Path to prompts JSON")
    parser.add_argument("--box-threshold", type=float, default=0.25, help="Detection threshold")
    parser.add_argument("--text-threshold", type=float, default=0.25, help="Text matching threshold")
    parser.add_argument("--output", help="Path to save annotated image")
    parser.add_argument("--output-json", help="Path to save detection JSON")

    args = parser.parse_args()

    with open(args.prompts) as f:
        prompts = json.load(f)

    detector = GroundingDINODetector()
    detections = detector.detect_callouts(
        args.image,
        prompts,
        box_threshold=args.box_threshold,
        text_threshold=args.text_threshold,
        output_path=args.output
    )

    if args.output_json:
        with open(args.output_json, 'w') as f:
            json.dump({
                'detections': detections,
                'metadata': {
                    'method': 'grounding_dino',
                    'box_threshold': args.box_threshold,
                    'text_threshold': args.text_threshold,
                    'num_detections': len(detections)
                }
            }, f, indent=2)

    print(f"\n=== Detection Summary ===")
    print(f"Total detections: {len(detections)}")
    by_class = {}
    for det in detections:
        cls = det['class']
        by_class[cls] = by_class.get(cls, 0) + 1
    for cls, count in sorted(by_class.items()):
        print(f"  {cls}: {count}")
