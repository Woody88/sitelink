# PDF Processing Testing Strategy

## Critical Analysis: Testing Distributed Systems

This document outlines the testing strategy for the PDF processing pipeline after critical evaluation of the "Contract Tests + Minimal Integration" approach.

---

## Architecture Overview

We have a 3-component distributed system:

```
1. Plan Service (Cloudflare Worker)
   - Creates plan in DB
   - Uploads PDF to R2
   - Kicks off processing job

2. Processing Manager (Durable Object)
   - Manages job state (pending → processing → complete)
   - Communicates with container via WebSocket
   - Provides progress updates via HTTP/WebSocket
   - Handles retries and failure tracking

3. PDF Processor (Container)
   - Downloads PDF from R2
   - Processes pages with vips
   - Uploads tiles to R2
   - Reports progress back to DO
```

---

## Fatal Flaws of "Contract Tests Only" Approach

### Flaw #1: Durable Objects Are NOT Unit-Testable

**The Problem:**
- Durable Objects have **persistent state** backed by Cloudflare's distributed storage
- The `ctx.storage` API behavior in local tests **≠** production behavior
- `ctx.blockConcurrencyWhile`, hibernation, alarm scheduling - these are **runtime-specific**
- You **cannot mock** the Durable Object runtime meaningfully

**Why "unit tests" are worthless:**
```typescript
// This test is nearly worthless:
it("should update progress", async () => {
  const stub = env.SITELINK_PDF_PROCESSOR.get(id)
  await stub.updateProgress({ completedPages: 1 })
  const progress = await stub.getProgress()
  expect(progress.completedPages).toBe(1)
})
```

**Why it's worthless:**
- Doesn't test persistence across DO instances
- Doesn't test concurrent access (the whole point of DOs)
- Doesn't test what happens when DO hibernates
- Doesn't test network failures between Worker → DO → Container

---

### Flaw #2: Cloudflare Containers Are Not Docker

**The Problem:**
- Cloudflare Containers use **gVisor** sandboxing, not Docker
- Networking between DO ↔ Container uses **Cloudflare's internal routing**
- `ctx.container.getTcpPort()` behavior cannot be replicated locally
- WebSocket connections between DO and Container have **specific Cloudflare semantics**

**What this means:**
- Testing `main.ts` locally with Bun doesn't prove it works in Cloudflare's container runtime
- The WebSocket handshake might work locally but fail in production
- Memory limits, CPU throttling, cold starts - all different in Cloudflare's environment

---

### Flaw #3: Contract Tests Don't Capture The Hard Parts

Contract tests verify **data shapes**, but the hard problems in distributed systems are:

**1. Timing/Race Conditions:**
- What if Plan Service creates plan, but DO initialization fails?
- What if Container finishes processing but callback to DO times out?
- What if DO hibernates mid-processing and loses WebSocket connection?

**2. Partial Failures:**
- R2 upload succeeds, but DB insert fails
- Container processes page 3/5, then crashes
- DO crashes after receiving "page complete" but before persisting state

**3. Network Partitions:**
- Worker → DO connection drops
- DO → Container connection drops
- Container → R2 upload fails intermittently

**Contract tests catch NONE of these.**

---

### Flaw #4: "Skip Integration Tests Initially" is Backwards

**Why this is wrong:**
1. You don't know if the architecture even **works** until you test it end-to-end
2. The Durable Object + Container integration is **novel** - no one has written this exact setup before
3. You might discover the architecture is fundamentally broken
4. By the time you discover this, you've already invested in contract tests for the **wrong abstractions**

---

## Concrete Failure Scenarios

### Scenario 1: DO Initialization Race Condition
```typescript
// Plan Service does:
await stub.initialize(job)  // Returns immediately

// But DO is still starting up...
// Container tries to connect → fails because DO not ready
```
Your contract test would pass. Production would fail.

### Scenario 2: Container Cold Start
```typescript
// First request to DO → Container
// Container takes 5 seconds to cold start
// DO's WebSocket connection times out
```
Your contract test (with instant responses) would pass. Production would fail.

### Scenario 3: R2 Eventual Consistency
```typescript
// Worker uploads PDF to R2
// Immediately tells DO to start processing
// Container tries to download PDF → 404 (eventual consistency delay)
```
Your contract test (with mocked R2) would pass. Production would fail.

---

## Correct Testing Strategy: Integration-First

### Phase 1: Build Minimal Integration Test FIRST ⭐

**This is the MOST IMPORTANT test - write it first:**

```typescript
describe("PDF Processing - Smoke Test", () => {
  it("should process a 1-page PDF end-to-end in Cloudflare runtime", async () => {
    // Use Cloudflare's test environment (Vitest with @cloudflare/vitest-pool-workers)

    // 1. Create plan with real 1-page PDF
    const { planId, uploadId } = await createPlan({
      file: await loadSamplePDF(), // Real PDF
      name: "Smoke Test Plan"
    })

    // 2. Verify job was kicked off
    const jobId = `job-${uploadId}`
    const stub = env.SITELINK_PDF_PROCESSOR.get(
      env.SITELINK_PDF_PROCESSOR.idFromName(jobId)
    )

    // 3. Wait for processing (with timeout)
    await waitFor(async () => {
      const progress = await stub.getProgress()
      return progress.status === 'complete'
    }, { timeout: 30000, interval: 1000 })

    // 4. Verify tiles exist in R2
    const dziPath = `/plans/${planId}/sheets/sheet-1/tiles/sheet-1.dzi`
    const dziObject = await env.SitelinkStorage.get(dziPath)
    expect(dziObject).not.toBeNull()

    // 5. Verify database updated
    const plan = await db.select().from(plans).where(eq(plans.id, planId))
    expect(plan.processingStatus).toBe('complete')
  })
})
```

**Why this is valuable:**
- ✅ Proves the architecture actually works in Cloudflare's runtime
- ✅ Catches DO + Container integration issues early
- ✅ Validates R2 eventual consistency isn't a problem
- ✅ Tests real WebSocket communication between DO and Container
- ✅ Can be run in CI with `wrangler dev` or Cloudflare's test environment

**Yes, it's slow (30 seconds).** But it's **ONE test** that gives you confidence the whole system works.

---

### Phase 2: Add Fast Behavior Tests

Once you know integration works, add fast tests for **business logic**:

```typescript
describe("Processing Manager - State Transitions", () => {
  it("should transition from pending → processing → complete", async () => {
    const stub = env.SITELINK_PDF_PROCESSOR.get(id)
    await stub.initialize(job)

    await stub.updateProgress({ status: 'processing', totalPages: 3 })
    await stub.markPageComplete(0, 3)
    await stub.markPageComplete(1, 3)
    await stub.markPageComplete(2, 3)

    const final = await stub.getProgress()
    expect(final.status).toBe('complete')
  })
})
```

---

### Phase 3: Add Failure Scenario Tests

```typescript
it("should mark job as partial_failure when some pages fail", async () => {
  const stub = env.SITELINK_PDF_PROCESSOR.get(id)
  await stub.initialize(job)

  await stub.markPageComplete(0, 3)
  await stub.markPageFailed(1, "vips error: corrupt page")
  await stub.markPageComplete(2, 3)

  const final = await stub.getProgress()
  expect(final.status).toBe('partial_failure')
  expect(final.failedPages).toContain(1)
  expect(final.completedPages).toBe(2)
})

it("should retry failed pages up to 3 times", async () => {
  // Test retry logic
})

it("should handle container crash mid-processing", async () => {
  // Test recovery from container failure
})
```

---

## Testing Checklist

### Required for MVP:

- [ ] **Phase 1: Integration Test** - End-to-end smoke test (MUST DO FIRST)
- [ ] **Phase 2: State Management** - DO state transitions work correctly
- [ ] **Phase 3: Failure Handling** - Pages can fail, jobs can partially complete

### Nice to Have:

- [ ] WebSocket connection tests
- [ ] Progress update broadcast tests
- [ ] Container cold start handling
- [ ] R2 eventual consistency handling
- [ ] Concurrent job processing

---

## Key Principles

1. **Integration test comes FIRST** - Don't write unit tests until you know the architecture works
2. **Test in Cloudflare's runtime** - Don't rely on local mocks for DO/Container behavior
3. **Test failure modes** - The hard part isn't the happy path, it's handling failures
4. **One slow test is fine** - Better than dozens of fast tests that don't catch real issues

---

## Setup Requirements for Integration Test

The integration test must follow the same setup pattern as plan tests:

```typescript
it("should process PDF end-to-end", async () => {
  // ✅ 1. Create authenticated user with session
  const { sessionCookie, authClient } = await createAuthenticatedUser(
    "pdf-processing-test@example.com"
  )

  // ✅ 2. Create organization with subscription
  const { organizationId } = await createOrgWithSubscription(
    authClient,
    "Processing Test Org"
  )

  // ✅ 3. Set active organization (important for permissions)
  await authClient.organization.setActive({ organizationId })

  // ✅ 4. Create project
  const projectId = await createProject(
    sessionCookie,
    organizationId,
    "Processing Test Project"
  )

  // ✅ 5. Create plan with PDF - this triggers processing
  // ... rest of test
})
```

**Why all these steps are necessary:**
- Authorization middleware requires valid session
- Requires active organization
- Validates organization membership
- Validates project ownership

All helper functions are available in `test/helpers/setup.ts`.

---

## Implementation Order

1. **First:** Write the integration test (even if it fails)
2. **Second:** Implement Durable Object methods to make it pass
3. **Third:** Implement container processing
4. **Fourth:** Add behavior tests for edge cases
5. **Last:** Add performance optimizations

**Don't reverse this order.** You need to know the architecture works before optimizing it.

---

## Common Mistakes to Avoid

❌ **Don't:** Mock Durable Object storage
❌ **Don't:** Test container locally with Bun
❌ **Don't:** Skip the integration test because it's "too slow"
❌ **Don't:** Write dozens of unit tests before proving integration works
❌ **Don't:** Assume WebSocket communication works the same locally

✅ **Do:** Test in Cloudflare's runtime from day one
✅ **Do:** Use real R2, real DOs, real containers
✅ **Do:** Start with one slow integration test
✅ **Do:** Add fast tests for business logic after
✅ **Do:** Test failure scenarios explicitly

---

## Conclusion

For distributed systems with Durable Objects and Containers:

**You need BOTH:**
1. **One integration test** (slow, but essential) - Run in CI, catches architecture problems
2. **Many behavior tests** (fast) - Test state transitions, edge cases, business logic

**Start with #1.** If you can't make the integration test pass, your architecture is broken and unit tests won't save you.

**Then add #2** for fast feedback on logic changes.

This is harder upfront, but you'll discover integration problems early instead of after building a test suite for the wrong abstractions.

---

## Special Case: PDF Processing with Cloudflare Containers

### Architecture Overview

The PDF processing system uses a multi-layered architecture with Cloudflare Containers:

```
Upload API (Worker)
    ↓
Durable Object (State Management + Alarm)
    ↓ alarm() triggers container
Cloudflare Container (vips processing)
    ↓ WebSocket messages
Durable Object (Progress updates)
    ↓ WebSocket broadcast
Clients (Real-time UI updates)
```

### Critical Testing Constraints

**Container Availability:**
- ✅ Available in: `wrangler dev`, Preview, Production
- ❌ NOT available in: Vitest test environment
- `ctx.container` is `undefined` in vitest

**WebSocket Testing Limitations:**
- **DO ↔ Container WebSocket**: Requires `ctx.container` → Cannot test in vitest
- **DO ↔ Client WebSocket**: Requires `isolatedStorage: false` → Can test but not useful for our architecture
- **Full WebSocket flow**: Requires real container → Only testable with `wrangler dev` or deployed

### Three-Phase Testing Strategy

#### ✅ Phase 1: Durable Object State Management (COMPLETED)

**Status:** ✅ Implemented and passing

**What:** Test DO storage, state transitions, and alarm logic
**Tool:** Vitest with `isolatedStorage: true`
**Location:** `test/integration/processing.test.ts`

```typescript
// Example: What Phase 1 tests validate
it("should initialize job in pending state", async () => {
    const { jobId, planId } = await createPlan(...)

    const stub = env.SITELINK_PDF_PROCESSOR.get(
        env.SITELINK_PDF_PROCESSOR.idFromName(jobId)
    )

    const progress = await stub.getProgress(jobId)
    expect(progress).toBeDefined()
    expect(progress.status).toBe("pending")
})

it("should manually trigger alarm to test state transitions", async () => {
    const stub = getDOStub()
    await stub.initialize(job)

    // Manually call alarm (bypasses container, updates status)
    await stub.alarm()

    const progress = await stub.getProgress(jobId)
    expect(progress.status).toBe("processing") // Mock without container
})

it("should track page completion", async () => {
    const stub = getDOStub()
    await stub.initialize(job)

    // Simulate what container would do
    await stub.markPageComplete(jobId, 0, 3)
    await stub.markPageComplete(jobId, 1, 3)
    await stub.markPageComplete(jobId, 2, 3)

    const progress = await stub.getProgress(jobId)
    expect(progress.status).toBe("complete")
    expect(progress.completedPages).toBe(3)
})
```

**What Phase 1 Validates:**
- ✅ Job initialization in DO storage
- ✅ State transitions (pending → processing → complete → failed)
- ✅ Progress tracking methods (`markPageComplete`, `markPageFailed`, `updateProgress`)
- ✅ Alarm handler logic (without actual container)
- ✅ Error state handling (partial_failure when pages fail)
- ✅ Upload → R2 → DO → Job creation flow

**What Phase 1 Does NOT Test:**
- ❌ Container startup (`ctx.container.start()`)
- ❌ WebSocket communication with container
- ❌ Actual PDF processing with vips
- ❌ Alarm→Container→WebSocket→DO message flow

**Key Implementation Detail:**
```typescript
// src/core/pdf-manager/index.ts
constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    // Container is optional - allows testing without container
    if (ctx.container !== undefined) {
        this.container = ctx.container
        // Start and monitor container in production
    }
}

override async alarm(): Promise<void> {
    const jobs = await this.ctx.storage.list<ProcessingJobState>()

    for (const [jobId, progress] of jobs) {
        if (progress.status === "pending") {
            if (this.container) {
                // Production: Start container processing
                await this.processPDF(progress)
            } else {
                // Test: Just update status without container
                await this.updateProgress(jobId, {
                    status: "processing",
                    totalPages: 3, // Mock value
                })
            }
        }
    }
}
```

---

#### 📦 Phase 2: Container PDF Processing (TODO)

**Status:** ⏳ Not yet implemented

**What:** Test vips PDF processing logic in isolation
**Tool:** Bun test with Docker/vips installed
**Location:** `packages/processing/test/processor.test.ts`

```typescript
// Phase 2: Test vips processing independently
import { describe, it, expect } from "bun:test"
import { $ } from "bun"
import { processPage, getPDFPageCount } from "../src/processor"

describe("PDF Processing with vips", () => {
    it("should convert PDF page to DZI tiles", async () => {
        const pdfPath = "./test/fixtures/sample-plan.pdf"
        const outputDir = "/tmp/test-output"

        // Run vips dzsave command
        await processPage({
            pdfPath,
            pageNum: 0,
            outputDir,
            dpi: 300,
            tileSize: 256,
            overlap: 1
        })

        // Verify DZI metadata file exists
        const dziExists = await Bun.file(`${outputDir}/sheet-1.dzi`).exists()
        expect(dziExists).toBe(true)

        // Verify tiles directory structure
        const tilesDir = await Bun.file(`${outputDir}/sheet-1_files`).exists()
        expect(tilesDir).toBe(true)

        // Verify zoom level 0 base tile
        const baseTile = await Bun.file(`${outputDir}/sheet-1_files/0/0_0.jpg`).exists()
        expect(baseTile).toBe(true)

        // Verify DZI XML structure
        const dziContent = await Bun.file(`${outputDir}/sheet-1.dzi`).text()
        expect(dziContent).toContain('TileSize="256"')
        expect(dziContent).toContain('Overlap="1"')
    })

    it("should handle multi-page PDF", async () => {
        const pdfPath = "./test/fixtures/multi-page.pdf"
        const pageCount = await getPDFPageCount(pdfPath)

        expect(pageCount).toBeGreaterThan(1)

        // Process each page
        for (let i = 0; i < pageCount; i++) {
            await processPage({
                pdfPath,
                pageNum: i,
                outputDir: `/tmp/page-${i}`
            })

            const dziExists = await Bun.file(`/tmp/page-${i}/sheet-${i+1}.dzi`).exists()
            expect(dziExists).toBe(true)
        }
    })

    it("should handle corrupt PDF gracefully", async () => {
        await expect(
            processPage({
                pdfPath: "./test/fixtures/corrupt.pdf",
                pageNum: 0,
                outputDir: "/tmp/output"
            })
        ).toReject()
    })

    it("should respect DPI settings", async () => {
        await processPage({
            pdfPath: "./test/fixtures/sample-plan.pdf",
            pageNum: 0,
            outputDir: "/tmp/high-dpi",
            dpi: 600 // High resolution
        })

        // Higher DPI should produce larger tiles/more zoom levels
        const dziContent = await Bun.file("/tmp/high-dpi/sheet-1.dzi").text()
        // Verify dimensions are larger
    })

    it("should upload tiles to R2", async () => {
        const outputDir = "/tmp/test-tiles"
        await processPage({
            pdfPath: "./test/fixtures/sample-plan.pdf",
            pageNum: 0,
            outputDir
        })

        // Upload to R2 (or mock R2)
        await uploadDirectoryToR2(outputDir, "test-plan/tiles")

        // Verify tiles exist in R2
        const dziInR2 = await checkR2Object("test-plan/tiles/sheet-1.dzi")
        expect(dziInR2).toBe(true)
    })
})
```

**What Phase 2 Should Validate:**
- ✅ vips command execution and error handling
- ✅ DZI format generation (XML metadata)
- ✅ Tile pyramid structure at multiple zoom levels
- ✅ Multi-page PDF handling
- ✅ Error handling for corrupt/invalid PDFs
- ✅ Configuration options (DPI, tile size, overlap)
- ✅ R2 upload of generated tiles
- ✅ Cleanup of temporary files

**What Phase 2 Does NOT Test:**
- ❌ DO ↔ Container communication
- ❌ WebSocket progress updates
- ❌ Alarm triggering
- ❌ End-to-end job flow

**Prerequisites for Phase 2:**
- Docker or libvips installed locally
- Sample PDF fixtures in `packages/processing/test/fixtures/`
- R2 mock or actual R2 bucket for upload tests

---

#### 🌐 Phase 3: End-to-End Integration (TODO)

**Status:** ⏳ Not yet implemented

**What:** Test complete flow with real container + DO + WebSocket
**Tool:** `wrangler dev` (local) or Preview environment (deployed)
**Location:** `test/e2e/full-flow.test.ts`

**Option A: Local Integration with `wrangler dev`**

```bash
# Terminal 1: Start local development environment
npx wrangler dev
# Containers will start via Docker locally

# Terminal 2: Run E2E tests
bun run test:e2e
```

```typescript
// test/e2e/local-integration.test.ts
import { describe, it, expect } from "bun:test"

describe("Full PDF Processing Flow (wrangler dev)", () => {
    const BASE_URL = "http://localhost:8787"

    it("should process PDF end-to-end with real container", async () => {
        // 1. Setup: Create authenticated user + org + project
        const { sessionCookie, projectId } = await setupTestProject()

        // 2. Upload PDF plan
        const pdfData = await loadSamplePDF()
        const formData = new FormData()
        formData.append("file", new Blob([pdfData]), "test-plan.pdf")
        formData.append("name", "Integration Test Plan")

        const uploadRes = await fetch(
            `${BASE_URL}/api/projects/${projectId}/plans`,
            {
                method: "POST",
                headers: { cookie: sessionCookie },
                body: formData
            }
        )

        expect(uploadRes.ok).toBe(true)
        const { jobId, planId, uploadId } = await uploadRes.json()

        // 3. Wait for processing to complete
        // This tests: alarm → container → vips → WebSocket → DO updates
        let finalProgress
        await waitFor(async () => {
            const statusRes = await fetch(
                `${BASE_URL}/api/processing/jobs/${jobId}/progress`
            )
            finalProgress = await statusRes.json()

            console.log(
                `Processing: ${finalProgress.completedPages || 0}/${finalProgress.totalPages || "?"} pages`
            )

            return finalProgress.status === "complete"
        }, {
            timeout: 120000,  // 2 minutes for multi-page PDF
            interval: 2000     // Check every 2 seconds
        })

        // 4. Verify final state
        expect(finalProgress.status).toBe("complete")
        expect(finalProgress.completedPages).toBeGreaterThan(0)
        expect(finalProgress.totalPages).toBeGreaterThan(0)
        expect(finalProgress.completedPages).toBe(finalProgress.totalPages)

        // 5. Verify tiles exist in R2 (requires R2 binding access)
        // Note: In wrangler dev, R2 is local storage
        // This validates container uploaded tiles successfully

        // 6. Verify database was updated
        const planRes = await fetch(
            `${BASE_URL}/api/plans/${planId}`,
            { headers: { cookie: sessionCookie } }
        )
        const plan = await planRes.json()
        expect(plan.processingStatus).toBe("complete")
    }, 180000) // 3 minute timeout

    it("should handle WebSocket progress subscriptions", async () => {
        // Test real-time progress updates via WebSocket
        const ws = new WebSocket(`ws://localhost:8787/ws/jobs/${jobId}`)

        const messages = []
        ws.on("message", (data) => {
            messages.push(JSON.parse(data))
        })

        ws.on("open", () => {
            ws.send(JSON.stringify({ type: "subscribe" }))
        })

        // Trigger job processing
        await triggerJobProcessing(jobId)

        // Wait for completion
        await waitFor(() =>
            messages.some(m => m.data.status === "complete"),
            { timeout: 120000 }
        )

        // Verify we received progress updates
        expect(messages.length).toBeGreaterThan(0)
        expect(messages.some(m => m.type === "progress_update")).toBe(true)
    })
})
```

**Option B: Preview Environment Testing**

```typescript
// test/e2e/preview-deployment.test.ts
describe("Full PDF Processing (Preview)", () => {
    const PREVIEW_URL = process.env.PREVIEW_URL // From CI/CD

    it("should process PDF in deployed preview environment", async () => {
        // Same test as local but against deployed preview
        // Uses real Cloudflare infrastructure
        // Can verify actual R2 buckets, databases, etc.
    })
})
```

**What Phase 3 Should Validate:**
- ✅ Upload → R2 storage
- ✅ DO job initialization
- ✅ Alarm triggers after 1 second
- ✅ Container receives job via WebSocket
- ✅ Container processes PDF with vips
- ✅ Container sends progress updates to DO (`page_complete`, `page_failed`)
- ✅ DO updates internal state
- ✅ DO broadcasts progress to connected clients
- ✅ Tiles uploaded to R2 with correct paths
- ✅ Job marked complete in DO storage
- ✅ Database updated with processing status
- ✅ Error handling for container crashes
- ✅ WebSocket reconnection/resilience

**Phase 3 Prerequisites:**
- Docker installed (for `wrangler dev`)
- Preview environment configured (for deployed tests)
- R2 bucket available
- Database migrations applied

---

### Testing Matrix Summary

| Phase | Status | What | Tool | Container | WebSocket | isolatedStorage | Speed |
|-------|--------|------|------|-----------|-----------|-----------------|-------|
| **Phase 1** | ✅ Done | DO state | Vitest | ❌ | ❌ | ✅ true | Fast (ms) |
| **Phase 2** | ⏳ TODO | vips processing | Bun test | ✅ Local | ❌ | N/A | Medium (sec) |
| **Phase 3** | ⏳ TODO | Full E2E | wrangler/Preview | ✅ Real | ✅ | N/A | Slow (min) |

### Development Workflow

```bash
# 1. Fast feedback loop - Business logic & state management
bun run vitest test/integration/processing.test.ts  # Phase 1 (DONE)

# 2. Container processing verification
cd packages/processing
bun test test/processor.test.ts                     # Phase 2 (TODO)

# 3. Full integration testing (when ready)
npx wrangler dev &                                  # Start local env
bun run test:e2e                                    # Phase 3 local

# 4. Pre-deployment verification
wrangler deploy --env preview                       # Deploy preview
bun run test:preview                                # Phase 3 preview
```

### Why This Three-Phase Strategy?

1. **Fast feedback** - Phase 1 runs in milliseconds, catches most bugs
2. **Isolated concerns** - Each phase tests one architectural layer
3. **Progressive confidence** - Build from foundation (state) → processing → integration
4. **Cost effective** - No preview deployments until Phase 3
5. **TDD friendly** - Can build container logic guided by Phase 2 tests
6. **Pragmatic** - Acknowledges Vitest's container limitations

### Key Design Decisions

**Optional Container Pattern:**
```typescript
// Allows DO to work in both test and production
if (ctx.container !== undefined) {
    this.container = ctx.container
    // Production: start and monitor container
}
```

**Alarm-Based Triggering:**
- Jobs start in "pending" state
- Alarm fires after 1 second
- Alarm checks for pending jobs and starts container
- Provides automatic retry via Cloudflare's alarm retry mechanism

**WebSocket Hibernation:**
- DO can hibernate while WebSocket stays open (zero cost)
- Container sends messages → wakes DO → updates progress
- No polling needed, efficient and cost-effective

### Anti-Patterns to Avoid

❌ **Trying to mock `ctx.container` in Vitest** - Won't work, not supported
❌ **Complex WebSocket mocking** - Test state management instead
❌ **Skipping Phase 2** - Need confidence in vips processing before E2E
❌ **Over-relying on E2E only** - Expensive and slow, use for critical paths
❌ **Testing implementation details** - Focus on behavior and state transitions

### Next Steps

1. ✅ **Phase 1 Complete** - DO state management tested
2. ⏳ **Phase 2 Next** - Implement container processing with vips tests
3. ⏳ **Phase 3 Later** - E2E integration once Phase 2 is solid

---

## General Testing Principles (All Projects)

### Key Takeaways

1. **Health services are integration concerns** - test them with real dependencies
2. **Service structure ≠ testing strategy** - organize by architectural patterns, test by purpose
3. **Focus unit tests on business logic** - calculations, validations, transformations
4. **Focus integration tests on boundaries** - HTTP, database, external systems
5. **Avoid redundant coverage** - don't test the same logic at multiple levels
6. **Choose tools appropriately** - bun test for units, vitest for CF Workers integration
7. **Containers need special handling** - Use three-phase strategy for container-based features

The goal is fast feedback for business logic changes and comprehensive verification of system integration, without redundant test coverage.
