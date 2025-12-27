#!/usr/bin/env python3
"""
Phase 1B: Sheet Metadata Extraction Pipeline

Extract sheet metadata from construction plan title blocks using:
1. Title block detection (standard corner locations)
2. OCR extraction (PaddleOCR preferred, Tesseract fallback)
3. Regex parsing for common formats
4. Confidence scoring with LLM fallback option
"""

import os
import sys
import time
import json
import base64
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image

# Add src/utils to path
sys.path.insert(0, str(Path(__file__).parent))
from utils.title_block_patterns import TitleBlockParser


class MetadataExtractor:
    """
    Extract sheet metadata from construction plan title blocks using OCR

    Supports:
    - PaddleOCR (preferred - better accuracy)
    - Tesseract (fallback)
    - LLM vision (low confidence fallback)
    """

    def __init__(self,
                 ocr_engine: str = 'tesseract',
                 use_llm_fallback: bool = True,
                 llm_confidence_threshold: float = 0.5,
                 llm_model: str = "google/gemini-2.5-flash"):
        """
        Initialize metadata extractor

        Args:
            ocr_engine: 'tesseract' (default) or 'paddleocr' or 'llm_only'
            use_llm_fallback: Use LLM for low confidence cases
            llm_confidence_threshold: Confidence below which to use LLM fallback
            llm_model: OpenRouter model for LLM fallback
        """
        self.ocr_engine = ocr_engine.lower()
        self.use_llm_fallback = use_llm_fallback
        self.llm_confidence_threshold = llm_confidence_threshold
        self.llm_model = llm_model

        # Initialize parser
        self.parser = TitleBlockParser(case_sensitive=False)

        # Initialize OCR engine
        self._init_ocr_engine()

        print(f"MetadataExtractor initialized:")
        print(f"  OCR Engine: {self.ocr_engine}")
        print(f"  LLM Fallback: {'Enabled' if use_llm_fallback else 'Disabled'}")
        if use_llm_fallback:
            print(f"  LLM Model: {llm_model}")
            print(f"  Confidence Threshold: {llm_confidence_threshold}")

    def _init_ocr_engine(self):
        """Initialize the selected OCR engine"""
        if self.ocr_engine == 'paddleocr':
            try:
                from paddleocr import PaddleOCR
                # Initialize PaddleOCR (CPU mode for portability)
                self.ocr = PaddleOCR(
                    use_angle_cls=True,
                    lang='en',
                    use_gpu=False,
                    show_log=False
                )
                print("  ✓ PaddleOCR initialized successfully")
            except Exception as e:
                print(f"  ✗ PaddleOCR not available: {e}")
                print("  Falling back to Tesseract...")
                self.ocr_engine = 'tesseract'
                self._init_tesseract()
        elif self.ocr_engine == 'tesseract':
            self._init_tesseract()
        elif self.ocr_engine == 'llm_only':
            print("  Using LLM-only mode (no local OCR)")
        else:
            raise ValueError(f"Unknown OCR engine: {self.ocr_engine}")

    def _init_tesseract(self):
        """Initialize Tesseract OCR"""
        try:
            import pytesseract
            self.tesseract = pytesseract
            # Test if tesseract binary is available (don't call get_tesseract_version as it may not be installed)
            print(f"  ✓ pytesseract module loaded (system tesseract may be needed)")
        except Exception as e:
            print(f"  ✗ Tesseract not available: {e}")
            if self.use_llm_fallback:
                print("  Will use LLM-only mode")
                self.ocr_engine = 'llm_only'
            else:
                print("  OCR will not work without Tesseract!")
                self.ocr_engine = None

    def extract_sheet_info(self, plan_image_path: str) -> Dict:
        """
        Extract sheet metadata from construction plan

        Args:
            plan_image_path: Path to full plan image (PDF will be converted)

        Returns:
            {
                'sheet_name': 'A7',
                'sheet_title': 'Floor Plan - Level 2',
                'confidence': 0.92,
                'method': 'paddleocr',  # or 'tesseract', 'llm_fallback', 'manual'
                'all_sheets': ['A5', 'A6', 'A7'],  # if extractable
                'extraction_time': 2.3,  # seconds
                'title_block_location': 'bottom_right',
                'ocr_text': '...',  # raw OCR output for debugging
            }
        """
        start_time = time.time()

        # Load image (convert PDF if needed)
        plan_image = self._load_plan_image(plan_image_path)

        if plan_image is None:
            return {
                'sheet_name': None,
                'sheet_title': None,
                'confidence': 0.0,
                'method': 'failed',
                'error': 'Failed to load plan image',
                'extraction_time': time.time() - start_time
            }

        # Detect title block region(s)
        title_block_regions = self._detect_title_blocks(plan_image)

        if not title_block_regions:
            return {
                'sheet_name': None,
                'sheet_title': None,
                'confidence': 0.0,
                'method': 'failed',
                'error': 'No title block detected',
                'extraction_time': time.time() - start_time
            }

        # Try OCR on each region until we get good results
        best_result = None
        best_confidence = 0.0

        # If using llm_only mode, skip OCR and go straight to LLM
        if self.ocr_engine == 'llm_only':
            print("  Using LLM-only mode, skipping OCR...")
            llm_result = self._llm_fallback(title_block_regions[0][1])  # Use first (best) region

            if llm_result:
                best_result = llm_result
                best_result['method'] = 'llm_only'
                best_result['title_block_location'] = title_block_regions[0][0]
        else:
            # Regular OCR path
            for location, region_image in title_block_regions:
                # Run OCR
                ocr_text = self._run_ocr(region_image)

                if not ocr_text:
                    continue

                # Parse with regex
                parsed = self.parser.parse_title_block(ocr_text)

                if parsed['confidence'] > best_confidence:
                    best_confidence = parsed['confidence']
                    best_result = {
                        'sheet_name': parsed['sheet_name'],
                        'sheet_title': parsed['sheet_title'],
                        'confidence': parsed['confidence'],
                        'method': self.ocr_engine,
                        'all_sheets': parsed.get('all_sheets', []),
                        'title_block_location': location,
                        'ocr_text': ocr_text[:500],  # Truncate for storage
                        'project_info': parsed.get('project_info', {}),
                    }

            # Check if we need LLM fallback
            if best_result and best_result['confidence'] < self.llm_confidence_threshold and self.use_llm_fallback:
                print(f"  Low confidence ({best_result['confidence']:.2f}), trying LLM fallback...")
                llm_result = self._llm_fallback(title_block_regions[0][1])  # Use best region

                if llm_result and llm_result.get('confidence', 0) > best_result['confidence']:
                    best_result = llm_result
                    best_result['method'] = 'llm_fallback'
            elif not best_result and self.use_llm_fallback:
                # No OCR results at all, try LLM fallback
                print("  No OCR results, trying LLM fallback...")
                llm_result = self._llm_fallback(title_block_regions[0][1])

                if llm_result:
                    best_result = llm_result
                    best_result['method'] = 'llm_fallback'
                    best_result['title_block_location'] = title_block_regions[0][0]

        # Finalize result
        if best_result:
            best_result['extraction_time'] = time.time() - start_time
            return best_result
        else:
            return {
                'sheet_name': None,
                'sheet_title': None,
                'confidence': 0.0,
                'method': 'failed',
                'error': 'OCR extraction failed',
                'extraction_time': time.time() - start_time
            }

    def _load_plan_image(self, plan_path: str) -> Optional[np.ndarray]:
        """
        Load plan image from file (supports PDF, PNG, JPG)

        Args:
            plan_path: Path to plan file

        Returns:
            Numpy array image or None
        """
        plan_path = Path(plan_path)

        if not plan_path.exists():
            print(f"Error: Plan file not found: {plan_path}")
            return None

        # Handle PDF
        if plan_path.suffix.lower() == '.pdf':
            return self._convert_pdf_to_image(str(plan_path))

        # Handle image files
        try:
            img = cv2.imread(str(plan_path))
            if img is None:
                print(f"Error: Failed to load image: {plan_path}")
                return None
            return img
        except Exception as e:
            print(f"Error loading image {plan_path}: {e}")
            return None

    def _convert_pdf_to_image(self, pdf_path: str, dpi: int = 150) -> Optional[np.ndarray]:
        """
        Convert first page of PDF to image

        Args:
            pdf_path: Path to PDF file
            dpi: Resolution for conversion

        Returns:
            Numpy array image or None
        """
        # Try PyMuPDF first (fitz)
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(pdf_path)
            if len(doc) == 0:
                print(f"Error: PDF has no pages: {pdf_path}")
                return None

            # Get first page
            page = doc[0]

            # Render to pixmap at specified DPI
            zoom = dpi / 72.0  # 72 DPI is default
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # Convert to numpy array
            img_data = pix.tobytes("png")
            nparr = np.frombuffer(img_data, np.uint8)
            opencv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            doc.close()
            return opencv_image

        except ImportError:
            pass  # Try pdf2image next
        except Exception as e:
            print(f"Error with PyMuPDF: {e}")

        # Fallback to pdf2image
        try:
            from pdf2image import convert_from_path

            # Convert first page only
            images = convert_from_path(pdf_path, dpi=dpi, first_page=1, last_page=1)

            if not images:
                print(f"Error: No images extracted from PDF: {pdf_path}")
                return None

            # Convert PIL Image to OpenCV format
            pil_image = images[0]
            opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

            return opencv_image

        except ImportError:
            print("Error: No PDF library available.")
            print("Install PyMuPDF: pip install pymupdf")
            print("Or pdf2image: pip install pdf2image (requires poppler-utils)")
            return None
        except Exception as e:
            print(f"Error converting PDF to image: {e}")
            return None

    def _detect_title_blocks(self, plan_image: np.ndarray) -> List[Tuple[str, np.ndarray]]:
        """
        Detect title block regions in standard locations

        Construction plans typically have title blocks in:
        - Bottom-right corner (most common)
        - Top-right corner
        - Bottom-left corner
        - Right edge (vertical title block)

        Args:
            plan_image: Full plan image

        Returns:
            List of (location_name, cropped_region) tuples, ordered by priority
        """
        h, w = plan_image.shape[:2]
        regions = []

        # Define standard title block sizes (as fraction of image)
        # Most title blocks are in bottom-right, roughly 15-25% width x 10-20% height

        # Bottom-right (most common)
        tb_width = int(w * 0.25)  # 25% of width
        tb_height = int(h * 0.15)  # 15% of height
        x1 = w - tb_width
        y1 = h - tb_height
        bottom_right = plan_image[y1:h, x1:w]
        regions.append(('bottom_right', bottom_right))

        # Bottom-right extended (larger region for safety)
        tb_width_ext = int(w * 0.35)
        tb_height_ext = int(h * 0.20)
        x1_ext = w - tb_width_ext
        y1_ext = h - tb_height_ext
        bottom_right_ext = plan_image[y1_ext:h, x1_ext:w]
        regions.append(('bottom_right_extended', bottom_right_ext))

        # Top-right (alternate location)
        tb_height_top = int(h * 0.15)
        top_right = plan_image[0:tb_height_top, x1:w]
        regions.append(('top_right', top_right))

        # Bottom-left (rare but possible)
        bottom_left = plan_image[y1:h, 0:tb_width]
        regions.append(('bottom_left', bottom_left))

        # Right edge vertical (for vertical title blocks)
        right_vertical_width = int(w * 0.12)
        right_edge = plan_image[:, w-right_vertical_width:w]
        regions.append(('right_edge', right_edge))

        return regions

    def _run_ocr(self, image_region: np.ndarray) -> str:
        """
        Run OCR on title block region

        Args:
            image_region: Cropped title block image

        Returns:
            OCR text string
        """
        if self.ocr_engine == 'paddleocr':
            return self._run_paddleocr(image_region)
        elif self.ocr_engine == 'tesseract':
            return self._run_tesseract(image_region)
        elif self.ocr_engine == 'llm_only':
            return ""  # Will use LLM fallback
        else:
            return ""

    def _run_paddleocr(self, image_region: np.ndarray) -> str:
        """
        Run PaddleOCR on image region

        Args:
            image_region: Image to OCR

        Returns:
            Extracted text
        """
        try:
            # PaddleOCR expects RGB or path
            result = self.ocr.ocr(image_region, cls=True)

            if not result or not result[0]:
                return ""

            # Extract text from results
            text_lines = []
            for line in result[0]:
                text = line[1][0]  # OCR text
                confidence = line[1][1]  # Confidence score

                # Only include high-confidence text
                if confidence > 0.5:
                    text_lines.append(text)

            return '\n'.join(text_lines)

        except Exception as e:
            print(f"PaddleOCR error: {e}")
            return ""

    def _run_tesseract(self, image_region: np.ndarray) -> str:
        """
        Run Tesseract OCR on image region

        Args:
            image_region: Image to OCR

        Returns:
            Extracted text
        """
        try:
            # Tesseract works better with preprocessed images
            gray = cv2.cvtColor(image_region, cv2.COLOR_BGR2GRAY)

            # Apply thresholding for better OCR
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # Run Tesseract
            text = self.tesseract.image_to_string(thresh)

            return text.strip()

        except Exception as e:
            print(f"Tesseract error: {e}")
            return ""

    def _llm_fallback(self, title_block_image: np.ndarray) -> Optional[Dict]:
        """
        Use LLM vision model for low-confidence cases

        Args:
            title_block_image: Title block region image

        Returns:
            Metadata dict or None
        """
        try:
            from dotenv import load_dotenv
            import requests

            load_dotenv()

            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                print("Warning: OPENROUTER_API_KEY not found, LLM fallback disabled")
                return None

            # Encode image
            _, buffer = cv2.imencode('.png', title_block_image)
            img_b64 = base64.b64encode(buffer).decode('utf-8')
            img_url = f"data:image/png;base64,{img_b64}"

            # Prompt for metadata extraction
            prompt = """Analyze this construction plan title block and extract:

1. Sheet name/number (e.g., "A7", "A-007", "A5")
2. Sheet title/description (e.g., "Floor Plan - Level 2")
3. Any other visible sheet names (for project context)

Return ONLY a JSON object with this structure:
{
  "sheet_name": "A7",
  "sheet_title": "Floor Plan - Level 2",
  "all_sheets": ["A5", "A6", "A7"],
  "confidence": 0.95
}

If you cannot find certain fields, use null. Set confidence based on text clarity."""

            # API call
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.llm_model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": img_url}}
                        ]
                    }],
                    "temperature": 0.1
                },
                timeout=30
            )

            if response.status_code != 200:
                print(f"LLM API error: {response.status_code}")
                return None

            result_text = response.json()['choices'][0]['message']['content']

            # Debug: print raw response
            if os.getenv('DEBUG_METADATA'):
                print(f"LLM Response: {result_text[:200]}")

            # Parse JSON response
            import re
            cleaned = result_text.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned.split('```json')[1].split('```')[0]
            elif cleaned.startswith('```'):
                cleaned = cleaned.split('```')[1].split('```')[0]

            metadata = json.loads(cleaned.strip())

            # Debug: print parsed metadata
            if os.getenv('DEBUG_METADATA'):
                print(f"Parsed metadata: {metadata}")

            return metadata

        except Exception as e:
            print(f"LLM fallback error: {e}")
            import traceback
            if os.getenv('DEBUG_METADATA'):
                traceback.print_exc()
            return None

    def reconstruct_plan_from_tiles(self, tiles_dir: str, output_path: str = None) -> Optional[str]:
        """
        Reconstruct full plan image from tiles

        Args:
            tiles_dir: Directory containing tile images (e.g., "tiles/plan_files/4")
            output_path: Optional path to save reconstructed image

        Returns:
            Path to reconstructed image or None
        """
        tiles_path = Path(tiles_dir)

        if not tiles_path.exists():
            print(f"Error: Tiles directory not found: {tiles_dir}")
            return None

        # Get all tile files
        tile_files = sorted(tiles_path.glob("*.jpg")) + sorted(tiles_path.glob("*.png"))

        if not tile_files:
            print(f"Error: No tile images found in {tiles_dir}")
            return None

        # Parse tile coordinates from filenames (format: row_col.jpg)
        tiles_coords = []
        for tile_file in tile_files:
            name = tile_file.stem
            parts = name.split('_')
            if len(parts) == 2:
                try:
                    row, col = int(parts[0]), int(parts[1])
                    tiles_coords.append((row, col, tile_file))
                except ValueError:
                    continue

        if not tiles_coords:
            print("Error: Could not parse tile coordinates")
            return None

        # Determine grid dimensions
        max_row = max(coord[0] for coord in tiles_coords)
        max_col = max(coord[1] for coord in tiles_coords)

        # Load all tiles to get actual dimensions
        tile_grid = {}
        max_tile_h = 0
        max_tile_w = 0

        for row, col, tile_file in tiles_coords:
            tile_img = cv2.imread(str(tile_file))
            if tile_img is not None:
                tile_grid[(row, col)] = tile_img
                h, w = tile_img.shape[:2]
                max_tile_h = max(max_tile_h, h)
                max_tile_w = max(max_tile_w, w)

        # Create blank canvas with appropriate size
        canvas_h = (max_row + 1) * max_tile_h
        canvas_w = (max_col + 1) * max_tile_w
        canvas = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255  # White background

        # Place tiles
        for (row, col), tile_img in tile_grid.items():
            y = row * max_tile_h
            x = col * max_tile_w
            h, w = tile_img.shape[:2]
            canvas[y:y+h, x:x+w] = tile_img

        # Save reconstructed image
        if output_path is None:
            output_path = tiles_path.parent / f"{tiles_path.name}_reconstructed.png"

        cv2.imwrite(str(output_path), canvas)
        print(f"Reconstructed plan saved to: {output_path}")

        return str(output_path)


def main():
    """Test metadata extraction"""
    import argparse

    parser = argparse.ArgumentParser(description="Extract sheet metadata from construction plans")
    parser.add_argument('plan_path', help='Path to plan image/PDF or tiles directory')
    parser.add_argument('--ocr-engine', choices=['paddleocr', 'tesseract', 'llm_only'], default='tesseract')
    parser.add_argument('--no-llm-fallback', action='store_true', help='Disable LLM fallback')
    parser.add_argument('--reconstruct-tiles', action='store_true', help='Reconstruct from tiles directory')
    parser.add_argument('--output', help='Output JSON file')

    args = parser.parse_args()

    # Initialize extractor
    extractor = MetadataExtractor(
        ocr_engine=args.ocr_engine,
        use_llm_fallback=not args.no_llm_fallback
    )

    # Handle tile reconstruction
    if args.reconstruct_tiles:
        print(f"\nReconstructing plan from tiles: {args.plan_path}")
        reconstructed_path = extractor.reconstruct_plan_from_tiles(args.plan_path)
        if not reconstructed_path:
            print("Failed to reconstruct plan from tiles")
            return 1
        plan_path = reconstructed_path
    else:
        plan_path = args.plan_path

    # Extract metadata
    print(f"\nExtracting metadata from: {plan_path}")
    print("=" * 70)

    result = extractor.extract_sheet_info(plan_path)

    # Print results
    print("\nExtraction Results:")
    print("=" * 70)
    print(f"Sheet Name: {result.get('sheet_name', 'N/A')}")
    print(f"Sheet Title: {result.get('sheet_title', 'N/A')}")
    print(f"Confidence: {result.get('confidence', 0):.2f}")
    print(f"Method: {result.get('method', 'N/A')}")
    print(f"Location: {result.get('title_block_location', 'N/A')}")
    print(f"Extraction Time: {result.get('extraction_time', 0):.2f}s")

    if result.get('all_sheets'):
        print(f"All Sheets Found: {', '.join(result['all_sheets'])}")

    if result.get('project_info'):
        print(f"Project Info: {result['project_info']}")

    if result.get('error'):
        print(f"Error: {result['error']}")

    # Save results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\nResults saved to: {args.output}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
