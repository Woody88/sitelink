# Callout Processor REST API

The callout-processor service provides a REST API for PDF metadata extraction and marker detection.

## Running the Server

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

Server runs on port `8000` by default (configurable via `PORT` environment variable).

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the service is ready.

**Response:**

```json
{
  "status": "ready",
  "service": "callout-processor"
}
```

Status codes:
- `200` - Service is ready
- `503` - Service is initializing

---

### 2. Extract Metadata

**POST** `/api/extract-metadata`

Extract sheet number and metadata from a PDF.

**Request:**

- **Content-Type**: `application/pdf`
- **Body**: PDF file binary data

**Response:**

```json
{
  "sheet_number": "A2",
  "metadata": {
    "width": 2550,
    "height": 3300,
    "dpi": 300,
    "title": "FLOOR PLAN - LEVEL 1",
    "notes": "Some notes here",
    "titleBlockLocation": {
      "region": "bottom-right",
      "confidence": 0.95
    }
  }
}
```

**Error Responses:**

- `400` - Invalid request (missing PDF or wrong Content-Type)
- `500` - Processing error

**Example:**

```bash
curl -X POST http://localhost:8000/api/extract-metadata \
  -H "Content-Type: application/pdf" \
  --data-binary @sheet-A2.pdf
```

---

### 3. Detect Markers

**POST** `/api/detect-markers`

Detect callout markers (detail references) in a PDF sheet.

**Request:**

- **Content-Type**: `application/pdf`
- **Headers**:
  - `X-Valid-Sheets` (optional): Comma-separated list of valid sheet numbers (e.g., "A1,A2,A3")
  - `X-Sheet-Number` (optional): Current sheet number to filter out self-references
- **Body**: PDF file binary data

**Response:**

```json
{
  "markers": [
    {
      "text": "1/A5",
      "detail": "1",
      "sheet": "A5",
      "type": "detail",
      "confidence": 0.90,
      "is_valid": true,
      "fuzzy_matched": false,
      "bbox": {
        "x": 0.5725,
        "y": 0.5133,
        "w": 0.05,
        "h": 0.05
      }
    },
    {
      "text": "2/A6",
      "detail": "2",
      "sheet": "A6",
      "type": "detail",
      "confidence": 0.85,
      "is_valid": false,
      "fuzzy_matched": false,
      "bbox": {
        "x": 0.3521,
        "y": 0.7234,
        "w": 0.05,
        "h": 0.05
      }
    }
  ],
  "total_detected": 2,
  "processing_time_ms": 15234
}
```

**Field Descriptions:**

- `text`: Full callout reference (e.g., "1/A5")
- `detail`: Detail number (e.g., "1")
- `sheet`: Target sheet reference (e.g., "A5")
- `type`: Always "detail" for now
- `confidence`: Detection confidence (0-1)
- `is_valid`: Whether the target sheet exists in the valid sheets list
- `fuzzy_matched`: Whether fuzzy matching was used (always false for now)
- `bbox`: Bounding box with normalized coordinates (0-1)
  - `x`, `y`: Center position (normalized)
  - `w`, `h`: Width and height (normalized, currently fixed at 0.05)

**Error Responses:**

- `400` - Invalid request (missing PDF or wrong Content-Type)
- `500` - Processing error

**Example:**

```bash
curl -X POST http://localhost:8000/api/detect-markers \
  -H "Content-Type: application/pdf" \
  -H "X-Valid-Sheets: A1,A2,A3,A4,A5,A6,A7" \
  -H "X-Sheet-Number: A2" \
  --data-binary @sheet-A2.pdf
```

---

## Detection Pipeline

The marker detection uses a hybrid CV + LLM approach:

1. **PDF → PNG Conversion** (300 DPI via VIPS)
2. **OpenCV Shape Detection** (circles, triangles, compound shapes)
3. **LLM Text Reading** (Gemini 2.5 Flash validates and reads text)
4. **Verification** (confirms centering and corrects misreads)
5. **Deduplication** (removes overlapping detections)

**Accuracy**: ~80% (8/10 callouts detected with high confidence)

See main [README.md](README.md) for more details on the detection algorithm.

---

## Environment Variables

- `PORT` - Server port (default: 8000)
- `OPENROUTER_API_KEY` - OpenRouter API key (required for LLM operations)

---

## Dependencies

The service requires:

- **Bun** runtime
- **vips** (libvips) for PDF conversion
- **Python 3** with OpenCV (`opencv-python`, `numpy`)
- **OpenRouter API key** for Gemini models

See [README.md](README.md) for installation instructions.
