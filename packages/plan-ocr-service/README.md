# Plan OCR Service

FastAPI-based service for construction plan processing:
- **Sheet metadata extraction**: Identifies sheet numbers from title blocks using OCR + LLM
- **Reference marker detection**: Two-stage pipeline (geometric detection + LLM validation)

## Architecture

This service is deployed as a Cloudflare Container and called by the sitelink backend workers.

**Key Features:**
- Hallucination-fixed LLM validation (temperature=0.0, batch_size=10)
- Context-aware marker detection using valid sheet list
- Handles presigned R2 URLs for sheet PDFs and tile images

## Local Development

### Prerequisites

- Python 3.10+
- Tesseract OCR installed
- OpenCV dependencies

### Setup

```bash
cd /home/woodson/Code/projects/sitelink/packages/plan-ocr-service

# Install dependencies
pip install -e .

# Copy environment file
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# Run locally
uvicorn src.api:app --reload --port 8000
```

### Running for Integration Tests

The backend integration tests require this service to be running on port 8000.

**Option 1: Docker (Recommended for tests)**
```bash
# Build the container
docker build -t plan-ocr-service .

# Start the container
docker run -d --name plan-ocr-service -p 8000:8000 plan-ocr-service

# Verify it's running
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"plan-ocr-service"}

# View logs
docker logs plan-ocr-service

# Stop when done
docker stop plan-ocr-service
docker rm plan-ocr-service
```

**Option 2: Local Python**
```bash
# Install and run (same as Local Development above)
pip install -e .
uvicorn src.api:app --reload --port 8000
```

Then run the integration tests from `packages/backend`:
```bash
cd packages/backend
bun vitest run tests/integration/queue-ocr-integration.test.ts
```

See `packages/backend/tests/integration/queue-ocr-integration.test.ts` for detailed test documentation.

### Testing

```bash
# Health check
curl http://localhost:8000/health

# Test metadata extraction
curl -X POST http://localhost:8000/api/extract-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "sheet_url": "https://example.com/sheet.pdf",
    "sheet_id": "test_001"
  }'

# Test marker detection
curl -X POST http://localhost:8000/api/detect-markers \
  -H "Content-Type: application/json" \
  -d '{
    "tile_urls": ["https://example.com/tile.jpg"],
    "valid_sheets": ["A5", "A6"],
    "strict_filtering": true
  }'
```

## API Endpoints

### POST /api/extract-metadata

Extract sheet metadata from a construction plan sheet.

**Request:**
```json
{
  "sheet_url": "https://presigned-url.com/sheet.pdf",
  "sheet_id": "sheet_12345"
}
```

**Response:**
```json
{
  "sheet_number": "A5",
  "metadata": {
    "title_block_location": {"x": 100, "y": 200, "w": 300, "h": 150},
    "extracted_text": "SHEET A5\nARCHITECTURAL FLOOR PLAN",
    "confidence": 0.95,
    "method": "tesseract"
  }
}
```

### POST /api/detect-markers

Detect reference markers from plan tile images.

**Request:**
```json
{
  "tile_urls": [
    "https://presigned-url.com/tile_0_0.jpg",
    "https://presigned-url.com/tile_0_1.jpg"
  ],
  "valid_sheets": ["A5", "A6", "A7"],
  "strict_filtering": true
}
```

**Response:**
```json
{
  "markers": [
    {
      "text": "3/A7",
      "detail": "3",
      "sheet": "A7",
      "type": "circular",
      "confidence": 0.95,
      "is_valid": true,
      "fuzzy_matched": false,
      "source_tile": "tile_2_3.jpg",
      "bbox": {"x": 150, "y": 200, "w": 30, "h": 30}
    }
  ],
  "stage1_candidates": 777,
  "stage2_validated": 169,
  "processing_time_ms": 15234.5
}
```

## Deployment

### Build Docker Image

```bash
docker build -t plan-ocr-service .
```

### Deploy to Cloudflare

```bash
# Set secrets
wrangler secret put OPENROUTER_API_KEY

# Deploy
wrangler deploy
```

## Critical Configuration

**IMPORTANT:** This service uses the hallucination-fixed version of the LLM validator:
- Temperature: **0.0** (deterministic)
- Batch size: **10** (not 15)
- Validation safeguard prevents output > input

Do NOT modify these values without thorough testing.

## Integration

Called by sitelink backend workers:
- **Queue 2 Worker**: Calls `/api/extract-metadata` per sheet
- **Queue 4 Worker**: Calls `/api/detect-markers` per plan

See `/home/woodson/Code/projects/plan-ocr/INTEGRATION_PLAN.md` for complete architecture.
