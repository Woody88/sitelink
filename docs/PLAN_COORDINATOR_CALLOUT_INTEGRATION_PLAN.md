# PlanCoordinator → CalloutProcessor Integration Plan (TDD Approach)

**Created:** December 2025
**Status:** Planning
**Goal:** Wire PlanCoordinator to use the new sheet-marker-detection-queue and CalloutProcessor

---

## Problem Statement

The PlanCoordinator currently uses the OLD marker detection approach:
- Triggers `marker-detection-queue` after tiles complete
- Calls `PLAN_OCR_SERVICE` with base64-encoded tiles
- Chunks tiles into groups of 25

Per the design.drawio, it should use the NEW approach:
- Trigger `sheet-marker-detection-queue` per individual sheet
- Call `CALLOUT_PROCESSOR` with PDF binary directly
- Pass `X-Valid-Sheets` and `X-Sheet-Number` headers
- Process sheets in parallel (5-10 at a time per design)

---

## What's Already Done

1. ✅ `SheetMarkerDetectionJob` type defined in `src/core/queues/types.ts`
2. ✅ `sheetMarkerDetectionQueueConsumer()` function implemented in `src/core/queues/index.ts`
3. ✅ `CalloutProcessor` container bound in `wrangler.jsonc` as `CALLOUT_PROCESSOR`
4. ✅ `callout-processor` package with `/api/detect-markers` endpoint
5. ✅ PlanCoordinator queries D1 for validSheets

---

## What's Missing

1. ❌ `sheet-marker-detection-queue` not in wrangler.jsonc
2. ❌ Consumer not registered in index.ts queue handler
3. ❌ PlanCoordinator.triggerMarkerDetection() uses old queue
4. ❌ Integration tests for the full flow

---

## TDD Implementation Plan

### Phase 1: Infrastructure Setup (No Code Changes to Logic)

#### Task 1.1: Add Queue to wrangler.jsonc
**File:** `packages/backend/wrangler.jsonc`

Add to producers and consumers:
```jsonc
"queues": {
  "producers": [
    // ... existing ...
    "sheet-marker-detection-queue"
  ],
  "consumers": [
    // ... existing ...
    "sheet-marker-detection-queue"
  ]
}
```

Add binding:
```jsonc
"bindings": [
  // ... existing ...
  { "name": "SHEET_MARKER_DETECTION_QUEUE", "queue": "sheet-marker-detection-queue" }
]
```

#### Task 1.2: Add Queue Binding to Env Type
**File:** `packages/backend/src/types/env.ts` or `worker-configuration.d.ts`

```typescript
interface Env {
  // ... existing ...
  SHEET_MARKER_DETECTION_QUEUE: Queue<SheetMarkerDetectionJob>
}
```

#### Task 1.3: Register Consumer in Queue Handler
**File:** `packages/backend/src/index.ts`

```typescript
// In the queue handler switch statement:
case "sheet-marker-detection-queue":
  await sheetMarkerDetectionQueueConsumer(batch, env, ctx)
  break
```

---

### Phase 2: Unit Tests (Write Tests First)

#### Task 2.1: Test SheetMarkerDetectionJob Consumer
**File:** `packages/backend/tests/queues/sheet-marker-detection-consumer.test.ts`

```typescript
describe("sheetMarkerDetectionQueueConsumer", () => {
  it("should fetch PDF from R2 using sheetKey", async () => {
    // Mock env.SitelinkStorage.get()
    // Assert it was called with correct key
  })

  it("should call CALLOUT_PROCESSOR with correct headers", async () => {
    // Mock env.CALLOUT_PROCESSOR.getByName().fetch()
    // Assert headers: X-Valid-Sheets, X-Sheet-Number, Content-Type
  })

  it("should insert detected markers into plan_markers table", async () => {
    // Mock D1 insert
    // Assert correct values inserted
  })

  it("should notify PlanCoordinator on completion", async () => {
    // Mock PlanCoordinator.fetch("/marker-complete")
    // Assert called with correct uploadId and sheetNumber
  })

  it("should handle CALLOUT_PROCESSOR errors gracefully", async () => {
    // Mock 500 response
    // Assert proper error handling
  })
})
```

#### Task 2.2: Test PlanCoordinator Marker Triggering
**File:** `packages/backend/tests/durable-objects/plan-coordinator-markers.test.ts`

```typescript
describe("PlanCoordinator marker detection triggering", () => {
  it("should trigger sheet-marker-detection-queue after all tiles complete", async () => {
    // Setup: Complete all tiles
    // Assert: SHEET_MARKER_DETECTION_QUEUE.send() called for each sheet
  })

  it("should include validSheets from D1 query", async () => {
    // Mock D1 with sheets A1, A2, A5
    // Assert: validSheets = ["A1", "A2", "A5"]
  })

  it("should send one job per sheet (no chunking)", async () => {
    // Setup: 5 sheets
    // Assert: 5 queue.send() calls
  })

  it("should pass correct sheetKey (PDF path, not tile path)", async () => {
    // Assert: sheetKey is R2 path to sheet PDF
  })

  it("should set status to 'triggering_markers' during queue sends", async () => {
    // Assert state transitions
  })
})
```

#### Task 2.3: Test PlanCoordinator /marker-complete Endpoint
**File:** `packages/backend/tests/durable-objects/plan-coordinator-complete.test.ts`

```typescript
describe("PlanCoordinator /marker-complete", () => {
  it("should track completed markers by sheetNumber", async () => {
    // POST /marker-complete with sheetNumber
    // Assert state.completedMarkers includes sheetNumber
  })

  it("should transition to 'complete' when all markers done", async () => {
    // Complete all marker jobs
    // Assert state.status === "complete"
  })

  it("should be idempotent (same sheetNumber twice)", async () => {
    // POST twice with same sheetNumber
    // Assert only counted once
  })
})
```

---

### Phase 3: Implementation Changes

#### Task 3.1: Add completedMarkers to PlanCoordinatorState
**File:** `packages/backend/src/core/durable-objects/plan-coordinator.ts`

```typescript
interface PlanCoordinatorState {
  // ... existing ...
  completedMarkers: number[]  // NEW: Track marker detection completion per sheet
}
```

#### Task 3.2: Replace triggerMarkerDetection() Logic
**File:** `packages/backend/src/core/durable-objects/plan-coordinator.ts`

Replace the current chunked tile approach with per-sheet PDF approach:

```typescript
private async triggerMarkerDetection(): Promise<void> {
  const uploadId = this.state.uploadId

  // Query sheets with their sheet_key (PDF path) and validated sheet names
  const sheetsResult = await this.env.SitelinkDB.prepare(`
    SELECT
      ps.id,
      ps.sheet_number as sheetNumber,
      ps.sheet_name as sheetName,
      ps.sheet_key as sheetKey,
      ps.plan_id as planId,
      p.project_id as projectId,
      pr.organization_id as organizationId
    FROM plan_sheets ps
    JOIN plans p ON ps.plan_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE ps.upload_id = ?
    AND ps.metadata_status = 'extracted'
    ORDER BY ps.sheet_number ASC
  `).bind(uploadId).all()

  const sheets = sheetsResult.results as Sheet[]

  // Build validSheets list from sheet names matching pattern
  const sheetReferencePattern = /^[A-Z]\d+$/i
  const validSheets = sheets
    .filter(s => s.sheetName !== null)
    .map(s => s.sheetName as string)
    .filter(name => sheetReferencePattern.test(name))

  // Update status
  this.state.status = "triggering_markers"
  await this.state.storage.put("state", this.state)

  // Enqueue one job per sheet (no chunking)
  for (const sheet of sheets) {
    await this.env.SHEET_MARKER_DETECTION_QUEUE.send({
      uploadId,
      planId: sheet.planId,
      organizationId: sheet.organizationId,
      projectId: sheet.projectId,
      validSheets,
      sheetId: sheet.id,
      sheetNumber: sheet.sheetNumber,
      sheetKey: sheet.sheetKey,  // R2 path to sheet PDF
      totalSheets: sheets.length,
    } satisfies SheetMarkerDetectionJob)
  }

  this.state.status = "markers_in_progress"
  await this.state.storage.put("state", this.state)
}
```

#### Task 3.3: Add /marker-complete Endpoint
**File:** `packages/backend/src/core/durable-objects/plan-coordinator.ts`

```typescript
// In the fetch handler
case "/marker-complete": {
  const { sheetNumber } = await request.json()

  if (!this.state.completedMarkers.includes(sheetNumber)) {
    this.state.completedMarkers.push(sheetNumber)
    await this.state.storage.put("state", this.state)
  }

  if (this.state.completedMarkers.length === this.state.totalSheets) {
    this.state.status = "complete"
    await this.state.storage.put("state", this.state)
    console.log(`Plan ${this.state.uploadId} processing complete!`)
  }

  return new Response(JSON.stringify({
    completedMarkers: this.state.completedMarkers.length,
    totalSheets: this.state.totalSheets,
    status: this.state.status
  }))
}
```

#### Task 3.4: Update Consumer to Call PlanCoordinator
**File:** `packages/backend/src/core/queues/index.ts`

Ensure the existing `sheetMarkerDetectionQueueConsumer` notifies PlanCoordinator:

```typescript
// At the end of processSheetMarkerDetectionJob():

// Notify PlanCoordinator that this sheet's markers are done
const coordinatorId = env.PLAN_COORDINATOR.idFromName(job.uploadId)
const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)
await coordinator.fetch("http://coordinator/marker-complete", {
  method: "POST",
  body: JSON.stringify({ sheetNumber: job.sheetNumber })
})
```

---

### Phase 4: Integration Tests

#### Task 4.1: End-to-End Integration Test
**File:** `packages/backend/tests/integration/pdf-processing-flow.test.ts`

```typescript
describe("Full PDF Processing Flow", () => {
  it("should process PDF through all stages to marker detection", async () => {
    // 1. Upload PDF
    // 2. Wait for pdf-processing-queue
    // 3. Wait for metadata-extraction-queue
    // 4. Wait for tile-generation-queue
    // 5. Wait for sheet-marker-detection-queue
    // 6. Verify plan_markers table has entries
    // 7. Verify PlanCoordinator status is "complete"
  })
})
```

#### Task 4.2: Mock Container Integration Test
**File:** `packages/backend/tests/integration/callout-processor-integration.test.ts`

```typescript
describe("CalloutProcessor Integration", () => {
  it("should receive PDF binary with correct headers", async () => {
    // Setup mock CALLOUT_PROCESSOR
    // Trigger sheetMarkerDetectionQueueConsumer
    // Assert: Content-Type: application/pdf
    // Assert: X-Valid-Sheets header present
    // Assert: X-Sheet-Number header present
    // Assert: body is binary PDF (not base64)
  })

  it("should parse markers response and insert to D1", async () => {
    // Mock CALLOUT_PROCESSOR response
    // Assert D1 insert with correct bbox coordinates
  })
})
```

---

### Phase 5: Cleanup

#### Task 5.1: Remove Old Marker Detection Code (Optional)
- Remove or deprecate `marker-detection-queue` references if no longer needed
- Clean up `markerDetectionQueueConsumer` if fully replaced
- Update any status checks that reference old statuses

#### Task 5.2: Update Documentation
- Update design.drawio to reflect implementation
- Update any API documentation
- Add migration notes if applicable

---

## Execution Order

1. **Phase 1** (Infrastructure) - Required first, no tests needed
2. **Phase 2** (Unit Tests) - Write tests that will initially fail
3. **Phase 3** (Implementation) - Make tests pass
4. **Phase 4** (Integration Tests) - Verify full flow
5. **Phase 5** (Cleanup) - Optional refinements

---

## Files to Modify

| File | Changes |
|------|---------|
| `wrangler.jsonc` | Add queue, binding |
| `worker-configuration.d.ts` | Add queue type |
| `src/index.ts` | Register consumer |
| `src/core/durable-objects/plan-coordinator.ts` | New state, new endpoint, new trigger logic |
| `src/core/queues/index.ts` | Add PlanCoordinator callback |
| `tests/queues/sheet-marker-detection-consumer.test.ts` | New test file |
| `tests/durable-objects/plan-coordinator-markers.test.ts` | New test file |
| `tests/integration/callout-processor-integration.test.ts` | New test file |

---

## Success Criteria

1. ✅ `sheet-marker-detection-queue` configured and working
2. ✅ PlanCoordinator triggers new queue after tiles complete
3. ✅ Each sheet processed as individual job (no chunking)
4. ✅ CalloutProcessor receives PDF binary with correct headers
5. ✅ Markers saved to `plan_markers` table
6. ✅ PlanCoordinator transitions to "complete" after all markers done
7. ✅ All unit tests pass
8. ✅ Integration tests pass
