# Marker Detection CPU Timeout Problem - Detailed Analysis

## ✅ RESOLVED (2025-12-07)

**Solution:** Extended PlanCoordinator Durable Object to handle tar generation.

**Root Cause:** Stream race condition (NOT CPU limits). Document's CPU limit assumptions were outdated (actual limits: 30s default, 5min configurable vs stated 10-50ms).

**Implementation:** See `docs/MARKER_DETECTION_SOLUTION_PLAN.md`

**Test Results:**
- ✅ Tar generation for 177 tiles: 129ms (232x faster than 30s timeout)
- ✅ Average per tile: 0.73ms
- ✅ No race conditions (single-threaded DO execution)
- ✅ Integration tests passing

---

[Rest of document kept for historical reference]

## Problem Statement

The marker detection queue consumer is failing with CPU timeout errors when processing 177 tiles. The Worker runtime cancels the request with the error:

```
The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response.
```

This occurs during the process of:
1. Fetching 177 tile images from R2 storage
2. Packaging them into a tar archive
3. Streaming the tar to the `plan-ocr-service` container for marker detection

## Root Cause Analysis

### Cloudflare Workers CPU Time Limits

Cloudflare Workers have strict **CPU time limits** for queue consumers:
- **Free tier**: ~10ms CPU time per request
- **Paid tier**: ~50ms CPU time per request (varies by plan)
- **Queue consumers**: Similar limits apply, with automatic cancellation if the Worker appears to hang

The key issue is that **CPU time** is different from **wall-clock time**:
- CPU time = actual computation time (not including I/O waits)
- Wall-clock time = total elapsed time (including I/O waits)

However, when processing 177 tiles sequentially:
- Each tile requires:
  - R2 fetch operation (I/O)
  - Tar entry creation (CPU)
  - Streaming tile data into tar entry (CPU + I/O)
- Even with I/O operations being "free" (not counting against CPU time), the CPU-intensive operations (tar packing, stream processing) accumulate
- Processing 177 tiles sequentially exceeds the CPU time budget

### The Current Implementation

The current code in [`packages/backend/src/core/queues/index.ts`](packages/backend/src/core/queues/index.ts) (lines 682-944) attempts to:

1. **Create a streaming tar** that processes tiles asynchronously
2. **Fetch tiles from R2** and add them to the tar packer sequentially
3. **Stream the tar** to the container while tiles are being processed

The implementation uses:
- A `ReadableStream` that starts immediately
- An async `processTilesAsync()` function that runs in the background
- Yields every 5 tiles using `setTimeout(resolve, 0)` to avoid blocking

### Why This Approach Fails

1. **Stream Consumption Race Condition**: The stream is passed to `container.fetch()` immediately, but `processTilesAsync()` hasn't started adding tiles yet. The container receives an incomplete tar stream.

2. **CPU Time Accumulation**: Even with yields, processing 177 tiles sequentially accumulates CPU time:
   - Tar entry creation: ~0.1-0.5ms per tile
   - Stream processing: ~0.5-2ms per tile
   - Total: ~100-400ms of CPU time (exceeds limits)

3. **Yielding Doesn't Help Enough**: `setTimeout(resolve, 0)` yields control but doesn't reset the CPU time counter. The Worker runtime tracks cumulative CPU time across the entire execution.

4. **Async Function Not Awaited**: The `processTilesAsync()` function is called but not awaited, so the Worker may complete (or timeout) before tiles are fully processed.

## What We've Tried

### Attempt 1: Sequential Processing with Yields
- **Approach**: Process tiles one by one, yield every 10 tiles
- **Result**: Still times out - CPU time accumulates

### Attempt 2: Parallel Batch Fetching
- **Approach**: Fetch tiles in batches of 20 in parallel, then add to tar sequentially
- **Result**: Fetching works, but adding to tar still times out

### Attempt 3: Streaming with Background Processing
- **Approach**: Create stream immediately, process tiles asynchronously in background
- **Result**: Container receives incomplete tar (stream consumed before tiles added)

### Attempt 4: Buffering All Tiles First
- **Approach**: Fetch all tiles first, then create tar stream
- **Result**: Exceeds CPU limits during the fetch phase

## Fundamental Constraints

### Cloudflare Workers Limitations

1. **CPU Time Limits**: Cannot be bypassed with yields or async operations
2. **Queue Consumer Timeouts**: Automatic cancellation if Worker appears hung
3. **No Long-Running Tasks**: Workers are designed for short, stateless operations

### Tar Stream Requirements

1. **Sequential Processing**: `tar-stream` packer requires entries to be added sequentially
2. **Complete Tar**: Container needs a complete, valid tar file to extract
3. **Streaming**: We want to stream (not buffer everything in memory)

### Architecture Constraints

1. **R2 Access**: Only the Worker has R2 access (container doesn't)
2. **Container Communication**: Must stream tar to container (can't use R2 URLs)
3. **177 Tiles**: This is a realistic number for a 2-page plan with DZI tiles

## Potential Solutions

### Solution 1: Split Work Across Multiple Queue Messages (Recommended)

**Approach**: Process tiles in chunks of 20-30 tiles per queue message, create partial tar files, then combine them.

**Implementation**:
1. Split `tileKeys` into chunks (e.g., 30 tiles per chunk)
2. For each chunk:
   - Create a queue message with chunk metadata
   - Process chunk in separate queue consumer execution
   - Upload partial tar to R2
3. Final queue message:
   - Fetch all partial tars from R2
   - Combine into single tar stream
   - Send to container

**Pros**:
- Stays within CPU time limits per execution
- Can process chunks in parallel
- Maintains streaming architecture

**Cons**:
- More complex (multiple queue messages)
- Requires temporary R2 storage for partial tars
- Slightly slower (multiple queue executions)

### Solution 2: Use Durable Object for Long-Running Task

**Approach**: Move tile processing to a Durable Object, which has higher CPU time limits.

**Implementation**:
1. Create a `MarkerDetectionProcessor` Durable Object
2. Queue consumer sends job to Durable Object
3. Durable Object processes tiles and streams to container
4. Durable Object can handle longer CPU time

**Pros**:
- Higher CPU time limits
- Stateful processing (can track progress)
- Better for long-running tasks

**Cons**:
- More complex architecture
- Durable Objects have their own limits (though higher)
- May still hit limits with 177 tiles

### Solution 3: Pre-generate Tar in Separate Queue

**Approach**: Create a separate queue that pre-generates the tar file and stores it in R2, then marker detection queue just streams from R2.

**Implementation**:
1. After tile generation completes, enqueue "tar-generation" job
2. Tar generation queue:
   - Fetches tiles in small batches
   - Creates tar file
   - Uploads to R2
3. Marker detection queue:
   - Streams pre-generated tar from R2 to container

**Pros**:
- Separates concerns
- Can retry tar generation independently
- Marker detection is faster (just streaming)

**Cons**:
- Requires temporary R2 storage
- Additional queue and processing step
- More complex flow

### Solution 4: Reduce Tile Count (Not Recommended)

**Approach**: Only send tiles from specific zoom levels or regions to marker detection.

**Pros**:
- Simple
- Stays within limits

**Cons**:
- May miss markers
- Not a real solution to the problem

### Solution 5: Use Container with R2 Access (Architectural Change)

**Approach**: Give the container direct R2 access, send tile keys instead of tar stream.

**Implementation**:
1. Container has R2 credentials
2. Worker sends list of tile keys
3. Container fetches tiles directly from R2
4. Container processes tiles

**Pros**:
- No tar generation in Worker
- No streaming complexity
- Container handles its own I/O

**Cons**:
- Requires architectural change
- Container needs R2 credentials
- Security considerations (scoped credentials)

## Recommended Solution

**Solution 1: Split Work Across Multiple Queue Messages** is the most practical approach because:

1. **Stays within limits**: Each queue execution processes a small chunk
2. **Maintains architecture**: Still uses streaming, no R2 access needed in container
3. **Scalable**: Can handle any number of tiles
4. **Retry-friendly**: Failed chunks can be retried independently

### Implementation Plan

1. **Modify queue consumer** to detect if tiles need chunking:
   - If tiles > 30: Split into chunks, enqueue multiple messages
   - If tiles <= 30: Process directly

2. **Create chunk processing logic**:
   - Process 30 tiles per execution
   - Create partial tar
   - Upload to R2 with unique key

3. **Create final assembly step**:
   - Fetch all partial tars from R2
   - Stream them sequentially to container
   - Or: Combine partial tars into single tar in R2, then stream

4. **Update queue message type** to support:
   - `chunkIndex`: Which chunk this is
   - `totalChunks`: Total number of chunks
   - `partialTarKey`: R2 key for partial tar (if applicable)

## Current Status

- **Problem**: Worker times out when processing 177 tiles
- **Symptoms**: No progress logs from `processTilesAsync()`, container receives incomplete tar
- **Blocking**: Marker detection cannot complete
- **Next Step**: Implement Solution 1 (chunked processing)

## Related Files

- [`packages/backend/src/core/queues/index.ts`](packages/backend/src/core/queues/index.ts) - Queue consumer implementation
- [`packages/backend/src/core/queues/types.ts`](packages/backend/src/core/queues/types.ts) - Queue message types
- [`packages/plan-ocr-service/src/api.py`](packages/plan-ocr-service/src/api.py) - Container API that receives tar stream

## References

- [Cloudflare Workers CPU Time Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [tar-stream npm package](https://www.npmjs.com/package/tar-stream)

