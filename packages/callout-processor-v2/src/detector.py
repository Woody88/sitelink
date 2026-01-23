from dataclasses import dataclass
from typing import List, Optional
import cv2
import numpy as np


@dataclass
class Candidate:
    x: float
    y: float
    radius: float
    bbox: dict
    source: str
    confidence: float
    shape_type: Optional[str] = None


CV_PASSES = [
    {"dp": 1.0, "param1": 50, "param2": 30, "minRadius": 12, "maxRadius": 50},
    {"dp": 1.0, "param1": 30, "param2": 20, "minRadius": 12, "maxRadius": 50},
    {"dp": 1.0, "param1": 50, "param2": 35, "minRadius": 35, "maxRadius": 70},
    {"dp": 1.0, "param1": 50, "param2": 25, "minRadius": 8, "maxRadius": 20},
]


def _preprocess(image: np.ndarray):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 7)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)
    return gray, cleaned


def detect_candidates(image: np.ndarray, dpi: int = 300) -> List[Candidate]:
    h, w = image.shape[:2]
    gray, cleaned = _preprocess(image)
    scale = dpi / 300.0
    candidates = []

    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    min_dist = int(40 * scale)

    for pass_idx, params in enumerate(CV_PASSES):
        min_radius = int(params["minRadius"] * scale)
        max_radius = int(params["maxRadius"] * scale)

        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT,
            dp=params["dp"],
            minDist=min_dist,
            param1=params["param1"],
            param2=params["param2"],
            minRadius=min_radius,
            maxRadius=max_radius
        )

        if circles is not None:
            for cx, cy, r in circles[0, :]:
                candidates.append(Candidate(
                    source=f"hough_pass{pass_idx}",
                    x=float(cx),
                    y=float(cy),
                    radius=float(r),
                    confidence=0.85 if pass_idx == 0 else 0.75,
                    shape_type="circle",
                    bbox={
                        "x1": int(cx - r),
                        "y1": int(cy - r),
                        "x2": int(cx + r),
                        "y2": int(cy + r)
                    }
                ))

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = int(600 * scale ** 2)
    max_area = int(8500 * scale ** 2)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not (min_area < area < max_area):
            continue

        x_rect, y_rect, bw, bh = cv2.boundingRect(cnt)
        perimeter = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0

        shape_type = None
        if circularity > 0.65:
            shape_type = "circle"
        elif len(approx) == 3:
            shape_type = "triangle"
        elif circularity < 0.6 and len(approx) > 4:
            aspect_ratio = bw / bh if bh > 0 else 0
            if 0.6 < aspect_ratio < 1.6:
                shape_type = "section_flag"

        if shape_type:
            radius = max(bw, bh) / 2
            candidates.append(Candidate(
                source="contour",
                x=float(x_rect + bw // 2),
                y=float(y_rect + bh // 2),
                radius=float(radius),
                confidence=0.75,
                shape_type=shape_type,
                bbox={"x1": x_rect, "y1": y_rect, "x2": x_rect + bw, "y2": y_rect + bh}
            ))

    type_priority = {"section_flag": 0, "triangle": 1, "circle": 2}
    candidates.sort(key=lambda c: type_priority.get(c.shape_type or "circle", 99))

    deduped = []
    dedup_radius = 35
    for cand in candidates:
        is_dup = any(np.hypot(cand.x - d.x, cand.y - d.y) < dedup_radius for d in deduped)
        if not is_dup:
            pad = 5
            cand.bbox['x1'] = max(0, cand.bbox['x1'] - pad)
            cand.bbox['y1'] = max(0, cand.bbox['y1'] - pad)
            cand.bbox['x2'] = min(w, cand.bbox['x2'] + pad)
            cand.bbox['y2'] = min(h, cand.bbox['y2'] + pad)
            deduped.append(cand)

    return deduped


def get_crop(image: np.ndarray, candidate: Candidate, padding_mult: float = 1.5) -> np.ndarray:
    padding = max(40, int(candidate.radius * padding_mult))

    x1 = max(0, int(candidate.x - candidate.radius - padding))
    y1 = max(0, int(candidate.y - candidate.radius - padding))
    x2 = min(image.shape[1], int(candidate.x + candidate.radius + padding))
    y2 = min(image.shape[0], int(candidate.y + candidate.radius + padding))

    return image[y1:y2, x1:x2].copy()
