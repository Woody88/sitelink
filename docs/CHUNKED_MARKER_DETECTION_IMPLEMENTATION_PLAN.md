# Chunked Marker Detection Implementation Plan

## Problem Summary

Marker detection times out during Stage 2 LLM validation due to synchronous sequential processing of ~59 batches taking ~177 seconds for 118 tiles. Total processing time (~189s) is too close to the 5-minute timeout limit.

## Solution: Chunked Queue Processing

**Consensus Recommendation**: Approach 3 - Chunked Queue Processing
- **Gemini 2.5 Pro**: 9/10 confidence
- **Grok-4**: 8/10 confidence

Split 118 tiles into chunks of 25, process each chunk as a separate queue job. Each chunk processes in ~30-40s (well under 5-min limit), and chunks execute in parallel for ~40s total wall-clock time.

---

## Implementation Phases

### Phase 1: Queue Message Type Updates (30 min)

**File**: `packages/backend/src/core/queues/types.ts`

```typescript
export interface MarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]
  // NEW: Chunking metadata
  isChunked?: boolean
  chunkIndex?: number
  totalChunks?: number
  tileKeys?: string[]  // Specific tiles for this chunk
  chunkId?: string     // Unique ID for deduplication
}
```

**Changes**:
- Add optional chunking metadata fields
- Backward compatible (all fields optional)

---

### Phase 2: PlanCoordinator Chunking Logic (2-3 hours)

**File**: `packages/backend/src/core/durable-objects/plan-coordinator.ts`

**Changes**:
1. Add `chunkArray()` helper method
2. Modify `triggerMarkerDetection()` to split large jobs
3. Add `CHUNK_SIZE = 25` constant
4. Generate unique `chunkId` per job
5. Enqueue multiple chunks for large jobs

**Implementation**:

```typescript
private chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

async triggerMarkerDetection(): Promise<void> {
  // List all tiles from R2
  const tilePrefix = `organizations/${this.organizationId}/projects/${this.projectId}/plans/${this.planId}/sheets/`
  const tileList = await this.env.SitelinkStorage.list({ prefix: tilePrefix })
  const tileKeys = tileList.objects
    .filter(obj => obj.key.endsWith('.jpg'))
    .map(obj => obj.key)

  const CHUNK_SIZE = 25

  if (tileKeys.length <= CHUNK_SIZE) {
    // Small job: process directly without chunking
    await this.env.MARKER_DETECTION_QUEUE.send({
      uploadId: this.uploadId,
      planId: this.planId,
      organizationId: this.organizationId,
      projectId: this.projectId,
      validSheets: this.validSheets,
      isChunked: false
    })
    console.log(`[PLAN COORDINATOR] Enqueued marker detection (${tileKeys.length} tiles, non-chunked)`)
  } else {
    // Large job: split into chunks
    const chunks = this.chunkArray(tileKeys, CHUNK_SIZE)
    const chunkId = crypto.randomUUID()

    for (let i = 0; i < chunks.length; i++) {
      await this.env.MARKER_DETECTION_QUEUE.send({
        uploadId: this.uploadId,
        planId: this.planId,
        organizationId: this.organizationId,
        projectId: this.projectId,
        validSheets: this.validSheets,
        isChunked: true,
        chunkIndex: i,
        totalChunks: chunks.length,
        tileKeys: chunks[i],
        chunkId
      })
    }

    console.log(`[PLAN COORDINATOR] Enqueued ${chunks.length} marker detection chunks (${tileKeys.length} tiles total)`)
  }
}
```

---

### Phase 3: Queue Consumer Updates (2-3 hours)

**File**: `packages/backend/src/core/queues/index.ts`

**Changes**:
1. Add chunked vs non-chunked processing logic
2. Implement `generateTarForTiles()` for specific tile subset
3. Add chunk metadata to container request headers
4. Update logging to show chunk progress

**Implementation**:

```typescript
// Helper function to generate tar for specific tiles
async function generateTarForTiles(
  tileKeys: string[],
  organizationId: string,
  projectId: string,
  planId: string,
  env: Env
): Promise<ReadableStream> {
  // Get PlanCoordinator DO instance
  const coordinatorId = env.PLAN_COORDINATOR.idFromName(planId)
  const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)

  // Request tar generation for specific tiles
  const response = await coordinator.fetch("http://localhost/generate-chunk-tar", {
    method: "POST",
    headers: {
      "X-Organization-Id": organizationId,
      "X-Project-Id": projectId,
      "X-Plan-Id": planId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ tileKeys })
  })

  if (!response.ok) {
    throw new Error(`Failed to generate tar for chunk: ${response.statusText}`)
  }

  return response.body!
}

// Marker detection queue consumer
async function handleMarkerDetection(
  batch: MessageBatch<MarkerDetectionJob>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body

    try {
      if (job.isChunked) {
        console.log(`🎯 [MARKERS] Processing chunk ${job.chunkIndex! + 1}/${job.totalChunks} (${job.tileKeys!.length} tiles)`)

        // Generate tar for ONLY this chunk's tiles
        const tarStream = await generateTarForTiles(
          job.tileKeys!,
          job.organizationId,
          job.projectId,
          job.planId,
          env
        )

        // Send to container
        const container = env.PLAN_OCR_SERVICE.getByName(job.planId)
        const response = await container.fetch("http://localhost/api/detect-markers", {
          method: "POST",
          body: tarStream,
          headers: {
            "Content-Type": "application/x-tar",
            "X-Organization-Id": job.organizationId,
            "X-Project-Id": job.projectId,
            "X-Plan-Id": job.planId,
            "X-Chunk-Id": job.chunkId!,
            "X-Chunk-Index": job.chunkIndex!.toString()
          },
          signal: AbortSignal.timeout(5 * 60 * 1000) // 5 minute timeout
        })

        if (!response.ok) {
          throw new Error(`Container returned ${response.status}: ${await response.text()}`)
        }

        const result = await response.json<MarkerDetectionResponse>()

        // Insert markers with deduplication
        await insertMarkersWithDeduplication(result.markers, job.chunkId!, env)

        console.log(`✅ [MARKERS] Chunk ${job.chunkIndex! + 1}/${job.totalChunks} complete: ${result.markers.length} markers`)

        message.ack()
      } else {
        // Non-chunked processing (existing logic for small jobs)
        console.log(`🎯 [MARKERS] Detecting markers for plan ${job.planId} (non-chunked)`)

        // Use existing tar generation from PlanCoordinator
        const coordinatorId = env.PLAN_COORDINATOR.idFromName(job.planId)
        const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)

        const tarResponse = await coordinator.fetch("http://localhost/generate-marker-tar", {
          method: "POST",
          headers: {
            "X-Organization-Id": job.organizationId,
            "X-Project-Id": job.projectId,
            "X-Plan-Id": job.planId
          }
        })

        if (!tarResponse.ok) {
          throw new Error(`Failed to generate tar: ${tarResponse.statusText}`)
        }

        const container = env.PLAN_OCR_SERVICE.getByName(job.planId)
        const response = await container.fetch("http://localhost/api/detect-markers", {
          method: "POST",
          body: tarResponse.body,
          headers: {
            "Content-Type": "application/x-tar",
            "X-Organization-Id": job.organizationId,
            "X-Project-Id": job.projectId,
            "X-Plan-Id": job.planId
          },
          signal: AbortSignal.timeout(5 * 60 * 1000)
        })

        if (!response.ok) {
          throw new Error(`Container returned ${response.status}: ${await response.text()}`)
        }

        const result = await response.json<MarkerDetectionResponse>()

        // Insert markers (no deduplication needed for non-chunked)
        for (const marker of result.markers) {
          await env.SitelinkDB.insert(planMarkers).values(marker)
        }

        console.log(`✅ [MARKERS] Non-chunked processing complete: ${result.markers.length} markers`)

        message.ack()
      }
    } catch (error) {
      console.error(`❌ [MARKERS] Error processing marker detection:`, error)
      message.retry()
    }
  }
}
```

---

### Phase 4: PlanCoordinator Chunk Tar Generation (1-2 hours)

**File**: `packages/backend/src/core/durable-objects/plan-coordinator.ts`

**Add new method** to generate tar for specific tile subset:

```typescript
/**
 * Generate tar stream for specific tiles (chunk processing)
 */
async generateChunkTar(request: Request): Promise<Response> {
  console.log(`[PLAN COORDINATOR] Generating chunk tar`)

  const organizationId = request.headers.get("X-Organization-Id")
  const projectId = request.headers.get("X-Project-Id")
  const planId = request.headers.get("X-Plan-Id")

  // Get tile keys from request body
  const { tileKeys } = await request.json<{ tileKeys: string[] }>()

  console.log(`[PLAN COORDINATOR] Generating tar for ${tileKeys.length} tiles`)

  // Pre-compute relative paths
  const tileMetadata = tileKeys.map(tileKey => {
    const keyParts = tileKey.split('/')
    const sheetIndex = keyParts.findIndex(part => part.startsWith('sheet-'))
    const relativePath = keyParts.slice(sheetIndex + 1).join('/')
    return { key: tileKey, relativePath }
  })

  // Generate tar buffer sequentially (single-threaded = no race condition)
  const tarBuffer = await this.generateTarBuffer(tileMetadata, this.env)

  console.log(`[PLAN COORDINATOR] Chunk tar generated: ${tarBuffer.length} bytes`)

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

// Update fetch method to handle new route
async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url)

  // ... existing routes ...

  if (url.pathname === "/generate-chunk-tar" && request.method === "POST") {
    return this.generateChunkTar(request)
  }

  // ... rest of routes ...
}
```

---

### Phase 5: Database Deduplication (1-2 hours)

**File**: `packages/backend/src/core/queues/index.ts` (add helper function)

```typescript
async function insertMarkersWithDeduplication(
  markers: Marker[],
  chunkId: string,
  env: Env
) {
  console.log(`[MARKERS] Inserting ${markers.length} markers with deduplication (chunkId: ${chunkId})`)

  let inserted = 0
  let duplicates = 0

  for (const marker of markers) {
    // Check for duplicate using unique constraint
    const existing = await env.SitelinkDB
      .select()
      .from(planMarkers)
      .where(
        and(
          eq(planMarkers.planId, marker.planId),
          eq(planMarkers.sheetId, marker.sheetId),
          eq(planMarkers.x, marker.x),
          eq(planMarkers.y, marker.y),
          eq(planMarkers.markerType, marker.markerType)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      // Add chunk metadata to marker
      await env.SitelinkDB.insert(planMarkers).values({
        ...marker,
        metadata: {
          ...marker.metadata,
          chunkId,
          processedAt: new Date().toISOString()
        }
      })
      inserted++
    } else {
      duplicates++
      console.log(`[MARKERS] Duplicate marker skipped: ${marker.markerType} at (${marker.x}, ${marker.y})`)
    }
  }

  console.log(`[MARKERS] Deduplication complete: ${inserted} inserted, ${duplicates} duplicates skipped`)
}
```

---

### Phase 6: Testing (2-3 hours)

**Test Files**:
- `packages/backend/tests/fixtures/sample-single-plan.pdf` (1 sheet)
- `packages/backend/tests/fixtures/sample-plan-2.pdf` (2 sheets)

**Test Plan**:

1. **Unit Tests**: Test chunk splitting logic
   - 15 tiles → no chunking (isChunked: false)
   - 25 tiles → no chunking (isChunked: false)
   - 26 tiles → 2 chunks (26, 0)
   - 50 tiles → 2 chunks (25, 25)
   - 75 tiles → 3 chunks (25, 25, 25)
   - 118 tiles → 5 chunks (25, 25, 25, 25, 18)

2. **Integration Test**: Small job (single sheet)
   - Upload sample-single-plan.pdf
   - Verify non-chunked processing
   - Check markers inserted

3. **Integration Test**: Medium job (2 sheets)
   - Upload sample-plan-2.pdf
   - Generate tiles using vips
   - Verify chunked processing (if > 25 tiles)
   - Check all chunks complete
   - Verify no duplicate markers

4. **Integration Test**: Chunk failure and retry
   - Simulate container failure on one chunk
   - Verify other chunks complete successfully
   - Verify failed chunk retries

5. **Performance Test**: Measure processing time
   - Generate 118 tiles using vips
   - Time total processing
   - Verify parallel execution (~40s expected)
   - Compare with sequential estimate (~189s)

---

## Implementation Checklist

### Phase 1: Queue Message Types ✅
- [ ] Update `MarkerDetectionJob` interface
- [ ] Add optional chunking fields
- [ ] Run typecheck

### Phase 2: PlanCoordinator Chunking ✅
- [ ] Add `chunkArray()` helper
- [ ] Modify `triggerMarkerDetection()`
- [ ] Add `CHUNK_SIZE` constant
- [ ] Test chunk splitting logic
- [ ] Run typecheck

### Phase 3: Queue Consumer Updates ✅
- [ ] Add `generateTarForTiles()` helper
- [ ] Add chunked processing logic
- [ ] Add non-chunked fallback
- [ ] Update logging
- [ ] Run typecheck

### Phase 4: Chunk Tar Generation ✅
- [ ] Add `generateChunkTar()` method
- [ ] Update fetch routing
- [ ] Test tar generation for subset
- [ ] Run typecheck

### Phase 5: Database Deduplication ✅
- [ ] Implement `insertMarkersWithDeduplication()`
- [ ] Add deduplication query
- [ ] Add chunk metadata to markers
- [ ] Test duplicate detection

### Phase 6: Testing ✅
- [ ] Unit test: Chunk splitting
- [ ] Integration test: Small job (non-chunked)
- [ ] Integration test: Medium job (chunked)
- [ ] Integration test: Chunk failure/retry
- [ ] Performance test: 118 tiles
- [ ] Verify no duplicate markers

---

## Expected Results

**Before (Current)**:
- 118 tiles: ~189s sequential
- Frequently times out (close to 5-min limit)
- All-or-nothing (loses all work on timeout)
- No container logs appearing

**After (Chunked)**:
- 118 tiles: ~40s (5 chunks in parallel)
- Each chunk: ~30-40s (well under 5-min limit)
- Resilient to failures (chunks retry independently)
- Partial results saved even if some chunks fail

---

## Rollout Strategy

1. **Development**: Implement all phases, test locally
2. **Staging**: Deploy and test with real PDFs
3. **Production**: Enable for new uploads, monitor metrics
4. **Optimization**: Fine-tune chunk size based on metrics

---

## Future Optimization (Post-Implementation)

After chunking is stable, optionally add async processing **within each chunk** to reduce processing time from 40s to ~10s per chunk:

```python
# In plan-ocr-service/src/api.py
import httpx
import asyncio

async def validate_batches_async(batches):
    async with httpx.AsyncClient() as client:
        tasks = [validate_batch_async(client, batch) for batch in batches]
        # Process 5 batches concurrently
        results = await asyncio.gather(*tasks)
    return results
```

**When to implement**: Only if chunking alone is insufficient for larger plans (500+ tiles).

---

## References

- Original issue: `/home/woodson/Code/projects/sitelink/docs/MARKER_DETECTION_TIMEOUT_ISSUE.md`
- Previous fix: `/home/woodson/Code/projects/sitelink/docs/MARKER_DETECTION_SOLUTION_PLAN.md`
- Consensus analysis: Multi-model evaluation (Gemini 2.5 Pro + Grok-4)
- Industry best practices: AWS Lambda, Stripe, Google Cloud Vision chunking patterns
