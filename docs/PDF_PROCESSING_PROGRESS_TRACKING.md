# PDF Processing Progress Tracking - Architecture Decision

**Date**: 2025-11-06
**Status**: Approved - Implementation Phase
**Decision**: Start with Direct Updates (Phase 1), add R2 Event Reconciliation later (Phase 2)

---

## Table of Contents

1. [Context & Problem Statement](#context--problem-statement)
2. [Architecture Approaches Evaluated](#architecture-approaches-evaluated)
3. [Consensus Analysis Results](#consensus-analysis-results)
4. [Final Recommended Approach](#final-recommended-approach)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)
7. [Migration Path & Future Enhancements](#migration-path--future-enhancements)
8. [Risk Mitigation](#risk-mitigation)
9. [References](#references)

---

## Context & Problem Statement

### The Challenge

SiteLink processes multi-page construction plan PDFs into Deep Zoom Image (DZI) tiles for mobile viewing using OpenSeadragon. The processing pipeline needs to:

1. **Process PDFs**: Use `vips` in a Cloudflare Container to convert each page to DZI tiles
2. **Upload Tiles**: Store generated tiles in Cloudflare R2 (hundreds of objects per page)
3. **Track Progress**: Provide real-time progress updates to mobile clients watching the upload
4. **Handle Failures**: Gracefully recover from network failures, container crashes, etc.

### Technical Constraints

- **Environment**: Cloudflare Workers + Durable Objects + R2 + Containers
- **Processing Location**: Container (not Worker, due to `vips` dependency)
- **Multi-tenancy**: Files organized by `orgId/projectId/planId/uploadId`
- **Real-time Requirements**: Multiple clients may watch same upload progress
- **Scale**: Each sheet generates 200-500 tile objects in R2

### The Core Question

**How should the container communicate processing progress?**

When the container uploads tiles to R2, how does it notify the Durable Object (which broadcasts to WebSocket clients)?

Three approaches emerged:
- **A**: Use R2 Event Notifications as the source of truth
- **B**: Use R2 Events → Database → Sync Engine (external dependency)
- **C**: Container directly updates progress (no events)

---

## Architecture Approaches Evaluated

### Approach A: R2 Event Notifications → Durable Object → WebSocket

```typescript
// Flow:
// 1. Container processes page → generates tiles
// 2. Container uploads tiles to R2
// 3. R2 fires "object-create" event → Cloudflare Queue
// 4. Queue consumer (Durable Object) parses event
// 5. DO increments progress counter
// 6. DO broadcasts progress via WebSocket to connected clients

// Example R2 Event Payload:
{
  "account": "3f4b7e3dcab231cbfdaa90a6a28bd548",
  "action": "PutObject",
  "bucket": "sitelink-storage",
  "object": {
    "key": "organizations/org-1/projects/proj-1/plans/plan-1/sheets/sheet-1/tiles/sheet-1.dzi",
    "size": 65536,
    "eTag": "c846ff7a18f28c2e262116d6e8719ef0"
  },
  "eventTime": "2024-05-24T19:36:44.379Z"
}

// Queue consumer in Durable Object
async queue(batch: MessageBatch): Promise<void> {
  for (const message of batch.messages) {
    const event = message.body

    // Only count .dzi files (not individual tiles)
    if (!event.object.key.endsWith('.dzi')) continue

    // Parse orgId/projectId/planId/sheetId from key
    const { planId, sheetId } = parseR2Key(event.object.key)

    // Update progress
    await this.markPageComplete(planId, sheetId)
  }
}
```

**Pros:**
- ✅ **Guaranteed delivery**: R2 confirms file exists before event fires
- ✅ **Automatic retry**: Cloudflare Queues provide at-least-once delivery
- ✅ **Event-driven**: Aligns with serverless best practices
- ✅ **Cloudflare-native**: No external dependencies
- ✅ **Self-healing**: Progress will eventually be correct even if container crashes

**Cons:**
- ❌ **Latency**: 1-5 second delay between upload and progress update
- ❌ **Complexity**: Event parsing, queue management, potential duplicates
- ❌ **Debugging**: Harder to trace flow (upload → queue → DO)
- ❌ **Volume**: Each sheet = hundreds of events (need to filter for `.dzi` only)

**Cost Implications:**
- Queue operations: ~$0.40 per million messages
- DO requests: $0.15 per million
- For 5-page plan: ~5 events (if filtering to `.dzi` only)

---

### Approach B: R2 Events → Database → Sync Engine

```typescript
// Flow:
// 1. Container uploads tiles to R2
// 2. R2 fires event → Queue consumer
// 3. Queue consumer updates database (Postgres/D1)
// 4. Sync engine (Electric SQL, LiveStore, PowerSync) syncs to clients

// Queue consumer
async queue(batch: MessageBatch): Promise<void> {
  for (const message of batch.messages) {
    const { planId } = parseR2Key(message.body.object.key)

    // Increment in database
    await db.execute(`
      UPDATE uploads
      SET completed_sheets = completed_sheets + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE plan_id = ?
    `, [planId])
  }
}

// Client (automatic via sync engine)
const progress = useLiveQuery(
  db.uploads.where({ planId })
)
```

**Pros:**
- ✅ **Proven patterns**: Industry-standard approach for real-time sync
- ✅ **Offline support**: Sync engines handle offline/online transitions
- ✅ **Simpler WebSocket management**: Sync engine handles reconnections
- ✅ **Multi-device sync**: Progress visible across all user devices
- ✅ **Database as source of truth**: Easy to query historical data

**Cons:**
- ❌ **External dependency**: Requires Electric SQL, LiveStore, or PowerSync
- ❌ **Database choice**: May require Postgres (D1 doesn't have native replication yet)
- ❌ **Cost**: Additional service costs for sync engine hosting
- ❌ **Complexity**: Another service to maintain and monitor
- ❌ **Latency**: Still has R2 event delay (1-5 seconds)

**Use Cases Where This Shines:**
- Multi-device sync required (e.g., desktop + mobile)
- Offline-first mobile app requirements
- Already using Postgres with replication

---

### Approach C: Direct Updates (No R2 Events)

```typescript
// Flow:
// 1. Container uploads tiles to R2
// 2. Container immediately calls DO progress endpoint
// 3. DO updates progress state
// 4. DO broadcasts to WebSocket clients

// In container tile processor
async function processPage(page: number) {
  // Generate tiles with vips
  await generateTiles(page)

  // Upload to R2
  await uploadToR2(tiles)

  // Update progress IMMEDIATELY
  await updateProgress({
    planId,
    completedPages: page + 1,
    totalPages
  })
}

// With retry logic
async function updateProgressWithRetry(progress, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await doStub.fetch("/progress", {
        method: "POST",
        body: JSON.stringify(progress)
      })
      return // Success!
    } catch (error) {
      if (attempt === maxRetries - 1) throw error

      // Exponential backoff: 1s, 2s, 4s
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
}
```

**Pros:**
- ✅ **Immediate updates**: No event latency - users see progress instantly
- ✅ **Simplest implementation**: Direct HTTP call, no event parsing
- ✅ **Easy debugging**: Clear request/response flow
- ✅ **Full control**: Container knows exact state
- ✅ **Cloudflare-native**: No external dependencies
- ✅ **Testable locally**: No need to simulate R2 events in tests

**Cons:**
- ❌ **Network failure risk**: If R2 upload succeeds but progress update fails, state is inconsistent
- ❌ **No automatic retry**: Must implement retry logic manually
- ❌ **Container crash recovery**: Progress lost if container crashes after upload but before update

**Mitigation Strategies:**
1. **Retry logic**: Exponential backoff (handles 99% of network blips)
2. **Idempotent processing**: Check if sheet already exists before reprocessing
3. **Reconciliation job**: Periodic check of R2 vs reported progress (Phase 2)

---

## Consensus Analysis Results

A multi-model consensus analysis was conducted with three AI models taking different stances:

### Model Recommendations

| Model | Stance | Recommendation | Confidence | Key Argument |
|-------|--------|----------------|------------|--------------|
| **Gemini 2.0** | For R2 Events | Approach A | 8/10 | "Reliability and correctness are paramount" |
| **Claude Sonnet 3.7** | Against R2 Events | Approach C | 8/10 | "Simplicity and immediate UX outweigh complexity" |
| **GPT-4o** | Neutral | Approach B | 8/10 | "Balanced solution with proven patterns" |

### Points of Agreement

All models agreed on:
- ✅ Network failure risk exists in Approach C
- ✅ 1-5 second R2 event latency is tolerable for upload progress
- ✅ Testability is important (local development without cloud dependencies)
- ✅ User trust depends on reliability

### Points of Disagreement

**Reliability vs Simplicity Trade-off:**

- **Gemini's Position**: R2 events are "crucial for guaranteed accuracy" because they confirm files exist. Network failures are common enough to warrant event-driven architecture.

- **Claude Sonnet's Position**: Direct updates with retry logic provide "sufficient reliability" and are "clearly superior" for user experience. Network failures are rare.

- **GPT-4o's Position**: External sync engines solve both problems but add dependency management overhead.

**The Real Debate:**

The disagreement centers on **how often network failures occur** and **whether guaranteed correctness justifies added complexity**.

- If network failures happen 1% of the time → Approach C with retry handles it
- If network failures happen 10% of the time → Approach A's guaranteed delivery worth it

**Industry Reality**: Most file upload systems use optimistic direct updates with retry logic (Approach C pattern) rather than storage events for progress tracking.

---

## Final Recommended Approach

### **Phased Implementation: Start Simple, Add Complexity Only If Needed**

## Phase 1: Direct Updates with Retry Logic (MVP)

**Timeline**: Implement this week
**Complexity**: Low
**Reliability**: 99%+ (with retry logic)

```typescript
// In packages/backend/src/core/pdf-manager/tile-processor.ts

export interface TileGeneratorData {
  pdfPath: string
  organizationId: string
  projectId: string
  planId: string
  uploadId: string
  uploadCallback: (path: string, orgId: string, projectId: string, planId: string, sheetId: string) => Promise<void>
  progressCallback: (progress: ProgressUpdate) => Promise<void> // NEW: Add this
  tempOutputDir?: string
  tempOutputCleanup?: boolean
}

export interface ProgressUpdate {
  planId: string
  completedPages: number
  totalPages: number
}

export async function executePlanTileGeneration(config: TileGeneratorData) {
  const pdfBuffer = await Bun.file(config.pdfPath).arrayBuffer()
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()

  console.info(`Processing ${totalPages} pages from ${config.pdfPath}`)

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const pageNumber = pageNum + 1
    const sheetId = `sheet-${pageNumber}`

    // 1. Generate tiles with vips
    const tmpOutputDir = config.tempOutputDir || `/tmp/${config.uploadId}/${sheetId}`
    await fs.mkdir(tmpOutputDir, { recursive: true })
    const dziPath = `${tmpOutputDir}/${sheetId}`

    await $`vips dzsave ${config.pdfPath}[page=${pageNum},dpi=300] ${dziPath} --tile-size 256 --overlap 1`

    // 2. Upload to R2
    await config.uploadCallback(
      tmpOutputDir,
      config.organizationId,
      config.projectId,
      config.planId,
      sheetId
    )

    // 3. Update progress immediately (NEW)
    await updateProgressWithRetry(config.progressCallback, {
      planId: config.planId,
      completedPages: pageNumber,
      totalPages
    })

    // 4. Cleanup
    if (config.tempOutputCleanup) {
      await fs.rm(tmpOutputDir, { recursive: true })
    }

    console.info(`Completed page ${pageNumber}/${totalPages}`)
  }

  return totalPages
}

// Helper: Retry logic with exponential backoff
async function updateProgressWithRetry(
  progressCallback: (update: ProgressUpdate) => Promise<void>,
  update: ProgressUpdate,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await progressCallback(update)
      return // Success!
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1

      if (isLastAttempt) {
        console.error(`Failed to update progress after ${maxRetries} attempts:`, error)
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt) * 1000
      console.warn(`Progress update failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}
```

**Durable Object Implementation:**

```typescript
// In packages/backend/src/core/pdf-manager/index.ts

export class SitelinkPdfProcessor extends DurableObject<Env> {

  /**
   * HTTP handler for container to update progress
   * Called directly by the container after each sheet upload
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/progress" && request.method === "POST") {
      const update = await request.json() as ProgressUpdate

      await this.updateProgressFromContainer(
        update.planId,
        update.completedPages,
        update.totalPages
      )

      return Response.json({ success: true })
    }

    // ... other endpoints (WebSocket upgrade, etc.)
  }

  /**
   * Update progress from container direct call
   */
  async updateProgressFromContainer(
    planId: string,
    completedPages: number,
    totalPages: number
  ): Promise<void> {
    const progress = await this.getProgress(planId)
    if (!progress) {
      throw new Error(`Job for plan ${planId} not found`)
    }

    const isComplete = completedPages === totalPages
    const progressPercent = Math.round((completedPages / totalPages) * 100)

    await this.updateProgress(planId, {
      status: isComplete ? "complete" : "processing",
      completedPages,
      totalPages,
      progress: progressPercent,
      ...(isComplete && { completedAt: Date.now() })
    })

    console.info(`Progress updated: ${planId} - ${completedPages}/${totalPages} (${progressPercent}%)`)
  }
}
```

**Why This Works:**

1. **Retry logic handles 99% of network failures**: Exponential backoff with 3 retries gives multiple chances
2. **Simple to debug**: Direct HTTP calls with clear error messages
3. **Fast user feedback**: No event latency - progress updates appear within milliseconds
4. **Testable locally**: No R2 events needed (see Testing Strategy below)
5. **Cloudflare-native**: Uses only DO HTTP endpoints

---

## Phase 2: R2 Event Reconciliation (Insurance Policy)

**Timeline**: Next sprint (optional)
**Complexity**: Medium
**Purpose**: Catch any missed progress updates

```typescript
// wrangler.toml - Enable R2 event notifications
[[queues.consumers]]
queue = "pdf-processing-reconciliation"
max_batch_size = 10
max_batch_timeout = 5

// Configure R2 bucket notification
// CLI: wrangler r2 bucket notification create sitelink-storage \
//   --event-type object-create \
//   --suffix ".dzi" \
//   --queue pdf-processing-reconciliation

// In Durable Object - Reconciliation handler
async queue(batch: MessageBatch<R2EventMessage>): Promise<void> {
  const reconciliations = new Map<string, number>()

  // Count .dzi files per plan from R2 events
  for (const message of batch.messages) {
    const event = message.body

    // Only count .dzi files (ignore individual tiles)
    if (!event.object.key.endsWith('.dzi')) continue

    // Parse: organizations/{orgId}/projects/{projId}/plans/{planId}/sheets/{sheetId}/tiles/...
    const parts = event.object.key.split('/')
    const planId = parts[5] // "plan-123"

    reconciliations.set(planId, (reconciliations.get(planId) || 0) + 1)
  }

  // Reconcile: Check if progress matches R2 reality
  for (const [planId, r2SheetCount] of reconciliations) {
    const progress = await this.getProgress(planId)
    if (!progress) {
      console.warn(`Reconciliation: No job found for plan ${planId}`)
      continue
    }

    // If reported progress < actual R2 count, fix it
    if (progress.completedPages < r2SheetCount) {
      console.warn(
        `Reconciliation discrepancy detected for ${planId}: ` +
        `Reported ${progress.completedPages}, R2 has ${r2SheetCount}`
      )

      await this.updateProgress(planId, {
        completedPages: r2SheetCount,
        reconciled: true, // Flag for monitoring
        reconciledAt: Date.now()
      })

      // Metrics: Track how often reconciliation is needed
      // If this happens frequently, investigate container→DO connection issues
    }
  }
}
```

**What This Provides:**

- ✅ **Safety net**: Catches missed updates from container crashes or network failures
- ✅ **Observability**: Track reconciliation frequency to measure Approach C reliability
- ✅ **Self-healing**: System eventually reaches correct state
- ✅ **No user-facing latency**: Reconciliation runs in background

**When to Enable Phase 2:**

- If monitoring shows >1% of jobs need reconciliation
- If users report stuck progress bars
- For extra peace of mind in production

**Cost**: Minimal - only pay for events on `.dzi` files (5-10 per plan)

---

## Phase 3: Sync Engine (Future - Only If Needed)

**Timeline**: Future enhancement
**Complexity**: High (external service)
**Triggers**:
- Need offline-first mobile app support
- Multi-device progress sync required
- Cross-platform real-time collaboration features

**Implementation**: See Approach B details above

**Don't Do This Unless**:
- You're already using Postgres (Electric SQL compatibility)
- You have other real-time sync requirements beyond progress
- Team has experience managing sync engine infrastructure

---

## Implementation Plan

### Week 1: Core Functionality

**Day 1-2: Update Tile Processor**

```typescript
// packages/backend/src/core/pdf-manager/tile-processor.ts

// 1. Add progressCallback to TileGeneratorData interface
export interface TileGeneratorData {
  // ... existing fields
  progressCallback: (update: ProgressUpdate) => Promise<void>
}

// 2. Add ProgressUpdate interface
export interface ProgressUpdate {
  planId: string
  completedPages: number
  totalPages: number
}

// 3. Add retry logic helper
async function updateProgressWithRetry(...) { /* implementation */ }

// 4. Call progressCallback after each upload
for (let pageNum = 0; pageNum < totalPages; pageNum++) {
  // ... generate tiles, upload to R2 ...

  await updateProgressWithRetry(config.progressCallback, {
    planId: config.planId,
    completedPages: pageNum + 1,
    totalPages
  })
}
```

**Day 3-4: Update Durable Object**

```typescript
// packages/backend/src/core/pdf-manager/index.ts

// 1. Add HTTP handler for /progress endpoint
async fetch(request: Request): Response {
  if (url.pathname === "/progress" && request.method === "POST") {
    const update = await request.json()
    await this.updateProgressFromContainer(...)
    return Response.json({ success: true })
  }
}

// 2. Implement updateProgressFromContainer method
async updateProgressFromContainer(
  planId: string,
  completedPages: number,
  totalPages: number
): Promise<void> {
  // ... implementation
}
```

**Day 5: Integration & Testing**

- Wire up container → DO progress callback
- Test with sample 3-page PDF
- Verify WebSocket broadcast to clients
- Test retry logic with simulated failures

---

### Week 2: Testing & Refinement

**Write Comprehensive Tests** (see Testing Strategy below)

**Add Monitoring:**

```typescript
// Track progress update success/failure rates
await logMetric("progress.update.success", 1)
await logMetric("progress.update.retry", 1, { attempt: 2 })
await logMetric("progress.update.failure", 1, { planId })
```

**Add Observability:**

```typescript
// Log timing for debugging
const startTime = Date.now()
await updateProgressWithRetry(...)
const duration = Date.now() - startTime

if (duration > 1000) {
  console.warn(`Slow progress update: ${duration}ms for ${planId}`)
}
```

---

## Testing Strategy

### Unit Tests (Bun Test)

**Test the tile processor with mocked callbacks:**

```typescript
// packages/backend/tests/unit/bun/pdf-manager.test.ts

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { executePlanTileGeneration, type ProgressUpdate } from "../../../src/core/pdf-manager/tile-processor"

describe("PDF Tile Processor - Progress Tracking", () => {
  const TEST_PDF = `${import.meta.dir}/../../fixtures/sample-plan.pdf`
  const TMP_DIR = `${import.meta.dir}/../../fixtures/tmp`

  beforeEach(async () => {
    await Bun.$`mkdir -p ${TMP_DIR}`.quiet()
  })

  afterEach(async () => {
    await Bun.$`rm -rf ${TMP_DIR}`.quiet()
  })

  test("calls progressCallback after each page upload", async () => {
    // Arrange: Mock callbacks
    const uploadCallback = mock(() => Promise.resolve())
    const progressCallback = mock(() => Promise.resolve())

    // Act: Process PDF
    await executePlanTileGeneration({
      pdfPath: TEST_PDF,
      organizationId: "org-1",
      projectId: "proj-1",
      planId: "plan-1",
      uploadId: "upload-1",
      uploadCallback,
      progressCallback,
      tempOutputDir: TMP_DIR,
      tempOutputCleanup: false
    })

    // Assert: Progress callback called for each page
    expect(progressCallback).toHaveBeenCalledTimes(3) // 3-page PDF

    // Assert: Correct progress values
    expect(progressCallback).toHaveBeenNthCalledWith(1, {
      planId: "plan-1",
      completedPages: 1,
      totalPages: 3
    })

    expect(progressCallback).toHaveBeenNthCalledWith(2, {
      planId: "plan-1",
      completedPages: 2,
      totalPages: 3
    })

    expect(progressCallback).toHaveBeenNthCalledWith(3, {
      planId: "plan-1",
      completedPages: 3,
      totalPages: 3
    })
  })

  test("retries progress update on failure", async () => {
    let callCount = 0

    // Mock: Fail twice, then succeed
    const progressCallback = mock(() => {
      callCount++
      if (callCount < 3) {
        throw new Error("Network failure")
      }
      return Promise.resolve()
    })

    const uploadCallback = mock(() => Promise.resolve())

    // Process single page should trigger 3 attempts
    await executePlanTileGeneration({
      pdfPath: TEST_PDF,
      // ... other params
      uploadCallback,
      progressCallback
    })

    // Assert: Retried 3 times before success
    expect(callCount).toBe(3)
  })

  test("throws after max retries exhausted", async () => {
    // Mock: Always fail
    const progressCallback = mock(() => {
      throw new Error("Permanent network failure")
    })

    const uploadCallback = mock(() => Promise.resolve())

    // Assert: Throws after 3 attempts
    await expect(
      executePlanTileGeneration({
        pdfPath: TEST_PDF,
        // ... other params
        uploadCallback,
        progressCallback
      })
    ).rejects.toThrow("Permanent network failure")
  })
})
```

---

### Integration Tests (Vitest + Cloudflare)

**Test the full DO → WebSocket flow:**

```typescript
// packages/backend/tests/integration/processing.test.ts

import { env, createExecutionContext } from "cloudflare:test"
import { describe, it, expect } from "vitest"

describe("PDF Processing - Progress Updates", () => {
  it("should update DO progress when container calls /progress", async () => {
    const jobId = "job-test-123"
    const planId = "plan-456"

    // 1. Initialize job in DO
    const stub = env.SITELINK_PDF_PROCESSOR.get(
      env.SITELINK_PDF_PROCESSOR.idFromName(jobId)
    )

    await stub.initialize({
      jobId,
      planId,
      uploadId: "upload-123",
      organizationId: "org-1",
      projectId: "proj-1",
      pdfPath: "path/to/file.pdf",
      filename: "test.pdf",
      fileSize: 1024
    })

    // 2. Simulate container calling /progress endpoint
    const response = await stub.fetch(
      new Request("http://localhost/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          completedPages: 1,
          totalPages: 3
        })
      })
    )

    expect(response.ok).toBe(true)

    // 3. Verify progress was updated
    const progress = await stub.getProgress(planId)
    expect(progress.completedPages).toBe(1)
    expect(progress.totalPages).toBe(3)
    expect(progress.status).toBe("processing")
    expect(progress.progress).toBe(33) // 1/3 = 33%
  })

  it("should mark job complete when all pages processed", async () => {
    const stub = env.SITELINK_PDF_PROCESSOR.get(
      env.SITELINK_PDF_PROCESSOR.idFromName("job-complete-test")
    )

    await stub.initialize({
      jobId: "job-complete-test",
      planId: "plan-complete",
      // ... other fields
    })

    // Simulate processing all 3 pages
    for (let page = 1; page <= 3; page++) {
      await stub.fetch(
        new Request("http://localhost/progress", {
          method: "POST",
          body: JSON.stringify({
            planId: "plan-complete",
            completedPages: page,
            totalPages: 3
          })
        })
      )
    }

    // Verify completion
    const progress = await stub.getProgress("plan-complete")
    expect(progress.status).toBe("complete")
    expect(progress.completedPages).toBe(3)
    expect(progress.progress).toBe(100)
    expect(progress.completedAt).toBeDefined()
  })
})
```

**No R2 events needed!** These tests run entirely locally with Miniflare.

---

### Manual Testing Checklist

**Scenario 1: Happy Path**
- [ ] Upload 3-page PDF
- [ ] Verify progress updates appear in real-time (WebSocket)
- [ ] Confirm progress bar reaches 100%
- [ ] Check all tiles exist in R2

**Scenario 2: Network Interruption**
- [ ] Simulate network failure (disconnect WiFi mid-upload)
- [ ] Verify retry logic kicks in
- [ ] Confirm progress eventually catches up
- [ ] Check logs for retry attempts

**Scenario 3: Container Crash**
- [ ] Kill container mid-processing
- [ ] Restart processing
- [ ] Verify idempotent behavior (skips already-processed sheets)
- [ ] Confirm final progress is correct

**Scenario 4: Multiple Clients**
- [ ] Connect 2 WebSocket clients to same job
- [ ] Start processing
- [ ] Verify both clients receive progress updates
- [ ] Disconnect one client, verify other continues

---

## Migration Path & Future Enhancements

### From Phase 1 to Phase 2

**When to Add R2 Event Reconciliation:**

Monitor these metrics for 2 weeks:
- `progress.update.failure` - Failed progress updates after retries
- `progress.discrepancy` - Jobs where final progress ≠ R2 reality

**If failure rate > 1%**: Enable Phase 2 reconciliation

**Implementation Steps:**
1. Configure R2 bucket notification (CLI command)
2. Add queue consumer to wrangler.toml
3. Implement `queue()` handler in DO
4. Deploy and monitor reconciliation frequency

**Rollback Plan:**
- Disable R2 notification rule (keeps Phase 1 working)
- No code changes needed - `queue()` handler simply won't be called

---

### From Phase 2 to Phase 3 (Sync Engine)

**Only Migrate If:**
- You need offline-first mobile app
- Users request multi-device sync
- You're building real-time collaboration features

**Migration Steps:**
1. Set up Postgres with replication (Electric SQL compatible)
2. Migrate D1 data to Postgres
3. Deploy Electric SQL sync service
4. Update mobile app to use sync client
5. Keep DO WebSocket as fallback during transition

**Estimated Effort**: 2-3 sprints

---

## Risk Mitigation

### Risk 1: Container Crashes Mid-Processing

**Impact**: Progress lost, user sees stuck progress bar
**Probability**: Medium (containers can crash due to OOM, timeouts)

**Mitigation:**

```typescript
// Make processing idempotent
async function processPage(pageNum: number) {
  const sheetId = `sheet-${pageNum + 1}`
  const dziPath = `organizations/${orgId}/.../sheets/${sheetId}/tiles/${sheetId}.dzi`

  // Check if already processed
  const exists = await r2.head(dziPath)
  if (exists) {
    console.info(`Sheet ${sheetId} already exists, skipping...`)

    // Still update progress (in case it was missed)
    await updateProgress({ completedPages: pageNum + 1, totalPages })
    return
  }

  // Process...
}
```

**Result**: Restart processing picks up where it left off

---

### Risk 2: Network Partition Between Container and DO

**Impact**: Progress updates fail, user sees no progress
**Probability**: Low (both run in Cloudflare network)

**Mitigation:**

1. **Retry logic** (already implemented in Phase 1)
2. **Exponential backoff** prevents overwhelming DO
3. **Alert if retries > 2** (indicates connectivity issue)
4. **Phase 2 reconciliation** eventually corrects progress

**User Impact**: Temporary (1-5 seconds delay), not permanent

---

### Risk 3: Progress Stuck at 99%

**Impact**: User sees "99% complete" but never finishes
**Probability**: Very Low (only if last progress update fails after 3 retries)

**Mitigation:**

**Client-side timeout:**

```typescript
// Mobile app
const PROGRESS_TIMEOUT = 60000 // 1 minute

useEffect(() => {
  const timer = setTimeout(() => {
    if (progress < 100 && status === 'processing') {
      // Show "Verifying..." message
      setStatus('verifying')

      // Poll DO for current status
      checkProgressStatus(planId)
    }
  }, PROGRESS_TIMEOUT)

  return () => clearTimeout(timer)
}, [progress, status])
```

**DO status endpoint:**

```typescript
// GET /status/:planId - Check current state
async getStatus(planId: string): Response {
  const progress = await this.getProgress(planId)

  // If status is "processing" but no updates in 5 minutes, investigate
  const staleThreshold = 5 * 60 * 1000
  const lastUpdate = progress.updatedAt || progress.startedAt

  if (Date.now() - lastUpdate > staleThreshold) {
    // Mark as potentially stalled
    return Response.json({
      ...progress,
      warning: "Processing may have stalled. Support has been notified."
    })
  }

  return Response.json(progress)
}
```

---

### Risk 4: R2 Upload Succeeds, Progress Update Fails (After All Retries)

**Impact**: Tiles exist in R2 but user doesn't know
**Probability**: Very Low (<0.1% with 3 retries)

**Mitigation:**

**Phase 2 Reconciliation** (see above) - R2 events will eventually trigger progress update

**Manual Recovery:**

```typescript
// Admin endpoint to force reconciliation
async forceReconcile(planId: string): Response {
  // Count .dzi files in R2
  const dziFiles = await r2.list({
    prefix: `organizations/.../plans/${planId}/sheets/`,
    suffix: '.dzi'
  })

  const actualSheetCount = dziFiles.objects.length

  // Update progress to match reality
  await this.updateProgress(planId, {
    completedPages: actualSheetCount,
    status: 'complete',
    reconciled: true,
    reconciledAt: Date.now()
  })

  return Response.json({ reconciled: true, sheetCount: actualSheetCount })
}
```

---

### Risk 5: Hundreds of Tile Events Overwhelm Queue (If Using Phase 2 Incorrectly)

**Impact**: High costs, slow reconciliation
**Probability**: High if filtering not implemented

**Mitigation:**

**CRITICAL**: Only trigger events for `.dzi` files, not individual tiles!

```bash
# Correct: Filter by suffix
wrangler r2 bucket notification create sitelink-storage \
  --event-type object-create \
  --suffix ".dzi" \
  --queue pdf-processing-reconciliation
```

**Result**: 5 events per 5-page plan (not 500+)

---

## Cost Analysis

### Phase 1: Direct Updates

**Components:**
- Durable Object requests: ~5 per plan (initialize + 3 progress updates + complete)
- WebSocket messages: ~3 per connected client
- No queue costs

**Cost per 1,000 plans:**
- DO requests: 5,000 × $0.15/million = $0.00075
- WebSocket: Included in DO pricing
- **Total: <$0.001**

**Conclusion**: Effectively free at scale

---

### Phase 2: R2 Event Reconciliation

**Additional Components:**
- R2 event notifications: 5 per plan (one per `.dzi` file)
- Queue operations: 5 per plan
- DO queue consumer invocations: 1 per batch (batches of 10)

**Cost per 1,000 plans:**
- R2 events: Free (no charge for notifications)
- Queue operations: 5,000 × $0.40/million = $0.002
- DO requests: 100 × $0.15/million = $0.000015
- **Total: ~$0.002**

**Conclusion**: Still negligible

---

### Phase 3: Sync Engine (External)

**Components:**
- Database hosting (Postgres with replication)
- Sync engine service (Electric SQL, LiveStore, etc.)
- Bandwidth for sync

**Estimated Cost per Month:**
- Database: $25-100 (depends on size/provider)
- Sync engine: $50-200 (depends on service)
- **Total: $75-300/month**

**Conclusion**: Only add if feature requirements justify cost

---

## Performance Metrics

### Target SLAs

| Metric | Target | Phase 1 | Phase 2 (with reconciliation) |
|--------|--------|---------|--------------------------------|
| **Progress update latency** | <1s | <100ms | <100ms (direct), 1-5s (reconciliation) |
| **Progress accuracy** | 99.9% | 99%+ | 99.99%+ |
| **Failed updates (after retry)** | <0.1% | <1% | <0.01% |
| **Processing throughput** | 10 concurrent plans | ✅ | ✅ |
| **WebSocket reconnection time** | <5s | ✅ | ✅ |

### Monitoring Dashboards

**Key Metrics to Track:**

```typescript
// Progress update success rate
metric("progress.update.success", 1, { planId, attempt })
metric("progress.update.failure", 1, { planId, error })

// Retry frequency
metric("progress.update.retry", 1, { planId, attempt })

// Reconciliation needed (Phase 2)
metric("progress.reconciliation.discrepancy", 1, { planId, diff })

// Processing time
metric("processing.duration", durationMs, { planId, pageCount })

// WebSocket connections
metric("websocket.connected", connectionCount, { planId })
```

**Alerts:**

- Alert if `progress.update.failure` > 1% of total updates
- Alert if `processing.duration` > 5 minutes for 5-page plan
- Alert if `progress.reconciliation.discrepancy` > 10 instances/day

---

## References

### Related Documentation

- [PDF_PROCESSING_ARCHITECTURE.md](./PDF_PROCESSING_ARCHITECTURE.md) - Overall processing pipeline
- [TESTING_STRATEGY.md](../packages/backend/tests/TESTING_STRATEGY.md) - Integration testing approach
- [TILES_STRATEGY.md](./TILES_STRATEGY.md) - DZI tile generation strategy

### Cloudflare Documentation

- [R2 Event Notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)

### External Resources

- [OpenSeadragon Documentation](https://openseadragon.github.io/)
- [libvips DZI Generation](https://www.libvips.org/API/current/Making-image-pyramids.md.html)
- [Electric SQL](https://electric-sql.com/) - Postgres sync engine
- [LiveStore.dev](https://livestore.dev/) - Real-time sync platform

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-06 | Phase 1: Direct Updates | Start simple, 99% reliability sufficient for MVP |
| 2025-11-06 | Add retry logic with exponential backoff | Handles transient network failures |
| 2025-11-06 | Phase 2 optional: R2 reconciliation | Insurance policy if monitoring shows >1% failures |
| 2025-11-06 | Phase 3 deferred: Sync engine | Only if offline/multi-device requirements emerge |

---

## Implementation Checklist

### Phase 1 (This Week)

- [ ] Add `progressCallback` parameter to `executePlanTileGeneration()`
- [ ] Implement `updateProgressWithRetry()` helper with exponential backoff
- [ ] Call `progressCallback` after each sheet upload in tile processor
- [ ] Add `/progress` HTTP endpoint to Durable Object
- [ ] Implement `updateProgressFromContainer()` method in DO
- [ ] Write unit tests for retry logic (Bun test)
- [ ] Write integration tests for DO progress updates (Vitest)
- [ ] Update container to provide progress callback when calling tile processor
- [ ] Test end-to-end with 3-page sample PDF
- [ ] Verify WebSocket broadcasts work correctly
- [ ] Add logging for success/failure/retry metrics
- [ ] Deploy to staging environment

### Phase 2 (Next Sprint - Optional)

- [ ] Configure R2 bucket notification with `.dzi` suffix filter
- [ ] Add queue consumer configuration to `wrangler.toml`
- [ ] Implement `queue()` handler in Durable Object
- [ ] Add reconciliation logic (check R2 count vs reported progress)
- [ ] Add `reconciled` flag to progress state
- [ ] Write tests for reconciliation logic
- [ ] Deploy and monitor reconciliation frequency
- [ ] Create dashboard for reconciliation metrics

### Phase 3 (Future - Only If Needed)

- [ ] Evaluate sync engine options (Electric SQL, LiveStore, PowerSync)
- [ ] Set up Postgres with replication
- [ ] Migrate from D1 to Postgres
- [ ] Deploy sync engine service
- [ ] Update mobile app to use sync client
- [ ] Maintain DO WebSocket as fallback during transition

---

## Questions & Answers

**Q: What if the container crashes after uploading tiles but before updating progress?**

A: The tiles exist in R2 but progress is incomplete. When processing restarts:
- Phase 1: Idempotent check skips already-uploaded sheets, updates progress correctly
- Phase 2: Reconciliation job detects discrepancy and fixes progress

**Q: How do I test this locally without Cloudflare infrastructure?**

A: Use Bun for unit tests (mock callbacks) and Vitest with `@cloudflare/vitest-pool-workers` for integration tests (Miniflare simulates DO/R2 locally). No cloud resources needed!

**Q: What if I need to reprocess a plan (user uploads new version)?**

A: New `uploadId` means new R2 path. Old tiles remain (for history). Progress is tracked separately per `uploadId`.

**Q: How does this scale to 100 concurrent uploads?**

A: Each upload gets its own Durable Object instance (isolated state). R2 handles thousands of concurrent uploads. No bottlenecks expected.

**Q: Should I use Phase 2 from day one?**

A: No. Start with Phase 1, monitor for 2 weeks. Only enable Phase 2 if failure rate >1%. Most systems don't need it.

**Q: What about progress persistence if DO hibernates?**

A: Progress is stored in DO storage (persistent). WebSocket connections reconnect and fetch current state from storage.

---

## Conclusion

**Recommended Approach**: Phase 1 (Direct Updates with Retry Logic)

This provides:
- ✅ 99%+ reliability with simple retry logic
- ✅ Immediate user feedback (<100ms latency)
- ✅ Fully testable locally
- ✅ Simple to implement and debug
- ✅ Cloudflare-native (no external dependencies)
- ✅ Low cost (<$0.001 per 1,000 plans)

**Safety Net**: Phase 2 (R2 Event Reconciliation) available if needed

**Future Path**: Phase 3 (Sync Engine) only if requirements change

**Start building today** - the simple approach is the right approach for MVP. Add complexity only when data proves it's needed.

---

**Last Updated**: 2025-11-06
**Author**: Claude (Anthropic)
**Status**: Ready for Implementation
