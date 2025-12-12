#!/usr/bin/env python3
"""
Stage 2: LLM Validation and Text Extraction

Takes candidates from Stage 1 and validates them using Gemini 2.5 Flash
with few-shot learning. Reuses logic from test_vision_fewshot.py.
"""

import os
import sys
import json
import base64
import time
import difflib
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import cv2
import numpy as np
import requests
from dotenv import load_dotenv

# Import Stage 1 candidate structure
sys.path.insert(0, str(Path(__file__).parent))
from stage1_geometric_detector import SymbolCandidate

load_dotenv()


class Stage2LLMValidator:
    """
    Stage 2: LLM validation and OCR
    
    Validates Stage 1 candidates and extracts text using
    few-shot learning approach.
    """

    def __init__(self,
                 batch_size: int = 10,
                 padding_percent: float = 0.20,
                 model: str = "google/gemini-2.5-flash",
                 temperature: float = 0.0,
                 valid_sheets: List[str] = None):
        """
        Initialize Stage 2 validator

        Args:
            batch_size: Number of candidates per API call
            padding_percent: Extra padding around candidate bbox (0.20 = 20%)
            model: OpenRouter model name
            temperature: LLM temperature
            valid_sheets: List of valid sheet names for validation context (e.g., ['A5', 'A6', 'A7'])
        """
        self.batch_size = batch_size
        self.padding_percent = padding_percent
        self.model = model
        self.temperature = temperature
        self.valid_sheets = valid_sheets or []

        # Load few-shot examples
        self.prompt_template, self.example_images = self._load_examples()

        print(f"Stage2Validator initialized:", file=sys.stderr)
        print(f"  Model: {model}", file=sys.stderr)
        print(f"  Batch size: {batch_size} candidates/call", file=sys.stderr)
        print(f"  Padding: {padding_percent*100:.0f}%", file=sys.stderr)
        print(f"  Examples: {len(self.example_images)} images", file=sys.stderr)
        if self.valid_sheets:
            print(f"  Valid sheets: {', '.join(self.valid_sheets)}", file=sys.stderr)

    def _load_examples(self, zoom_level: int = 4) -> Tuple[str, List[str]]:
        """Load few-shot examples (reused from test_vision_fewshot.py)"""

        # Base prompt template - will be formatted with context in _format_prompt
        # Note: Placeholders will be filled in by _format_prompt() method
        prompt = """You are analyzing construction plan drawings to find REFERENCE MARKERS.

There are TWO types of reference markers used in North American construction plans:

1. **CIRCULAR markers** (Detail/Section Callouts):
   - Shows: Detail Number / Sheet Reference
   - Example: "3/A7" means "Detail 3 on Sheet A7"
   - Often has a leader line with pin pointing to the location
   - May be on top of another shape
   - Text can be rotated 0°, 90°, 180°, or 270°

2. **TRIANGULAR markers** (Revision Indicators):
   - Shows: Revision Number / Sheet
   - Example: "3/A5" means "Revision 3 on Sheet A5"
   - Triangle is the "delta" symbol (Δ = change)
   - Text orientation follows diagonal slash line
   - Usually solid black or filled

{context_section}

EXAMPLES PROVIDED:
I'm showing you examples of both types in the first 7 images.

YOUR TASK:
After the 7 example images, I'm showing you candidate images from geometric detection.
For EACH candidate, determine if it contains a valid reference marker.

IMPORTANT:
- Some candidates may be FALSE POSITIVES (circles/triangles that aren't markers)
- Only include confident detections
- Ignore legend tables, title blocks, dimension text, or random circles{extra_instructions}

{output_format}

Respond ONLY with the JSON array. No other text."""

        # Load example images
        base_dir = Path(__file__).parent.parent / "cropped_example"
        examples_dir = base_dir / f"zoom{zoom_level}"

        if not examples_dir.exists():
            examples_dir = base_dir

        example_images = []

        # Add circular examples (use 4 best quality ones)
        for i in [1, 2, 4, 6]:
            img_path = examples_dir / f"circular_{i}.png"
            if img_path.exists():
                img_b64 = self._encode_image(str(img_path))
                example_images.append(f"data:image/png;base64,{img_b64}")

        # Add triangle examples (all 3)
        for i in [1, 2, 3]:
            img_path = examples_dir / f"triangle_{i}.png"
            if img_path.exists():
                img_b64 = self._encode_image(str(img_path))
                example_images.append(f"data:image/png;base64,{img_b64}")

        return prompt, example_images

    def _format_prompt(self) -> str:
        """
        Format the prompt template with context-aware sections

        Returns:
            Formatted prompt with valid sheets context and structured output format
        """
        # Build context section
        if self.valid_sheets:
            context_section = f"""
<valid_context>
Valid sheet names for this plan: {', '.join(self.valid_sheets)}
Valid detail numbers: 1-7, N
Valid formats: [detail]/[sheet] (e.g., "3/A7", "N/11")
</valid_context>"""
        else:
            context_section = ""

        # Build extra instructions
        if self.valid_sheets:
            extra_instructions = """
- Use fuzzy matching for OCR errors (e.g., "A5" vs "AS" - Levenshtein distance ≤2)
- If sheet name not in valid_sheets list, classify as "unknown" with low confidence
- Be extra careful with N vs 6 confusion (common OCR error)"""
        else:
            extra_instructions = ""

        # Build structured output format
        output_format = """OUTPUT FORMAT:
Return a JSON array with this structure:
[
  {
    "detail": "3",
    "sheet": "A7",
    "type": "circular",
    "confidence": 0.95,
    "is_valid": true,
    "fuzzy_matched": false
  },
  {
    "detail": "6",
    "sheet": "A1",
    "type": "circular",
    "confidence": 0.40,
    "is_valid": false,
    "reason": "sheet A1 not in valid_sheets"
  }
]

CRITICAL RULES TO PREVENT HALLUCINATION:
1. The first 7 images are EXAMPLES - DO NOT analyze them, DO NOT include them in output
2. After the 7 examples, you will see CANDIDATE images to analyze
3. ONLY return markers found in the CANDIDATE images (images 8+)
4. Return AT MOST one marker per candidate image
5. If a candidate is NOT a valid marker, return NOTHING for it (empty/skip)
6. DO NOT generate or invent markers - only report what you actually see
7. DO NOT return sequential/numbered markers (e.g., 1/A5, 2/A5, 3/A5...)
8. Your output array length should be ≤ number of candidate images

For each CANDIDATE image that contains a valid marker, use:
- confidence: 0.0-1.0 (how sure you are about the reading)
- is_valid: true if sheet is in valid_sheets (or if no valid_sheets provided)
- fuzzy_matched: true if you corrected an OCR error
- reason: explain why is_valid=false (optional)"""

        # Format the template
        formatted_prompt = self.prompt_template.format(
            context_section=context_section,
            extra_instructions=extra_instructions,
            output_format=output_format
        )

        return formatted_prompt

    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode('utf-8')

    def _crop_candidate(self, tile_image: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
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

    def _validate_batch(self, batch_crops: List[str], batch_candidates: List[SymbolCandidate] = None) -> List[Dict]:
        """
        Validate a batch of candidate crops using LLM

        Args:
            batch_crops: List of base64-encoded crop images
            batch_candidates: Optional list of SymbolCandidate objects corresponding to batch_crops (for bbox info)

        Returns:
            List of validated markers with text
        """
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not found in .env file")

        # Format prompt with valid sheets context
        formatted_prompt = self._format_prompt()

        # Build content array: prompt + examples + candidate crops
        content = [{"type": "text", "text": formatted_prompt}]

        # Add example images
        for ex_img_url in self.example_images:
            content.append({
                "type": "image_url",
                "image_url": {"url": ex_img_url}
            })

        # Add candidate crops
        for crop_url in batch_crops:
            content.append({
                "type": "image_url",
                "image_url": {"url": crop_url}
            })

        # OpenRouter API call
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [{
                        "role": "user",
                        "content": content
                    }],
                    "temperature": self.temperature,
                    "max_tokens": 2048  # Limit response size - expected ~500-1000 tokens for 10 candidates
                },
                timeout=60  # Keep at 60s - original project used this, large responses are handled by regex fallback
            )

            if response.status_code != 200:
                print(f"API error: {response.status_code} - {response.text}", file=sys.stderr)
                return []

            result = response.json()
            result_text = result['choices'][0]['message']['content']
            
            # Reject responses that are too large (likely hallucination)
            # Expected: ~1-2KB per batch, reject if >50KB
            if len(result_text) > 50000:
                print(f"  ⚠️  WARNING: Response too large ({len(result_text)} chars, expected <2KB) - rejecting batch", file=sys.stderr)
                print(f"  Response preview: {result_text[:200]}...", file=sys.stderr)
                return []

            # Parse JSON response
            validated = self._parse_llm_response(result_text)

            # CRITICAL FIX: Validate that LLM didn't hallucinate
            # Output should NEVER exceed input count
            if len(validated) > len(batch_crops):
                print(f"  ⚠️  WARNING: LLM hallucination detected!", file=sys.stderr)
                print(f"  Input: {len(batch_crops)} candidates, Output: {len(validated)} markers", file=sys.stderr)
                print(f"  Truncating to match input count to prevent hallucination", file=sys.stderr)
                # Keep only the first N markers up to the input count
                validated = validated[:len(batch_crops)]

            # Add bbox information from original candidates if provided
            # Match by index (LLM should maintain order, but may skip invalid candidates)
            if batch_candidates:
                for idx, marker in enumerate(validated):
                    # Match validated marker to candidate by index
                    # If LLM skipped some candidates, we'll match to the first available
                    if idx < len(batch_candidates):
                        candidate = batch_candidates[idx]
                        marker['bbox'] = {
                            'x': candidate.bbox[0],
                            'y': candidate.bbox[1],
                            'w': candidate.bbox[2],
                            'h': candidate.bbox[3]
                        }

            return validated

        except requests.Timeout:
            print(f"  ⚠️  API timeout after 30s - rejecting batch", file=sys.stderr)
            return []
        except requests.RequestException as e:
            print(f"  ⚠️  API request error: {e}", file=sys.stderr)
            return []
        except Exception as e:
            print(f"Batch validation error: {e}", file=sys.stderr)
            return []

    def _fuzzy_match_sheet(self, sheet: str, max_distance: int = 2) -> Optional[Dict]:
        """
        Perform fuzzy matching on sheet name against valid_sheets

        Args:
            sheet: Sheet name to match
            max_distance: Maximum Levenshtein distance to allow

        Returns:
            Dict with match info or None if no match
            {
                'matched_sheet': str,
                'distance': int,
                'fuzzy_matched': bool
            }
        """
        if not self.valid_sheets:
            # No validation context - accept all sheets
            return {
                'matched_sheet': sheet,
                'distance': 0,
                'fuzzy_matched': False
            }

        sheet_upper = sheet.upper()

        # Check exact match first
        for valid_sheet in self.valid_sheets:
            if sheet_upper == valid_sheet.upper():
                return {
                    'matched_sheet': valid_sheet,
                    'distance': 0,
                    'fuzzy_matched': False
                }

        # Try fuzzy matching with Levenshtein distance
        best_match = None
        best_distance = max_distance + 1

        for valid_sheet in self.valid_sheets:
            # Use difflib's SequenceMatcher as a simple Levenshtein alternative
            # Calculate edit distance manually
            distance = self._levenshtein_distance(sheet_upper, valid_sheet.upper())

            if distance <= max_distance and distance < best_distance:
                best_distance = distance
                best_match = valid_sheet

        if best_match:
            return {
                'matched_sheet': best_match,
                'distance': best_distance,
                'fuzzy_matched': True
            }

        return None

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

    def _parse_llm_response(self, result_text: str) -> List[Dict]:
        """Parse LLM JSON response with fuzzy matching support"""
        import re

        markers = []

        # Try JSON parsing first
        try:
            cleaned = result_text.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned.split('```json')[1].split('```')[0]
            elif cleaned.startswith('```'):
                cleaned = cleaned.split('```')[1].split('```')[0]

            markers_json = json.loads(cleaned.strip())

            if not isinstance(markers_json, list):
                raise ValueError("Expected JSON array")

            for item in markers_json:
                detail = str(item.get('detail', '')).strip()
                sheet = str(item.get('sheet', '')).strip().upper()
                marker_type = str(item.get('type', 'unknown')).strip().lower()

                # Get confidence and is_valid from LLM response (if provided)
                confidence = item.get('confidence', 0.8)
                is_valid = item.get('is_valid', True)
                reason = item.get('reason', '')

                if detail and sheet:
                    # Apply fuzzy matching if we have valid_sheets
                    if self.valid_sheets:
                        match_result = self._fuzzy_match_sheet(sheet)

                        if match_result:
                            marker = {
                                'text': f"{detail}/{match_result['matched_sheet']}",
                                'detail': detail,
                                'sheet': match_result['matched_sheet'],
                                'type': marker_type,
                                'confidence': confidence,
                                'is_valid': True,
                                'fuzzy_matched': match_result['fuzzy_matched']
                            }
                            if match_result['fuzzy_matched']:
                                marker['original_sheet'] = sheet
                                marker['edit_distance'] = match_result['distance']
                        else:
                            # No valid match found - mark as invalid
                            marker = {
                                'text': f"{detail}/{sheet}",
                                'detail': detail,
                                'sheet': sheet,
                                'type': marker_type,
                                'confidence': min(confidence, 0.5),  # Lower confidence for invalid sheets
                                'is_valid': False,
                                'fuzzy_matched': False,
                                'reason': f"Sheet '{sheet}' not in valid_sheets: {', '.join(self.valid_sheets)}"
                            }
                    else:
                        # No validation - accept all
                        marker = {
                            'text': f"{detail}/{sheet}",
                            'detail': detail,
                            'sheet': sheet,
                            'type': marker_type,
                            'confidence': confidence,
                            'is_valid': is_valid,
                            'fuzzy_matched': False
                        }
                        if reason:
                            marker['reason'] = reason

                    markers.append(marker)

            return markers

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"  Warning: JSON parsing failed ({e}), trying regex...", file=sys.stderr)

        # Fallback: Regex parsing with fuzzy matching
        pattern = r'(\d+|N)\s*[/_—–-]\s*([A-Z0-9.\-]+)'
        matches = re.findall(pattern, result_text.upper())

        for detail_num, sheet_ref in matches:
            # Apply fuzzy matching if we have valid_sheets
            if self.valid_sheets:
                match_result = self._fuzzy_match_sheet(sheet_ref)
                if match_result:
                    markers.append({
                        'text': f"{detail_num}/{match_result['matched_sheet']}",
                        'detail': detail_num,
                        'sheet': match_result['matched_sheet'],
                        'type': 'unknown',
                        'confidence': 0.6,
                        'is_valid': True,
                        'fuzzy_matched': match_result['fuzzy_matched']
                    })
            else:
                markers.append({
                    'text': f"{detail_num}/{sheet_ref}",
                    'detail': detail_num,
                    'sheet': sheet_ref,
                    'type': 'unknown',
                    'confidence': 0.6,
                    'is_valid': True,
                    'fuzzy_matched': False
                })

        return markers

    def validate_candidates(self, candidates: List[SymbolCandidate], tiles_dir: str, verbose: bool = True) -> List[Dict]:
        """
        Validate all candidates from Stage 1

        Args:
            candidates: List of SymbolCandidate objects from Stage 1
            tiles_dir: Directory containing tile images
            verbose: Print progress

        Returns:
            List of validated markers with extracted text
        """
        if verbose:
            print(f"\n{'='*70}", file=sys.stderr)
            print(f"STAGE 2: LLM Validation", file=sys.stderr)
            print(f"Validating {len(candidates)} candidates", file=sys.stderr)
            print(f"{'='*70}\n", file=sys.stderr)

        tiles_path = Path(tiles_dir)

        # Group candidates by tile
        by_tile = {}
        for c in candidates:
            if c.source_tile not in by_tile:
                by_tile[c.source_tile] = []
            by_tile[c.source_tile].append(c)

        all_validated = []
        total_batches = 0
        start_time = time.time()

        # Process each tile's candidates
        for tile_name, tile_candidates in by_tile.items():
            tile_path = tiles_path / tile_name
            tile_image = cv2.imread(str(tile_path))
            
            if tile_image is None:
                print(f"Warning: Failed to load {tile_name}", file=sys.stderr)
                continue

            # Crop candidates
            crops = []
            valid_candidates = []
            for c in tile_candidates:
                crop = self._crop_candidate(tile_image, c.bbox)
                if crop is not None:
                    # Encode to base64
                    _, buffer = cv2.imencode('.png', crop)
                    crop_b64 = base64.b64encode(buffer).decode('utf-8')
                    crops.append(f"data:image/png;base64,{crop_b64}")
                    valid_candidates.append(c)

            # Update tile_candidates to only include valid ones
            tile_candidates = valid_candidates

            # Batch and validate
            for i in range(0, len(crops), self.batch_size):
                batch = crops[i:i+self.batch_size]
                batch_candidates = tile_candidates[i:i+self.batch_size]
                
                if verbose:
                    print(f"[{tile_name}] Batch {i//self.batch_size + 1}: {len(batch)} candidates...", end=" ", flush=True, file=sys.stderr)

                validated = self._validate_batch(batch, batch_candidates)
                
                if verbose:
                    print(f"✓ {len(validated)} validated", file=sys.stderr)

                # Add source metadata
                for v in validated:
                    v['source_tile'] = tile_name
                
                all_validated.extend(validated)
                total_batches += 1

        elapsed = time.time() - start_time

        if verbose:
            print(f"\n{'='*70}", file=sys.stderr)
            print(f"STAGE 2 COMPLETE", file=sys.stderr)
            print(f"{'='*70}", file=sys.stderr)
            print(f"Candidates validated: {len(candidates)}", file=sys.stderr)
            print(f"Symbols confirmed: {len(all_validated)}", file=sys.stderr)
            print(f"False positive rate: {(1 - len(all_validated)/len(candidates))*100:.1f}%", file=sys.stderr)
            print(f"API batches: {total_batches}", file=sys.stderr)
            print(f"Processing time: {elapsed:.2f} seconds", file=sys.stderr)
            print(f"Cost estimate: ${total_batches * 0.0015:.3f}", file=sys.stderr)
            print(f"{'='*70}\n", file=sys.stderr)

        return all_validated

    def validate_candidates_from_dicts(self, candidates_dicts: List[Dict], tile_paths: List[str], strict_filtering: bool = True, verbose: bool = False) -> List[Dict]:
        """
        Validate candidates from dict format (used by API)
        
        Args:
            candidates_dicts: List of candidate dicts from Stage 1 with keys: bbox, confidence, symbol_type, source_tile
            tile_paths: List of paths to tile images
            strict_filtering: If True, only return markers with is_valid=True
            verbose: If True, print progress logs to stderr
            
        Returns:
            List of validated markers
        """
        # Convert dicts to SymbolCandidate objects
        from .stage1_geometric_detector import SymbolCandidate
        
        candidates = []
        for c_dict in candidates_dicts:
            # Handle both tuple and list bbox formats
            bbox = c_dict['bbox']
            if isinstance(bbox, list):
                bbox = tuple(bbox)
            candidate = SymbolCandidate(
                bbox=bbox,
                confidence=c_dict.get('confidence', 0.5),
                symbol_type=c_dict.get('symbol_type', 'circular'),
                detection_method=c_dict.get('detection_method', 'unknown'),
                source_tile=c_dict.get('source_tile', '')
            )
            candidates.append(candidate)
        
        # Create a temporary directory structure for tiles
        # Group tiles by their base name
        tiles_by_name = {}
        for tile_path in tile_paths:
            tile_name = os.path.basename(tile_path)
            tiles_by_name[tile_name] = tile_path
        
        # Create a temp directory and copy/link tiles
        import tempfile
        import shutil
        temp_tiles_dir = tempfile.mkdtemp()
        
        try:
            # Copy tiles to temp directory with their source_tile names
            for candidate in candidates:
                if candidate.source_tile in tiles_by_name:
                    src_path = tiles_by_name[candidate.source_tile]
                    dst_path = os.path.join(temp_tiles_dir, candidate.source_tile)
                    shutil.copy2(src_path, dst_path)
            
            # Validate using existing method
            validated = self.validate_candidates(candidates, temp_tiles_dir, verbose=verbose)
            
            # Apply strict filtering if requested
            if strict_filtering:
                validated = [v for v in validated if v.get('is_valid', False)]
            
            return validated
        finally:
            # Clean up temp directory
            shutil.rmtree(temp_tiles_dir, ignore_errors=True)


def main():
    """Test Stage 2 validator"""
    import argparse

    parser = argparse.ArgumentParser(description="Stage 2: LLM Validation")
    parser.add_argument('candidates_json', help='Stage 1 candidates JSON file')
    parser.add_argument('tiles_dir', help='Directory containing tiles')
    parser.add_argument('--batch-size', type=int, default=15, help='Batch size')
    parser.add_argument('--output', help='Output JSON file')

    args = parser.parse_args()

    # Load Stage 1 candidates
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

    # Initialize validator
    validator = Stage2LLMValidator(batch_size=args.batch_size)

    # Validate
    validated = validator.validate_candidates(candidates, args.tiles_dir, verbose=True)

    # Save results
    if args.output:
        output_data = {
            'stage1_candidates': len(candidates),
            'stage2_validated': len(validated),
            'markers': validated
        }

        with open(args.output, 'w') as f:
            json.dump(output_data, f, indent=2)

        print(f"\nSaved {len(validated)} validated markers to {args.output}")


if __name__ == '__main__':
    main()
