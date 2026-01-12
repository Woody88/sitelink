# PDF Processing Worker Architecture

## Overview

This document defines the backend worker architecture for the 4-stage PDF processing pipeline. The system processes construction plan PDFs uploaded from the mobile app, extracting sheet metadata, detecting callouts, and generating tiles for interactive viewing.

The architecture uses Cloudflare Workers for orchestration, Cloudflare Containers for VIPS/Python processing, Cloudflare Queues for job distribution, Durable Objects for coordination, and R2 for storage.

## Context

The mobile app handles the initial PDF processing:
- Splits multi-page PDFs into individual sheets (150 DPI PNG)
- Stores locally with LiveStore events
- Syncs to backend when online

The backend workers enhance these sheets with:
- High-resolution images (300 DPI) for callout detection
- Sheet metadata extraction (OCR title blocks)
- Callout detection and hyperlink generation
- PMTiles for interactive zooming

## Pipeline Stages

### Stage 1: Image Generation
**Input**: Plan upload event from mobile sync
**Process**: Convert PDF pages to 300 DPI PNG using VIPS
**Output**: `sheetImageGenerated` events
**Storage**: R2 bucket at `organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/sheet-{n}/source.png`

These 300 DPI images are the source for all subsequent processing stages.

### Stage 2: Metadata Extraction
**Input**: All `sheetImageGenerated` events for a plan
**Process**: OCR sheet title blocks to extract number/title/discipline
**Output**: `sheetMetadataExtracted` events, followed by `planMetadataCompleted`
**Coordination**: Waits for ALL sheets before emitting `planMetadataCompleted`

The `planMetadataCompleted` event includes a `validSheets` array (sheet IDs that were successfully extracted). This list is used by Stage 3 to validate callout targets.

### Stage 3: Callout Detection
**Input**: `planMetadataCompleted` event
**Process**: OpenCV shape detection + LLM validation per sheet
**Output**: `sheetCalloutsDetected` events (includes `needsReview` flag)
**Dependencies**: Requires Python runtime (OpenCV) and OpenRouter API access

Uses the reference implementation from `packages/callout-processor` on backend-dev branch. Each sheet is processed independently, using the `validSheets` list to verify that detected callout targets exist.

### Stage 4: PMTiles Generation
**Input**: `sheetCalloutsDetected` events
**Process**: Generate Deep Zoom tiles from 300 DPI PNG using VIPS
**Output**: `sheetTilesGenerated` events
**Storage**: R2 bucket at `organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/sheet-{n}/tiles.pmtiles`

Tiles enable interactive zooming in the mobile app's plan viewer.

## Worker Types

### Cloudflare Worker (Orchestration)

The main Cloudflare Worker handles:
- Receiving events from LiveStore sync
- Enqueueing jobs to Cloudflare Queues
- Routing requests to the PDF Processor Container
- Committing events back to LiveStore

### PDF Processor Container

A Cloudflare Container running VIPS and Python dependencies. Exposes REST endpoints for processing tasks.

**Container Binding** (wrangler.json):
```json
"containers": {
  "binding": "PDF_PROCESSOR_CONTAINER",
  "image": "./container"
}
```

**Endpoints**:

#### POST /generate-images
Converts PDF pages to 300 DPI PNG images using VIPS.

**Request**:
```typescript
{
  pdfPath: string     // R2 key to original PDF
  planId: string
  projectId: string
  organizationId: string
  totalPages: number
}
```

**Response**:
```typescript
{
  sheets: Array<{
    pageNumber: number
    r2Key: string       // Path to generated PNG
    width: number
    height: number
  }>
}
```

#### POST /extract-metadata
Runs OCR on sheet title blocks to extract metadata.

**Request**:
```typescript
{
  imagePath: string   // R2 key to 300 DPI PNG
  sheetId: string
  sheetNumber: number
}
```

**Response**:
```typescript
{
  sheetNumber: string
  title: string
  discipline: string | null
  confidence: number
}
```

#### POST /detect-callouts
Runs OpenCV shape detection + LLM validation for callout markers.

**Request**:
```typescript
{
  imagePath: string         // R2 key to 300 DPI PNG
  sheetId: string
  sheetNumber: number
  validSheets: string[]     // For target validation
}
```

**Response**:
```typescript
{
  markers: Array<{
    id: string
    type: "section" | "detail" | "elevation"
    label: string
    targetSheet: string | null
    boundingBox: { x: number, y: number, width: number, height: number }
    confidence: number
    needsReview: boolean
  }>
  unmatchedCount: number
}
```

#### POST /generate-tiles
Generates Deep Zoom tiles and packages as PMTiles.

**Request**:
```typescript
{
  imagePath: string   // R2 key to 300 DPI PNG
  outputPath: string  // R2 key for output PMTiles
  sheetId: string
}
```

**Response**:
```typescript
{
  tilesPath: string   // R2 key to generated PMTiles
  tileCount: number
  zoomLevels: number
}
```

### PlanCoordinator Durable Object

Tracks sheet completion state for each plan.

```typescript
class PlanCoordinator extends DurableObject {
  state: {
    planId: string
    totalSheets: number
    processedSheets: Set<string>
    validSheets: string[]
    failedSheets: string[]
  }

  async recordSheetComplete(sheetId: string, success: boolean): Promise<void>
  async isAllSheetsComplete(): Promise<boolean>
  async getValidSheets(): Promise<string[]>
}
```

When `processedSheets.size === totalSheets`, triggers `planMetadataCompleted` event.

## Queue System

### Cloudflare Queues

Jobs are distributed via Cloudflare Queues, with the Worker consuming messages and routing to the Container.

```typescript
// wrangler.json
"queues": {
  "producers": [
    { "queue": "pdf-processing", "binding": "PDF_QUEUE" }
  ],
  "consumers": [
    { "queue": "pdf-processing", "max_batch_size": 1, "max_retries": 3 }
  ]
}
```

### Job Types

#### Image Generation Job
```typescript
interface ImageGenJob {
  type: "image-gen"
  uploadId: string
  planId: string
  projectId: string
  organizationId: string
  pdfPath: string
  totalPages: number
  priority: number
}
```

#### Metadata Extraction Job
```typescript
interface MetadataExtractionJob {
  type: "metadata-extraction"
  uploadId: string
  planId: string
  sheetId: string
  sheetNumber: number
  imagePath: string
}
```

#### Callout Detection Job
```typescript
interface CalloutDetectionJob {
  type: "callout-detection"
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]
  sheets: Array<{
    sheetId: string
    sheetNumber: number
    imagePath: string
  }>
}
```

#### PMTiles Generation Job
```typescript
interface TilesGenJob {
  type: "tiles-gen"
  uploadId: string
  planId: string
  sheetId: string
  sheetNumber: number
  imagePath: string
}
```

### Priority and Retry Logic

**Priority Levels**:
- 10: User-initiated (just uploaded)
- 5: Background re-processing
- 1: Batch jobs

**Retry Strategy**:
- Max retries: 3
- Backoff: Exponential (1min, 5min, 15min)
- Failure action: Emit `planProcessingFailed` event

**Concurrency Limits** (managed via queue consumer settings):
- Image Generation: 2 concurrent (VIPS is CPU-intensive)
- Metadata Extraction: 10 concurrent (lightweight OCR)
- Callout Detection: 1 concurrent (expensive LLM calls)
- PMTiles Generation: 2 concurrent (VIPS is CPU-intensive)

## LiveStore Integration

### Event Commit Pattern

All workers use the same LiveStore client pattern:

```typescript
import { LiveStoreClient } from "@livestore/sync-cf/cf-worker"
import { schema } from "@sitelink/domain"

const client = new LiveStoreClient({
  schema,
  storeId: organizationId,
  syncBackend: env.SYNC_BACKEND_DO,
})

await client.commit(
  events.sheetImageGenerated({
    sheetId,
    planId,
    projectId,
    pageNumber,
    localImagePath: r2Key,
    width,
    height,
    generatedAt: Date.now(),
  })
)
```

### StoreId Routing

**Critical**: The `storeId` MUST be the `organizationId` for proper sync routing.

All events for a plan must use the same `organizationId` so they materialize to the same LiveStore instance. Mobile clients subscribe to their organization's store.

### Event Ordering

Events must be committed in order for each stage:

1. Stage 1: Emit `sheetImageGenerated` in page order (1, 2, 3...)
2. Stage 2: Emit `sheetMetadataExtracted` as completed, then `planMetadataCompleted` last
3. Stage 3: Emit `sheetCalloutsDetected` in any order (parallel processing)
4. Stage 4: Emit `sheetTilesGenerated` in any order (parallel processing)

### Error Events

If any stage fails completely, emit `planProcessingFailed`:
```typescript
await client.commit(
  events.planProcessingFailed({
    planId,
    error: errorMessage,
    failedAt: new Date(),
  })
)
```

## Error Handling

### Failure Modes

#### 1. PDF Corruption
**Stage**: Image Generation
**Handling**: Emit `planProcessingFailed`, mark plan as failed
**Recovery**: User must re-upload PDF

#### 2. OCR Failure
**Stage**: Metadata Extraction
**Handling**: Use fallback titles ("Sheet 1", "Sheet 2")
**Recovery**: Still emit `planMetadataCompleted` with valid sheets

#### 3. LLM API Failure
**Stage**: Callout Detection
**Handling**: Retry with exponential backoff (3 attempts)
**Recovery**: If all retries fail, emit event with empty markers array

#### 4. VIPS Crash
**Stage**: Image Gen or PMTiles Gen
**Handling**: Retry job (different container instance may succeed)
**Recovery**: After 3 retries, emit `planProcessingFailed`

### Partial Failures

If some sheets succeed and others fail:
- Continue processing successful sheets
- Mark failed sheets in database
- UI shows partial results with error indicators
- Users can retry individual sheets

### Monitoring and Alerts

- Log all errors to Cloudflare Workers Analytics
- Track processing times per stage
- Alert on high failure rates (>5%)
- Alert on stuck jobs (>1 hour in queue)

## File Storage

### R2 Bucket Structure

```
organizations/{orgId}/projects/{projectId}/plans/{planId}/
├── uploads/
│   └── {uploadId}/
│       ├── original.pdf          (from mobile sync)
│       └── sheet-{n}.pdf         (split pages, optional)
└── sheets/
    └── sheet-{n}/
        ├── source.png            (300 DPI, Stage 1)
        ├── tiles.pmtiles         (Stage 4)
        └── debug/                (optional, for callout detection)
            ├── cv_detection.png
            └── callouts_annotated.png
```

### Container Storage

**Container Local Storage** (temporary):
- Used during processing for intermediate files
- Cleaned up after job completes
- Not persistent across container restarts

**R2 Storage** (permanent):
- All final outputs (source.png, tiles.pmtiles)
- Original PDFs (synced from mobile)
- Accessible by mobile app via presigned URLs

### File Lifecycle

1. Mobile uploads PDF → R2 at `uploads/{uploadId}/original.pdf`
2. Image Gen downloads PDF, generates PNGs, uploads to R2
3. Metadata Extraction reads PNGs from R2
4. Callout Detection reads PNGs from R2
5. PMTiles Gen reads PNGs from R2, uploads tiles.pmtiles
6. Mobile app fetches PMTiles from R2 via presigned URLs

### Storage Optimization

- **Compression**: Use JPEG for tiles (85% quality) to save space
- **TTL**: Debug images can expire after 30 days
- **Lazy Loading**: Generate tiles on-demand if storage is constrained

## Deployment

### Cloudflare Configuration

**wrangler.json**:
```json
{
  "name": "sitelink-backend",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",

  "durable_objects": {
    "bindings": [
      {
        "name": "PLAN_COORDINATOR_DO",
        "class_name": "PlanCoordinator"
      },
      {
        "name": "SYNC_BACKEND_DO",
        "class_name": "SyncBackend"
      }
    ]
  },

  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "sitelink-storage"
    }
  ],

  "queues": {
    "producers": [
      { "queue": "pdf-processing", "binding": "PDF_QUEUE" }
    ],
    "consumers": [
      {
        "queue": "pdf-processing",
        "max_batch_size": 1,
        "max_retries": 3,
        "dead_letter_queue": "pdf-processing-dlq"
      }
    ]
  },

  "containers": {
    "PDF_PROCESSOR_CONTAINER": {
      "image": "./container"
    }
  },

  "vars": {
    "OPENROUTER_API_KEY": "sk-..."
  }
}
```

### Container Dockerfile

```dockerfile
# container/Dockerfile
FROM python:3.11-slim

# Install VIPS and dependencies
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libvips-tools \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app
WORKDIR /app

EXPOSE 8080
CMD ["python", "server.py"]
```

**requirements.txt**:
```
opencv-python-headless==4.9.0.80
numpy==1.26.4
pillow==10.2.0
pyvips==2.2.2
pmtiles==3.3.0
flask==3.0.0
pytesseract==0.3.10
requests==2.31.0
```

### Dependencies

**Cloudflare Workers**:
- `@livestore/sync-cf` - LiveStore client
- `@sitelink/domain` - Shared events/schema
- `@cloudflare/workers-types` - TypeScript types

**Container (Python)**:
- VIPS (libvips + pyvips)
- OpenCV (cv2)
- NumPy
- Pillow
- Tesseract OCR
- PMTiles CLI
- Flask (HTTP server)

### Deployment Process

1. **Build and Deploy Container**:
   ```bash
   cd apps/backend/container
   docker build -t pdf-processor .
   # Container is deployed with wrangler
   ```

2. **Deploy Cloudflare Worker**:
   ```bash
   cd apps/backend
   bun run build
   bunx wrangler deploy
   ```

3. **Create Queues**:
   ```bash
   bunx wrangler queues create pdf-processing
   bunx wrangler queues create pdf-processing-dlq
   ```

4. **Test Pipeline**:
   - Upload test PDF via mobile app
   - Monitor queue depths in Cloudflare dashboard
   - Check Worker logs for processing
   - Verify events in LiveStore

## Key Design Decisions

### 1. Cloudflare Containers for Heavy Processing

**Decision**: Use Cloudflare Containers for VIPS and Python workloads.

**Rationale**:
- Single cloud provider (Cloudflare-only infrastructure)
- Containers have access to R2 bindings
- No cross-cloud networking complexity
- Simplified deployment and monitoring

### 2. Coordination with Durable Objects

**Decision**: Use PlanCoordinator Durable Object to track sheet completion.

**Rationale**:
- Durable Objects provide strong consistency
- State persists across worker invocations
- Atomic updates prevent race conditions
- Natural fit for aggregation logic

### 3. Cloudflare Queues for Job Distribution

**Decision**: Use Cloudflare Queues instead of external queue services.

**Rationale**:
- Native integration with Workers
- Built-in retry and dead-letter support
- No external dependencies
- Consistent with Cloudflare-only architecture

### 4. Container Storage vs R2

**Decision**: Store only final outputs in R2, use container local temp storage during processing.

**Rationale**:
- R2 is permanent and accessible by mobile
- Local storage is faster for intermediate files
- Reduces R2 storage costs
- Simplifies cleanup after processing

### 5. Handling Partial Failures

**Decision**: Continue processing successful sheets, mark failed sheets individually.

**Rationale**:
- Better UX than failing entire plan
- Users can see partial results immediately
- Failed sheets can be retried independently
- Graceful degradation principle

## Future Enhancements

### 1. Batch Processing Mode
Allow users to upload multiple PDFs at once, process in background with lower priority.

### 2. Smart Caching
Cache 300 DPI source images in R2 to avoid re-generation when re-running callout detection.

### 3. Progressive Results
Stream `sheetCalloutsDetected` events as each sheet completes, don't wait for all sheets.

### 4. Container Autoscaling
Configure container autoscaling based on queue depth for high-volume processing.

### 5. Adaptive Quality
Adjust JPEG quality based on sheet complexity (e.g., 90% for detailed plans, 75% for simple diagrams).

### 6. Delta Sync
Only process sheets that changed in a PDF update, skip unchanged sheets.

## References

- LiveStore Docs: https://next.livestore.dev/#docs-for-llms
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Containers: https://developers.cloudflare.com/workers/platform/containers/
- VIPS Documentation: https://www.libvips.org/
- PMTiles Spec: https://github.com/protomaps/PMTiles
- OpenCV Python: https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html
- Callout Processor (backend-dev): `packages/callout-processor/`

## Related Documents

- `/docs/PDF_UPLOAD_IMPLEMENTATION.md` - Mobile local-first processing
- `/docs/LIVESTORE_0.4_MIGRATION.md` - LiveStore migration guide
- `/docs/STORE_ARCHITECTURE.md` - Data architecture overview
- `/docs/design/AGENT_ORCHESTRATION.md` - Agent coordination patterns
