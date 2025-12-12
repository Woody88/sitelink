#!/usr/bin/env python3
"""
OCR Prefilter for Stage 1.5: Fast text-based candidate filtering

Reduces LLM validation load by filtering candidates using fast OCR.
Three-class decision: ACCEPT, REJECT, UNCERTAIN
"""

import re
import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import sys
import time

# Import Stage 1 candidate structure
sys.path.insert(0, str(Path(__file__).parent))
from stage1_geometric_detector import SymbolCandidate


class OCRPrefilter:
    """
    Fast OCR-based prefilter to reduce LLM validation load

    Three-class decision system:
    - ACCEPT: High confidence matches (skip LLM)
    - REJECT: Clear false positives (skip LLM)
    - UNCERTAIN: Send to LLM for final validation
    """

    def __init__(self,
                 valid_sheets: List[str] = None,
                 valid_details: List[str] = None,
                 ocr_engine: str = 'easyocr',
                 confidence_threshold: float = 0.7,
                 padding_percent: float = 0.20,
                 verbose: bool = True):
        """
        Initialize OCR prefilter

        Args:
            valid_sheets: List of valid sheet names (e.g., ['A5', 'A6', 'A7'])
            valid_details: List of valid detail identifiers (e.g., ['1','2','3','N'])
            ocr_engine: 'easyocr' (default), 'paddleocr', or 'tesseract'
            confidence_threshold: Min OCR confidence for ACCEPT (0.7 = 70%)
            padding_percent: Extra padding around bbox for OCR (0.20 = 20%)
            verbose: Print progress messages
        """
        self.valid_sheets = [s.upper() for s in (valid_sheets or [])]
        self.valid_details = valid_details or ['1', '2', '3', '4', '5', '6', '7', 'N']
        self.ocr_engine_name = ocr_engine
        self.confidence_threshold = confidence_threshold
        self.padding_percent = padding_percent
        self.verbose = verbose

        # Compile regex pattern for marker format: [detail]/[sheet]
        # Examples: "3/A7", "N/11", "6/A5"
        self.marker_pattern = re.compile(r'^([0-9N])\s*/\s*([A-Z0-9]+)$', re.IGNORECASE)

        # Initialize OCR engine
        self.ocr = self._initialize_ocr_engine(ocr_engine)

        if verbose:
            print(f"OCRPrefilter initialized:", file=sys.stderr)
            print(f"  OCR engine: {ocr_engine}", file=sys.stderr)
            print(f"  Confidence threshold: {confidence_threshold}", file=sys.stderr)
            if self.valid_sheets:
                print(f"  Valid sheets: {', '.join(self.valid_sheets)}", file=sys.stderr)
            print(f"  Valid details: {', '.join(self.valid_details)}", file=sys.stderr)

    def _initialize_ocr_engine(self, engine: str):
        """Initialize the specified OCR engine"""
        if engine == 'paddleocr':
            try:
                from paddleocr import PaddleOCR
                return PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False,
                               show_log=False)
            except ImportError:
                print("Warning: PaddleOCR not available, falling back to easyocr", file=sys.stderr)
                engine = 'easyocr'

        if engine == 'tesseract':
            try:
                import pytesseract
                # Check if tesseract binary is available
                pytesseract.get_tesseract_version()
                return pytesseract
            except (ImportError, Exception) as e:
                print(f"Warning: Tesseract not available: {e}", file=sys.stderr)
                # Try easyocr as fallback
                try:
                    import easyocr
                    print("Falling back to easyocr...", file=sys.stderr)
                    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                    return reader
                except ImportError:
                    print("Warning: Neither tesseract nor easyocr available. OCR prefilter will be disabled.", file=sys.stderr)
                    return None

        if engine == 'easyocr':
            try:
                import easyocr
                # Initialize with English only for speed
                reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                return reader
            except ImportError:
                print("Warning: EasyOCR not available. Trying tesseract as fallback...", file=sys.stderr)
                try:
                    import pytesseract
                    pytesseract.get_tesseract_version()
                    return pytesseract
                except (ImportError, Exception):
                    print("Warning: No OCR engine available. OCR prefilter will be disabled.", file=sys.stderr)
                    return None

        return None

    def filter_candidates(self,
                         candidates: List[SymbolCandidate],
                         tiles_dir: str) -> Dict[str, List[SymbolCandidate]]:
        """
        Classify candidates as ACCEPT, REJECT, or UNCERTAIN

        Args:
            candidates: List of Stage 1 geometric detection candidates
            tiles_dir: Directory containing tile images

        Returns:
            {
                'accept': [],      # High confidence matches → skip LLM
                'reject': [],      # Clear false positives → skip LLM
                'uncertain': []    # Send to LLM for validation
            }
        """
        # If OCR engine is not available, skip prefiltering and send all to LLM
        if self.ocr is None:
            if self.verbose:
                print(f"\n{'='*70}", file=sys.stderr)
                print("OCR PREFILTER (Stage 1.5) - DISABLED (No OCR engine available)", file=sys.stderr)
                print(f"All {len(candidates)} candidates will be sent to LLM", file=sys.stderr)
                print(f"{'='*70}\n", file=sys.stderr)
            return {
                'accept': [],
                'reject': [],
                'uncertain': candidates  # Send all to LLM if OCR unavailable
            }

        if self.verbose:
            print(f"\n{'='*70}", file=sys.stderr)
            print("OCR PREFILTER (Stage 1.5)", file=sys.stderr)
            print(f"Filtering {len(candidates)} candidates", file=sys.stderr)
            print(f"{'='*70}\n", file=sys.stderr)

        results = {
            'accept': [],
            'reject': [],
            'uncertain': []
        }

        tiles_path = Path(tiles_dir)

        # Group candidates by tile for efficiency
        by_tile = {}
        for c in candidates:
            if c.source_tile not in by_tile:
                by_tile[c.source_tile] = []
            by_tile[c.source_tile].append(c)

        start_time = time.time()
        processed = 0

        for tile_name, tile_candidates in by_tile.items():
            # Load tile image once
            tile_path = tiles_path / tile_name
            tile_image = cv2.imread(str(tile_path))

            if tile_image is None:
                if self.verbose:
                    print(f"Warning: Failed to load {tile_name}", file=sys.stderr)
                # If can't load image, send to UNCERTAIN
                results['uncertain'].extend(tile_candidates)
                continue

            if self.verbose:
                print(f"[{tile_name}] Processing {len(tile_candidates)} candidates...",
                      end=" ", flush=True, file=sys.stderr)

            tile_results = {'accept': 0, 'reject': 0, 'uncertain': 0}

            for candidate in tile_candidates:
                # Extract text with OCR
                text, confidence = self._extract_text(candidate, tile_image)

                # Classify based on pattern matching and confidence
                classification = self._classify_candidate(text, confidence)

                results[classification].append(candidate)
                tile_results[classification] += 1
                processed += 1

            if self.verbose:
                print(f"✓ Accept: {tile_results['accept']}, "
                      f"Reject: {tile_results['reject']}, "
                      f"Uncertain: {tile_results['uncertain']}", file=sys.stderr)

        elapsed = time.time() - start_time

        if self.verbose:
            self._print_summary(results, elapsed, processed)

        return results

    def _extract_text(self,
                     candidate: SymbolCandidate,
                     tile_image: np.ndarray) -> Tuple[str, float]:
        """
        Extract text from candidate crop using OCR

        Args:
            candidate: SymbolCandidate object
            tile_image: Full tile image

        Returns:
            (extracted_text, confidence_score)
        """
        # Crop candidate region with padding
        crop = self._crop_candidate(tile_image, candidate.bbox)

        if crop is None or crop.size == 0:
            return "", 0.0

        # Preprocess crop for better OCR
        crop_preprocessed = self._preprocess_for_ocr(crop)

        # Run OCR based on engine type
        try:
            if self.ocr_engine_name == 'paddleocr':
                return self._extract_paddleocr(crop_preprocessed)
            elif self.ocr_engine_name == 'tesseract':
                return self._extract_tesseract(crop_preprocessed)
            else:  # easyocr
                return self._extract_easyocr(crop_preprocessed)
        except Exception as e:
            if self.verbose:
                print(f"  OCR error: {e}", file=sys.stderr)
            return "", 0.0

    def _crop_candidate(self,
                       tile_image: np.ndarray,
                       bbox: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
        """
        Crop candidate region with padding

        Args:
            tile_image: Full tile image
            bbox: (x, y, w, h) bounding box

        Returns:
            Cropped image region (or None if invalid)
        """
        x, y, w, h = bbox

        # Add padding
        pad_w = int(w * self.padding_percent)
        pad_h = int(h * self.padding_percent)

        # Crop with bounds checking
        x1 = max(0, x - pad_w)
        y1 = max(0, y - pad_h)
        x2 = min(tile_image.shape[1], x + w + pad_w)
        y2 = min(tile_image.shape[0], y + h + pad_h)

        # Ensure valid crop
        if x2 <= x1 or y2 <= y1:
            return None

        crop = tile_image[y1:y2, x1:x2]

        # Ensure crop is not empty
        if crop.size == 0:
            return None

        return crop

    def _preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for better OCR results

        Args:
            image: Input image

        Returns:
            Preprocessed image
        """
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Apply adaptive thresholding for better contrast
        # This helps with text extraction from construction plans
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )

        # Invert back (text should be dark on light background)
        binary = cv2.bitwise_not(binary)

        # Optional: resize small images for better OCR
        min_height = 32
        if binary.shape[0] < min_height:
            scale = min_height / binary.shape[0]
            new_width = int(binary.shape[1] * scale)
            binary = cv2.resize(binary, (new_width, min_height),
                              interpolation=cv2.INTER_CUBIC)

        return binary

    def _extract_paddleocr(self, image: np.ndarray) -> Tuple[str, float]:
        """Extract text using PaddleOCR"""
        result = self.ocr.ocr(image, cls=True)

        if not result or not result[0]:
            return "", 0.0

        # Combine all detected text with highest confidence
        texts = []
        confidences = []

        for line in result[0]:
            text = line[1][0]
            conf = line[1][1]
            texts.append(text)
            confidences.append(conf)

        combined_text = ' '.join(texts).strip()
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return combined_text, avg_confidence

    def _extract_tesseract(self, image: np.ndarray) -> Tuple[str, float]:
        """Extract text using Tesseract"""
        import pytesseract
        from PIL import Image

        # Convert numpy array to PIL Image
        pil_image = Image.fromarray(image)

        # Get detailed data including confidence
        data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)

        # Extract text and confidence
        texts = []
        confidences = []

        for i, conf in enumerate(data['conf']):
            if conf > 0:  # Valid detection
                text = data['text'][i]
                if text.strip():
                    texts.append(text)
                    confidences.append(conf / 100.0)  # Normalize to 0-1

        combined_text = ' '.join(texts).strip()
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return combined_text, avg_confidence

    def _extract_easyocr(self, image: np.ndarray) -> Tuple[str, float]:
        """Extract text using EasyOCR"""
        # EasyOCR expects image in BGR or RGB
        results = self.ocr.readtext(image)

        if not results:
            return "", 0.0

        # Combine all detected text with highest confidence
        texts = []
        confidences = []

        for (bbox, text, conf) in results:
            texts.append(text)
            confidences.append(conf)

        combined_text = ' '.join(texts).strip()
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return combined_text, avg_confidence

    def _classify_candidate(self, text: str, ocr_confidence: float) -> str:
        """
        Classify candidate as 'accept', 'reject', or 'uncertain'

        Decision logic:
        1. If OCR confidence < 0.3 → 'uncertain' (too blurry, let LLM decide)
        2. If text doesn't match pattern → 'reject' (not a marker)
        3. If valid_sheets provided:
           a. If sheet in valid_sheets AND confidence ≥ threshold → 'accept'
           b. If sheet NOT in valid_sheets → 'reject'
           c. If confidence < threshold → 'uncertain'
        4. If no valid_sheets:
           a. If confidence ≥ threshold AND matches pattern → 'accept'
           b. Otherwise → 'uncertain'

        Args:
            text: OCR extracted text
            ocr_confidence: OCR confidence score (0-1)

        Returns:
            'accept', 'reject', or 'uncertain'
        """
        # Clean up text
        text = text.strip().upper()

        # Very low confidence → uncertain (LLM might see better)
        if ocr_confidence < 0.3:
            return 'uncertain'

        # Try to match marker pattern
        match = self.marker_pattern.match(text)

        if not match:
            # Check if text is completely empty or nonsensical
            if not text or len(text) < 2:
                return 'reject'  # Empty or very short

            # Check for common false positive patterns
            if self._is_false_positive_pattern(text):
                return 'reject'

            # Text doesn't match but has some content
            # If confidence is very high, still reject (confident it's not a marker)
            if ocr_confidence >= 0.7:
                return 'reject'
            else:
                # Lower confidence, might be OCR error, let LLM check
                return 'uncertain'

        # Extract detail and sheet from match
        detail, sheet = match.groups()
        detail = detail.upper()
        sheet = sheet.upper()

        # Validate detail number
        if detail not in self.valid_details:
            # Invalid detail number
            if ocr_confidence >= 0.7:
                return 'reject'  # Confident it's wrong
            else:
                return 'uncertain'  # Might be OCR error (e.g., 6 vs N)

        # Validate against known valid sheets
        if self.valid_sheets:
            if sheet in self.valid_sheets:
                # Valid sheet and matches pattern
                if ocr_confidence >= self.confidence_threshold:
                    return 'accept'  # High confidence match
                else:
                    return 'uncertain'  # Matches but low confidence
            else:
                # Sheet not in valid list
                # Check for common OCR errors (fuzzy match)
                if self._fuzzy_match_sheet(sheet):
                    return 'uncertain'  # Might be OCR error
                else:
                    return 'reject'  # Definitely invalid sheet

        # No valid_sheets list → rely on pattern match and confidence only
        if ocr_confidence >= self.confidence_threshold:
            return 'accept'  # High confidence pattern match
        else:
            return 'uncertain'  # Pattern matches but low confidence

    def _is_false_positive_pattern(self, text: str) -> bool:
        """
        Check if text matches common false positive patterns

        Args:
            text: OCR extracted text (already uppercased)

        Returns:
            True if likely a false positive
        """
        # Common false positive keywords
        false_positive_keywords = [
            'SCALE', 'PLAN', 'ELEVATION', 'SECTION', 'DETAIL',
            'NOTES', 'LEGEND', 'TITLE', 'DATE', 'DRAWN',
            'SHEET', 'NORTH', 'SOUTH', 'EAST', 'WEST',
            'GENERAL', 'ARCHITECTURAL', 'STRUCTURAL',
            'FLOOR', 'ROOF', 'FOUNDATION', 'WALL'
        ]

        for keyword in false_positive_keywords:
            if keyword in text:
                return True

        # Very long text is unlikely to be a marker
        if len(text) > 20:
            return True

        # Text with lots of special characters
        special_char_count = sum(1 for c in text if not c.isalnum() and c != '/')
        if special_char_count > 3:
            return True

        return False

    def _fuzzy_match_sheet(self, sheet: str, max_distance: int = 1) -> bool:
        """
        Check if sheet name is close to any valid sheet (Levenshtein distance)

        Args:
            sheet: Sheet name to check
            max_distance: Maximum edit distance to allow

        Returns:
            True if close match found
        """
        if not self.valid_sheets:
            return False

        for valid_sheet in self.valid_sheets:
            distance = self._levenshtein_distance(sheet, valid_sheet)
            if distance <= max_distance:
                return True

        return False

    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Levenshtein distance between two strings

        Args:
            s1: First string
            s2: Second string

        Returns:
            Edit distance
        """
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                # Cost of insertions, deletions, or substitutions
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def _print_summary(self, results: Dict, elapsed: float, processed: int):
        """Print filtering summary"""
        total = sum(len(results[k]) for k in results)

        print(f"\n{'='*70}", file=sys.stderr)
        print("OCR PREFILTER COMPLETE", file=sys.stderr)
        print(f"{'='*70}", file=sys.stderr)
        print(f"Total candidates: {total}", file=sys.stderr)
        print(f"  ✓ Accepted (high confidence): {len(results['accept'])} "
              f"({len(results['accept'])/total*100:.1f}%)", file=sys.stderr)
        print(f"  ✗ Rejected (false positives): {len(results['reject'])} "
              f"({len(results['reject'])/total*100:.1f}%)", file=sys.stderr)
        print(f"  ? Uncertain (LLM required): {len(results['uncertain'])} "
              f"({len(results['uncertain'])/total*100:.1f}%)", file=sys.stderr)

        llm_reduction = (1 - len(results['uncertain']) / total) * 100 if total > 0 else 0
        print(f"\nLLM call reduction: {llm_reduction:.1f}%", file=sys.stderr)
        print(f"Processing time: {elapsed:.2f}s", file=sys.stderr)
        print(f"Avg per candidate: {elapsed/processed*1000:.1f}ms", file=sys.stderr)
        print(f"{'='*70}\n", file=sys.stderr)


def main():
    """Test OCR prefilter"""
    import argparse

    parser = argparse.ArgumentParser(description="OCR Prefilter for Stage 1.5")
    parser.add_argument('candidates_json', help='Stage 1 candidates JSON file')
    parser.add_argument('tiles_dir', help='Directory containing tile images')
    parser.add_argument('--valid-sheets', nargs='+',
                       help='Valid sheet names (e.g., --valid-sheets A5 A6 A7)')
    parser.add_argument('--ocr-engine', choices=['easyocr', 'paddleocr', 'tesseract'],
                       default='easyocr', help='OCR engine to use')
    parser.add_argument('--confidence', type=float, default=0.7,
                       help='Confidence threshold for ACCEPT (default: 0.7)')
    parser.add_argument('--output', help='Output JSON file')

    args = parser.parse_args()

    # Load Stage 1 candidates
    import json
    with open(args.candidates_json) as f:
        stage1_data = json.load(f)

    # Convert to SymbolCandidate objects
    candidates = []
    for c in stage1_data['candidates']:
        candidate = SymbolCandidate(
            bbox=tuple(c['bbox']),
            confidence=c['confidence'],
            symbol_type=c['symbol_type'],
            detection_method=c.get('detection_method', 'unknown'),
            source_tile=c['source_tile']
        )
        candidates.append(candidate)

    # Initialize prefilter
    prefilter = OCRPrefilter(
        valid_sheets=args.valid_sheets,
        ocr_engine=args.ocr_engine,
        confidence_threshold=args.confidence,
        verbose=True
    )

    # Filter candidates
    results = prefilter.filter_candidates(candidates, args.tiles_dir)

    # Save results
    if args.output:
        output_data = {
            'total_candidates': len(candidates),
            'accepted': len(results['accept']),
            'rejected': len(results['reject']),
            'uncertain': len(results['uncertain']),
            'llm_reduction_percent': (1 - len(results['uncertain'])/len(candidates))*100,
            'results': {
                'accept': [c.to_dict() for c in results['accept']],
                'reject': [c.to_dict() for c in results['reject']],
                'uncertain': [c.to_dict() for c in results['uncertain']]
            }
        }

        with open(args.output, 'w') as f:
            json.dump(output_data, f, indent=2)

        print(f"Results saved to: {args.output}")


if __name__ == '__main__':
    main()
