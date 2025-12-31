# Marker Detection Timeout Issue

**Document Created:** 2025-12-08
**Status:** ACTIVE INVESTIGATION
**Severity:** HIGH - Blocks PDF processing pipeline completion

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Evidence from Logs and Investigation](#evidence-from-logs-and-investigation)
3. [Cloudflare-Specific Constraints](#cloudflare-specific-constraints)
4. [OCR Processing Details](#ocr-processing-details)
5. [Current Architecture](#current-architecture)
6. [Configuration Details](#configuration-details)
7. [Investigation Results](#investigation-results)
8. [Context for Solution Proposals](#context-for-solution-proposals)
9. [Key Files Reference](#key-files-reference)
10. [Related Documentation](#related-documentation)

---

## Problem Statement

The marker detection process **successfully starts** but **times out before completion**, resulting in zero markers being inserted into the database. This is a **different issue** from the previously resolved tar generation race condition documented in `MARKER_DETECTION_CPU_TIMEOUT_PROBLEM.md`.

### What's Different from the Previous Issue

The previous issue (resolved on 2025-12-07) was a **stream race condition** where the tar stream was consumed before tiles were added. This was fixed by moving tar generation to the PlanCoordinator Durable Object.

The **current issue** occurs AFTER tar generation completes successfully:
- ✅ Tar generation works (118 tiles in 129ms)
- ✅ Tar stream is sent to container
- ❌ Container processing times out before completion
- ❌ Zero markers inserted into database

### Impact on System

- **Pipeline Status**: PDF processing appears "complete" but marker detection silently fails
- **User Impact**: No clickable sheet references available (core product feature)
- **Database State**: `plan_markers` table remains empty for affected plans
- **Processing Job**: Marked as "complete" despite incomplete marker detection
- **No Error Visibility**: Silent timeout with no error messages or stack traces

### Current Symptoms

```log
[PlanCoordinator] All tiles complete! Auto-triggering marker detection...
[PlanCoordinator] Found 118 tile images
🚀 [QUEUE CONSUMER] Processing 1 marker detection jobs
🎯 [MARKERS] Detecting markers for plan 9cab1e7b-7713-41e0-9d56-9433f60877ec
[PLAN COORDINATOR] Generating marker detection tar
[PLAN COORDINATOR] Found 118 tile images
[PLAN COORDINATOR] Tar generation complete: 118 tiles
✅ Received tar stream from PlanCoordinator
📦 Tar stream size: [size] bytes
🎯 Streaming tiles tar to plan-ocr-service for marker detection...
[Process stops here - no completion or error]
```

### Database Evidence

After timeout occurs:

```sql
-- Query: Check for markers in plan
SELECT COUNT(*) FROM plan_markers WHERE plan_id = '9cab1e7b-7713-41e0-9d56-9433f60877ec';
-- Result: 0 (expected: 10-50 markers)

-- Query: Check processing job status
SELECT status, progress FROM processing_jobs WHERE upload_id = '[upload-id]';
-- Result: status='complete', progress=100 (misleading - markers not detected)
```

---

## Evidence from Logs and Investigation

### Log Analysis

**Timeline of Events:**

1. **Metadata Extraction Phase** (Completes Successfully)
   ```log
   ✅ Successfully extracted metadata for sheet 1
   ✅ Successfully extracted metadata for sheet 2
   [PlanCoordinator] All metadata extraction complete!
   ```

2. **Tile Generation Phase** (Completes Successfully)
   ```log
   ✅ Successfully generated 59 tiles for sheet 1
   ✅ Successfully generated 59 tiles for sheet 2
   [PlanCoordinator] All tiles complete! Auto-triggering marker detection...
   ```

3. **Marker Detection Phase** (Times Out)
   ```log
   [PlanCoordinator] Found 118 tile images
   🚀 [QUEUE CONSUMER] Processing 1 marker detection jobs
   🎯 [MARKERS] Detecting markers for plan [id]
   [PLAN COORDINATOR] Tar generation complete: 118 tiles
   [PLAN COORDINATOR] Generated tar buffer: [bytes] bytes
   ✅ Received tar stream from PlanCoordinator
   📦 Tar stream size: [size] bytes
   🎯 Streaming tiles tar to plan-ocr-service for marker detection...

   [SILENCE - Process times out here]
   ```

### What We Know Works

- ✅ **Tar Generation**: PlanCoordinator successfully generates tar in 129ms
  - Location: `/src/core/durable-objects/plan-coordinator.ts` lines 351-475
  - Processes 118 tiles sequentially with periodic yielding
  - Returns complete tar buffer

- ✅ **Container Communication**: Tar stream successfully sent to container
  - Container binding: `env.PLAN_OCR_SERVICE.getByName(job.planId)`
  - Endpoint: `http://localhost/api/detect-markers`
  - Headers correctly set including `X-Valid-Sheets`, `X-Plan-Id`

- ✅ **Queue Consumer Initialization**: Marker detection job starts processing
  - Location: `/src/core/queues/index.ts` lines 625-647
  - Consumer configuration: `max_batch_size: 1`, `max_retries: 3`

### What We Know Fails

- ❌ **Container Processing**: Python container times out during marker detection
  - No logs from container after tar extraction begins
  - Expected logs missing:
    ```log
    [MARKERS] Stage 1 progress: 20/118 tiles processed
    [MARKERS] Stage 1 complete: [N] candidates found
    [MARKERS] Running Stage 2: LLM validation
    [MARKERS] Stage 2 complete: [N] validated markers
    ```

- ❌ **Database Insertion**: Zero markers inserted
  - No calls to `db.insert(planMarkers).values(markerRecords)` logged
  - Queue consumer line 797-798 never reached

- ❌ **Error Reporting**: No error messages or exceptions
  - Timeout is silent (no logs in Worker or container)
  - AbortController timeout may not be triggering correctly

### Missing Log Evidence

The following logs are **expected but never appear**:

1. **From Python Container** (`/packages/plan-ocr-service/src/api.py`):
   ```python
   # Line 236: Should see tar extraction
   print(f"[MARKERS] Received {len(tar_data)} bytes of tar data", file=sys.stderr)

   # Line 252: Should see tile count
   print(f"[MARKERS] Found {len(tile_paths)} tiles in tar", file=sys.stderr)

   # Line 291: Should see Stage 1 progress
   print(f"[MARKERS] Stage 1 progress: {i + 1}/{len(tile_paths)} tiles processed", file=sys.stderr)

   # Line 306: Should see Stage 2 batching estimate
   print(f"[MARKERS] Stage 2: Estimated {estimated_batches} API batches", file=sys.stderr)
   ```

2. **From Queue Consumer** (`/src/core/queues/index.ts`):
   ```javascript
   // Line 758: Should see response parsing
   console.log(`📥 Received response from marker detection service, parsing JSON...`)

   // Line 774: Should see marker count
   console.log(`✅ Detected ${result.markers.length} markers`)

   // Line 798: Should see database insertion
   console.log(`✅ Successfully inserted ${markerRecords.length} markers into database`)
   ```

---

## Cloudflare-Specific Constraints

### Workers CPU Time Limits

**Current Configuration** (`/packages/backend/wrangler.jsonc` line 128-129):
```jsonc
"limits": {
  "cpu_ms": 120000  // 2 minutes (120,000ms)
}
```

**Cloudflare Platform Limits:**
- **Default**: 30,000ms (30 seconds)
- **Configured**: 120,000ms (2 minutes) - temporary safety net
- **Maximum**: 300,000ms (5 minutes)
- **Measurement**: CPU time only (excludes I/O waits like network requests, R2 fetches)

**Important Note:** The previous document `MARKER_DETECTION_CPU_TIMEOUT_PROBLEM.md` contained **outdated information** about CPU limits (stated 10-50ms). Actual limits are much higher (30s default, configurable up to 5 minutes).

Reference: [Cloudflare Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/)

### Queue Consumer Timeouts

**Marker Detection Queue Configuration** (`wrangler.jsonc` lines 111-115):
```jsonc
{
  "queue": "marker-detection-queue",
  "max_batch_size": 1,      // Process one plan at a time
  "max_retries": 3          // Retry up to 3 times on failure
}
```

**Queue Consumer Timeout** (`/src/core/queues/index.ts` lines 719-725):
```typescript
// Add timeout for marker detection (5 minutes)
const MARKER_DETECTION_TIMEOUT_MS = 5 * 60 * 1000
const controller = new AbortController()
const timeoutId = setTimeout(() => {
  console.error(`⏱️ Marker detection timeout after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s`)
  controller.abort()
}, MARKER_DETECTION_TIMEOUT_MS)
```

**Configured Timeout**: 5 minutes (300,000ms)

**Expected Behavior When Timeout Triggers:**
```javascript
// Lines 742-749
catch (error) {
  clearTimeout(timeoutId)
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.error(`❌ Marker detection aborted due to timeout.`)
    throw new Error(`Marker detection container timed out after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s.`)
  }
  console.error(`❌ Error fetching from marker detection container:`, error)
  throw error
}
```

**Observed**: These error logs are NOT appearing, suggesting the timeout may not be triggering as expected, or a different timeout is occurring first.

### Durable Object Execution Model

**PlanCoordinator** (`/src/core/durable-objects/plan-coordinator.ts`):
- **Execution Model**: Single-threaded (one request at a time per instance)
- **CPU Time Limit**: Higher than Workers (configurable, default 30s)
- **Concurrency**: No parallelism within a single Durable Object instance
- **State Persistence**: In-memory state backed by durable storage

**Tar Generation Performance** (lines 415-475):
```typescript
// Processes 118 tiles in 129ms (0.73ms per tile average)
// Uses periodic yielding every 50 tiles to prevent blocking
if (i % 50 === 0 && i > 0) {
  await new Promise(resolve => setTimeout(resolve, 0))
}
```

This proves **tar generation is NOT the bottleneck** (previously suspected but now resolved).

### Container Execution Limits

**PlanOcrService Container** (`/src/core/plan-ocr-service/index.ts` lines 14-16):
```typescript
export class PlanOcrService extends Container {
  override defaultPort = 8000
  override sleepAfter = "10m"  // Container stops after 10 minutes of inactivity
  // ...
}
```

**Container Configuration** (`wrangler.jsonc` lines 21-26):
```jsonc
{
  "class_name": "PlanOcrService",
  "image": "../plan-ocr-service/Dockerfile",
  "max_instances": 5,
  "instance_type": "standard"
}
```

**Container Platform Limits:**
- **Instance Type**: `standard` (shared CPU, 512MB RAM default)
- **Max Instances**: 5 (concurrent container instances)
- **Lifecycle**: `sleepAfter: 10m` (container sleeps after 10 minutes of no requests)
- **Startup**: `defaultPort: 8000` (Cloudflare waits for container to listen on port before routing)
- **Execution Time**: No hard limit documented, but container should respond within reasonable time

**Important**: Cloudflare Containers are **different from Workers**:
- Workers: Event-driven, strict CPU time limits
- Containers: Long-running processes, more flexible execution model
- Communication: Workers → Container via service binding (HTTP)

---

## OCR Processing Details

### Processing Pipeline Overview

The Python container (`plan-ocr-service`) performs a **two-stage pipeline**:

**Stage 1: Geometric Detection** (Fast - ~0.1s per tile)
- OpenCV-based circle and triangle detection
- No external API calls
- Location: `/packages/plan-ocr-service/src/stage1_geometric_detector.py`

**Stage 2: LLM Validation** (Slow - ~3s per batch of 10)
- Tesseract OCR for text extraction from candidate regions
- Google Gemini Flash API call via OpenRouter for validation
- Batch processing: 10 candidates per API call
- Location: `/packages/plan-ocr-service/src/stage2_llm_validator.py`

### Detailed Processing Flow

**Container Receives Tar** (`/packages/plan-ocr-service/src/api.py` lines 226-252):
```python
# 1. Receive tar stream from Worker
tar_data = await request.body()
print(f"[MARKERS] Received {len(tar_data)} bytes of tar data", file=sys.stderr)

# 2. Extract tar to temp directory
temp_dir = tempfile.mkdtemp()
tar_stream = io.BytesIO(tar_data)
with tarfile.open(fileobj=tar_stream, mode='r:') as tar:
    tar.extractall(path=temp_dir)

# 3. Find all .jpg tiles
tile_paths = []
for root, dirs, files in os.walk(temp_dir):
    for file in files:
        if file.endswith('.jpg'):
            tile_paths.append(os.path.join(root, file))

print(f"[MARKERS] Found {len(tile_paths)} tiles in tar", file=sys.stderr)
```

**Stage 1: Geometric Detection** (lines 278-293):
```python
stage1_detector = Stage1GeometricDetector()
stage1_results = []

for i, tile_path in enumerate(tile_paths):
    candidates = stage1_detector.detect_candidates(tile_path)
    for candidate in candidates:
        candidate['source_tile'] = os.path.basename(tile_path)
        stage1_results.append(candidate)

    # Progress logging every 20 tiles
    if (i + 1) % 20 == 0 or (i + 1) == len(tile_paths):
        print(f"[MARKERS] Stage 1 progress: {i + 1}/{len(tile_paths)} tiles", file=sys.stderr)

print(f"[MARKERS] Stage 1 complete: {len(stage1_results)} candidates", file=sys.stderr)
```

**Stage 2: LLM Validation** (lines 303-326):
```python
# Batch size: 10 candidates per API call
stage2_validator = Stage2LLMValidator(
    valid_sheets=valid_sheets,
    batch_size=10,  # CRITICAL: Prevents token limit issues
    temperature=0.0  # CRITICAL: Deterministic results
)

# Estimated batches and time
estimated_batches = (len(stage1_results) + 9) // 10
print(f"[MARKERS] Stage 2: Estimated {estimated_batches} API batches (~{estimated_batches * 3:.0f}s)", file=sys.stderr)

# Validate with LLM (batched)
validated_markers = stage2_validator.validate_candidates_from_dicts(
    stage1_results,
    tile_paths,
    strict_filtering=strict_filtering,
    verbose=True
)

print(f"[MARKERS] Stage 2 complete: {len(validated_markers)} validated markers", file=sys.stderr)
```

### Time Complexity Analysis

**For 118 Tiles:**

**Stage 1 (Geometric Detection):**
- **Per Tile**: ~0.1 seconds (OpenCV processing)
- **Total**: 118 tiles × 0.1s = **~12 seconds**
- **No API calls**: All local processing

**Stage 2 (LLM Validation):**
- **Assumptions**:
  - Average 5 candidates per tile → ~590 candidates
  - Batch size: 10 candidates per API call → ~59 batches
  - Time per batch: ~3 seconds (API call + network latency)
- **Total**: 59 batches × 3s = **~177 seconds (~3 minutes)**

**Combined Total Estimate**: 12s + 177s = **~189 seconds (~3.15 minutes)**

**Problem**: This exceeds the 5-minute queue consumer timeout IF:
- More candidates found than average
- API calls are slower than 3s
- Network latency increases
- Stage 1 takes longer than expected

### External Dependencies

**OpenRouter API** (Google Gemini Flash):
- **API Key**: Stored in environment variable `OPENROUTER_API_KEY`
  - Location: `wrangler.jsonc` line 120
  - Also passed to container: `/src/core/plan-ocr-service/index.ts` line 19
- **Model**: `google/gemini-flash-1.5` (fast, low-cost)
- **Rate Limits**: Unknown (not documented in codebase)
- **Network**: External API call (not Cloudflare-hosted)
- **Timeout**: No explicit timeout configured in Python code
- **Retry Logic**: Not implemented in Stage2LLMValidator

**Potential API Issues:**
- Slow response times (>5s per batch)
- Rate limiting (429 errors)
- API downtime or errors
- Network timeouts

**Important**: If API calls fail or timeout, no error is propagated to Worker logs.

---

## Current Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker                          │
│                                                                 │
│  ┌──────────────────┐     ┌─────────────────────────────────┐ │
│  │  Queue Consumer  │────▶│     PlanCoordinator (DO)        │ │
│  │  (Marker Det.)   │     │  - Generates tar from 118 tiles │ │
│  │                  │     │  - Returns tar stream           │ │
│  │  Lines 625-804   │     │  - Takes 129ms (WORKS ✅)       │ │
│  └──────────────────┘     └─────────────────────────────────┘ │
│         │                             │                        │
│         │ Receives tar stream         │                        │
│         ▼                             │                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           Service Binding (Container Fetch)             │  │
│  │  - URL: http://localhost/api/detect-markers             │  │
│  │  - Method: POST                                          │  │
│  │  - Content-Type: application/x-tar                       │  │
│  │  - Body: tar stream (118 tile images)                   │  │
│  │  - Headers: X-Valid-Sheets, X-Plan-Id, X-Upload-Id      │  │
│  │  - Timeout: 5 minutes (AbortController)                 │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP Request
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              plan-ocr-service Container (Python)                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  FastAPI Endpoint: /api/detect-markers                   │ │
│  │  - Extracts tar to temp directory                        │ │
│  │  - Finds all .jpg files (118 tiles)                      │ │
│  │  - Stage 1: Geometric Detection (OpenCV)                 │ │
│  │    └─ Processes each tile (~0.1s per tile = 12s total)   │ │
│  │  - Stage 2: LLM Validation (Tesseract + Gemini)         │ │
│  │    └─ Batches of 10 candidates (~3s per batch)          │ │
│  │         └─ ~59 batches × 3s = ~177s                      │ │
│  │                                                           │ │
│  │  [TIMES OUT HERE ❌]                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                               │                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         External API (OpenRouter)                        │ │
│  │  - Model: google/gemini-flash-1.5                        │ │
│  │  - Endpoint: https://openrouter.ai/api/v1/chat/...      │ │
│  │  - No explicit timeout configured                        │ │
│  │  - No retry logic                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Should return JSON
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Queue Consumer (continued)                              │ │
│  │  - Parse JSON response                                   │ │
│  │  - Insert markers into D1 database                       │ │
│  │  - Acknowledge queue message                             │ │
│  │                                                           │ │
│  │  [NEVER REACHED ❌]                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Step-by-Step Execution:**

1. **Trigger**: PlanCoordinator detects all tiles complete (line 182-183)
   ```typescript
   if (this.state.completedTiles.length === this.state.totalSheets &&
       this.state.status === "tiles_in_progress")
   ```

2. **Database Query**: Get sheet metadata and build valid sheets list (lines 191-231)
   ```typescript
   const sheetsResult = await this.env.SitelinkDB.prepare(`
     SELECT ps.sheet_name as sheetName, ...
     FROM plan_sheets ps
     WHERE ps.upload_id = ? AND ps.metadata_status = 'extracted'
   `).bind(this.state.uploadId).all()

   const validSheets = sheets
     .filter(s => s.sheetName !== null)
     .map(s => s.sheetName as string)
   ```

3. **Enqueue Job**: Send marker detection job to queue (lines 234-240)
   ```typescript
   await this.env.MARKER_DETECTION_QUEUE.send({
     uploadId: this.state.uploadId,
     planId,
     organizationId,
     projectId,
     validSheets,  // e.g., ["A1", "A2"]
   })
   ```

4. **Queue Consumer**: Receives job and calls PlanCoordinator for tar (lines 672-694)
   ```typescript
   const tarResponse = await coordinator.fetch("http://localhost/generate-marker-tar", {
     method: "POST",
     headers: {
       "X-Organization-Id": job.organizationId,
       "X-Project-Id": job.projectId,
       "X-Plan-Id": job.planId,
       "X-Valid-Sheets": job.validSheets.join(","),
     }
   })
   ```

5. **Tar Generation**: PlanCoordinator generates tar (lines 351-409)
   - Lists tiles from R2
   - Generates tar buffer sequentially
   - Returns as stream with Content-Length header
   - **Performance**: 118 tiles in 129ms ✅

6. **Container Request**: Queue consumer streams tar to container (lines 712-740)
   ```typescript
   const response = await container.fetch("http://localhost/api/detect-markers", {
     method: "POST",
     headers: {
       "Content-Type": "application/x-tar",
       "X-Valid-Sheets": job.validSheets.join(","),
       "X-Plan-Id": job.planId,
       "X-Upload-Id": job.uploadId,
       "X-Strict-Filtering": "true",
     },
     body: tarStream,
     signal: controller.signal,  // 5-minute timeout
   })
   ```

7. **Container Processing**: Python container processes tar ❌ TIMES OUT
   - Extract tar to temp directory
   - Stage 1: Geometric detection
   - Stage 2: LLM validation (API calls)
   - **Expected**: Return JSON with markers
   - **Actual**: Times out before completion

8. **Database Insertion**: NEVER REACHED (lines 776-801)
   ```typescript
   const result = await response.json() as { markers: [...] }

   if (result.markers.length > 0) {
     await db.insert(planMarkers).values(markerRecords)
     console.log(`✅ Successfully inserted ${markerRecords.length} markers`)
   }
   ```

### Why Tar Generation Works But Container Doesn't

**Tar Generation (PlanCoordinator Durable Object):**
- **Environment**: Durable Object (higher CPU limits, single-threaded)
- **Work Type**: I/O-bound (R2 fetches) + light CPU (tar packing)
- **Execution**: Sequential with periodic yielding
- **Time**: 129ms for 118 tiles (0.73ms per tile)
- **No External Dependencies**: All Cloudflare-internal operations

**Container Processing (Python FastAPI):**
- **Environment**: Container (separate process, different limits)
- **Work Type**: CPU-bound (OpenCV) + I/O-bound (API calls)
- **Execution**: Sequential with progress logging
- **Time**: Estimated 189 seconds (3.15 minutes)
- **External Dependencies**: OpenRouter API (unpredictable latency)

**Key Difference**: Container relies on **external API calls** which can fail, timeout, or be rate-limited. Worker has no visibility into these failures.

---

## Configuration Details

### wrangler.jsonc Configuration

**Full Queue Configuration** (lines 74-116):
```jsonc
"queues": {
  "producers": [
    { "binding": "TILE_GENERATION_QUEUE", "queue": "tile-generation-queue" },
    { "binding": "PDF_PROCESSING_QUEUE", "queue": "pdf-processing-queue" },
    { "binding": "METADATA_EXTRACTION_QUEUE", "queue": "metadata-extraction-queue" },
    { "binding": "MARKER_DETECTION_QUEUE", "queue": "marker-detection-queue" }
  ],
  "consumers": [
    {
      "queue": "tile-generation-queue",
      "max_batch_size": 10,
      "max_concurrency": 50,
      "max_retries": 3
    },
    {
      "queue": "pdf-processing-queue",
      "max_batch_size": 1,
      "max_retries": 3
    },
    {
      "queue": "metadata-extraction-queue",
      "max_batch_size": 5,
      "max_concurrency": 20,
      "max_retries": 3
    },
    {
      "queue": "marker-detection-queue",
      "max_batch_size": 1,      // Process one plan at a time
      "max_retries": 3           // Retry 3 times on failure
      // Note: No max_concurrency = default (1 concurrent execution)
    }
  ]
}
```

**Environment Variables** (lines 118-121):
```jsonc
"vars": {
  "PLAN_OCR_SERVICE_URL": "http://localhost:8000",
  "OPENROUTER_API_KEY": "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"
}
```

**CPU Limits** (lines 123-130):
```jsonc
/**
 * CPU Time Limits
 * Phase 1 safety net: 120,000ms (2 minutes) while implementing marker detection fix
 * Default: 30,000ms, Maximum: 300,000ms
 * Docs: https://developers.cloudflare.com/workers/platform/limits/
 */
"limits": {
  "cpu_ms": 120000  // 2 minutes
}
```

### Container Configuration

**Container Bindings** (lines 14-27):
```jsonc
"containers": [
  {
    "class_name": "SitelinkPdfProcessor",  // Tile generation container
    "image": "./Dockerfile",
    "max_instances": 5,
    "instance_type": "standard"
  },
  {
    "class_name": "PlanOcrService",  // Marker detection container
    "image": "../plan-ocr-service/Dockerfile",
    "max_instances": 5,
    "instance_type": "standard"
  }
]
```

**Durable Object Bindings** (lines 28-42):
```jsonc
"durable_objects": {
  "bindings": [
    { "class_name": "SitelinkPdfProcessor", "name": "SITELINK_PDF_PROCESSOR" },
    { "class_name": "PlanCoordinator", "name": "PLAN_COORDINATOR" },
    { "class_name": "PlanOcrService", "name": "PLAN_OCR_SERVICE" }
  ]
}
```

### Queue Consumer Code Configuration

**Timeout Configuration** (`/src/core/queues/index.ts` lines 719-725):
```typescript
// Add timeout for marker detection (5 minutes - marker detection can take a while with LLM validation)
const MARKER_DETECTION_TIMEOUT_MS = 5 * 60 * 1000
const controller = new AbortController()
const timeoutId = setTimeout(() => {
  console.error(`⏱️ Marker detection timeout after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s`)
  controller.abort()
}, MARKER_DETECTION_TIMEOUT_MS)
```

**Error Handling** (lines 742-750):
```typescript
catch (error) {
  clearTimeout(timeoutId)
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.error(`❌ Marker detection aborted due to timeout.`)
    throw new Error(`Marker detection container timed out after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s.`)
  }
  console.error(`❌ Error fetching from marker detection container:`, error)
  throw error
}
```

### Python Container Configuration

**LLM Validator Settings** (`/packages/plan-ocr-service/src/api.py` lines 309-313):
```python
stage2_validator = Stage2LLMValidator(
    valid_sheets=valid_sheets,
    batch_size=10,      # CRITICAL: Use 10, not 15 (prevents token limit issues)
    temperature=0.0     # CRITICAL: Use 0.0 for determinism
)
```

**Progress Logging** (lines 289-291):
```python
# Progress logging every 20 tiles
if (i + 1) % 20 == 0 or (i + 1) == len(tile_paths):
    print(f"[MARKERS] Stage 1 progress: {i + 1}/{len(tile_paths)} tiles processed", file=sys.stderr)
```

---

## Investigation Results

### What Works ✅

1. **PDF Processing Pipeline**
   - PDF upload and splitting: ✅ Working
   - Metadata extraction: ✅ Working (Tesseract OCR + LLM fallback)
   - Tile generation: ✅ Working (vips container, DZI format)
   - R2 storage operations: ✅ Working

2. **Tar Generation** (Previously Fixed)
   - PlanCoordinator generates tar: ✅ Working (129ms for 118 tiles)
   - No race condition: ✅ Fixed (single-threaded DO execution)
   - Tar stream returned: ✅ Working (Content-Length header set)

3. **Queue Infrastructure**
   - Tile generation queue: ✅ Working (batch processing, parallel execution)
   - Metadata extraction queue: ✅ Working
   - Marker detection queue initialization: ✅ Working (job received, tar generated)

4. **Container Communication**
   - Service binding: ✅ Working (container.fetch())
   - Tar stream sent to container: ✅ Working (request initiated)
   - Headers transmitted: ✅ Working (X-Valid-Sheets, X-Plan-Id, etc.)

### What Fails ❌

1. **Container Processing**
   - **Symptom**: Python container times out during marker detection
   - **Evidence**: No Stage 1 or Stage 2 progress logs from container
   - **Expected Duration**: ~3 minutes (Stage 1: 12s + Stage 2: 177s)
   - **Configured Timeout**: 5 minutes (should be sufficient)
   - **Actual Behavior**: Silent timeout (no error logs)

2. **Database Insertion**
   - **Symptom**: Zero markers inserted into `plan_markers` table
   - **Evidence**: `SELECT COUNT(*) FROM plan_markers WHERE plan_id = '...'` returns 0
   - **Expected**: 10-50 markers for a typical plan
   - **Actual**: 0 markers

3. **Error Reporting**
   - **Symptom**: No error messages or stack traces
   - **Expected**: AbortController timeout error logged at line 723
   - **Actual**: No timeout error logged
   - **Implication**: Either timeout not triggering OR different error occurring

### Diagnostic Queries Run

**Query 1: Check marker count**
```sql
SELECT COUNT(*) as marker_count, plan_id
FROM plan_markers
WHERE plan_id = '9cab1e7b-7713-41e0-9d56-9433f60877ec'
GROUP BY plan_id;
-- Result: 0 rows (plan_id not found in table = zero markers)
```

**Query 2: Check processing job status**
```sql
SELECT
  upload_id,
  status,
  progress,
  completed_pages,
  total_pages,
  last_error,
  completed_at
FROM processing_jobs
WHERE upload_id = '[upload-id]';
-- Result: status='complete', progress=100, last_error=NULL
-- Misleading: Shows "complete" but markers not detected
```

**Query 3: Check plan_sheets metadata**
```sql
SELECT
  id,
  sheet_number,
  sheet_name,
  metadata_status,
  tile_count,
  status
FROM plan_sheets
WHERE upload_id = '[upload-id]'
ORDER BY sheet_number ASC;
-- Result: All sheets show status='complete', metadata_status='extracted'
-- Tile counts: 59 tiles per sheet (total: 118 tiles)
```

### Hypothesis: Why Container Times Out

**Possible Causes:**

1. **LLM API Latency**
   - OpenRouter API calls taking longer than 3s per batch
   - Network issues or rate limiting
   - No timeout configured in Python code
   - No retry logic if API fails

2. **Too Many Candidates**
   - If Stage 1 finds >590 candidates (more than expected)
   - More batches needed → longer processing time
   - Could exceed 5-minute timeout

3. **Container Resource Limits**
   - `instance_type: "standard"` may have limited CPU/RAM
   - OpenCV processing slower than expected
   - Tesseract OCR slower on container hardware

4. **Silent Failure in Python**
   - Exception raised but not propagated to Worker
   - Python process crashes/hangs
   - FastAPI error handling not catching issue

5. **AbortController Not Working**
   - Timeout not aborting the container fetch
   - Container continues processing but response never reaches Worker
   - Different timeout occurring (platform-level?)

### Next Investigation Steps

To determine root cause:

1. **Add Container Logging**
   - Deploy container with debug logging enabled
   - Monitor actual processing time for Stage 1 and Stage 2
   - Track API call latency and success rate

2. **Test with Smaller Dataset**
   - Process plan with fewer tiles (e.g., 20 tiles)
   - Verify if processing completes successfully
   - Determine if issue is volume-related

3. **Add Explicit Timeouts in Python**
   - Set timeout for OpenRouter API calls
   - Add timeout for tar extraction
   - Implement retry logic for API failures

4. **Monitor Container Lifecycle**
   - Check if container is starting/stopping correctly
   - Verify `defaultPort: 8000` is responding
   - Test container health endpoint before processing

5. **Chunk Processing (If Volume-Related)**
   - Split tiles into chunks of 30
   - Process chunks sequentially
   - Combine results at end

---

## Context for Solution Proposals

### Constraints That Must Be Maintained

1. **R2 Isolation**
   - Container does NOT have direct R2 access
   - All data must be streamed through Worker
   - Cannot change to "send R2 URLs to container" model

2. **Cloudflare Containers Platform**
   - Cannot significantly modify container architecture
   - Must use service bindings for communication
   - Container lifecycle managed by Cloudflare

3. **Data Integrity**
   - Must process ALL tiles (cannot skip tiles to save time)
   - Must validate ALL candidates with LLM (accuracy requirement)
   - Markers must be accurately stored in database

4. **User Experience**
   - Processing must complete within reasonable time (<10 minutes ideal)
   - Silent failures are unacceptable (must report errors)
   - Retry logic must be idempotent

### Optimization Opportunities

1. **Chunking/Batching**
   - Split 118 tiles into chunks of 20-30 tiles
   - Process chunks sequentially or in parallel
   - Aggregate results at end
   - **Benefit**: Stays within timeout limits per chunk

2. **Streaming Results**
   - Container streams validated markers as they're found
   - Worker inserts markers incrementally
   - **Benefit**: Partial results saved even if timeout occurs

3. **Async Processing**
   - Container returns immediately with job ID
   - Processes in background, posts results via webhook
   - Worker polls for completion
   - **Benefit**: No timeout issues

4. **Pre-filtering Tiles**
   - Only send tiles likely to contain markers (e.g., specific zoom levels)
   - Reduce total tile count
   - **Risk**: May miss markers on excluded tiles

5. **LLM Optimization**
   - Increase batch size from 10 to 20 (fewer API calls)
   - Use faster model (if accuracy maintained)
   - Cache LLM responses for identical candidates
   - **Benefit**: Reduces Stage 2 time

6. **Container Scaling**
   - Use `instance_type: "performance"` instead of `standard`
   - More CPU/RAM for OpenCV and Tesseract
   - **Benefit**: Faster Stage 1 processing

7. **Explicit Timeouts**
   - Add timeout to OpenRouter API calls (e.g., 10s per batch)
   - Fail fast if API unresponsive
   - Retry failed batches
   - **Benefit**: Predictable behavior, better error handling

8. **Progress Tracking**
   - Container posts progress updates to Worker endpoint
   - Worker tracks progress in database
   - Can resume from last checkpoint on retry
   - **Benefit**: Idempotent retries, better visibility

### Recommended Approach

Based on investigation, the most practical solution is **chunked processing with explicit timeouts**:

1. **Split tiles into chunks** (30 tiles per chunk)
2. **Process chunks sequentially** (one queue message per chunk)
3. **Add explicit timeouts** to OpenRouter API calls (10s per batch)
4. **Implement retry logic** for failed API calls
5. **Stream results** back to Worker incrementally
6. **Track progress** in database for idempotent retries

**Why This Approach:**
- Stays within timeout limits (30 tiles × 0.1s + ~15 batches × 3s = ~47s per chunk)
- Maintains R2 isolation (no architectural changes)
- Provides better error visibility (timeouts logged per chunk)
- Allows partial completion (some chunks may succeed even if others fail)
- Idempotent (can retry failed chunks)

---

## Key Files Reference

### Queue Consumer Implementation
**File**: `/home/woodson/Code/projects/sitelink/packages/backend/src/core/queues/index.ts`

**Key Functions:**
- `markerDetectionQueueConsumer()` - Lines 625-647
  - Entry point for marker detection jobs
  - Processes queue messages

- `processMarkerDetectionJob()` - Lines 649-804
  - Line 656-664: List tiles from R2
  - Line 672-694: Request tar from PlanCoordinator
  - Line 712-740: Stream tar to container with timeout
  - Line 752-801: Parse response and insert markers into database

**Critical Lines:**
- Line 720: `const MARKER_DETECTION_TIMEOUT_MS = 5 * 60 * 1000`
- Line 729-740: Container fetch with AbortController
- Line 742-749: Timeout error handling (NOT TRIGGERING)
- Line 797: Database insertion (NEVER REACHED)

### PlanCoordinator Durable Object
**File**: `/home/woodson/Code/projects/sitelink/packages/backend/src/core/durable-objects/plan-coordinator.ts`

**Key Methods:**
- `tileComplete()` - Lines 156-277
  - Line 180-181: Detect all tiles complete
  - Line 234-240: Enqueue marker detection job

- `generateMarkerTar()` - Lines 351-409
  - Line 367-376: List tiles from R2
  - Line 391: Call `generateTarBuffer()` to create tar
  - Line 396-408: Return tar as stream with Content-Length

- `generateTarBuffer()` - Lines 415-475
  - Line 426-462: Process tiles sequentially
  - Line 459-460: Yield every 50 tiles to prevent blocking
  - **Performance**: 118 tiles in 129ms ✅

### Python Container API
**File**: `/home/woodson/Code/projects/sitelink/packages/plan-ocr-service/src/api.py`

**Key Endpoints:**
- `/api/detect-markers` - Lines 199-379
  - Line 226-252: Extract tar and find tiles
  - Line 278-293: Stage 1 geometric detection
  - Line 303-326: Stage 2 LLM validation
  - Line 349: Return markers as JSON

**Progress Logging:**
- Line 236: `[MARKERS] Received {len(tar_data)} bytes of tar data` (EXPECTED but NOT SEEN)
- Line 252: `[MARKERS] Found {len(tile_paths)} tiles in tar` (EXPECTED but NOT SEEN)
- Line 291: Stage 1 progress every 20 tiles (EXPECTED but NOT SEEN)
- Line 306: Stage 2 batch estimate (EXPECTED but NOT SEEN)

### Queue Message Types
**File**: `/home/woodson/Code/projects/sitelink/packages/backend/src/core/queues/types.ts`

**MarkerDetectionJob Type** - Lines 34-40:
```typescript
export interface MarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]  // e.g., ["A1", "A2"]
}
```

### Database Schema
**File**: `/home/woodson/Code/projects/sitelink/packages/backend/src/core/database/schemas/plan-markers.ts`

**plan_markers Table** - Lines 6-44:
```typescript
export const planMarkers = D.sqliteTable("plan_markers", {
  id: D.text().primaryKey(),
  uploadId: D.text("upload_id").notNull(),
  planId: D.text("plan_id").notNull(),
  sheetNumber: D.integer("sheet_number").notNull(),

  // Marker content
  markerText: D.text("marker_text").notNull(),  // e.g., "3/A7"
  detail: D.text("detail").notNull(),            // e.g., "3"
  sheet: D.text("sheet").notNull(),              // e.g., "A7"
  markerType: D.text("marker_type").notNull(),   // "circular" | "triangular"

  // Validation metadata
  confidence: D.real("confidence").notNull(),
  isValid: D.integer("is_valid", { mode: "boolean" }).notNull(),
  fuzzyMatched: D.integer("fuzzy_matched", { mode: "boolean" }).default(false),

  // Location metadata
  sourceTile: D.text("source_tile"),
  bbox: D.text("bbox", { mode: "json" }),  // { x, y, w, h }

  createdAt: D.integer("created_at", { mode: "timestamp_ms" }).notNull(),
})
```

### Cloudflare Configuration
**File**: `/home/woodson/Code/projects/sitelink/packages/backend/wrangler.jsonc`

**Key Sections:**
- Lines 14-27: Container definitions (PlanOcrService)
- Lines 28-42: Durable Object bindings
- Lines 111-115: Marker detection queue consumer config
- Lines 118-121: Environment variables (OPENROUTER_API_KEY)
- Lines 128-129: CPU limits (120,000ms)

### Container Definition
**File**: `/home/woodson/Code/projects/sitelink/packages/backend/src/core/plan-ocr-service/index.ts`

**PlanOcrService Class** - Lines 14-29:
```typescript
export class PlanOcrService extends Container {
  override defaultPort = 8000
  override sleepAfter = "10m"

  override envVars = {
    OPENROUTER_API_KEY: "sk-or-v1-...",
  }

  override onStart() {
    console.log("PlanOcrService container successfully started")
  }

  override onError(error: string) {
    console.log("PlanOcrService container error:", error)
  }
}
```

---

## Related Documentation

### Previous Issues (Resolved)
- **`MARKER_DETECTION_CPU_TIMEOUT_PROBLEM.md`** - Tar generation race condition
  - **Status**: ✅ RESOLVED (2025-12-07)
  - **Solution**: Moved tar generation to PlanCoordinator Durable Object
  - **Outcome**: Tar generation now works in 129ms (118 tiles)
  - **Note**: Contains outdated CPU limit information (stated 10-50ms, actual is 30s-5m)

### Architecture Documentation
- **`PDF_PROCESSING_NEW_ARCHITECTURE.md`** - Overall PDF processing flow
- **`PLAN_PROCESSING_FLOW_V1.md`** - Detailed processing flow diagram
- **`TILES_STRATEGY.md`** - DZI tile generation strategy

### External References
- [Cloudflare Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Cloudflare Containers Documentation](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/containers/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [OpenRouter API Documentation](https://openrouter.ai/docs)

---

## Summary

**The Problem:**
Marker detection processing times out silently after tar generation completes successfully. Container receives 118 tiles but never returns results.

**The Evidence:**
- Tar generation works (129ms for 118 tiles) ✅
- Container receives tar stream ✅
- Stage 1 and Stage 2 logs never appear ❌
- No markers inserted into database ❌
- No timeout errors logged ❌

**The Constraints:**
- 5-minute queue consumer timeout
- Container must process 118 tiles
- Each tile: ~0.1s (Stage 1) + ~3s per 10 candidates (Stage 2)
- External API calls to OpenRouter (unpredictable latency)
- No direct R2 access in container

**The Recommendation:**
Implement chunked processing with explicit timeouts:
1. Split tiles into chunks of 30
2. Process chunks sequentially
3. Add timeouts to API calls
4. Implement retry logic
5. Stream results incrementally

**Next Steps:**
1. Investigate container logs to confirm root cause
2. Test with smaller dataset (20 tiles) to verify processing works
3. Implement chunking solution if volume-related
4. Add explicit timeouts and retry logic for LLM API calls
5. Improve error reporting and progress tracking

---

**Document Version:** 1.0
**Last Updated:** 2025-12-08
**Status:** Active Investigation
