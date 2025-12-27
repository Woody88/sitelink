#!/usr/bin/env python3
"""
Stage 1: Fast Candidate Detection using Geometric Shape Detection

Uses Hough circle detection + contour-based triangle detection
instead of template matching (which fails due to variable text content).
"""

import cv2
import numpy as np
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Dict
import time
import json

import sys
sys.path.insert(0, str(Path(__file__).parent))
from utils.nms import nms_per_symbol_type
from utils.geometric_filters import apply_geometric_filters


@dataclass
class SymbolCandidate:
    """Represents a potential symbol detection"""
    bbox: Tuple[int, int, int, int]  # (x, y, w, h) in tile coordinates
    confidence: float                 # 0-1 confidence score
    symbol_type: str                  # 'circular' or 'triangular'
    detection_method: str             # 'hough_circle' or 'contour_triangle'
    source_tile: str                  # Tile filename

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'bbox': self.bbox,
            'confidence': self.confidence,
            'symbol_type': self.symbol_type,
            'detection_method': self.detection_method,
            'source_tile': self.source_tile
        }


class Stage1GeometricDetector:
    """
    Stage 1: Fast candidate detection using geometric shape detection
    
    Detects circles using Hough Circle Transform and triangles using
    contour detection with polygon approximation.
    """

    def __init__(self,
                 circle_min_radius: int = 10,
                 circle_max_radius: int = 60,
                 triangle_min_size: int = 15,
                 triangle_max_size: int = 100,
                 nms_threshold: float = 0.3,
                 strict_filtering: bool = False):
        """
        Initialize geometric detector

        Args:
            circle_min_radius: Minimum circle radius in pixels
            circle_max_radius: Maximum circle radius in pixels
            triangle_min_size: Minimum triangle side length
            triangle_max_size: Maximum triangle side length
            nms_threshold: IoU threshold for non-maximum suppression
            strict_filtering: Enable advanced geometric filtering to reduce false positives
        """
        self.circle_min_radius = circle_min_radius
        self.circle_max_radius = circle_max_radius
        self.triangle_min_size = triangle_min_size
        self.triangle_max_size = triangle_max_size
        self.nms_threshold = nms_threshold
        self.strict_filtering = strict_filtering

        print(f"Stage1GeometricDetector initialized:", file=sys.stderr)
        print(f"  Circle detection: radius {circle_min_radius}-{circle_max_radius}px", file=sys.stderr)
        print(f"  Triangle detection: size {triangle_min_size}-{triangle_max_size}px", file=sys.stderr)
        print(f"  NMS threshold: {nms_threshold}", file=sys.stderr)
        print(f"  Strict filtering: {'ENABLED' if strict_filtering else 'DISABLED'}", file=sys.stderr)

    def detect_circles(self, gray_image: np.ndarray) -> List[SymbolCandidate]:
        """
        Detect circular symbols using Hough Circle Transform

        Args:
            gray_image: Grayscale image

        Returns:
            List of circular symbol candidates
        """
        candidates = []

        # Apply edge detection (lowered thresholds for more edges)
        edges = cv2.Canny(gray_image, 30, 100)

        # Hough Circle Transform
        # Using more permissive parameters for higher recall
        circles = cv2.HoughCircles(
            edges,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=20,  # Minimum distance between circle centers (lowered from 30)
            param1=50,   # Canny edge detection threshold
            param2=15,   # Accumulator threshold (lowered from 30 for more circles)
            minRadius=self.circle_min_radius,
            maxRadius=self.circle_max_radius
        )

        if circles is not None:
            circles = np.uint16(np.around(circles))
            for circle in circles[0, :]:
                x, y, r = circle

                # Create bounding box
                bbox = (int(x - r), int(y - r), int(2 * r), int(2 * r))

                # Confidence based on circle quality (placeholder - can be refined)
                confidence = 0.8

                candidate = SymbolCandidate(
                    bbox=bbox,
                    confidence=confidence,
                    symbol_type='circular',
                    detection_method='hough_circle',
                    source_tile=''  # Will be set by caller
                )
                candidates.append(candidate)

        return candidates

    def detect_triangles(self, gray_image: np.ndarray) -> List[SymbolCandidate]:
        """
        Detect triangular symbols using contour detection

        Args:
            gray_image: Grayscale image

        Returns:
            List of triangular symbol candidates
        """
        candidates = []

        # Apply binary threshold
        _, binary = cv2.threshold(gray_image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            # Approximate polygon
            epsilon = 0.04 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            # Check if it's a triangle (3 vertices)
            if len(approx) == 3:
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(approx)

                # Filter by size
                if (self.triangle_min_size <= w <= self.triangle_max_size and
                    self.triangle_min_size <= h <= self.triangle_max_size):

                    # Calculate aspect ratio (should be roughly square for our triangles)
                    aspect_ratio = float(w) / h if h > 0 else 0
                    if 0.5 <= aspect_ratio <= 2.0:  # Allow some variation

                        # Calculate area ratio (filled triangle vs bounding box)
                        triangle_area = cv2.contourArea(approx)
                        bbox_area = w * h
                        area_ratio = triangle_area / bbox_area if bbox_area > 0 else 0

                        # Triangles should fill ~50% of bounding box (relaxed range)
                        if 0.2 <= area_ratio <= 0.8:
                            confidence = 0.7

                            candidate = SymbolCandidate(
                                bbox=(x, y, w, h),
                                confidence=confidence,
                                symbol_type='triangular',
                                detection_method='contour_triangle',
                                source_tile=''
                            )
                            candidates.append(candidate)

        return candidates

    def detect_in_tile(self, tile_path: str) -> List[SymbolCandidate]:
        """
        Detect symbol candidates in a single tile

        Args:
            tile_path: Path to tile image

        Returns:
            List of SymbolCandidate objects
        """
        # Load image
        tile = cv2.imread(str(tile_path))
        if tile is None:
            print(f"Warning: Failed to load tile {tile_path}", file=sys.stderr)
            return []

        # Convert to grayscale
        gray = cv2.cvtColor(tile, cv2.COLOR_BGR2GRAY)

        tile_filename = Path(tile_path).name

        # Detect circles
        circle_candidates = self.detect_circles(gray)
        for c in circle_candidates:
            c.source_tile = tile_filename

        # Detect triangles
        triangle_candidates = self.detect_triangles(gray)
        for c in triangle_candidates:
            c.source_tile = tile_filename

        # Combine
        all_candidates = circle_candidates + triangle_candidates

        # Apply NMS
        filtered_candidates = nms_per_symbol_type(all_candidates, self.nms_threshold)

        # Apply advanced geometric filtering if enabled
        if self.strict_filtering:
            filtered_candidates, _ = apply_geometric_filters(
                filtered_candidates,
                gray,
                strict_filtering=True,
                verbose=False
            )

        return filtered_candidates

    def detect_candidates(self, tile_path: str) -> List[Dict]:
        """
        Detect candidates in a tile and return as dicts (for API compatibility)
        
        Args:
            tile_path: Path to tile image
            
        Returns:
            List of candidate dicts
        """
        candidates = self.detect_in_tile(tile_path)
        return [c.to_dict() for c in candidates]

    def detect_in_directory(self, tiles_dir: str, verbose: bool = True) -> List[SymbolCandidate]:
        """
        Detect candidates in all tiles in a directory

        Args:
            tiles_dir: Directory containing tile images
            verbose: Print progress messages

        Returns:
            List of all candidates across all tiles
        """
        tiles_path = Path(tiles_dir)

        # Find all image files
        image_files = []
        for ext in ['*.jpg', '*.jpeg', '*.png']:
            image_files.extend(tiles_path.glob(ext))

        image_files = sorted(image_files)

        if not image_files:
            if verbose:
                print(f"No image files found in {tiles_dir}", file=sys.stderr)
            return []

        if verbose:
            print(f"\n{'='*70}", file=sys.stderr)
            print(f"STAGE 1: Geometric Shape Detection", file=sys.stderr)
            print(f"Processing {len(image_files)} tiles", file=sys.stderr)
            print(f"{'='*70}\n", file=sys.stderr)

        all_candidates = []
        start_time = time.time()
        total_before_filter = 0
        total_after_filter = 0

        for i, tile_path in enumerate(image_files, 1):
            if verbose:
                print(f"[{i}/{len(image_files)}] {tile_path.name}...", end=" ", flush=True, file=sys.stderr)

            candidates = self.detect_in_tile(str(tile_path))
            total_after_filter += len(candidates)

            if candidates:
                all_candidates.extend(candidates)
                if verbose:
                    # Count by type
                    circles = sum(1 for c in candidates if c.symbol_type == 'circular')
                    triangles = sum(1 for c in candidates if c.symbol_type == 'triangular')
                    print(f"✓ {circles} circles, {triangles} triangles", file=sys.stderr)
            else:
                if verbose:
                    print("(no candidates)", file=sys.stderr)

        elapsed = time.time() - start_time

        if verbose:
            print(f"\n{'='*70}", file=sys.stderr)
            print(f"STAGE 1 COMPLETE", file=sys.stderr)
            print(f"{'='*70}", file=sys.stderr)
            print(f"Total candidates: {len(all_candidates)}", file=sys.stderr)
            if self.strict_filtering:
                print(f"  (Advanced filtering enabled)", file=sys.stderr)
            print(f"Processing time: {elapsed:.2f} seconds", file=sys.stderr)
            print(f"Avg per tile: {elapsed/len(image_files):.3f} seconds", file=sys.stderr)

            # Breakdown by symbol type
            by_type = {}
            for c in all_candidates:
                by_type[c.symbol_type] = by_type.get(c.symbol_type, 0) + 1
            print(f"\nBy symbol type:", file=sys.stderr)
            for symbol_type, count in sorted(by_type.items()):
                print(f"  {symbol_type}: {count}", file=sys.stderr)

            print(f"{'='*70}\n", file=sys.stderr)

        return all_candidates


def main():
    """Test the Stage 1 geometric detector"""
    import argparse

    parser = argparse.ArgumentParser(description="Stage 1: Geometric Shape Detection")
    parser.add_argument('tiles_dir', help='Directory containing tiles')
    parser.add_argument('--circle-min', type=int, default=15, help='Min circle radius')
    parser.add_argument('--circle-max', type=int, default=50, help='Max circle radius')
    parser.add_argument('--triangle-min', type=int, default=20, help='Min triangle size')
    parser.add_argument('--triangle-max', type=int, default=80, help='Max triangle size')
    parser.add_argument('--nms', type=float, default=0.3, help='NMS IoU threshold')
    parser.add_argument('--strict-filtering', action='store_true',
                        help='Enable advanced geometric filtering to reduce false positives')
    parser.add_argument('--output', help='Output JSON file for candidates')

    args = parser.parse_args()

    # Initialize detector
    detector = Stage1GeometricDetector(
        circle_min_radius=args.circle_min,
        circle_max_radius=args.circle_max,
        triangle_min_size=args.triangle_min,
        triangle_max_size=args.triangle_max,
        nms_threshold=args.nms,
        strict_filtering=args.strict_filtering
    )

    # Detect candidates
    candidates = detector.detect_in_directory(args.tiles_dir, verbose=True)

    # Save to JSON if requested
    if args.output:
        output_data = {
            'tiles_dir': args.tiles_dir,
            'total_candidates': len(candidates),
            'candidates': [c.to_dict() for c in candidates]
        }

        with open(args.output, 'w') as f:
            json.dump(output_data, f, indent=2)

        print(f"\nSaved {len(candidates)} candidates to {args.output}")


if __name__ == '__main__':
    main()
