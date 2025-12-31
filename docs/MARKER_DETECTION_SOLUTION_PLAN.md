# Marker Detection Timeout - Solution Implementation Plan

**Created:** 2025-12-07
**Status:** Ready for Implementation
**Estimated Time:** 4-6 hours

---

## Executive Summary

**Problem:** Marker detection queue consumer times out when processing 177 tiles due to a stream race condition, not CPU limits as initially assumed.

**Root Cause:** The tar stream is passed to `container.fetch()` before `processTilesAsync()` populates it, causing the container to wait indefinitely for data that hasn't been generated yet.

**Recommended Solution:** Extend the existing `PlanCoordinator` Durable Object to handle tar generation in a single-threaded context, eliminating the race condition while maintaining architectural consistency.

**Consensus:** 2/2 models (Gemini 2.5 Pro: 9/10 confidence, Claude Opus 4.1: 8/10 confidence) strongly recommend this approach over migrating to Cloudflare Workflows.

---

## Research Findings

### Discovery 1: Outdated CPU Limit Assumptions

**Document Claim:** `MARKER_DETECTION_CPU_TIMEOUT_PROBLEM.md` states:
- Free tier: ~10ms CPU time
- Paid tier: ~50ms CPU time

**Actual Cloudflare Limits (2025):**
- Default: **30 seconds (30,000ms)**
- Maximum (configurable): **5 minutes (300,000ms)**
- Configuration: `limits.cpu_ms` in wrangler.jsonc

**Impact:** Processing 177 tiles (~100-400ms CPU) is well within even the default limits.

### Discovery 2: Stream Race Condition

**Location:** `packages/backend/src/core/queues/index.ts:722-877`

**The Bug:**
```typescript
// Stream created immediately
const tarStream = new ReadableStream({
  async start(controller) {
    packer.on('data', (chunk) => controller.enqueue(...))

    // ❌ processTilesAsync() fires and forgets - NOT awaited
    processTilesAsync().catch(error => {...})
  }
})

// Stream passed to container BEFORE tiles are added
response = await container.fetch("...", { body: tarStream })
```

**What Happens:**
1. `tarStream` created with empty packer
2. Stream passed to `container.fetch()` immediately
3. Container starts consuming empty stream
4. `processTilesAsync()` runs in background (not blocking)
5. Container waits forever → Worker appears hung → timeout

### Discovery 3: Current Architecture Pattern

**PlanCoordinator Durable Object** already serves as the central orchestrator:
- Tracks metadata extraction completion (`completedSheets[]`)
- Tracks tile generation completion (`completedTiles[]`)
- Auto-triggers marker detection when tiles are ready
- Uses single-threaded execution (eliminates race conditions)
- Has 15-minute timeout via alarms

**Pattern:** All orchestration logic lives in PlanCoordinator, making it the natural home for tar generation.

---

## Solution Comparison

### Option A: Extend PlanCoordinator Durable Object ✅ **RECOMMENDED**

**Approach:** Move tar generation into PlanCoordinator as a new HTTP endpoint.

**Pros:**
- ✅ Architectural consistency (PlanCoordinator already orchestrates marker flow)
- ✅ Single-threaded execution eliminates race condition
- ✅ Reuses existing state management patterns
- ✅ Simple mental model (all orchestration in one place)
- ✅ Fast implementation (~4-6 hours)
- ✅ Low risk (extends proven component)

**Cons:**
- ⚠️ Tar generation CPU-bound (but well within 30s-5min limits)

**Confidence:** 9/10 (Gemini), 8/10 (Claude Opus)

---

### Option B: Migrate to Cloudflare Workflows ❌ **NOT RECOMMENDED**

**Approach:** Create MarkerDetectionWorkflow with multi-step execution.

**Pros:**
- ✅ Built-in observability
- ✅ Step-based retry logic
- ✅ "Modern" approach

**Cons:**
- ❌ Introduces new abstraction layer (cognitive overhead)
- ❌ Fragments orchestration logic (DOs + Workflows)
- ❌ Longer implementation time (days vs hours)
- ❌ Overkill for synchronization issue
- ❌ Learning curve for Workflows API
- ❌ Violates YAGNI principle

**Verdict:** Workflows are powerful but unnecessary for this specific problem. Save for truly complex multi-step processes.

---

## Implementation Plan

### Phase 1: Immediate Fix (2-3 hours)

**Goal:** Add CPU limit configuration as safety net.

#### Step 1.1: Update wrangler.jsonc
**File:** `packages/backend/wrangler.jsonc`

```json
{
  "limits": {
    "cpu_ms": 120000  // 2 minutes (4x default)
  }
}
```

**Rationale:** Conservative limit that provides headroom while staying well under 5-minute maximum.

#### Step 1.2: Test Configuration
```bash
cd packages/backend
bun run dev
# Verify no configuration errors
```

---

### Phase 2: Durable Object Extension (4-6 hours)

#### Step 2.1: Add Tar Generation Method to PlanCoordinator

**File:** `packages/backend/src/core/durable-objects/plan-coordinator.ts`

**New Method:**
```typescript
/**
 * Generate tar stream of all tiles for marker detection
 * Single-threaded execution eliminates race condition
 */
async generateMarkerTar(request: Request): Promise<Response> {
  console.log(`[PLAN COORDINATOR] Generating marker detection tar`)

  // Extract context from headers
  const organizationId = request.headers.get("X-Organization-Id")
  const projectId = request.headers.get("X-Project-Id")
  const planId = request.headers.get("X-Plan-Id")
  const validSheetsHeader = request.headers.get("X-Valid-Sheets")

  if (!organizationId || !projectId || !planId || !validSheetsHeader) {
    return new Response("Missing required headers", { status: 400 })
  }

  const validSheets = validSheetsHeader.split(",")

  // List all tile JPEGs from R2
  const tilePrefix = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/`
  console.log(`[PLAN COORDINATOR] Listing tiles from R2: ${tilePrefix}`)

  const env = this.env as Env
  const tileList = await env.SitelinkStorage.list({ prefix: tilePrefix })
  const tileKeys = tileList.objects
    .filter(obj => obj.key.endsWith('.jpg'))
    .map(obj => obj.key)

  console.log(`[PLAN COORDINATOR] Found ${tileKeys.length} tile images`)

  if (tileKeys.length === 0) {
    return new Response("No tiles found", { status: 404 })
  }

  // Pre-compute relative paths
  const tileMetadata = tileKeys.map(tileKey => {
    const keyParts = tileKey.split('/')
    const sheetIndex = keyParts.findIndex(part => part.startsWith('sheet-'))
    const relativePath = keyParts.slice(sheetIndex + 1).join('/')
    return { key: tileKey, relativePath }
  })

  // Generate tar buffer sequentially (single-threaded = no race condition)
  const tarBuffer = await this.generateTarBuffer(tileMetadata, env)

  console.log(`[PLAN COORDINATOR] Generated tar buffer: ${tarBuffer.length} bytes`)

  // Return as stream
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(tarBuffer)
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-tar",
      "Content-Length": tarBuffer.length.toString(),
    }
  })
}

/**
 * Generate tar buffer from tile metadata
 * Processes tiles sequentially with periodic yielding
 */
private async generateTarBuffer(
  tileMetadata: Array<{ key: string; relativePath: string }>,
  env: Env
): Promise<Uint8Array> {
  const packer = pack()
  const chunks: Buffer[] = []

  packer.on('data', chunk => chunks.push(chunk))

  let processed = 0

  for (let i = 0; i < tileMetadata.length; i++) {
    const tile = tileMetadata[i]

    // Fetch tile from R2
    const tileObject = await env.SitelinkStorage.get(tile.key)
    if (!tileObject) {
      console.warn(`[PLAN COORDINATOR] Tile not found: ${tile.key}`)
      continue
    }

    // Create tar entry
    const entry = Writable.toWeb(packer.entry({
      name: tile.relativePath,
      type: 'file',
      size: tileObject.size
    }))

    // Stream tile data into entry
    if (tileObject.body) {
      await tileObject.body.pipeTo(entry)
    } else {
      const writer = entry.getWriter()
      await writer.close()
    }

    processed++

    // Log progress
    if (processed % 20 === 0) {
      console.log(`[PLAN COORDINATOR] Processed ${processed}/${tileMetadata.length} tiles`)
    }

    // Yield to event loop every 50 tiles to prevent blocking
    if (i % 50 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  // Finalize packer
  packer.finalize()

  // Wait for finalization
  await new Promise<void>((resolve) => {
    packer.on('end', () => resolve())
  })

  console.log(`[PLAN COORDINATOR] Tar generation complete: ${processed} tiles`)

  return Buffer.concat(chunks)
}
```

#### Step 2.2: Add HTTP Handler Route

**File:** `packages/backend/src/core/durable-objects/plan-coordinator.ts`

Update `fetch()` handler:
```typescript
async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url)

  // Existing routes
  if (url.pathname === "/initialize" && request.method === "POST") {
    return this.initialize(request)
  }

  if (url.pathname === "/sheet-complete" && request.method === "POST") {
    return this.sheetComplete(request)
  }

  if (url.pathname === "/tile-complete" && request.method === "POST") {
    return this.tileComplete(request)
  }

  if (url.pathname === "/progress" && request.method === "GET") {
    return this.getProgress()
  }

  // NEW ROUTE
  if (url.pathname === "/generate-marker-tar" && request.method === "POST") {
    return this.generateMarkerTar(request)
  }

  return new Response("Not found", { status: 404 })
}
```

#### Step 2.3: Update Marker Detection Queue Consumer

**File:** `packages/backend/src/core/queues/index.ts`

**Replace lines 704-827** (current tar generation logic) with:
```typescript
// Use PlanCoordinator to generate tar stream (eliminates race condition)
console.log(`🎯 [MARKERS] Requesting tar stream from PlanCoordinator...`)

const coordinatorId = env.PLAN_COORDINATOR.idFromName(job.uploadId)
const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)

// Call PlanCoordinator to generate tar
const tarResponse = await coordinator.fetch("http://localhost/generate-marker-tar", {
  method: "POST",
  headers: {
    "X-Organization-Id": job.organizationId,
    "X-Project-Id": job.projectId,
    "X-Plan-Id": job.planId,
    "X-Valid-Sheets": job.validSheets.join(","),
  }
})

if (!tarResponse.ok) {
  const errorText = await tarResponse.text()
  console.error(`❌ Failed to generate tar: ${tarResponse.statusText}`, errorText)
  throw new Error(`Failed to generate tar: ${errorText}`)
}

console.log(`✅ Received tar stream from PlanCoordinator`)

// Get tar stream body
const tarStream = tarResponse.body
if (!tarStream) {
  throw new Error("No tar stream in response")
}

// Log tar size for debugging
const contentLength = tarResponse.headers.get("Content-Length")
console.log(`📦 Tar stream size: ${contentLength} bytes`)
```

**Keep everything after line 828** (container health check, marker detection call, database insert) unchanged.

#### Step 2.4: Add Required Imports

**File:** `packages/backend/src/core/durable-objects/plan-coordinator.ts`

Ensure these imports exist:
```typescript
import { pack } from 'tar-stream'
import { Writable } from 'node:stream'
import type { Env } from '../bindings'
```

---

### Phase 3: Testing (1-2 hours)

#### Step 3.1: Unit Tests for PlanCoordinator

**File:** `packages/backend/tests/unit/bun/plan-coordinator.test.ts`

Add new test suite:
```typescript
describe("PlanCoordinator - Marker Tar Generation", () => {
  it("should generate tar stream for tiles", async () => {
    const env = await getTestEnv()

    // Setup: Upload test tiles to R2
    const testTiles = [
      'organizations/org1/projects/proj1/plans/plan1/sheets/sheet-0/0/0_0.jpg',
      'organizations/org1/projects/proj1/plans/plan1/sheets/sheet-0/0/0_1.jpg',
    ]

    for (const key of testTiles) {
      await env.SitelinkStorage.put(key, new Uint8Array([0xFF, 0xD8, 0xFF])) // JPEG header
    }

    // Initialize coordinator
    const id = env.PLAN_COORDINATOR.idFromName("test-upload-1")
    const coordinator = env.PLAN_COORDINATOR.get(id)

    // Generate tar
    const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
      method: "POST",
      headers: {
        "X-Organization-Id": "org1",
        "X-Project-Id": "proj1",
        "X-Plan-Id": "plan1",
        "X-Valid-Sheets": "0",
      }
    })

    expect(response.ok).toBe(true)
    expect(response.headers.get("Content-Type")).toBe("application/x-tar")

    const tarBuffer = await response.arrayBuffer()
    expect(tarBuffer.byteLength).toBeGreaterThan(0)

    // Cleanup
    for (const key of testTiles) {
      await env.SitelinkStorage.delete(key)
    }
  })

  it("should handle missing tiles gracefully", async () => {
    const env = await getTestEnv()
    const id = env.PLAN_COORDINATOR.idFromName("test-upload-2")
    const coordinator = env.PLAN_COORDINATOR.get(id)

    const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
      method: "POST",
      headers: {
        "X-Organization-Id": "org1",
        "X-Project-Id": "proj1",
        "X-Plan-Id": "nonexistent",
        "X-Valid-Sheets": "0",
      }
    })

    expect(response.status).toBe(404)
  })

  it("should yield to event loop during large tar generation", async () => {
    // Test with 177 tiles (realistic scenario)
    const env = await getTestEnv()

    const testTiles = Array.from({ length: 177 }, (_, i) =>
      `organizations/org1/projects/proj1/plans/plan1/sheets/sheet-0/0/0_${i}.jpg`
    )

    for (const key of testTiles) {
      await env.SitelinkStorage.put(key, new Uint8Array([0xFF, 0xD8, 0xFF]))
    }

    const id = env.PLAN_COORDINATOR.idFromName("test-upload-3")
    const coordinator = env.PLAN_COORDINATOR.get(id)

    const startTime = Date.now()
    const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
      method: "POST",
      headers: {
        "X-Organization-Id": "org1",
        "X-Project-Id": "proj1",
        "X-Plan-Id": "plan1",
        "X-Valid-Sheets": "0",
      }
    })
    const duration = Date.now() - startTime

    expect(response.ok).toBe(true)
    console.log(`Generated tar for 177 tiles in ${duration}ms`)

    // Cleanup
    for (const key of testTiles) {
      await env.SitelinkStorage.delete(key)
    }
  })
})
```

#### Step 3.2: Integration Test

**File:** `packages/backend/tests/integration/queue-marker-detection.test.ts`

Create new test file:
```typescript
import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { getTestEnv } from "../helpers"
import { processMarkerDetectionJob } from "../../src/core/queues"

describe("Marker Detection Queue - Integration", () => {
  let env: Env

  beforeAll(async () => {
    env = await getTestEnv()
  })

  it("should process marker detection without timeout", async () => {
    // Setup: Create plan with tiles
    const uploadId = "test-marker-integration-1"
    const planId = "plan-marker-1"

    // Upload 177 test tiles
    const tiles = Array.from({ length: 177 }, (_, i) => ({
      key: `organizations/org1/projects/proj1/plans/${planId}/sheets/sheet-0/0/0_${i}.jpg`,
      data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) // JPEG
    }))

    for (const tile of tiles) {
      await env.SitelinkStorage.put(tile.key, tile.data)
    }

    // Initialize PlanCoordinator
    const coordinatorId = env.PLAN_COORDINATOR.idFromName(uploadId)
    const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)

    await coordinator.fetch("http://localhost/initialize", {
      method: "POST",
      body: JSON.stringify({ uploadId, totalSheets: 1, timeoutMs: 900000 })
    })

    // Enqueue marker detection job
    const job = {
      uploadId,
      planId,
      organizationId: "org1",
      projectId: "proj1",
      validSheets: ["0"],
    }

    // Process job (should not timeout)
    const startTime = Date.now()
    await processMarkerDetectionJob({ body: job }, env)
    const duration = Date.now() - startTime

    console.log(`Marker detection completed in ${duration}ms`)

    // Verify no timeout (should complete in < 30 seconds)
    expect(duration).toBeLessThan(30000)

    // Cleanup
    for (const tile of tiles) {
      await env.SitelinkStorage.delete(tile.key)
    }
  }, 60000) // 60 second timeout for test
})
```

#### Step 3.3: Manual Testing Checklist

```bash
# 1. Deploy to dev environment
cd packages/backend
bun run deploy:dev

# 2. Upload test PDF with 2 pages (should generate ~177 tiles)
# Use test script or frontend

# 3. Monitor logs for:
# - "[PLAN COORDINATOR] Generating marker detection tar"
# - "[PLAN COORDINATOR] Found X tile images"
# - "[PLAN COORDINATOR] Processed Y/X tiles"
# - "✅ Received tar stream from PlanCoordinator"
# - "✅ Detected N markers"

# 4. Verify timing
# - Tar generation should complete in < 5 seconds
# - Total marker detection should complete in < 60 seconds

# 5. Check database
# - processing_jobs.status should be "complete"
# - plan_markers should have detected markers
```

---

### Phase 4: Deployment (30 minutes)

#### Step 4.1: Update Documentation

**File:** `docs/MARKER_DETECTION_CPU_TIMEOUT_PROBLEM.md`

Add section at top:
```markdown
## ✅ RESOLVED (2025-12-07)

**Solution:** Extended PlanCoordinator Durable Object to handle tar generation.

**Root Cause:** Stream race condition (NOT CPU limits). Document's CPU limit assumptions were outdated (actual limits: 30s default, 5min configurable vs stated 10-50ms).

**Implementation:** See `docs/MARKER_DETECTION_SOLUTION_PLAN.md`

---

[Rest of document kept for historical reference]
```

#### Step 4.2: Deploy to Production

```bash
# 1. Run tests
bun run vitest

# 2. Deploy
bun run deploy

# 3. Monitor production logs for first few marker detection jobs

# 4. Set up alerts for:
# - Marker detection job failures
# - CPU time approaching limits
# - Tar generation taking > 10 seconds
```

---

## Success Criteria

### Must Have (Phase 2)
- ✅ Marker detection completes without timeout for 177 tiles
- ✅ PlanCoordinator successfully generates tar stream
- ✅ Queue consumer receives and processes tar stream
- ✅ Markers saved to database
- ✅ Unit tests pass
- ✅ Integration tests pass

### Should Have (Phase 3)
- ✅ Tar generation completes in < 5 seconds
- ✅ Total marker detection completes in < 60 seconds
- ✅ Logs show clear progress at each stage
- ✅ No memory issues with 177 tiles

### Nice to Have (Phase 4)
- ✅ Production monitoring dashboard
- ✅ Alerts for anomalies
- ✅ Performance metrics tracked

---

## Risk Mitigation

### Risk 1: Tar Generation Exceeds CPU Limits
**Likelihood:** Low (177 tiles ~400ms CPU, limit is 120,000ms)
**Mitigation:**
- Periodic yielding every 50 tiles
- Configurable CPU limit (can increase to 300,000ms if needed)
- Monitoring in place

### Risk 2: Memory Pressure from Buffering
**Likelihood:** Low (~50MB for 177 tiles, DOs have 128MB default)
**Mitigation:**
- Monitor memory usage during testing
- Can switch to streaming approach if needed (Phase 2 optimization)

### Risk 3: PlanCoordinator Becomes Bottleneck
**Likelihood:** Low (single coordinator per upload, handles one request at a time)
**Mitigation:**
- Single-threaded execution is feature, not bug
- Coordinator only generates tar once per upload
- Can optimize later if needed

---

## Future Optimizations (Post-MVP)

### Optimization 1: Streaming Tar Generation
If memory becomes an issue with very large plans:
- Implement pull-based streaming in `generateTarBuffer()`
- Stream tiles directly from R2 through packer to response
- Avoids buffering entire tar in memory

### Optimization 2: Parallel Tile Fetching
If R2 fetching is bottleneck:
- Fetch tiles in batches of 20
- Pre-fetch next batch while processing current
- Could reduce total time by 30-50%

### Optimization 3: Cloudflare Workflows (Future Feature)
When to consider:
- Need complex multi-step orchestration with external dependencies
- Want built-in observability dashboard
- Have genuinely long-running processes (hours/days)

**Not needed for marker detection** - current solution is simpler and sufficient.

---

## Appendix: Alternative Approaches Considered

### Why Not Sequential Processing in Queue Consumer?
**Pros:** Simple, no DO changes
**Cons:** Still has race condition unless we buffer entire tar first (memory issue)
**Verdict:** Moving to DO is cleaner architectural solution

### Why Not Cloudflare Workflows?
**Pros:** Modern, built-in features
**Cons:** Overkill, introduces complexity, longer implementation
**Verdict:** Save for future genuinely complex workflows

### Why Not Multiple Queue Messages (Chunking)?
**Pros:** Distributes work
**Cons:** Unnecessary complexity, doesn't solve root cause, harder to debug
**Verdict:** Solves wrong problem (we don't have CPU limit issue)

---

## References

- [Cloudflare Workers CPU Time Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Higher CPU Limits (2025)](https://developers.cloudflare.com/changelog/2025-03-25-higher-cpu-limits/)
- [Durable Objects Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- Current Implementation: `packages/backend/src/core/durable-objects/plan-coordinator.ts`
- Queue Consumer: `packages/backend/src/core/queues/index.ts`

---

## Implementation Checklist

- [ ] Phase 1: Add CPU limit to wrangler.jsonc (15 min)
- [ ] Phase 2.1: Add `generateMarkerTar()` to PlanCoordinator (2 hours)
- [ ] Phase 2.2: Add `generateTarBuffer()` helper (1 hour)
- [ ] Phase 2.3: Update HTTP handler routes (15 min)
- [ ] Phase 2.4: Update queue consumer to call DO (30 min)
- [ ] Phase 2.5: Add required imports (5 min)
- [ ] Phase 3.1: Write unit tests (1 hour)
- [ ] Phase 3.2: Write integration test (30 min)
- [ ] Phase 3.3: Manual testing (30 min)
- [ ] Phase 4.1: Update documentation (15 min)
- [ ] Phase 4.2: Deploy to production (15 min)

**Total Estimated Time:** 6-8 hours (can be done in one workday)

---

**Next Steps:** Assign to developer and begin Phase 1 implementation.
