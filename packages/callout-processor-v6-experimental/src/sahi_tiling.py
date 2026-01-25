import cv2
import numpy as np
from typing import List, Tuple, Dict

TILE_SIZE = 2048
OVERLAP = 0.25
DPI = 72

def tile_image(image: np.ndarray, tile_size: int = TILE_SIZE, overlap: float = OVERLAP) -> List[Tuple[np.ndarray, Tuple[int, int]]]:
    """
    Split image into overlapping tiles.

    Args:
        image: Input image (numpy array)
        tile_size: Size of each tile in pixels
        overlap: Overlap ratio (0-1)

    Returns:
        List of (tile_image, (offset_x, offset_y)) tuples
    """
    h, w = image.shape[:2]
    stride = int(tile_size * (1 - overlap))
    tiles = []

    for y in range(0, max(1, h - tile_size + 1), stride):
        for x in range(0, max(1, w - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]

            if tile.shape[0] < tile_size or tile.shape[1] < tile_size:
                padded = np.zeros((tile_size, tile_size, 3), dtype=np.uint8) if len(tile.shape) == 3 else np.zeros((tile_size, tile_size), dtype=np.uint8)
                padded[:tile.shape[0], :tile.shape[1]] = tile
                tile = padded

            tiles.append((tile, (x, y)))

    if w > tile_size:
        x = w - tile_size
        for y in range(0, max(1, h - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]
            tiles.append((tile, (x, y)))

    if h > tile_size:
        y = h - tile_size
        for x in range(0, max(1, w - tile_size + 1), stride):
            tile = image[y:y+tile_size, x:x+tile_size]
            tiles.append((tile, (x, y)))

    if w > tile_size and h > tile_size:
        tile = image[h-tile_size:h, w-tile_size:w]
        tiles.append((tile, (w-tile_size, h-tile_size)))

    return tiles

def adjust_coordinates(bbox: List[float], offset: Tuple[int, int]) -> List[float]:
    """
    Convert tile coordinates to full image coordinates.

    Args:
        bbox: Bounding box in format [x, y, w, h]
        offset: Tile offset (offset_x, offset_y)

    Returns:
        Adjusted bounding box in format [x, y, w, h]
    """
    x, y, w, h = bbox
    offset_x, offset_y = offset
    return [x + offset_x, y + offset_y, w, h]

def merge_detections(detections: List[Dict], iou_threshold: float = 0.5) -> List[Dict]:
    """
    Merge overlapping detections across tiles using per-class NMS.

    Args:
        detections: List of {'bbox': [x,y,w,h], 'confidence': float, 'class': str}
        iou_threshold: IoU threshold for NMS

    Returns:
        Merged detections after NMS
    """
    if not detections:
        return []

    by_class = {}
    for det in detections:
        cls = det['class']
        if cls not in by_class:
            by_class[cls] = []
        by_class[cls].append(det)

    merged = []
    for cls, dets in by_class.items():
        boxes = [d['bbox'] for d in dets]
        scores = [d['confidence'] for d in dets]

        indices = cv2.dnn.NMSBoxes(boxes, scores, 0.0, iou_threshold)

        if len(indices) > 0:
            for idx in indices.flatten():
                merged.append(dets[idx])

    return merged

def visualize_tiles(image: np.ndarray, output_path: str, tile_size: int = TILE_SIZE, overlap: float = OVERLAP) -> str:
    """
    Generate debug visualization showing tile boundaries.

    Args:
        image: Input image
        output_path: Path to save visualization
        tile_size: Tile size in pixels
        overlap: Overlap ratio

    Returns:
        Path to saved visualization
    """
    vis = image.copy()
    h, w = vis.shape[:2]
    stride = int(tile_size * (1 - overlap))

    for y in range(0, h, stride):
        cv2.line(vis, (0, y), (w, y), (0, 255, 0), 2)
    for x in range(0, w, stride):
        cv2.line(vis, (x, 0), (x, h), (0, 255, 0), 2)

    if w > tile_size:
        cv2.line(vis, (w - tile_size, 0), (w - tile_size, h), (0, 0, 255), 3)
    if h > tile_size:
        cv2.line(vis, (0, h - tile_size), (w, h - tile_size), (0, 0, 255), 3)

    cv2.imwrite(output_path, vis)
    return output_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test SAHI tiling module")
    parser.add_argument("image", help="Path to test image")
    parser.add_argument("--output", default="test_output/tile_grid_debug.png", help="Output path for visualization")
    parser.add_argument("--tile-size", type=int, default=TILE_SIZE, help="Tile size in pixels")
    parser.add_argument("--overlap", type=float, default=OVERLAP, help="Overlap ratio (0-1)")

    args = parser.parse_args()

    image = cv2.imread(args.image)
    if image is None:
        print(f"Error: Could not load image from {args.image}")
        exit(1)

    print(f"Image size: {image.shape[1]}x{image.shape[0]}")

    tiles = tile_image(image, args.tile_size, args.overlap)
    print(f"Generated {len(tiles)} tiles")

    for i, (tile, offset) in enumerate(tiles[:3]):
        print(f"  Tile {i}: size={tile.shape[1]}x{tile.shape[0]}, offset={offset}")

    output_path = visualize_tiles(image, args.output, args.tile_size, args.overlap)
    print(f"\nTile grid visualization saved: {output_path}")

    test_bbox = [100, 100, 50, 50]
    test_offset = (512, 256)
    adjusted = adjust_coordinates(test_bbox, test_offset)
    print(f"\nCoordinate test:")
    print(f"  Original bbox: {test_bbox}")
    print(f"  Offset: {test_offset}")
    print(f"  Adjusted bbox: {adjusted}")

    test_detections = [
        {'bbox': [100, 100, 50, 50], 'confidence': 0.9, 'class': 'detail'},
        {'bbox': [105, 105, 50, 50], 'confidence': 0.85, 'class': 'detail'},
        {'bbox': [500, 500, 60, 60], 'confidence': 0.75, 'class': 'elevation'},
    ]
    merged = merge_detections(test_detections, iou_threshold=0.5)
    print(f"\nNMS test:")
    print(f"  Before NMS: {len(test_detections)} detections")
    print(f"  After NMS: {len(merged)} detections")
