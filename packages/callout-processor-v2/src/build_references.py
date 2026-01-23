import os
from pathlib import Path
from typing import List, Tuple, Optional
import cv2
import fitz
import numpy as np


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 300) -> np.ndarray:
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    doc.close()
    return img


def find_circle_contours(image: np.ndarray, min_radius: int = 15, max_radius: int = 70) -> List[Tuple[int, int, int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    circles = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 300:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue

        circularity = 4 * np.pi * area / (perimeter ** 2)

        if circularity > 0.65:
            (x, y), radius = cv2.minEnclosingCircle(contour)
            if min_radius <= radius <= max_radius:
                circles.append((int(x), int(y), int(radius)))

    return circles


def detect_filled_triangle(roi_gray: np.ndarray, min_area: int = 80) -> bool:
    _, binary = cv2.threshold(roi_gray, 128, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        approx = cv2.approxPolyDP(contour, 0.06 * cv2.arcLength(contour, True), True)
        if 3 <= len(approx) <= 5:
            rect = cv2.boundingRect(contour)
            aspect = rect[2] / max(rect[3], 1)
            if 0.5 < aspect < 2.0:
                return True

    return False


def detect_triangle_above(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    search_height = int(r * 1.8)
    search_width = int(r * 2.0)

    x1 = max(0, cx - search_width // 2)
    x2 = min(image.shape[1], cx + search_width // 2)
    y1 = max(0, cy - r - search_height)
    y2 = max(0, cy - int(r * 0.5))

    if y2 <= y1 or x2 <= x1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    return detect_filled_triangle(gray, min_area=60)


def detect_triangle_left(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    search_width = int(r * 1.5)
    search_height = int(r * 2.0)

    x1 = max(0, cx - r - search_width)
    x2 = max(0, cx - int(r * 0.5))
    y1 = max(0, cy - search_height // 2)
    y2 = min(image.shape[0], cy + search_height // 2)

    if x2 <= x1 or y2 <= y1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    return detect_filled_triangle(gray, min_area=60)


def detect_triangle_right(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    search_width = int(r * 1.5)
    search_height = int(r * 2.0)

    x1 = min(image.shape[1], cx + int(r * 0.5))
    x2 = min(image.shape[1], cx + r + search_width)
    y1 = max(0, cy - search_height // 2)
    y2 = min(image.shape[0], cy + search_height // 2)

    if x2 <= x1 or y2 <= y1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    return detect_filled_triangle(gray, min_area=60)


def has_horizontal_divider(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    x1 = max(0, cx - int(r * 0.9))
    x2 = min(image.shape[1], cx + int(r * 0.9))
    y1 = max(0, cy - int(r * 0.4))
    y2 = min(image.shape[0], cy + int(r * 0.4))

    if x2 <= x1 or y2 <= y1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 30, 100)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=8, minLineLength=int(r * 0.4), maxLineGap=5)

    if lines is None:
        return False

    for line in lines:
        x1l, y1l, x2l, y2l = line[0]
        angle = abs(np.arctan2(y2l - y1l, x2l - x1l) * 180 / np.pi)
        if angle < 20 or angle > 160:
            return True

    return False


def has_vertical_divider(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    x1 = max(0, cx - int(r * 0.4))
    x2 = min(image.shape[1], cx + int(r * 0.4))
    y1 = max(0, cy - int(r * 0.9))
    y2 = min(image.shape[0], cy + int(r * 0.9))

    if x2 <= x1 or y2 <= y1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 30, 100)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=8, minLineLength=int(r * 0.4), maxLineGap=5)

    if lines is None:
        return False

    for line in lines:
        x1l, y1l, x2l, y2l = line[0]
        angle = abs(np.arctan2(y2l - y1l, x2l - x1l) * 180 / np.pi)
        if 70 < angle < 110:
            return True

    return False


def is_hollow_circle(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    inner_r = int(r * 0.5)
    x1 = max(0, cx - inner_r)
    y1 = max(0, cy - inner_r)
    x2 = min(image.shape[1], cx + inner_r)
    y2 = min(image.shape[0], cy + inner_r)

    if x2 <= x1 or y2 <= y1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    mean_inner = np.mean(gray)

    outer_x1 = max(0, cx - r)
    outer_y1 = max(0, cy - r)
    outer_x2 = min(image.shape[1], cx + r)
    outer_y2 = min(image.shape[0], cy + r)

    outer_roi = image[outer_y1:outer_y2, outer_x1:outer_x2]
    if outer_roi.size == 0:
        return False

    outer_gray = cv2.cvtColor(outer_roi, cv2.COLOR_BGR2GRAY)
    mean_outer = np.mean(outer_gray)

    return mean_inner > 200 and mean_outer > 180


def has_content_inside(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    inner_r = int(r * 0.6)
    x1 = max(0, cx - inner_r)
    y1 = max(0, cy - inner_r)
    x2 = min(image.shape[1], cx + inner_r)
    y2 = min(image.shape[0], cy + inner_r)

    if x2 <= x1 or y2 <= y1:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)

    dark_pixels = np.sum(binary > 0)
    total_pixels = binary.size

    ratio = dark_pixels / total_pixels if total_pixels > 0 else 0

    return 0.02 < ratio < 0.5


def classify_callout(image: np.ndarray, cx: int, cy: int, r: int) -> Optional[str]:
    left_tri = detect_triangle_left(image, cx, cy, r)
    right_tri = detect_triangle_right(image, cx, cy, r)
    top_tri = detect_triangle_above(image, cx, cy, r)
    h_divider = has_horizontal_divider(image, cx, cy, r)
    v_divider = has_vertical_divider(image, cx, cy, r)

    if left_tri or right_tri:
        if h_divider and v_divider:
            return "section_full"
        elif h_divider:
            return "section_with_ref"
        return "section_simple"

    if top_tri:
        if h_divider and v_divider:
            return "elevation_full"
        elif h_divider:
            return "elevation_with_ref"
        return "elevation_simple"

    if h_divider and v_divider:
        return "detail_full"
    elif h_divider:
        return "detail_with_ref"
    return "detail_simple"


def extract_crop(image: np.ndarray, cx: int, cy: int, r: int, callout_type: str, target_size: int = 80) -> np.ndarray:
    if "section" in callout_type:
        margin_top = int(r * 1.2)
        margin_bottom = int(r * 0.8)
        margin_side = int(r * 1.8)
    elif "elevation" in callout_type:
        margin_top = int(r * 1.8)
        margin_bottom = int(r * 0.8)
        margin_side = int(r * 0.6)
    else:
        margin_top = int(r * 0.6)
        margin_bottom = int(r * 0.6)
        margin_side = int(r * 0.6)

    x1 = max(0, cx - r - margin_side)
    y1 = max(0, cy - r - margin_top)
    x2 = min(image.shape[1], cx + r + margin_side)
    y2 = min(image.shape[0], cy + r + margin_bottom)

    crop = image[y1:y2, x1:x2]

    if crop.size == 0:
        return np.zeros((target_size, target_size, 3), dtype=np.uint8)

    h, w = crop.shape[:2]
    scale = target_size / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)

    resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)

    canvas = np.ones((target_size, target_size, 3), dtype=np.uint8) * 255
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    canvas[offset_y:offset_y + new_h, offset_x:offset_x + new_w] = resized

    return canvas


def is_valid_callout_region(image: np.ndarray, cx: int, cy: int, r: int) -> bool:
    x1 = max(0, cx - r)
    y1 = max(0, cy - r)
    x2 = min(image.shape[1], cx + r)
    y2 = min(image.shape[0], cy + r)

    if x2 - x1 < 10 or y2 - y1 < 10:
        return False

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return False

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    mean_intensity = np.mean(gray)

    if mean_intensity < 150:
        return False

    if not is_hollow_circle(image, cx, cy, r):
        return False

    if not has_content_inside(image, cx, cy, r):
        return False

    return True


def extract_callout_regions_from_pspc(image: np.ndarray) -> List[Tuple[np.ndarray, str]]:
    results = []

    circles = find_circle_contours(image, min_radius=18, max_radius=65)

    circles_sorted = sorted(circles, key=lambda c: (c[1], c[0]))

    seen_positions = set()
    for cx, cy, r in circles_sorted:
        pos_key = (cx // 40, cy // 40)
        if pos_key in seen_positions:
            continue

        if not is_valid_callout_region(image, cx, cy, r):
            continue

        callout_type = classify_callout(image, cx, cy, r)
        if callout_type is None:
            continue

        seen_positions.add(pos_key)
        crop = extract_crop(image, cx, cy, r, callout_type)
        results.append((crop, callout_type))

    return results


def extract_from_pdf(pdf_path: str) -> List[Tuple[np.ndarray, str]]:
    results = []
    doc = fitz.open(pdf_path)

    for page_num in range(len(doc)):
        image = render_pdf_page(pdf_path, page_num, dpi=300)
        callouts = extract_callout_regions_from_pspc(image)
        results.extend(callouts)

    doc.close()
    return results


def extract_from_png(png_path: str) -> List[Tuple[np.ndarray, str]]:
    image = cv2.imread(png_path)
    if image is None:
        return []
    return extract_callout_regions_from_pspc(image)


def main():
    base_dir = Path("/home/woodson/Code/projects/sitelink/packages/callout-processor-v2")
    output_dir = base_dir / "assets" / "reference_crops"
    output_dir.mkdir(parents=True, exist_ok=True)

    for f in output_dir.glob("*.png"):
        f.unlink()

    pdf_path = "/home/woodson/Code/projects/sitelink/docs/PSPC National CADD Standard - Callout Symbols.pdf"
    png_paths = [
        "/home/woodson/Code/projects/sitelink/packages/callout-processor/assets/pspc_standard_page_1.png",
        "/home/woodson/Code/projects/sitelink/packages/callout-processor/assets/pspc_standard_page_2.png"
    ]

    all_callouts = []

    if os.path.exists(pdf_path):
        print(f"Extracting from PDF: {pdf_path}")
        pdf_callouts = extract_from_pdf(pdf_path)
        print(f"  Found {len(pdf_callouts)} callouts from PDF")
        all_callouts.extend(pdf_callouts)

    for png_path in png_paths:
        if os.path.exists(png_path):
            print(f"Extracting from PNG: {png_path}")
            png_callouts = extract_from_png(png_path)
            print(f"  Found {len(png_callouts)} callouts from PNG")
            all_callouts.extend(png_callouts)

    counts = {}

    for crop, callout_type in all_callouts:
        if callout_type not in counts:
            counts[callout_type] = 0
        counts[callout_type] += 1
        idx = counts[callout_type]
        filename = f"{callout_type}_{idx:02d}.png"
        filepath = output_dir / filename
        cv2.imwrite(str(filepath), crop)
        print(f"Saved: {filename}")

    print(f"\nTotal callouts extracted:")
    for ctype, count in sorted(counts.items()):
        print(f"  {ctype}: {count}")
    print(f"  Total: {sum(counts.values())}")
    print(f"\nOutput directory: {output_dir}")


if __name__ == "__main__":
    main()
