# Callout Processor Service Integration Plan

> **Last Updated**: December 18, 2025
> **Status**: In Progress

## Overview

Convert `packages/new-detection-processing` from a CLI tool to a REST API service that replaces `packages/plan-ocr-service`. The new service processes full sheet PDFs (not tiles) and provides both metadata extraction and marker detection.

**Key Change**: Switch from tile-based processing to sheet-based processing - simpler architecture, no chunking needed.

**Approach**: Test-Driven Development (TDD) - Write tests first, then implement to pass tests.

**Execution Strategy**: Use specialized agents for parallel implementation:
- Agent 1: Write unit tests for callout-processor API
- Agent 2: Implement API server and routes
- Agent 3: Update backend queue consumers and integration tests

---

## TDD Workflow Summary

```
1. SETUP       → Rename package, create test structure
2. RED         → Write failing unit tests for API endpoints
3. GREEN       → Implement API to pass tests
4. REFACTOR    → Clean up, add Dockerfile
5. INTEGRATE   → Write backend integration tests
6. IMPLEMENT   → Update queue consumers to pass integration tests
7. VERIFY      → Run full pipeline tests
8. CLEANUP     → Delete old plan-ocr-service
```

---

## Architecture Alignment (design.drawio)

```
PDF Processing Queue → Pdf Splitter
                            ↓
                       R2 (sheet PDFs)
                          /    \
    Tile Generator Queue       Callout Processing Queue
            ↓                           ↓
    Generate DZI Tiles          Callout Processor ← NEW SERVICE
            ↓                           ↓
       R2 (tiles)                  D1 (markers)
```

---

## Files to Modify/Create

### New Service: `packages/callout-processor/`

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Rename | Change name from `new-detection-processing` |
| `src/api/server.ts` | Create | Bun.serve() REST API entry point |
| `src/api/routes/health.ts` | Create | GET /health endpoint |
| `src/api/routes/metadata.ts` | Create | POST /api/extract-metadata endpoint |
| `src/api/routes/markers.ts` | Create | POST /api/detect-markers endpoint |
| `Dockerfile` | Create | Container build with Bun + Python + vips |

### Backend: `packages/backend/`

| File | Action | Description |
|------|--------|-------------|
| `src/core/queues/types.ts` | Modify | Update `MarkerDetectionJob` for per-sheet processing |
| `src/core/queues/index.ts` | Modify | Simplify `markerDetectionQueueConsumer` to send PDF |
| `src/core/plan-ocr-service/index.ts` | Rename | Rename to `callout-processor/index.ts` |
| `src/core/durable-objects/plan-coordinator.ts` | Modify | Update `triggerMarkerDetection` for per-sheet jobs |
| `wrangler.jsonc` | Modify | Update container config |

### Delete

| File | Action |
|------|--------|
| `packages/plan-ocr-service/` | Delete after migration complete |

---

## Implementation Steps (TDD Order)

### Phase 1: Setup & Test Infrastructure

#### 1.1 Rename Package
```bash
mv packages/new-detection-processing packages/callout-processor
```

Update `package.json`:
```json
{ "name": "callout-processor" }
```

#### 1.2 Create Test Structure
```bash
mkdir -p packages/callout-processor/tests/unit
mkdir -p packages/callout-processor/tests/integration
```

#### 1.3 Write Unit Tests First (RED phase)
Create failing tests for all API endpoints before implementation:
- `tests/unit/health.test.ts`
- `tests/unit/metadata.test.ts`
- `tests/unit/markers.test.ts`

### Phase 2: Implement API to Pass Tests (GREEN phase)

#### 2.1 Create API Server (`src/api/server.ts`)

```typescript
import { healthHandler } from './routes/health'
import { metadataHandler } from './routes/metadata'
import { markersHandler } from './routes/markers'

let isReady = false

// Initialize service (load models, etc.)
async function initialize() {
  console.log('[callout-processor] Initializing...')
  // Any startup tasks
  isReady = true
  console.log('[callout-processor] Ready')
}

Bun.serve({
  port: 8000,
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return healthHandler(isReady)
    }
    if (url.pathname === '/api/extract-metadata' && request.method === 'POST') {
      return metadataHandler(request)
    }
    if (url.pathname === '/api/detect-markers' && request.method === 'POST') {
      return markersHandler(request)
    }

    return new Response('Not Found', { status: 404 })
  }
})

initialize()
```

#### 2.2 Create Health Endpoint (`src/api/routes/health.ts`)

```typescript
export function healthHandler(isReady: boolean): Response {
  if (isReady) {
    return Response.json({ status: 'ready', service: 'callout-processor' })
  }
  return Response.json(
    { status: 'initializing', service: 'callout-processor' },
    { status: 503 }
  )
}
```

#### 2.3 Create Metadata Endpoint (`src/api/routes/metadata.ts`)

**Input**: PDF binary (Content-Type: application/pdf)
**Output**: `{ sheet_number: string, metadata: {...} }`

Integration with existing `titleBlockAnalysis.ts`:
- Receive PDF blob
- Save to temp file
- Convert PDF → PNG using `pdfProcessor.ts`
- Call `analyzeTitleBlock()`
- Return formatted response

#### 2.4 Create Markers Endpoint (`src/api/routes/markers.ts`)

**Input**: PDF binary + headers (X-Valid-Sheets, X-Sheet-Number)
**Output**: `{ markers: [...] }`

Integration with existing `cvLLMDetection.ts`:
- Receive PDF blob
- Save to temp file
- Convert PDF → PNG using `pdfProcessor.ts`
- Parse `X-Valid-Sheets` header
- Call `detectCalloutsWithCVLLM()`
- Map output to API response format

**Response Format Mapping**:
```typescript
// cvLLMDetection returns:
{ hyperlinks: [{ calloutRef, targetSheetRef, x, y, confidence }] }

// API must return:
{ markers: [{ text, detail, sheet, type, confidence, is_valid, bbox }] }
```

#### 2.5 Create Dockerfile

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-tools \
    poppler-utils \
    python3 python3-pip python3-venv \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create Python venv and install dependencies
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Bun dependencies
COPY package.json ./
RUN bun install --production

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

ENV NODE_ENV=production PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

USER bun
CMD ["bun", "run", "src/api/server.ts"]
```

---

### Phase 3: Update Backend Integration

#### 3.1 Update MarkerDetectionJob Type (`src/core/queues/types.ts`)

```typescript
export interface MarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]
  // NEW: Per-sheet processing (no more chunking)
  sheetId: string
  sheetNumber: number
  sheetKey: string  // R2 path to sheet PDF
  totalSheets: number
}
```

**Remove**: `isChunked`, `chunkIndex`, `totalChunks`, `tileKeys`, `chunkId`

#### 3.2 Simplify markerDetectionQueueConsumer (`src/core/queues/index.ts`)

**Current** (lines 777-1047): Fetches tiles, encodes base64, sends JSON
**New**: Send sheet PDF directly

```typescript
async function processMarkerDetectionJob(message: Message<MarkerDetectionJob>, env: Env) {
  const job = message.body
  console.log(`[MARKERS] Processing sheet ${job.sheetNumber}/${job.totalSheets}`)

  // 1. Get sheet PDF from R2
  const sheetPdf = await env.SitelinkStorage.get(job.sheetKey)
  if (!sheetPdf) {
    throw new Error(`Sheet not found: ${job.sheetKey}`)
  }

  // 2. Use sheet isolation for container
  const container = env.CALLOUT_PROCESSOR.getByName(job.sheetId)

  // 3. Health check with retries (existing logic)
  await waitForContainerReady(container)

  // 4. Send PDF directly to container
  const response = await container.fetch("http://localhost/api/detect-markers", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Sheet-Id": job.sheetId,
      "X-Sheet-Number": job.sheetNumber.toString(),
      "X-Valid-Sheets": job.validSheets.join(","),
      "X-Total-Sheets": job.totalSheets.toString()
    },
    body: sheetPdf.body
  })

  // 5. Parse response and insert markers (existing logic)
  const result = await response.json()
  // ... insert into plan_markers table
}
```

**Remove**: `generateBase64TilesPayload()`, chunking logic, deduplication

#### 3.3 Update PlanCoordinator (`src/core/durable-objects/plan-coordinator.ts`)

Modify `triggerMarkerDetection()` (lines 217-338):

**Current**: Lists tiles, chunks them, sends tile keys
**New**: Sends one job per sheet

```typescript
private async triggerMarkerDetection() {
  // Query sheets from database (existing code: lines 220-243)
  const sheets = sheetsResult.results
  const validSheets = sheets.map(s => s.sheetName).filter(Boolean)

  console.log(`[PlanCoordinator] Enqueueing ${sheets.length} marker detection jobs (one per sheet)`)

  // Send one job per sheet - no chunking needed!
  for (const sheet of sheets) {
    const sheetKey = `organizations/${sheet.organizationId}/projects/${sheet.projectId}/plans/${sheet.planId}/uploads/${this.state!.uploadId}/sheet-${sheet.sheetNumber}.pdf`

    await this.env.MARKER_DETECTION_QUEUE.send({
      uploadId: this.state!.uploadId,
      planId: sheet.planId as string,
      organizationId: sheet.organizationId as string,
      projectId: sheet.projectId as string,
      validSheets,
      sheetId: sheet.id as string,
      sheetNumber: sheet.sheetNumber as number,
      sheetKey,
      totalSheets: this.state!.totalSheets
    })

    console.log(`[PlanCoordinator] Enqueued marker job for sheet ${sheet.sheetNumber}`)
  }
}
```

**Remove**: Tile listing, `CHUNK_SIZE`, `chunkArray()`, chunking logic

#### 3.4 Rename Container Binding (`src/core/plan-ocr-service/index.ts`)

Rename to `src/core/callout-processor/index.ts`:

```typescript
import { Container } from "@cloudflare/containers"

export class CalloutProcessor extends Container {
  override defaultPort = 8000
  override sleepAfter = "10m"

  override envVars = {
    OPENROUTER_API_KEY: "..."
  }
}
```

#### 3.5 Update wrangler.jsonc

```jsonc
{
  "containers": [
    {
      "class_name": "SitelinkPdfProcessor",
      "image": "./Dockerfile",
      "max_instances": 5,
      "instance_type": "standard"
    },
    {
      "class_name": "CalloutProcessor",
      "image": "../callout-processor/Dockerfile",
      "max_instances": 5,
      "instance_type": "standard"
    }
  ],
  "durable_objects": {
    "bindings": [
      // ... existing bindings
      {
        "class_name": "CalloutProcessor",
        "name": "CALLOUT_PROCESSOR"
      }
    ]
  },
  // Remove PlanOcrService references
}
```

---

### Phase 4: Delete Old Service

After migration is verified working:
```bash
rm -rf packages/plan-ocr-service/
```

---

## Testing Strategy (TDD Approach)

### Test-First Implementation Order

We write tests BEFORE implementation, following existing backend patterns.

#### Step 1: Unit Tests for API Routes (No Docker Required)

**File**: `packages/callout-processor/tests/unit/api.test.ts`

```typescript
import { describe, test, expect, mock } from "bun:test"

describe("Health endpoint", () => {
  test("returns ready when service is initialized", async () => {
    // Test: GET /health returns { status: 'ready', service: 'callout-processor' }
  })

  test("returns 503 when service is initializing", async () => {
    // Test: GET /health returns 503 during startup
  })
})

describe("Metadata endpoint", () => {
  test("extracts sheet number from PDF", async () => {
    // Test: POST /api/extract-metadata with PDF returns { sheet_number: 'A5' }
  })

  test("returns 400 for invalid PDF", async () => {
    // Test: POST /api/extract-metadata with invalid data returns 400
  })
})

describe("Markers endpoint", () => {
  test("detects callout markers from PDF", async () => {
    // Test: POST /api/detect-markers returns { markers: [...] }
  })

  test("filters markers by valid_sheets header", async () => {
    // Test: Only returns markers referencing valid sheets
  })

  test("returns empty markers for blank sheet", async () => {
    // Test: Handles sheets with no callouts gracefully
  })
})
```

#### Step 2: Integration Tests for Queue Consumer (With Mocked Container)

**File**: `packages/backend/tests/unit/bun/queue-callout-processor.test.ts`

```typescript
import { describe, test, expect, mock, beforeEach } from "bun:test"

describe("markerDetectionQueueConsumer (mocked)", () => {
  test("sends PDF to container and inserts markers", async () => {
    // Mock: env.SitelinkStorage.get() returns PDF blob
    // Mock: env.CALLOUT_PROCESSOR.getByName().fetch() returns markers
    // Assert: plan_markers table has correct records
  })

  test("retries on container error", async () => {
    // Mock: Container returns 500
    // Assert: message.retry() called
  })

  test("handles empty marker response", async () => {
    // Mock: Container returns { markers: [] }
    // Assert: No database insert, message.ack() called
  })
})
```

#### Step 3: Integration Tests with Real Docker Container

**File**: `packages/backend/tests/integration/queue-callout-detection.test.ts`

```typescript
import { describe, test, expect, beforeAll } from "vitest"
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test"

describe("Callout Detection (Integration)", () => {
  beforeAll(async () => {
    // Check if Docker container is available
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.warn("callout-processor not running on port 8001, skipping")
      return
    }
  })

  test("full pipeline: PDF → markers in database", async () => {
    // 1. Upload test PDF to R2
    // 2. Create MarkerDetectionJob
    // 3. Invoke markerDetectionQueueConsumer
    // 4. Verify plan_markers records in database
  }, 120_000) // 2 minute timeout for LLM processing
})
```

#### Step 4: End-to-End Pipeline Test

**File**: `packages/backend/tests/integration/queue-full-pipeline.test.ts`

Test the complete flow: Upload → Split → Metadata → Tiles → Markers

---

### Local Testing Setup

#### Docker Container Configuration

**File**: `packages/backend/vitest.config.mts` (add binding)

```typescript
serviceBindings: {
  // Existing bindings...

  // NEW: Callout processor container proxy
  async CALLOUT_PROCESSOR(request: Request) {
    const CONTAINER_PORT = 8001
    const url = new URL(request.url)
    const localUrl = `http://localhost:${CONTAINER_PORT}${url.pathname}`
    return await fetch(localUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: "half"
    })
  }
}
```

#### Running Tests Locally

```bash
# 1. Build and start the callout-processor container
cd packages/callout-processor
docker build -t callout-processor .
docker run -d -p 8001:8000 --name callout-processor-test callout-processor

# 2. Verify container health
curl http://localhost:8001/health
# Expected: {"status":"ready","service":"callout-processor"}

# 3. Run unit tests (no Docker needed)
cd packages/callout-processor
bun test tests/unit/

# 4. Run integration tests (requires Docker)
cd packages/backend
bun run vitest tests/integration/queue-callout-detection.test.ts

# 5. Cleanup
docker stop callout-processor-test
docker rm callout-processor-test
```

---

### Test Fixtures

**File**: `packages/backend/tests/fixtures/`

- `sample-single-plan.pdf` - Single page construction plan
- `sample-multi-sheet.pdf` - Multi-page plan with cross-references
- `sample-no-callouts.pdf` - Blank sheet for edge case testing

Copy from: `packages/new-detection-processing/sample-single-plan.pdf`

---

### Container Health Check Helper

**File**: `packages/backend/tests/helpers/containers.ts`

```typescript
export async function isCalloutProcessorAvailable(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:8001/health", {
      signal: AbortSignal.timeout(2000)
    })
    const data = await response.json()
    return data.status === "ready"
  } catch {
    return false
  }
}
```

---

## Benefits of New Architecture

| Aspect | Old (Tile-Based) | New (Sheet-Based) |
|--------|------------------|-------------------|
| Complexity | High (chunking, dedup) | Low (one job per sheet) |
| Base64 encoding | Required (tiles → JSON) | Not needed (stream PDF) |
| Parallelism | Artificial (chunks) | Natural (sheets) |
| Accuracy | Unknown | 80% (tested) |
| Container isolation | Per-plan | Per-sheet |

---

## Risk Mitigation

- **Rollback**: Keep plan-ocr-service available until new service is verified
- **Feature flag**: Add env var to switch between services during migration
- **Monitoring**: Log processing times and accuracy metrics

---

## Progress Tracking

- [ ] Phase 1: Setup & Test Infrastructure
  - [ ] Rename package
  - [ ] Create test structure
  - [ ] Write failing unit tests
- [ ] Phase 2: Implement API (GREEN)
  - [ ] Create API server
  - [ ] Implement health endpoint
  - [ ] Implement metadata endpoint
  - [ ] Implement markers endpoint
  - [ ] Create Dockerfile
- [ ] Phase 3: Backend Integration
  - [ ] Update MarkerDetectionJob type
  - [ ] Simplify queue consumer
  - [ ] Update PlanCoordinator
  - [ ] Rename container binding
  - [ ] Update wrangler.jsonc
- [ ] Phase 4: Cleanup
  - [ ] Full pipeline verification
  - [ ] Delete old plan-ocr-service
