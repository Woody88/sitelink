"""
Shared utility for cropping detected regions from construction drawing images.

YOLO detection runs at 72 DPI, but LLM extraction needs higher resolution.
This module handles:
  - Loading images at configurable DPI (via pyvips or PyMuPDF for PDFs)
  - Cropping normalized bounding boxes (0-1 range) to pixel regions
  - Returning base64-encoded images ready for OpenRouter API calls

Used by both schedule extraction (extract_schedule.py) and notes extraction.
"""

import base64
import io
from pathlib import Path
from typing import Union

import cv2
import numpy as np


def crop_region(
    image_path: str,
    bbox: tuple[float, float, float, float],
    output_dpi: int = 150,
    padding_pct: float = 0.02,
) -> dict:
    """
    Crop a region from an image file using normalized bbox coordinates.

    Args:
        image_path: Path to the source image (PNG/JPG).
        bbox: Normalized (x, y, w, h) where all values are 0-1.
              x, y = top-left corner; w, h = width, height.
        output_dpi: DPI to render at (only affects PDF sources via pyvips/fitz).
        padding_pct: Extra padding around bbox as fraction (0.02 = 2%).

    Returns:
        dict with keys:
            - "image": numpy array (BGR) of cropped region
            - "base64": base64-encoded PNG string
            - "width": crop width in pixels
            - "height": crop height in pixels
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")

    return crop_region_from_array(img, bbox, padding_pct=padding_pct)


def crop_region_from_array(
    image_array: np.ndarray,
    bbox: tuple[float, float, float, float],
    padding_pct: float = 0.02,
) -> dict:
    """
    Crop a region from a numpy array using normalized bbox coordinates.

    Args:
        image_array: Source image as numpy array (BGR format from cv2).
        bbox: Normalized (x, y, w, h) where all values are 0-1.
        padding_pct: Extra padding around bbox as fraction.

    Returns:
        dict with keys:
            - "image": numpy array (BGR) of cropped region
            - "base64": base64-encoded PNG string
            - "width": crop width in pixels
            - "height": crop height in pixels
    """
    img_h, img_w = image_array.shape[:2]
    bx, by, bw, bh = bbox

    pad_x = bw * padding_pct
    pad_y = bh * padding_pct

    x1 = max(0, int((bx - pad_x) * img_w))
    y1 = max(0, int((by - pad_y) * img_h))
    x2 = min(img_w, int((bx + bw + pad_x) * img_w))
    y2 = min(img_h, int((by + bh + pad_y) * img_h))

    if x2 <= x1 or y2 <= y1:
        raise ValueError(f"Invalid crop region: ({x1},{y1}) to ({x2},{y2}) from bbox {bbox}")

    crop = image_array[y1:y2, x1:x2]

    _, buffer = cv2.imencode(".png", crop)
    b64 = base64.b64encode(buffer.tobytes()).decode("utf-8")

    return {
        "image": crop,
        "base64": b64,
        "width": crop.shape[1],
        "height": crop.shape[0],
    }


def render_pdf_page(
    pdf_path: str,
    page_num: int = 0,
    dpi: int = 150,
) -> np.ndarray:
    """
    Render a PDF page to a numpy array at the specified DPI.

    Uses PyMuPDF (fitz) for rendering.

    Args:
        pdf_path: Path to the PDF file.
        page_num: 0-indexed page number.
        dpi: Render resolution.

    Returns:
        numpy array in BGR format (cv2 convention).
    """
    import fitz

    doc = fitz.open(pdf_path)
    if page_num >= doc.page_count:
        doc.close()
        raise ValueError(f"Page {page_num} out of range (PDF has {doc.page_count} pages)")

    page = doc[page_num]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)

    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    doc.close()
    return img


def full_page_to_base64(
    image_array: np.ndarray,
    max_dimension: int = 4096,
) -> str:
    """
    Encode a full page image to base64 PNG, optionally downscaling if too large.

    Args:
        image_array: Source image (BGR).
        max_dimension: Maximum width or height. Image is scaled down if larger.

    Returns:
        base64-encoded PNG string.
    """
    h, w = image_array.shape[:2]
    if max(h, w) > max_dimension:
        scale = max_dimension / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        image_array = cv2.resize(image_array, (new_w, new_h), interpolation=cv2.INTER_AREA)

    _, buffer = cv2.imencode(".png", image_array)
    return base64.b64encode(buffer.tobytes()).decode("utf-8")


def pixel_bbox_to_normalized(
    pixel_bbox: tuple[float, float, float, float],
    img_width: int,
    img_height: int,
) -> tuple[float, float, float, float]:
    """
    Convert pixel bbox [x, y, w, h] to normalized [0-1] bbox.

    Args:
        pixel_bbox: (x, y, width, height) in pixels.
        img_width: Image width in pixels.
        img_height: Image height in pixels.

    Returns:
        (x, y, w, h) normalized to 0-1 range.
    """
    x, y, w, h = pixel_bbox
    return (x / img_width, y / img_height, w / img_width, h / img_height)
