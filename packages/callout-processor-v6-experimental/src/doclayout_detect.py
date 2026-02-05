#!/usr/bin/python3
"""
DocLayout-YOLO detection module for construction drawing layout regions.

Detects: schedule_table, notes_block, legend_box
Uses fine-tuned DocLayout-YOLO model from DocStructBench base.
"""

import os

os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"

from pathlib import Path
from typing import Union

import cv2
import numpy as np

MODEL_PATH = Path(__file__).parent.parent / "weights" / "doclayout_construction_v1.pt"

CLASS_NAMES = ["schedule_table", "notes_block", "legend_box"]

MIN_SIZE_FILTERS = {
    "schedule_table": (80, 40),
    "notes_block": (200, 100),
    "legend_box": (100, 100),
}

_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model

    from doclayout_yolo import YOLOv10

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"DocLayout-YOLO weights not found at {MODEL_PATH}. "
            f"Place the fine-tuned model at: {MODEL_PATH}"
        )

    _model = YOLOv10(str(MODEL_PATH))
    return _model


def detect_layout_regions(
    image_path_or_array: Union[str, Path, np.ndarray],
    conf: float = 0.25,
    iou: float = 0.5,
) -> list[dict]:
    """
    Run DocLayout-YOLO inference on a single image.

    Args:
        image_path_or_array: File path (str/Path) or numpy array (BGR or RGB).
        conf: Confidence threshold for detections.
        iou: IoU threshold for NMS.

    Returns:
        List of detection dicts:
        [
          {
            "bbox": [x, y, w, h],
            "class": "schedule_table",
            "confidence": 0.85,
            "model": "doclayout_yolo"
          },
          ...
        ]
        bbox is in pixel coordinates: [top-left-x, top-left-y, width, height].
    """
    model = _load_model()

    if isinstance(image_path_or_array, np.ndarray):
        input_image = image_path_or_array
    else:
        path = str(image_path_or_array)
        input_image = cv2.imread(path)
        if input_image is None:
            raise ValueError(f"Could not load image from {path}")

    results = model.predict(
        input_image,
        imgsz=1024,
        conf=conf,
        iou=iou,
        verbose=False,
    )

    detections = []

    for r in results:
        boxes = r.boxes
        for i in range(len(boxes)):
            box = boxes[i]
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf_score = float(box.conf[0])
            cls_id = int(box.cls[0])

            if cls_id < 0 or cls_id >= len(CLASS_NAMES):
                continue

            class_name = CLASS_NAMES[cls_id]
            w = float(x2 - x1)
            h = float(y2 - y1)

            min_w, min_h = MIN_SIZE_FILTERS[class_name]
            if w < min_w or h < min_h:
                continue

            detections.append({
                "bbox": [float(x1), float(y1), w, h],
                "class": class_name,
                "confidence": conf_score,
                "model": "doclayout_yolo",
            })

    return detections
