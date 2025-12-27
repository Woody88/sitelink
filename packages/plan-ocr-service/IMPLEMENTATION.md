# Plan-OCR Service Implementation Roadmap

**Project:** Sitelink Integration - Plan-OCR Marker Detection Service
**Status:** Phases 1-4 Complete ✅ | Phases 5-8 Pending ⏳
**Last Updated:** 2025-12-01

---

## Overview

This document outlines the 8-phase implementation plan for integrating the plan-ocr Python service into the sitelink Cloudflare platform.

**Architecture:** Sheet-Level Parallel Processing with Durable Objects (Refined Option C)

**Total Estimated Time:** 40-60 hours

---

## Phase 1: Explore Sitelink Codebase ✅ COMPLETE

**Status:** ✅ COMPLETE
**Duration:** ~4 hours
**Complexity:** MEDIUM

### Objectives
- Understand sitelink monorepo structure
- Identify existing queue worker patterns
- Locate database schema files (Drizzle)
- Find existing PDF processing flow
- Identify Durable Object patterns
- Understand Effect-TS service patterns

### Key Findings
- **Monorepo Structure:** `packages/backend/`, `packages/drizzle-effect/`, `packages/mobile/`
- **Existing Queues:** `tile-generation-queue`, `pdf-processing-queue`
- **Database:** Drizzle ORM with D1 (SQLite)
- **Existing Container:** `SitelinkPdfProcessor` (Durable Object + Container hybrid)
- **Queue Pattern:** Promise.allSettled with individual ack/retry
- **Service Pattern:** Effect-TS services with error handling

### Deliverables
- ✅ Comprehensive codebase analysis
- ✅ Integration points identified
- ✅ Existing patterns documented

---

## Phase 2: Create Detailed Implementation Plan ✅ COMPLETE

**Status:** ✅ COMPLETE
**Duration:** ~6 hours
**Complexity:** COMPLEX

### Objectives
- Break down integration into detailed subtasks
- Design database schema changes
- Specify API contracts
- Plan error handling strategies
- Estimate performance and costs
- Create rollback plan

### Deliverables
- ✅ 7 implementation phases with 40+ subtasks
- ✅ Database schema specifications (PLAN_SHEETS, PLAN_MARKERS)
- ✅ API contract for 2 Python endpoints
- ✅ Queue configuration details
- ✅ Error scenarios and mitigation strategies
- ✅ Performance expectations (10-sheet: ~105s, 100-sheet: ~8min)
- ✅ Feature flag strategy for gradual rollout

### Key Decisions
- **Architecture:** Refined Option C (Sheet-Level Parallel + Durable Objects)
- **Python Deployment:** Cloudflare Container (not external service)
- **Feature Flag:** `ENABLE_PLAN_OCR` for gradual rollout
- **Queue Structure:** 3 new queues (metadata, tiles, markers)

---

## Phase 3: Setup Python plan-ocr-service Package ✅ COMPLETE

**Status:** ✅ COMPLETE
**Duration:** ~4 hours
**Complexity:** MEDIUM

### Objectives
- Create new Python package in sitelink monorepo
- Copy Python files from plan-ocr project
- Create FastAPI application with 2 endpoints
- Create Dockerfile for Cloudflare Container
- Setup dependencies and configuration
- Verify hallucination fix is present

### Implementation

**Location:** `/home/woodson/Code/projects/sitelink/packages/plan-ocr-service/`

**Files Created (16 total):**
```
plan-ocr-service/
├── Dockerfile                    ✅
├── pyproject.toml                ✅
├── wrangler.toml                 ✅
├── README.md                     ✅
├── ARCHITECTURE.md               ✅
├── ACHIEVEMENTS.md               ✅
├── .env.example                  ✅
└── src/
    ├── __init__.py               ✅
    ├── api.py                    ✅ FastAPI with 3 endpoints
    ├── metadata_extractor.py     ✅ From plan-ocr
    ├── stage1_geometric_detector.py ✅ From plan-ocr
    ├── stage2_llm_validator.py   ✅ HALLUCINATION-FIXED
    ├── ocr_prefilter.py          ✅ From plan-ocr
    └── utils/
        ├── __init__.py           ✅
        ├── nms.py                ✅
        ├── geometric_filters.py  ✅
        ├── title_block_patterns.py ✅
        └── preprocessing.py      ✅
```

### API Endpoints Created
1. **GET /health** - Health check
2. **POST /api/extract-metadata** - Sheet metadata extraction
3. **POST /api/detect-markers** - Reference marker detection

### Critical Verifications
- ✅ Temperature: 0.0 (line 41 of stage2_llm_validator.py)
- ✅ Batch size: 10 (line 38 of stage2_llm_validator.py)
- ✅ Hallucination safeguard present (lines 307-314)

### Deliverables
- ✅ Complete Python package ready for local testing
- ✅ Dockerfile with OpenCV + Tesseract
- ✅ FastAPI application with error handling
- ✅ Comprehensive documentation (README, ARCHITECTURE, ACHIEVEMENTS)

### Testing
**Local Test Commands:**
```bash
cd /home/woodson/Code/projects/sitelink/packages/plan-ocr-service
pip install -e .
uvicorn src.api:app --reload --port 8000
curl http://localhost:8000/health
```

---

## Phase 4: Create Database Schema Migration ✅ COMPLETE

**Status:** ✅ COMPLETE
**Duration:** ~2 hours
**Complexity:** MEDIUM

### Objectives
- Update PLAN_SHEETS table with metadata columns
- Create new PLAN_MARKERS table
- Update schema exports
- Prepare migration files

### Implementation

#### 1. Updated PLAN_SHEETS Schema
**File:** `packages/backend/src/core/database/schemas/plan-sheets.ts`

**New Columns Added:**
```typescript
sheetName: D.text("sheet_name")
  // e.g., "A5", "A-007"

metadataStatus: D.text("metadata_status")
  .notNull()
  .default("pending")
  // pending|extracting|extracted|failed

metadata: D.text("metadata", { mode: "json" })
  // JSON: { title_block_location, extracted_text, confidence, method }

metadataExtractedAt: D.integer("metadata_extracted_at", { mode: "timestamp_ms" })
```

#### 2. Created PLAN_MARKERS Table
**File:** `packages/backend/src/core/database/schemas/plan-markers.ts`

**Schema:**
```typescript
{
  id: text (PK)
  uploadId: text (FK → plan_uploads.uploadId, cascade)
  planId: text (FK → plans.id, cascade)
  sheetNumber: integer

  // Marker content
  markerText: text      // "3/A7"
  detail: text          // "3"
  sheet: text           // "A7"
  markerType: text      // "circular" | "triangular"

  // Validation
  confidence: real
  isValid: boolean
  fuzzyMatched: boolean

  // Location
  sourceTile: text      // "tile_2_3.jpg"
  bbox: json            // { x, y, w, h }

  createdAt: timestamp_ms
}
```

**Indexes:**
- `idx_markers_upload` on `uploadId`
- `idx_markers_plan` on `planId`
- `idx_markers_sheet` on `(planId, sheetNumber)`

#### 3. Updated Schema Exports
**File:** `packages/backend/src/core/database/schemas/index.ts`

- ✅ Added export: `export * from "./plan-markers"`
- ✅ Added import: `import { planMarkers } from "./plan-markers"`
- ✅ Added to schema object: `planMarkers`

### Deliverables
- ✅ PLAN_SHEETS schema updated
- ✅ PLAN_MARKERS table created
- ✅ Schema exports updated
- ✅ Ready for migration generation

### Next Steps (Not Yet Run)
```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
bun run db:generate    # Creates drizzle/0001_*.sql
bun run db:local:apply:migration
```

---

## Phase 5: Implement PlanCoordinator Durable Object ⏳ PENDING

**Status:** ⏳ PENDING
**Duration:** ~4 hours
**Complexity:** COMPLEX

### Objectives
- Create Durable Object to coordinate sheet metadata completion
- Track when all sheets have finished metadata extraction
- Automatically trigger next phase (tile generation)
- Handle idempotent sheet completion (safe retries)

### Implementation

**File:** `packages/backend/src/durable-objects/PlanCoordinator.ts`

**Methods to Implement:**
```typescript
class PlanCoordinator extends DurableObject {
  // Initialize coordination for a new plan
  async initialize(request: Request): Promise<Response>
    // Input: { uploadId, planId, totalSheets, organizationId, projectId }
    // Stores: uploadId, planId, totalSheets, completedSheets: [], failedSheets: []

  // Mark sheet as complete (idempotent)
  async sheetComplete(request: Request): Promise<Response>
    // Input: { sheetId, sheetNumber, success: boolean }
    // Updates: completedSheets or failedSheets
    // Triggers: Queue 3 when totalCompleted === totalSheets

  // Get current progress
  async getProgress(request: Request): Promise<Response>
    // Returns: { totalSheets, completedSheets, failedSheets, status, progress% }

  // Route handler
  override async fetch(request: Request): Promise<Response>
    // Routes to: /initialize, /sheet-complete, /progress
}
```

**State Storage (Durable Object storage):**
```typescript
{
  uploadId: string
  planId: string
  totalSheets: number
  organizationId: string
  projectId: string
  completedSheets: string[]  // Array of sheet IDs
  failedSheets: string[]     // Array of sheet IDs
  status: "in_progress" | "completed" | "failed"
  createdAt: number
}
```

**Idempotency:**
- Duplicate `sheetComplete()` calls are ignored
- Checks if sheetId already in completedSheets or failedSheets
- Safe for queue retries

**Auto-Trigger Logic:**
```typescript
if (completedSheets.length + failedSheets.length === totalSheets) {
  // All sheets processed!
  await env.PLAN_TILE_GENERATION_QUEUE.send({
    uploadId, planId, organizationId, projectId,
    totalSheets, completedSheets: completedSheets.length, failedSheets: failedSheets.length
  })
  await this.ctx.storage.put("status", "completed")
}
```

### Configuration Changes

**wrangler.jsonc:**
```jsonc
{
  "durable_objects": {
    "bindings": [
      { "class_name": "SitelinkPdfProcessor", "name": "SITELINK_PDF_PROCESSOR" },
      { "class_name": "PlanCoordinator", "name": "PLAN_COORDINATOR" }  // ADD
    ]
  },
  "migrations": [
    { "new_sqlite_classes": ["SitelinkPdfProcessor"], "tag": "v1" },
    { "new_sqlite_classes": ["PlanCoordinator"], "tag": "v2" }  // ADD
  ]
}
```

**src/index.ts:**
```typescript
export { PlanCoordinator } from "./durable-objects/PlanCoordinator"
```

**src/core/bindings.ts:**
```typescript
export class PlanCoordinatorBinding extends Context.Tag("PlanCoordinatorBinding")<
  PlanCoordinatorBinding,
  DurableObjectNamespace<PlanCoordinator>
>() {}
```

### Deliverables
- ⏳ PlanCoordinator Durable Object implemented
- ⏳ Registered in wrangler.jsonc
- ⏳ Exported from index.ts
- ⏳ Binding created
- ⏳ Unit tests written

### Testing Strategy
- Test initialization
- Test sheet completion tracking
- Test idempotency (duplicate calls)
- Test auto-trigger when all sheets complete
- Test failure tracking

---

## Phase 6: Implement Queue Workers ⏳ PENDING

**Status:** ⏳ PENDING
**Duration:** ~12 hours
**Complexity:** COMPLEX

### Overview
Implement 3 new queue workers for the plan-ocr pipeline:
1. Queue 2: Metadata Extraction (sheet-level, parallel)
2. Queue 3: Tile Generation (plan-level, sequential)
3. Queue 4: Marker Detection (plan-level, sequential)

---

### Phase 6a: Queue 2 - Metadata Extraction Worker ⏳ PENDING

**Duration:** ~4 hours
**Complexity:** COMPLEX

#### Objectives
- Extract sheet metadata in parallel (per sheet)
- Call Python service with presigned URL
- Update PLAN_SHEETS table
- Notify PlanCoordinator when complete

#### Implementation

**File:** `packages/backend/src/core/queues/metadataExtractionConsumer.ts`

**Queue Message Type:**
```typescript
interface MetadataExtractionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  sheetId: string
  sheetNumber: number
  sheetKey: string      // R2 path: "organizations/.../sheet-1.pdf"
  totalSheets: number
}
```

**Processing Flow:**
```typescript
async function processMetadataJob(message, env) {
  // 1. Update status to "extracting"
  await db.update(planSheets)
    .set({ metadataStatus: "extracting" })
    .where(eq(planSheets.id, sheetId))

  // 2. Get sheet PDF from R2
  const sheet = await env.SitelinkStorage.get(sheetKey)

  // 3. Generate presigned URL (1 hour expiry)
  const presignedUrl = await env.SitelinkStorage.createPresignedUrl(sheetKey, { expiresIn: 3600 })

  // 4. Call Python service
  const planOcrContainer = env.PLAN_OCR_SERVICE.getByName(planId)
  const response = await planOcrContainer.fetch("http://localhost/api/extract-metadata", {
    method: "POST",
    body: JSON.stringify({ sheet_url: presignedUrl, sheet_id: sheetId })
  })

  // 5. Parse response
  const result = await response.json()
  // { sheet_number: "A5", metadata: {...} }

  // 6. Update PLAN_SHEETS
  await db.update(planSheets)
    .set({
      sheetName: result.sheet_number,
      metadata: JSON.stringify(result.metadata),
      metadataStatus: "extracted",
      metadataExtractedAt: new Date()
    })
    .where(eq(planSheets.id, sheetId))

  // 7. Notify PlanCoordinator
  const coordinator = env.PLAN_COORDINATOR.getByName(planId)
  await coordinator.fetch("http://localhost/sheet-complete", {
    method: "POST",
    body: JSON.stringify({ sheetId, sheetNumber, success: true })
  })
}
```

**Error Handling:**
```typescript
catch (error) {
  // Mark as failed
  await db.update(planSheets)
    .set({ metadataStatus: "failed", errorMessage: error.message })
    .where(eq(planSheets.id, sheetId))

  // Still notify coordinator (with success=false)
  await coordinator.fetch("http://localhost/sheet-complete", {
    body: JSON.stringify({ sheetId, sheetNumber, success: false })
  })

  // Retry via queue
  message.retry()
}
```

#### Configuration

**wrangler.jsonc:**
```jsonc
{
  "queues": {
    "producers": [
      { "binding": "METADATA_EXTRACTION_QUEUE", "queue": "metadata-extraction-queue" }
    ],
    "consumers": [
      {
        "queue": "metadata-extraction-queue",
        "max_batch_size": 5,
        "max_concurrency": 20,  // High concurrency for parallel processing
        "max_retries": 3
      }
    ]
  }
}
```

**src/core/queues/types.ts:**
```typescript
export interface MetadataExtractionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  sheetId: string
  sheetNumber: number
  sheetKey: string
  totalSheets: number
}
```

**src/index.ts queue handler:**
```typescript
case "metadata-extraction-queue":
  await metadataExtractionQueueConsumer(
    batch as MessageBatch<MetadataExtractionJob>,
    env,
    ctx
  )
  break
```

#### Deliverables
- ⏳ metadataExtractionConsumer.ts implemented
- ⏳ Queue registered in wrangler.jsonc
- ⏳ Message type defined
- ⏳ Consumer registered in index.ts
- ⏳ Error handling and retries
- ⏳ Unit tests

---

### Phase 6b: Queue 3 - Tile Generation Worker ⏳ PENDING

**Duration:** ~4 hours
**Complexity:** COMPLEX

#### Objectives
- Generate tiles for entire plan (plan-level)
- Query all sheet metadata
- Extract valid_sheets array
- Enqueue to marker detection

#### Implementation

**File:** `packages/backend/src/core/queues/planTileGenerationConsumer.ts`

**Queue Message Type:**
```typescript
interface PlanTileGenerationJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  totalSheets: number
  completedSheets: number
  failedSheets: number
}
```

**Processing Flow:**
```typescript
async function processPlanTileJob(message, env) {
  // 1. Query all sheets
  const sheets = await db.select()
    .from(planSheets)
    .where(eq(planSheets.uploadId, uploadId))
    .orderBy(planSheets.sheetNumber)

  // 2. Extract valid sheet names
  const validSheets = sheets
    .filter(sheet => sheet.sheetName && sheet.metadataStatus === "extracted")
    .map(sheet => sheet.sheetName)

  console.log(`Valid sheets: ${validSheets.join(", ")}`)

  // 3. Generate tiles for each sheet
  for (const sheet of sheets) {
    // Reuse existing tile generation logic from SitelinkPdfProcessor
    const container = env.SITELINK_PDF_PROCESSOR.getByName(planId)
    const sheetObject = await env.SitelinkStorage.get(sheet.sheetKey)

    const response = await container.fetch("http://localhost/generate-tiles", {
      method: "POST",
      body: sheetObject.body,
      headers: {
        "Content-Type": "application/pdf",
        "X-Sheet-Key": sheet.sheetKey,
        "X-Sheet-Number": sheet.sheetNumber.toString(),
        // ... other headers
      }
    })

    // Extract tar stream and upload tiles to R2
    // ... (existing logic)
  }

  // 4. Enqueue to marker detection
  await env.MARKER_DETECTION_QUEUE.send({
    uploadId, planId, organizationId, projectId,
    validSheets,
    totalSheets
  })
}
```

#### Configuration

**wrangler.jsonc:**
```jsonc
{
  "queues": {
    "producers": [
      { "binding": "PLAN_TILE_GENERATION_QUEUE", "queue": "plan-tile-generation-queue" }
    ],
    "consumers": [
      {
        "queue": "plan-tile-generation-queue",
        "max_batch_size": 1,  // Plan-level operation
        "max_retries": 3
      }
    ]
  }
}
```

#### Deliverables
- ⏳ planTileGenerationConsumer.ts implemented
- ⏳ Queue registered
- ⏳ Message type defined
- ⏳ Consumer registered
- ⏳ Unit tests

---

### Phase 6c: Queue 4 - Marker Detection Worker ⏳ PENDING

**Duration:** ~4 hours
**Complexity:** COMPLEX

#### Objectives
- Detect markers from all tiles (plan-level)
- Generate presigned URLs for tiles
- Call Python service with valid_sheets context
- Insert markers into PLAN_MARKERS table
- Update PROCESSING_JOBS status

#### Implementation

**File:** `packages/backend/src/core/queues/markerDetectionConsumer.ts`

**Queue Message Type:**
```typescript
interface MarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]  // e.g., ["A5", "A6", "A7"]
  totalSheets: number
}
```

**Processing Flow:**
```typescript
async function processMarkerDetectionJob(message, env) {
  // 1. List all tiles from R2
  const tilePrefix = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/`
  const tiles = await env.SitelinkStorage.list({ prefix: tilePrefix })

  // 2. Generate presigned URLs (2 hour expiry)
  const tileUrls = await Promise.all(
    tiles.objects
      .filter(obj => obj.key.endsWith(".jpg"))
      .map(obj => env.SitelinkStorage.createPresignedUrl(obj.key, { expiresIn: 7200 }))
  )

  console.log(`Found ${tileUrls.length} tiles`)

  // 3. Call Python service
  const planOcrContainer = env.PLAN_OCR_SERVICE.getByName(planId)
  const response = await planOcrContainer.fetch("http://localhost/api/detect-markers", {
    method: "POST",
    body: JSON.stringify({
      tile_urls: tileUrls,
      valid_sheets: validSheets,
      strict_filtering: true
    })
  })

  // 4. Parse response
  const result = await response.json()
  // { markers: [...], stage1_candidates: 777, stage2_validated: 169, processing_time_ms: 15234.5 }

  console.log(`Stage 1: ${result.stage1_candidates} candidates`)
  console.log(`Stage 2: ${result.stage2_validated} validated`)

  // 5. Insert markers into database
  const markerInserts = result.markers.map(marker => ({
    id: nanoid(),
    uploadId, planId,
    sheetNumber: extractSheetNumberFromTile(marker.source_tile),
    markerText: marker.text,
    detail: marker.detail,
    sheet: marker.sheet,
    markerType: marker.type,
    confidence: marker.confidence,
    isValid: marker.is_valid,
    fuzzyMatched: marker.fuzzy_matched,
    sourceTile: marker.source_tile,
    bbox: JSON.stringify(marker.bbox),
    createdAt: new Date()
  }))

  if (markerInserts.length > 0) {
    await db.insert(planMarkers).values(markerInserts)
    console.log(`Inserted ${markerInserts.length} markers`)
  }

  // 6. Update PROCESSING_JOBS
  await db.update(processingJobs)
    .set({
      status: "complete",
      completedAt: new Date(),
      progress: 100
    })
    .where(eq(processingJobs.uploadId, uploadId))

  console.log(`Plan ${planId} processing complete!`)
}
```

**Helper Function:**
```typescript
function extractSheetNumberFromTile(sourceTile: string): number {
  // Example: "sheet-3/tile_2_3.jpg" → 3
  const match = sourceTile.match(/sheet-(\d+)\//)
  return match ? parseInt(match[1]) : 0
}
```

#### Configuration

**wrangler.jsonc:**
```jsonc
{
  "queues": {
    "producers": [
      { "binding": "MARKER_DETECTION_QUEUE", "queue": "marker-detection-queue" }
    ],
    "consumers": [
      {
        "queue": "marker-detection-queue",
        "max_batch_size": 1,  // Plan-level operation
        "max_retries": 3
      }
    ]
  }
}
```

#### Deliverables
- ⏳ markerDetectionConsumer.ts implemented
- ⏳ Queue registered
- ⏳ Message type defined
- ⏳ Consumer registered
- ⏳ Unit tests

---

## Phase 7: Create PlanOcrService Effect Service ⏳ PENDING

**Status:** ⏳ PENDING
**Duration:** ~3 hours
**Complexity:** MEDIUM

### Objectives
- Create type-safe Effect-TS wrapper for Python service
- Implement retry logic and timeouts
- Define error types
- Follow existing service patterns

### Implementation

**File:** `packages/backend/src/services/PlanOcrService.ts`

**Service Structure:**
```typescript
export class PlanOcrService extends Effect.Service<PlanOcrService>()("PlanOcrService", {
  dependencies: [PlanOcrContainerBinding],
  effect: Effect.gen(function* () {
    const containerNamespace = yield* PlanOcrContainerBinding

    // Method 1: Extract Metadata
    const extractMetadata = (
      planId: string,
      sheetUrl: string,
      sheetId: string
    ): Effect.Effect<SheetMetadata, PlanOcrError> =>
      Effect.gen(function* () {
        const container = containerNamespace.getByName(planId)

        const response = yield* Effect.tryPromise({
          try: () => container.fetch("http://localhost/api/extract-metadata", {
            method: "POST",
            body: JSON.stringify({ sheet_url: sheetUrl, sheet_id: sheetId })
          }),
          catch: (error) => new PlanOcrError({
            reason: "network_error",
            message: "Failed to call Python service"
          })
        })

        // ... parse and validate response

        return yield* Schema.decode(SheetMetadata)(data)
      }).pipe(
        Effect.timeout("30 seconds"),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(new PlanOcrError({ reason: "timeout", message: "..." }))
        )
      )

    // Method 2: Detect Markers
    const detectMarkers = (
      planId: string,
      tileUrls: string[],
      validSheets: string[]
    ): Effect.Effect<MarkerDetectionResult, PlanOcrError> =>
      Effect.gen(function* () {
        // ... similar structure
      }).pipe(
        Effect.timeout("120 seconds"),
        Effect.retry({ times: 2 })  // Optional retry
      )

    return { extractMetadata, detectMarkers }
  })
}) {}
```

**Schema Definitions:**
```typescript
export class SheetMetadata extends Schema.Class<SheetMetadata>("SheetMetadata")({
  sheet_number: Schema.String,
  metadata: Schema.Struct({
    title_block_location: Schema.Struct({ x, y, w, h }),
    extracted_text: Schema.String,
    confidence: Schema.Number,
    method: Schema.Literal("tesseract", "llm_fallback", "llm_only")
  })
}) {}

export class MarkerDetectionResult extends Schema.Class<MarkerDetectionResult>("MarkerDetectionResult")({
  markers: Schema.Array(Schema.Struct({ ... })),
  stage1_candidates: Schema.Number,
  stage2_validated: Schema.Number,
  processing_time_ms: Schema.Number
}) {}

export class PlanOcrError extends Schema.TaggedError<PlanOcrError>()(
  "PlanOcrError",
  {
    reason: Schema.Literal("network_error", "timeout", "extraction_failed", "detection_failed", "invalid_response"),
    message: Schema.String,
    details: Schema.optional(Schema.String)
  }
) {}
```

**Configuration:**

**src/core/bindings.ts:**
```typescript
export class PlanOcrContainerBinding extends Context.Tag("PlanOcrContainerBinding")<
  PlanOcrContainerBinding,
  DurableObjectNamespace
>() {}
```

**src/index.ts:**
```typescript
const PlanOcrContainerLayer = Layer.succeed(
  Bindings.PlanOcrContainerBinding,
  env.PLAN_OCR_SERVICE
)

const AppLayer = Api.pipe(
  Layer.provide(CoreLayer),
  Layer.provide(PlanOcrContainerLayer),  // ADD
  // ... other layers
)
```

### Deliverables
- ⏳ PlanOcrService.ts implemented
- ⏳ Type-safe schemas defined
- ⏳ Error types defined
- ⏳ Timeouts configured (30s metadata, 120s markers)
- ⏳ Binding created and registered
- ⏳ Unit tests

---

## Phase 8: End-to-End Integration Testing ⏳ PENDING

**Status:** ⏳ PENDING
**Duration:** ~8 hours
**Complexity:** COMPLEX

### Objectives
- Test complete flow from PDF upload to marker storage
- Test error scenarios and retries
- Test parallel processing
- Verify data integrity
- Performance testing

### Test Scenarios

#### Test 1: Happy Path (5-page PDF) ⏳
**Steps:**
1. Upload 5-page PDF
2. Verify PDF split into 5 sheets
3. Verify PlanCoordinator initialized
4. Verify 5 metadata extraction jobs enqueued
5. Verify metadata extracted for all 5 sheets (parallel)
6. Verify PlanCoordinator triggers tile generation
7. Verify tiles generated for all sheets
8. Verify marker detection job enqueued
9. Verify markers detected and stored in PLAN_MARKERS
10. Verify PROCESSING_JOBS status = "complete"

**Expected Results:**
- All 5 sheets processed in parallel (~30-45s)
- valid_sheets array populated
- Markers stored with correct sheetNumber
- No errors or retries

#### Test 2: Partial Failure (3-page PDF, 1 fails) ⏳
**Setup:**
- Mock Python service to fail on sheet 2

**Steps:**
1. Upload 3-page PDF
2. Sheet 1: Success ✅
3. Sheet 2: Fail ❌ (retried 3 times)
4. Sheet 3: Success ✅
5. Verify PlanCoordinator still triggers tile generation
6. Verify tile generation skips failed sheet
7. Verify marker detection uses only successful sheets

**Expected Results:**
- Sheets 1 & 3 in valid_sheets array
- Sheet 2 marked as "failed" in database
- Marker detection proceeds with 2 valid sheets
- System degrades gracefully

#### Test 3: Large Plan (100-page PDF) ⏳
**Steps:**
1. Upload 100-page PDF
2. Verify parallel processing (max_concurrency=20)
3. Monitor resource usage
4. Verify no timeouts
5. Verify completion time <10 minutes

**Expected Results:**
- Metadata extraction: ~60s (parallel batches)
- Tile generation: ~6 minutes
- Marker detection: ~2 minutes
- Total: ~8-9 minutes
- No memory issues

#### Test 4: Retry Scenario ⏳
**Setup:**
- Mock Python service to fail first time, succeed second time

**Steps:**
1. Upload 1-page PDF
2. Metadata extraction fails
3. Queue retries (attempt 2)
4. Metadata extraction succeeds
5. Verify idempotency (no duplicate data)

**Expected Results:**
- Retry successful
- PlanCoordinator handles duplicate notification
- No duplicate markers
- Single database record

#### Test 5: Hallucination Detection ⏳
**Setup:**
- Use special test case that triggers hallucination

**Steps:**
1. Process plan with known hallucination trigger
2. Verify hallucination warning logged
3. Verify output truncated to match input
4. Verify markers stored correctly

**Expected Results:**
- Hallucination detected
- Output ≤ input count
- Valid markers stored
- Warning logged for monitoring

### Unit Tests

**PlanCoordinator Tests:**
- ⏳ Test initialization
- ⏳ Test sheet completion tracking
- ⏳ Test idempotency (duplicate notifications)
- ⏳ Test auto-trigger when complete
- ⏳ Test failure tracking

**Queue Consumer Tests:**
- ⏳ Test metadata extraction success
- ⏳ Test metadata extraction failure
- ⏳ Test tile generation
- ⏳ Test marker detection
- ⏳ Test error handling
- ⏳ Test retry logic

**PlanOcrService Tests:**
- ⏳ Test Effect error handling
- ⏳ Test timeout behavior
- ⏳ Test schema validation
- ⏳ Test retry logic

### Integration Test Files to Create

```
packages/backend/src/
├── durable-objects/__tests__/
│   └── PlanCoordinator.test.ts
├── core/queues/__tests__/
│   ├── metadataExtractionConsumer.test.ts
│   ├── planTileGenerationConsumer.test.ts
│   └── markerDetectionConsumer.test.ts
├── services/__tests__/
│   └── PlanOcrService.test.ts
└── integration-tests/
    ├── happy-path.test.ts
    ├── partial-failure.test.ts
    ├── large-plan.test.ts
    ├── retry.test.ts
    └── hallucination.test.ts
```

### Deliverables
- ⏳ All unit tests passing
- ⏳ All integration tests passing
- ⏳ Performance benchmarks documented
- ⏳ Test coverage report
- ⏳ Bug fixes for any issues found

---

## Additional Required Work

### Update PDF Processing Worker ⏳ PENDING

**File:** `packages/backend/src/core/queues/index.ts`

**Objective:** Modify existing `pdfProcessingQueueConsumer` to:
1. Initialize PlanCoordinator after creating sheets
2. Enqueue to metadata extraction queue (not tile generation)
3. Add feature flag support

**Changes:**
```typescript
// After creating PLAN_SHEETS records...

// NEW: Initialize PlanCoordinator
const coordinator = env.PLAN_COORDINATOR.getByName(planId)
await coordinator.fetch("http://localhost/initialize", {
  method: "POST",
  body: JSON.stringify({ uploadId, planId, totalSheets, organizationId, projectId })
})

// NEW: Check feature flag
const enablePlanOcr = env.ENABLE_PLAN_OCR === "true"

if (enablePlanOcr) {
  // NEW FLOW: Enqueue metadata extraction (per sheet)
  for (let i = 0; i < totalSheets; i++) {
    await env.METADATA_EXTRACTION_QUEUE.send({
      uploadId, planId, organizationId, projectId,
      sheetId: sheetIds[i],
      sheetNumber: i + 1,
      sheetKey: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/uploads/${uploadId}/sheet-${i+1}.pdf`,
      totalSheets
    })
  }
} else {
  // OLD FLOW: Direct to tile generation
  await env.TILE_GENERATION_QUEUE.send({ ... })
}
```

**Feature Flag Configuration:**

**wrangler.jsonc:**
```jsonc
{
  "vars": {
    "ENABLE_PLAN_OCR": "false"  // Default disabled
  }
}
```

---

## Environment Variables & Configuration

### Required Environment Variables

**wrangler.jsonc (vars):**
```jsonc
{
  "vars": {
    "ENABLE_PLAN_OCR": "false",  // Feature flag
    "PLAN_OCR_SERVICE_URL": "http://localhost:8000"  // For local testing
  }
}
```

**Secrets (set via wrangler):**
```bash
wrangler secret put OPENROUTER_API_KEY
```

**Python Service (.env):**
```bash
OPENROUTER_API_KEY=your_key_here
```

### Queue Bindings Summary

```jsonc
{
  "queues": {
    "producers": [
      { "binding": "PDF_PROCESSING_QUEUE", "queue": "pdf-processing-queue" },
      { "binding": "TILE_GENERATION_QUEUE", "queue": "tile-generation-queue" },
      { "binding": "METADATA_EXTRACTION_QUEUE", "queue": "metadata-extraction-queue" },
      { "binding": "PLAN_TILE_GENERATION_QUEUE", "queue": "plan-tile-generation-queue" },
      { "binding": "MARKER_DETECTION_QUEUE", "queue": "marker-detection-queue" }
    ],
    "consumers": [
      { "queue": "pdf-processing-queue", "max_batch_size": 1, "max_retries": 3 },
      { "queue": "tile-generation-queue", "max_batch_size": 10, "max_concurrency": 50, "max_retries": 3 },
      { "queue": "metadata-extraction-queue", "max_batch_size": 5, "max_concurrency": 20, "max_retries": 3 },
      { "queue": "plan-tile-generation-queue", "max_batch_size": 1, "max_retries": 3 },
      { "queue": "marker-detection-queue", "max_batch_size": 1, "max_retries": 3 }
    ]
  }
}
```

---

## Implementation Timeline

### Week 1: Core Infrastructure
- ✅ Phase 1: Explore codebase (4h)
- ✅ Phase 2: Create plan (6h)
- ✅ Phase 3: Setup Python service (4h)
- ✅ Phase 4: Database schemas (2h)

**Total Week 1:** 16 hours ✅ COMPLETE

### Week 2: Coordination & Workers
- ⏳ Phase 5: PlanCoordinator (4h)
- ⏳ Phase 6a: Metadata extraction worker (4h)
- ⏳ Phase 6b: Tile generation worker (4h)
- ⏳ Phase 6c: Marker detection worker (4h)

**Total Week 2:** 16 hours ⏳ PENDING

### Week 3: Services & Testing
- ⏳ Phase 7: PlanOcrService (3h)
- ⏳ Phase 8: Integration testing (8h)
- ⏳ Update PDF worker (2h)
- ⏳ Documentation & deployment (3h)

**Total Week 3:** 16 hours ⏳ PENDING

**Grand Total:** 48 hours (~6 working days)

---

## Risk Mitigation

### High-Risk Items
1. **Durable Object Coordination** - Complex state management
   - Mitigation: Thorough unit testing, idempotency checks

2. **Queue Worker Failures** - Partial processing issues
   - Mitigation: Comprehensive error handling, retry logic, dead-letter queues

3. **Python Container Cold Starts** - Slow initial response
   - Mitigation: Keep 3 instances warm, monitor startup times

### Medium-Risk Items
1. **Database Migration** - Schema changes in production
   - Mitigation: Test thoroughly locally, backup before migration

2. **Hallucination in Production** - LLM issues after deployment
   - Mitigation: Monitor hallucination rate, alert threshold at 5%

### Low-Risk Items
1. **Python Service** - Isolated and well-tested
2. **Database Schemas** - Additive, non-breaking changes

---

## Success Criteria

### Performance Targets
- ✅ Metadata extraction: <5s per sheet
- ⏳ Small plan (10 sheets): <2 minutes total
- ⏳ Large plan (100 sheets): <10 minutes total
- ⏳ Hallucination rate: <1% in production

### Accuracy Targets
- ✅ Marker recall: >90% (baseline: 91.5%)
- ⏳ Metadata extraction: >95% success rate
- ⏳ End-to-end success: >98%

### Reliability Targets
- ⏳ Sheet retry success: >95%
- ⏳ Queue processing latency: <500ms
- ⏳ System uptime: >99.9%

---

## Deployment Strategy

### Phase 1: Local Testing
1. Test Python service locally
2. Test database migrations
3. Test individual workers
4. Integration tests

### Phase 2: Preview Deployment
1. Deploy to Cloudflare preview environment
2. Test with sample plans
3. Monitor performance and errors
4. Fix any issues found

### Phase 3: Production Rollout (Feature Flag)
1. Deploy to production with `ENABLE_PLAN_OCR=false`
2. Enable for 10% of plans
3. Monitor metrics for 1 week
4. Increase to 50%
5. Monitor for another week
6. Enable for 100%

### Phase 4: Cleanup
1. Remove old tile generation queue (if unused)
2. Remove feature flag
3. Document final architecture
4. Create runbook for operations

---

## Monitoring & Observability

### Key Metrics to Track

**Performance:**
- Metadata extraction time (p50, p95, p99)
- Marker detection time (p50, p95, p99)
- Queue depth (all queues)
- Processing throughput (plans/hour)

**Quality:**
- Hallucination detection rate
- Stage 1 candidate count (should stay ~777)
- Stage 2 validation rate (should stay ~22%)
- OCR confidence scores

**Reliability:**
- Success rate per queue
- Retry rate per queue
- Error rate by type
- Timeout rate

**Cost:**
- API calls per plan
- Cost per plan
- Container CPU time
- R2 bandwidth

### Alerting Thresholds
- ⚠️ Hallucination rate >5%
- ⚠️ Error rate >5%
- ⚠️ Timeout rate >10%
- ⚠️ Queue depth >100 messages
- ⚠️ Processing time >2x expected

---

## Rollback Plan

### If Issues Occur in Production

**Immediate Rollback (5 minutes):**
1. Set `ENABLE_PLAN_OCR=false` in production
2. PDFs revert to old flow (direct to tile generation)
3. Monitor queue drain

**Gradual Rollback (if needed):**
1. Stop processing new plans
2. Drain existing queues
3. Rollback database migration (if safe)
4. Deploy previous code version

**Recovery:**
1. Identify root cause from logs
2. Fix issue in development
3. Test thoroughly in preview
4. Re-enable with feature flag (10% → 50% → 100%)

---

## Documentation

### Files Created
- ✅ `README.md` - Quick start guide
- ✅ `ARCHITECTURE.md` - System architecture with diagrams
- ✅ `ACHIEVEMENTS.md` - Project achievements and metrics
- ✅ `IMPLEMENTATION.md` - This file (implementation roadmap)

### Additional Documentation Needed
- ⏳ API documentation (OpenAPI/Swagger)
- ⏳ Runbook for operations
- ⏳ Troubleshooting guide
- ⏳ Performance tuning guide

---

## Next Steps

### Immediate Actions (Week 2)
1. **Begin Phase 5:** Implement PlanCoordinator Durable Object
2. **Test locally:** Ensure coordination logic works
3. **Implement Phase 6a:** Metadata extraction worker
4. **Test integration:** PlanCoordinator + Worker

### Recommended Approach
- Implement one phase at a time
- Test thoroughly after each phase
- Use feature flag for gradual rollout
- Monitor metrics closely
- Be prepared to rollback if needed

---

## Conclusion

This implementation plan provides a clear roadmap for integrating the plan-ocr service into sitelink. With **4 of 8 phases complete**, the foundation is solid and ready for backend worker implementation.

**Status:** 50% Complete
**Next Milestone:** Phase 5 (PlanCoordinator Durable Object)
**Estimated Remaining Time:** 30-35 hours
**Target Completion:** Week 3

The phased approach with feature flags ensures safe deployment and easy rollback if needed. Each phase builds on the previous, creating a robust, scalable system for construction plan processing.
