# PDF Processing Container

Python-based container for PDF processing with VIPS, OpenCV, and Tesseract OCR.

## Services

### POST /generate-images
Convert PDF to 300 DPI PNG images using pyvips.

**Headers:**
- `X-Sheet-Id`: Sheet identifier
- `X-Plan-Id`: Plan identifier

**Request Body:** PDF binary data

**Response:**
```json
{
  "images": [{
    "sheetId": "sheet-123",
    "imageUrl": "r2://plans/plan-456/sheets/sheet-123.png",
    "width": 8400,
    "height": 10800,
    "dpi": 300
  }]
}
```

### POST /extract-metadata
Extract metadata from title block using OCR.

**Headers:**
- `X-Sheet-Id`: Sheet identifier

**Request Body:** PNG binary data

**Response:**
```json
{
  "sheetNumber": "A-101",
  "sheetTitle": "FLOOR PLAN",
  "rawText": "..."
}
```

### POST /detect-callouts
Detect callouts using OpenCV shape detection.

**Headers:**
- `X-Sheet-Id`: Sheet identifier
- `X-DPI`: DPI (default: 300)

**Request Body:** PNG binary data

**Response:**
```json
{
  "shapes": [{
    "type": "circle",
    "method": "hough",
    "centerX": 100,
    "centerY": 200,
    "radius": 20,
    "bbox": {"x1": 80, "y1": 180, "x2": 120, "y2": 220},
    "confidence": 0.8
  }],
  "imageWidth": 8400,
  "imageHeight": 10800,
  "totalDetections": 42,
  "byMethod": {
    "hough": 30,
    "contour": 12
  }
}
```

### POST /generate-tiles
Generate PMTiles from PNG using pyvips dzsave.

**Headers:**
- `X-Sheet-Id`: Sheet identifier
- `X-Plan-Id`: Plan identifier

**Request Body:** PNG binary data

**Response:**
```json
{
  "tilesUrl": "r2://plans/plan-456/sheets/sheet-123.pmtiles",
  "minZoom": 0,
  "maxZoom": 5,
  "bounds": [0, 0, 8400, 10800]
}
```

## Development

```bash
# Build the container
docker build -t pdf-processor .

# Run locally
docker run -p 3001:3001 pdf-processor

# Test health endpoint
curl http://localhost:3001/health
```

## Deployment

Deploy to Cloudflare Container Registry:

```bash
# Tag for Cloudflare
docker tag pdf-processor registry.cloudflare.com/YOUR_ACCOUNT/pdf-processor

# Push to registry
docker push registry.cloudflare.com/YOUR_ACCOUNT/pdf-processor
```

Configure in `wrangler.json`:

```json
{
  "container": {
    "image": "registry.cloudflare.com/YOUR_ACCOUNT/pdf-processor:latest",
    "port": 3001
  }
}
```
