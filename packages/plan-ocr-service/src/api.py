"""
Plan OCR Service - FastAPI Application

Provides endpoints for:
1. Sheet metadata extraction from construction plan PDFs
2. Reference marker detection from plan tile images
"""

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional
import requests
import tempfile
import os
import time
import sys
import tarfile
import io
import base64
from pathlib import Path

from .metadata_extractor import MetadataExtractor
from .stage1_geometric_detector import Stage1GeometricDetector, SymbolCandidate
from .stage2_llm_validator import Stage2LLMValidator
from .ocr_prefilter import OCRPrefilter
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Plan OCR Service",
    description="Construction plan metadata extraction and marker detection",
    version="0.1.0"
)

# Global model instances (loaded on startup)
_models_loaded = False
_stage1_detector = None
_metadata_extractor = None


@app.on_event("startup")
async def startup_event():
    """Pre-load models on container startup to avoid cold start delays"""
    global _models_loaded, _stage1_detector, _metadata_extractor

    print("[STARTUP] ====== Initializing models ======", file=sys.stderr)
    start_time = time.time()

    try:
        # Pre-load Stage 1 geometric detector
        print("[STARTUP] Loading Stage1GeometricDetector...", file=sys.stderr)
        _stage1_detector = Stage1GeometricDetector()
        print("[STARTUP] ✓ Stage1 detector loaded", file=sys.stderr)

        # Pre-load metadata extractor
        print("[STARTUP] Loading MetadataExtractor...", file=sys.stderr)
        _metadata_extractor = MetadataExtractor(
            ocr_engine='tesseract',
            use_llm_fallback=True
        )
        print("[STARTUP] ✓ Metadata extractor loaded", file=sys.stderr)

        # Pre-import Stage2 dependencies (Stage2 validator is instantiated per-request with valid_sheets)
        print("[STARTUP] Pre-importing Stage2LLMValidator...", file=sys.stderr)
        from .stage2_llm_validator import Stage2LLMValidator
        print("[STARTUP] ✓ Stage2 dependencies loaded", file=sys.stderr)

        _models_loaded = True
        elapsed = time.time() - start_time
        print(f"[STARTUP] ====== All models loaded successfully in {elapsed:.2f}s ======", file=sys.stderr)

    except Exception as e:
        print(f"[STARTUP] ❌ ERROR loading models: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        # Don't set _models_loaded = True on error
        raise

# Request/Response Models

class MetadataRequest(BaseModel):
    sheet_url: HttpUrl
    sheet_id: str

class MetadataResponse(BaseModel):
    sheet_number: str
    metadata: Dict[str, Any]

class MarkerDetectionRequest(BaseModel):
    tile_urls: List[HttpUrl]
    valid_sheets: List[str]
    strict_filtering: bool = True

class TileData(BaseModel):
    filename: str
    data: str  # base64-encoded image data

class Base64TilesRequest(BaseModel):
    tiles: List[TileData]
    valid_sheets: List[str]
    strict_filtering: bool = True

class MarkerBBox(BaseModel):
    x: int
    y: int
    w: int
    h: int

class Marker(BaseModel):
    text: str
    detail: str
    sheet: str
    type: str
    confidence: float
    is_valid: bool
    fuzzy_matched: bool
    source_tile: str
    bbox: MarkerBBox

class MarkerDetectionResponse(BaseModel):
    markers: List[Marker]
    stage1_candidates: int
    stage2_validated: int
    processing_time_ms: float

class HealthResponse(BaseModel):
    status: str
    service: str

class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None


# Helper Functions

def download_file(url: str, suffix: str = "") -> str:
    """Download a file from URL to temporary location"""
    try:
        response = requests.get(str(url), timeout=60)
        response.raise_for_status()

        # Create temp file
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, 'wb') as f:
            f.write(response.content)

        return temp_path
    except requests.RequestException as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download file: {str(e)}"
        )


# API Endpoints

@app.get("/health")
async def health_check():
    """
    Health check endpoint - validates model readiness

    Returns:
    - 200 OK with status="ready" when models are loaded and service is ready
    - 503 Service Unavailable with status="initializing" when models are still loading
    """
    if not _models_loaded:
        return JSONResponse(
            status_code=503,
            content={
                "status": "initializing",
                "service": "plan-ocr-service",
                "message": "Models are still loading, please retry"
            }
        )
    return HealthResponse(status="ready", service="plan-ocr-service")


@app.post("/api/extract-metadata", response_model=MetadataResponse)
async def extract_metadata(request: Request):
    """
    Extract sheet metadata from a construction plan sheet

    Accepts either:
    1. JSON with sheet_url and sheet_id (original format)
    2. PDF blob directly with Content-Type: application/pdf
    """
    temp_pdf = None
    sheet_id = "unknown"

    try:
        content_type = request.headers.get("content-type", "")
        
        if content_type.startswith("application/pdf"):
            # PDF blob directly - save to temp file
            pdf_data = await request.body()
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            temp_file.write(pdf_data)
            temp_file.close()
            temp_pdf = temp_file.name
            sheet_id = request.headers.get("x-sheet-id", "unknown")
            print(f"[METADATA] Received PDF blob, sheet_id: {sheet_id}", file=sys.stderr)
        else:
            # JSON format with sheet_url
            json_data = await request.json()
            metadata_req = MetadataRequest(**json_data)
            sheet_id = metadata_req.sheet_id
            print(f"[METADATA] Processing sheet_id: {sheet_id}", file=sys.stderr)
            
            # Download sheet PDF
            temp_pdf = download_file(metadata_req.sheet_url, suffix=".pdf")
            print(f"[METADATA] Downloaded to: {temp_pdf}", file=sys.stderr)

        # Use pre-loaded metadata extractor (loaded in startup event)
        global _metadata_extractor
        if _metadata_extractor is None:
            raise HTTPException(
                status_code=503,
                detail="Service is still initializing. Please retry."
            )

        # Extract sheet info
        result = _metadata_extractor.extract_sheet_info(temp_pdf)

        # Map sheet_name to sheet_number for API response (metadata extractor returns sheet_name)
        if result and 'sheet_name' in result and result['sheet_name']:
            # Successfully extracted sheet name (e.g., "A7")
            result['sheet_number'] = result['sheet_name']
        elif not result or 'sheet_number' not in result:
            # Fallback: Generate a default sheet number from sheet_id if title block not found
            # This allows processing to continue even when OCR fails
            print(f"[METADATA] Title block not found, using fallback sheet number", file=sys.stderr)
            # Use last 4 chars of sheet_id as fallback, or "Sheet-{N}" format
            fallback_number = f"Sheet-{sheet_id[-4:]}" if len(sheet_id) >= 4 else f"Sheet-{sheet_id}"
            result = {
                'sheet_number': fallback_number,
                'confidence': 0.0,
                'method': 'fallback',
                'title_block_location': {},
                'extracted_text': '',
                'sheet_title': None,
                'all_sheets': []
            }

        print(f"[METADATA] Extracted sheet_number: {result['sheet_number']}", file=sys.stderr)
        print(f"[METADATA] Confidence: {result.get('confidence', 0)}", file=sys.stderr)

        return MetadataResponse(
            sheet_number=result['sheet_number'],
            metadata={
                'title_block_location': result.get('title_block_location', {}),
                'extracted_text': result.get('extracted_text', ''),
                'confidence': result.get('confidence', 0.0),
                'method': result.get('method', 'unknown'),
                'sheet_title': result.get('sheet_title'),
                'all_sheets': result.get('all_sheets', [])
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[METADATA] Error: {str(e)}", file=sys.stderr)
        raise HTTPException(
            status_code=500,
            detail=f"Metadata extraction failed: {str(e)}"
        )
    finally:
        # Cleanup temp file
        if temp_pdf and os.path.exists(temp_pdf):
            try:
                os.unlink(temp_pdf)
            except:
                pass


@app.post("/api/detect-markers", response_model=MarkerDetectionResponse)
async def detect_markers(request: Request):
    """
    Detect reference markers from plan tile images

    Accepts either:
    1. Tar stream with Content-Type: application/x-tar (tiles packaged in tar)
    2. JSON with tiles array (base64-encoded tile data) - PREFERRED
    3. JSON with tile_urls and valid_sheets (backward compatibility)

    Runs a two-stage pipeline:
    1. Stage 1: Geometric detection (circles, triangles)
    2. Stage 2: LLM validation with context-aware filtering
    """
    print(f"[MARKERS] ====== Marker detection endpoint called ======", file=sys.stderr)
    temp_files = []
    temp_dir = None

    try:
        start_time = time.time()
        content_type = request.headers.get("content-type", "")
        print(f"[MARKERS] Content-Type: {content_type}", file=sys.stderr)
        
        # Extract valid_sheets from headers or request
        valid_sheets_str = request.headers.get("x-valid-sheets", "")
        if valid_sheets_str:
            valid_sheets = [s.strip() for s in valid_sheets_str.split(",") if s.strip()]
        else:
            valid_sheets = []

        if content_type.startswith("application/x-tar"):
            # Tar stream - extract tiles from tar
            print(f"[MARKERS] Received tar stream", file=sys.stderr)
            
            # Create temp directory for extracted tiles
            temp_dir = tempfile.mkdtemp()
            temp_files.append(temp_dir)
            
            # Read tar data
            tar_data = await request.body()
            print(f"[MARKERS] Received {len(tar_data)} bytes of tar data", file=sys.stderr)
            
            # Extract tar to temp directory
            tar_stream = io.BytesIO(tar_data)
            with tarfile.open(fileobj=tar_stream, mode='r:') as tar:
                tar.extractall(path=temp_dir)
                print(f"[MARKERS] Extracted tar to {temp_dir}", file=sys.stderr)
            
            # Find all .jpg files in extracted directory
            tile_paths = []
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    if file.endswith('.jpg'):
                        tile_path = os.path.join(root, file)
                        tile_paths.append(tile_path)
            
            print(f"[MARKERS] Found {len(tile_paths)} tiles in tar", file=sys.stderr)
            
            # For tar stream, valid_sheets should come from headers
            if not valid_sheets:
                print(f"[MARKERS] Warning: No valid_sheets provided in headers", file=sys.stderr)
        else:
            # JSON format - check if it's base64 tiles or URL tiles
            json_data = await request.json()
            
            if "tiles" in json_data:
                # Base64-encoded tiles (preferred method)
                base64_req = Base64TilesRequest(**json_data)
                valid_sheets = base64_req.valid_sheets
                
                print(f"[MARKERS] Processing {len(base64_req.tiles)} base64-encoded tiles", file=sys.stderr)
                
                # Create temp directory for tiles
                temp_dir = tempfile.mkdtemp()
                temp_files.append(temp_dir)
                
                # Decode and save all tiles
                tile_paths = []
                for i, tile in enumerate(base64_req.tiles):
                    try:
                        # Decode base64 data
                        tile_data = base64.b64decode(tile.data)
                        
                        # Save to temp file
                        tile_path = os.path.join(temp_dir, tile.filename)
                        with open(tile_path, 'wb') as f:
                            f.write(tile_data)
                        
                        tile_paths.append(tile_path)
                        
                        if (i + 1) % 25 == 0 or (i + 1) == len(base64_req.tiles):
                            print(f"[MARKERS] Decoded {i + 1}/{len(base64_req.tiles)} tiles", file=sys.stderr)
                    except Exception as e:
                        print(f"[MARKERS] Error decoding tile {tile.filename}: {e}", file=sys.stderr)
                
                print(f"[MARKERS] Successfully decoded {len(tile_paths)} tiles", file=sys.stderr)
            else:
                # URL-based tiles (backward compatibility)
                marker_req = MarkerDetectionRequest(**json_data)
                valid_sheets = marker_req.valid_sheets
                
                print(f"[MARKERS] Processing {len(marker_req.tile_urls)} tiles from URLs", file=sys.stderr)
                
                # Download all tiles
                tile_paths = []
                for i, tile_url in enumerate(marker_req.tile_urls):
                    temp_path = download_file(tile_url, suffix=".jpg")
                    temp_files.append(temp_path)
                    tile_paths.append(temp_path)

                    if (i + 1) % 50 == 0:
                        print(f"[MARKERS] Downloaded {i + 1}/{len(marker_req.tile_urls)} tiles", file=sys.stderr)

        print(f"[MARKERS] Valid sheets: {valid_sheets}", file=sys.stderr)
        print(f"[MARKERS] Processing {len(tile_paths)} tiles", file=sys.stderr)

        # Use pre-loaded Stage1 detector (loaded in startup event)
        global _stage1_detector
        if _stage1_detector is None:
            raise HTTPException(
                status_code=503,
                detail="Service is still initializing. Please retry."
            )

        # Stage 1: Geometric detection
        print(f"[MARKERS] Running Stage 1: Geometric detection", file=sys.stderr)
        stage1_detector = _stage1_detector
        stage1_results = []

        for i, tile_path in enumerate(tile_paths):
            candidates = stage1_detector.detect_candidates(tile_path)
            for candidate in candidates:
                candidate['source_tile'] = os.path.basename(tile_path)
                stage1_results.append(candidate)
            
            # Progress logging every 20 tiles
            if (i + 1) % 20 == 0 or (i + 1) == len(tile_paths):
                print(f"[MARKERS] Stage 1 progress: {i + 1}/{len(tile_paths)} tiles processed, {len(stage1_results)} candidates found", file=sys.stderr)

        print(f"[MARKERS] Stage 1 complete: {len(stage1_results)} candidates from {len(tile_paths)} tiles", file=sys.stderr)

        if len(stage1_results) == 0:
            return MarkerDetectionResponse(
                markers=[],
                stage1_candidates=0,
                stage2_validated=0,
                processing_time_ms=(time.time() - start_time) * 1000
            )

        # Stage 1.5: OCR Prefilter (filter candidates before LLM)
        print(f"[MARKERS] Running Stage 1.5: OCR Prefilter", file=sys.stderr)
        
        # Convert dict candidates to SymbolCandidate objects for prefilter
        symbol_candidates = []
        for candidate_dict in stage1_results:
            symbol_candidates.append(SymbolCandidate(
                bbox=tuple(candidate_dict['bbox']),
                confidence=candidate_dict.get('confidence', 0.5),
                symbol_type=candidate_dict.get('symbol_type', 'circular'),
                detection_method=candidate_dict.get('detection_method', 'hough_circle'),
                source_tile=candidate_dict.get('source_tile', 'unknown')
            ))
        
        # Initialize OCR prefilter
        # Use tesseract (already installed) instead of easyocr to avoid extra dependencies
        ocr_prefilter = OCRPrefilter(
            valid_sheets=valid_sheets,
            ocr_engine='tesseract',  # Use tesseract (already installed in container)
            confidence_threshold=0.7,
            verbose=True
        )
        
        # Filter candidates
        filtered = ocr_prefilter.filter_candidates(symbol_candidates, temp_dir)
        
        # Auto-accept high-confidence matches (convert back to dicts)
        auto_accepted = [c.to_dict() for c in filtered['accept']]
        
        # Send uncertain + auto-accepted candidates to LLM
        # (Auto-accepted still need LLM for structured output, but they're high confidence)
        llm_candidates = [c.to_dict() for c in filtered['uncertain']] + auto_accepted
        
        print(f"[MARKERS] OCR Prefilter Results:", file=sys.stderr)
        print(f"  ✓ Auto-accepted (high confidence): {len(auto_accepted)} ({len(auto_accepted)/len(stage1_results)*100:.1f}%)", file=sys.stderr)
        print(f"  ✗ Auto-rejected (false positives): {len(filtered['reject'])} ({len(filtered['reject'])/len(stage1_results)*100:.1f}%)", file=sys.stderr)
        print(f"  ? Uncertain: {len(filtered['uncertain'])} ({len(filtered['uncertain'])/len(stage1_results)*100:.1f}%)", file=sys.stderr)
        print(f"  → LLM validation: {len(llm_candidates)} candidates ({len(llm_candidates)/len(stage1_results)*100:.1f}%)", file=sys.stderr)
        llm_reduction = (len(filtered['reject'])/len(stage1_results))*100
        print(f"  LLM call reduction: {llm_reduction:.1f}% (rejected {len(filtered['reject'])} false positives)", file=sys.stderr)

        # Stage 2: LLM validation (only on uncertain candidates)
        print(f"[MARKERS] Running Stage 2: LLM validation", file=sys.stderr)
        print(f"[MARKERS] Stage 2: Processing {len(llm_candidates)} candidates in batches of 10", file=sys.stderr)
        estimated_batches = (len(llm_candidates) + 9) // 10  # Round up
        print(f"[MARKERS] Stage 2: Estimated {estimated_batches} API batches (~{estimated_batches * 3:.0f}s)", file=sys.stderr)
        
        stage2_validator = Stage2LLMValidator(
            valid_sheets=valid_sheets,
            batch_size=10,  # CRITICAL: Use 10, not 15
            temperature=0.0  # CRITICAL: Use 0.0 for determinism
        )

        # Get strict_filtering - default to True, can be overridden via header
        strict_filtering = request.headers.get("x-strict-filtering", "true").lower() == "true"
        
        # Enable verbose logging for progress tracking
        validated_markers = stage2_validator.validate_candidates_from_dicts(
            llm_candidates,  # Only uncertain candidates go to LLM
            tile_paths,
            strict_filtering=strict_filtering,
            verbose=True  # Enable progress logging
        )
        
        # Note: Auto-accepted candidates still need LLM validation to extract
        # structured marker data (text, detail, sheet). They'll validate quickly
        # since they're high confidence, but we still need the structured output.
        # The main benefit is filtering out clear false positives (rejected candidates),
        # which significantly reduces LLM API calls.

        print(f"[MARKERS] Stage 2 complete: {len(validated_markers)} validated markers", file=sys.stderr)

        # Convert to response format
        markers = []
        for marker in validated_markers:
            markers.append(Marker(
                text=marker['text'],
                detail=marker['detail'],
                sheet=marker['sheet'],
                type=marker['type'],
                confidence=marker['confidence'],
                is_valid=marker['is_valid'],
                fuzzy_matched=marker.get('fuzzy_matched', False),
                source_tile=marker['source_tile'],
                bbox=MarkerBBox(
                    x=marker['bbox']['x'],
                    y=marker['bbox']['y'],
                    w=marker['bbox']['w'],
                    h=marker['bbox']['h']
                )
            ))

        processing_time_ms = (time.time() - start_time) * 1000
        print(f"[MARKERS] Processing complete: {processing_time_ms:.2f}ms", file=sys.stderr)

        return MarkerDetectionResponse(
            markers=markers,
            stage1_candidates=len(stage1_results),
            stage2_validated=len(validated_markers),
            processing_time_ms=processing_time_ms
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[MARKERS] Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Marker detection failed: {str(e)}"
        )
    finally:
        # Cleanup temp files and directories
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                try:
                    if os.path.isdir(temp_file):
                        import shutil
                        shutil.rmtree(temp_file)
                    else:
                        os.unlink(temp_file)
                except:
                    pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
