# PDF Processing Worker Architecture

## Overview

This document defines the backend worker architecture for the 4-stage PDF processing pipeline. The system processes construction plan PDFs uploaded from the mobile app, extracting sheet metadata, detecting callouts, and generating tiles for interactive viewing.

The architecture uses Cloudflare Workers with Durable Objects for queue management, LiveStore for event sourcing, and a mix of VIPS (image processing) and Python dependencies (OpenCV, LLM) for the actual processing work.

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

### 1. Image Generation Worker

**Responsibilities**:
- Listen for plan upload events from LiveStore sync
- Download original PDF from R2
- Use VIPS to render each page at 300 DPI PNG
- Upload source images to R2
- Emit `sheetImageGenerated` events

**Input Event**: `v1.PlanUploaded`
**Output Events**: `v1.SheetImageGenerated` (one per sheet)

**Dependencies**:
- VIPS CLI (via Cloudflare Workers subprocess or external service)
- R2 storage bindings
- LiveStore client

**Implementation Notes**:
- VIPS is not available in Cloudflare Workers directly
- Options:
  1. Run on external compute (AWS Lambda, Fly.io) triggered by queue
  2. Use Cloudflare Workers for orchestration + external VIPS service
  3. Use Cloudflare Images API for PDF rendering

**Recommended**: Use AWS Lambda with VIPS layer, triggered by SQS queue from Cloudflare Worker.

### 2. Metadata Extraction Worker

**Responsibilities**:
- Listen for `sheetImageGenerated` events
- Track completion of all sheets for a plan
- Run OCR on title block regions to extract sheet metadata
- Emit `sheetMetadataExtracted` events
- When all sheets complete, emit `planMetadataCompleted` with `validSheets` list

**Input Event**: `v1.SheetImageGenerated`
**Output Events**:
- `v1.SheetMetadataExtracted` (one per sheet)
- `v1.PlanMetadataCompleted` (once all sheets processed)

**Dependencies**:
- OCR service (Tesseract.js or cloud OCR API)
- LiveStore client for event commits
- Durable Object for plan completion tracking

**State Tracking**:
Uses a Durable Object keyed by `planId` to track:
```typescript
interface PlanMetadataState {
  planId: string
  totalSheets: number
  processedSheets: Set<string>
  validSheets: string[]  // Sheet IDs with valid metadata
  failedSheets: string[]  // Sheet IDs that failed extraction
}
```

When `processedSheets.size === totalSheets`, emit `planMetadataCompleted`.

**Implementation Notes**:
- Title block detection can use simple heuristics (bottom-right corner)
- OCR can run in Cloudflare Workers via Tesseract.js WASM
- Fallback: Use generic titles "Sheet 1", "Sheet 2" if OCR fails

### 3. Callout Detection Worker

**Responsibilities**:
- Listen for `planMetadataCompleted` events
- For each sheet in the plan, run OpenCV + LLM detection pipeline
- Use `validSheets` list to validate callout targets
- Emit `sheetCalloutsDetected` events with markers and `needsReview` flags

**Input Event**: `v1.PlanMetadataCompleted`
**Output Events**: `v1.SheetCalloutsDetected` (one per sheet)

**Dependencies**:
- Python runtime with OpenCV (cv2), numpy
- OpenRouter API for LLM validation
- 300 DPI source images from R2
- LiveStore client

**Processing Flow**:
```
1. Receive planMetadataCompleted(planId, validSheets)
2. For each sheet in plan:
   a. Download 300 DPI PNG from R2
   b. Run enhancedShapeDetection.py (OpenCV)
   c. Crop detected shapes
   d. Batch validate with LLM (batchValidation.ts)
   e. Deduplicate nearby detections
   f. Verify targets against validSheets
   g. Emit sheetCalloutsDetected event
```

**Implementation Notes**:
- Reuse callout-processor code from backend-dev branch
- Python execution requires external runtime (not available in CF Workers)
- Options:
  1. AWS Lambda with Python + OpenCV layers
  2. Dedicated Python service (FastAPI) on Fly.io/Railway
  3. Cloudflare Workers + external Python API

**Recommended**: AWS Lambda with Python 3.11 + OpenCV layer, triggered via SQS.

**Error Handling**:
- If detection fails for a sheet, emit event with empty markers array
- Set `unmatchedCount` for callouts that don't match `validSheets`
- Flag markers as `needsReview: true` if confidence < 0.8

### 4. PMTiles Generation Worker

**Responsibilities**:
- Listen for `sheetCalloutsDetected` events
- Download 300 DPI source image from R2
- Use VIPS to generate Deep Zoom tiles
- Package as PMTiles format
- Upload to R2
- Emit `sheetTilesGenerated` events

**Input Event**: `v1.SheetCalloutsDetected`
**Output Events**: `v1.SheetTilesGenerated`

**Dependencies**:
- VIPS CLI for tiling
- PMTiles CLI for packaging
- R2 storage bindings
- LiveStore client

**Tile Generation**:
```bash
# VIPS generates Deep Zoom tiles (JPEG)
vips dzsave source.png tiles/ --suffix .jpg[Q=85] --tile-size=256

# PMTiles packages tiles for efficient serving
pmtiles convert tiles/ output.pmtiles
```

**Implementation Notes**:
- Same challenge as Stage 1: VIPS not available in CF Workers
- Can reuse the same external compute setup
- PMTiles is a single file, easy to store in R2

**Recommended**: AWS Lambda with VIPS + PMTiles layers, triggered via SQS.

## Queue System

### Queue Architecture

Use Cloudflare Durable Objects as queue managers, with external compute workers polling for jobs.

```typescript
// Queue Durable Object
class ProcessingQueue extends DurableObject {
  async enqueue(job: Job): Promise<void>
  async dequeue(): Promise<Job | null>
  async retry(jobId: string): Promise<void>
  async markComplete(jobId: string): Promise<void>
  async markFailed(jobId: string, error: string): Promise<void>
}
```

### Queue Types

#### Image Generation Queue
```typescript
interface ImageGenJob {
  uploadId: string
  planId: string
  projectId: string
  organizationId: string
  pdfPath: string  // R2 key
  totalPages: number
  priority: number  // 1-10 (10 = highest)
}
```

#### Metadata Extraction Queue
```typescript
interface MetadataExtractionJob {
  uploadId: string
  planId: string
  sheetId: string
  sheetNumber: number
  imagePath: string  // R2 key to 300 DPI PNG
}
```

#### Callout Detection Queue
```typescript
interface CalloutDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]  // From planMetadataCompleted
  // Processed per-sheet
  sheets: Array<{
    sheetId: string
    sheetNumber: number
    imagePath: string  // R2 key to 300 DPI PNG
  }>
}
```

#### PMTiles Generation Queue
```typescript
interface TilesGenJob {
  uploadId: string
  planId: string
  sheetId: string
  sheetNumber: number
  imagePath: string  // R2 key to 300 DPI PNG
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

**Concurrency Limits**:
- Image Generation: 2 concurrent (VIPS is CPU-intensive)
- Metadata Extraction: 10 concurrent (lightweight OCR)
- Callout Detection: 1 concurrent (expensive LLM calls)
- PMTiles Generation: 2 concurrent (VIPS is CPU-intensive)

### Queue Monitoring

Expose metrics via Durable Object:
```typescript
interface QueueMetrics {
  pending: number
  inProgress: number
  completed: number
  failed: number
  avgProcessingTime: number
}
```

## LiveStore Integration

### Event Commit Pattern

All workers use the same LiveStore client pattern:

```typescript
import { LiveStoreClient } from "@livestore/sync-cf/cf-worker"
import { schema } from "@sitelink/domain"

// Initialize with organizationId as storeId
const client = new LiveStoreClient({
  schema,
  storeId: organizationId,
  syncBackend: env.SYNC_BACKEND_DO,
})

// Commit events
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
**Handling**: Retry job (different worker may succeed)
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

### Local vs R2

**Local Storage** (temporary):
- Used during processing for intermediate files
- Cleaned up after job completes
- Not persistent across worker invocations

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

### Environment Setup

**Cloudflare Workers**:
```toml
# wrangler.toml
[env.production]
name = "sitelink-backend"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[durable_objects.bindings]]
name = "PROCESSING_QUEUE_DO"
class_name = "ProcessingQueueDO"
script_name = "sitelink-backend"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "sitelink-storage"

[vars]
OPENROUTER_API_KEY = "sk-..."
WORKER_SERVICE_URL = "https://pdf-workers.sitelink.app"
```

**AWS Lambda** (for VIPS + Python workers):
```yaml
# serverless.yml
functions:
  imageGen:
    handler: workers/imageGen.handler
    runtime: nodejs18.x
    layers:
      - arn:aws:lambda:us-east-1:123456789012:layer:vips:1
    events:
      - sqs:
          arn: !GetAtt ImageGenQueue.Arn
          batchSize: 1
    timeout: 300
    memorySize: 3008

  calloutDetection:
    handler: workers/calloutDetection.handler
    runtime: python3.11
    layers:
      - arn:aws:lambda:us-east-1:123456789012:layer:opencv:1
    events:
      - sqs:
          arn: !GetAtt CalloutQueue.Arn
          batchSize: 1
    timeout: 900
    memorySize: 10240
```

### Dependencies

**Cloudflare Workers**:
- `@livestore/sync-cf` - LiveStore client
- `@sitelink/domain` - Shared events/schema
- `@cloudflare/workers-types` - TypeScript types

**AWS Lambda (Node.js)**:
- VIPS layer (libvips + sharp)
- PMTiles CLI
- AWS SDK (S3/R2 access)

**AWS Lambda (Python)**:
- OpenCV (cv2)
- NumPy
- Pillow
- Requests (for OpenRouter API)

### Deployment Process

1. **Build Cloudflare Worker**:
   ```bash
   cd apps/backend
   bun run build
   bunx wrangler deploy
   ```

2. **Deploy AWS Lambdas**:
   ```bash
   cd workers
   serverless deploy --stage production
   ```

3. **Configure Queue URLs**:
   - Update Cloudflare Worker env vars with SQS queue URLs
   - Update Lambda env vars with Cloudflare Worker callback URLs

4. **Test Pipeline**:
   - Upload test PDF via mobile app
   - Monitor queue depths in Cloudflare dashboard
   - Check Lambda CloudWatch logs for processing
   - Verify events in LiveStore

## Key Design Decisions

### 1. Coordination for "Wait for All Sheets"

**Decision**: Use a Durable Object keyed by `planId` to track sheet completion.

**Rationale**:
- Durable Objects provide strong consistency
- State persists across worker invocations
- Atomic updates prevent race conditions
- Natural fit for aggregation logic

**Alternative Considered**: Query LiveStore for all `sheetMetadataExtracted` events.
**Rejected**: Would require polling or complex event counting logic.

### 2. Python Dependencies (OpenCV)

**Decision**: Run OpenCV workload on AWS Lambda with Python runtime.

**Rationale**:
- OpenCV requires native Python bindings (cv2)
- Cloudflare Workers don't support Python
- AWS Lambda has pre-built OpenCV layers
- SQS provides reliable queue integration

**Alternative Considered**: Rewrite OpenCV logic in JavaScript (opencv.js).
**Rejected**: Performance concerns and incomplete API coverage.

### 3. Local File Storage vs R2

**Decision**: Store only final outputs in R2, use local temp storage during processing.

**Rationale**:
- R2 is permanent and accessible by mobile
- Local storage is faster for intermediate files
- Reduces R2 storage costs
- Simplifies cleanup after processing

**Alternative Considered**: Store all intermediate files in R2.
**Rejected**: Unnecessary storage costs and slower processing.

### 4. Queue Priority and Concurrency

**Decision**: Prioritize user-initiated uploads (priority 10), limit callout detection to 1 concurrent job.

**Rationale**:
- User uploads need fast feedback
- LLM calls are expensive and rate-limited
- VIPS is CPU-intensive, limit to 2 concurrent
- OCR is lightweight, can run 10 concurrent

**Alternative Considered**: FIFO queue with no prioritization.
**Rejected**: Poor UX for interactive uploads.

### 5. Handling Partial Failures

**Decision**: Continue processing successful sheets, mark failed sheets individually.

**Rationale**:
- Better UX than failing entire plan
- Users can see partial results immediately
- Failed sheets can be retried independently
- Graceful degradation principle

**Alternative Considered**: Fail entire plan if any sheet fails.
**Rejected**: Wasteful re-processing of successful sheets.

## Future Enhancements

### 1. Batch Processing Mode
Allow users to upload multiple PDFs at once, process in background with lower priority.

### 2. Smart Caching
Cache 300 DPI source images in R2 to avoid re-generation when re-running callout detection.

### 3. Progressive Results
Stream `sheetCalloutsDetected` events as each sheet completes, don't wait for all sheets.

### 4. GPU Acceleration
Use GPU-enabled Lambda instances for faster OpenCV processing.

### 5. Adaptive Quality
Adjust JPEG quality based on sheet complexity (e.g., 90% for detailed plans, 75% for simple diagrams).

### 6. Delta Sync
Only process sheets that changed in a PDF update, skip unchanged sheets.

## References

- LiveStore Docs: https://next.livestore.dev/#docs-for-llms
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- VIPS Documentation: https://www.libvips.org/
- PMTiles Spec: https://github.com/protomaps/PMTiles
- OpenCV Python: https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html
- Callout Processor (backend-dev): `packages/callout-processor/`
- Backend Queues (backend-dev): `packages/backend/src/core/queues/`

## Related Documents

- `/docs/PDF_UPLOAD_IMPLEMENTATION.md` - Mobile local-first processing
- `/docs/LIVESTORE_0.4_MIGRATION.md` - LiveStore migration guide
- `/docs/STORE_ARCHITECTURE.md` - Data architecture overview
- `/docs/design/AGENT_ORCHESTRATION.md` - Agent coordination patterns
