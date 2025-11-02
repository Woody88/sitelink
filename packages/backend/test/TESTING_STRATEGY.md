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
