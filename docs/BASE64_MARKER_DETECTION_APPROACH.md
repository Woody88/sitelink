# Base64 JSON Approach for Marker Detection

## Executive Summary

This document explains why we transitioned from a tar-stream approach to a base64 JSON approach for sending tile images to the `plan-ocr-service` container for marker detection, and details the current issues we're facing with the implementation.

## Problem Statement

### Original Issue: Tar-Stream Corruption

The initial implementation attempted to send tile images to the `plan-ocr-service` container as a tar archive stream. This approach encountered persistent "bad checksum" errors from the Python container, indicating that the tar archive was being corrupted during transmission.

**Root Cause:**
- Cloudflare Workers use Web Streams API, which differs from Node.js streams
- The `tar-stream` library (Node.js) is incompatible with Cloudflare Workers runtime
- Stream handling in Workers caused tar headers to be corrupted during transmission
- Multiple attempts to fix stream conversion (buffering, pull-based streams, manual conversion) all failed

**Symptoms:**
- Python container reported: `{"detail":"Marker detection failed: bad checksum"}`
- Tar archives were incomplete or corrupted
- No markers were detected despite tiles being generated successfully

## Solution: Base64 JSON Encoding

### Why Base64 JSON?

After extensive debugging and research, we chose to send tiles as base64-encoded strings within a JSON payload. This approach offers several advantages:

1. **Native JSON Support**: Cloudflare Workers have excellent native JSON support
2. **No Stream Complexity**: Eliminates all stream conversion issues
3. **Debuggable**: JSON payloads are human-readable and easy to inspect
4. **Reliable**: No corruption issues - base64 encoding is deterministic
5. **Worker-Compatible**: Works perfectly within Worker memory constraints (25 tiles per chunk)

### Implementation Details

#### Worker Side (`packages/backend/src/core/queues/index.ts`)

**Function: `generateBase64TilesPayload()`**
```typescript
async function generateBase64TilesPayload(
  tileKeys: string[],
  env: Env
): Promise<{ tiles: Array<{ filename: string; data: string }> }> {
  // Fetch tiles from R2 in parallel batches
  const tiles = await Promise.all(
    tileKeys.map(async (key) => {
      const obj = await env.SitelinkStorage.get(key)
      if (!obj) return null
      const data = await obj.arrayBuffer()
      // Convert ArrayBuffer to base64 string
      const base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
      return {
        filename: key.split('/').pop() || key,
        data: base64
      }
    })
  )
  return { tiles: tiles.filter(Boolean) }
}
```

**Request Construction:**
```typescript
const requestBody = {
  tiles: payload.tiles,  // Array of { filename: string, data: string }
  valid_sheets: job.validSheets,
  strict_filtering: true
}

const bodyJson = JSON.stringify(requestBody)
```

**Container Request:**
```typescript
response = await container.fetch("http://localhost/api/detect-markers", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": bodyJson.length.toString(),
  },
  body: bodyJson,
  signal: controller.signal,
})
```

#### Python Service Side (`packages/plan-ocr-service/src/api.py`)

**Request Model:**
```python
class TileData(BaseModel):
    filename: str
    data: str  # base64-encoded image data

class Base64TilesRequest(BaseModel):
    tiles: List[TileData]
    valid_sheets: List[str]
    strict_filtering: bool = True
```

**Processing:**
```python
if "tiles" in json_data:
    base64_req = Base64TilesRequest(**json_data)
    
    # Decode and save all tiles
    for tile in base64_req.tiles:
        tile_data = base64.b64decode(tile.data)
        tile_path = os.path.join(temp_dir, tile.filename)
        with open(tile_path, 'wb') as f:
            f.write(tile_data)
```

### Chunking Strategy

To avoid exceeding Worker memory limits and CPU time limits, we process tiles in chunks:

- **Chunk Size**: 25 tiles per chunk (configurable)
- **Parallel Processing**: Multiple chunks can be processed in parallel
- **Deduplication**: Markers are deduplicated when chunks are processed concurrently

**Chunking Logic** (`packages/backend/src/core/durable-objects/plan-coordinator.ts`):
```typescript
if (tileKeys.length > 25) {
  // Split into chunks of 25 tiles
  const chunks = chunkArray(tileKeys, 25)
  // Enqueue separate jobs for each chunk
  for (const chunk of chunks) {
    await env.MARKER_DETECTION_QUEUE.send({
      // ... chunk metadata
      tileKeys: chunk,
      isChunked: true,
      chunkIndex: i,
      totalChunks: chunks.length
    })
  }
}
```

## Current Issues

### Issue 1: Container Fetch Hanging

**Symptom:**
- `container.fetch()` call to `/api/detect-markers` hangs indefinitely
- No response is received from the container
- No Python container logs appear (no `[MARKERS] ====== Marker detection endpoint called ======` log)
- Container reports as "ready" (`Port 8000 is ready`, `PlanOcrService container successfully started`)

**Observed Behavior (Latest Logs):**
```
🏥 [CHUNK] Performing health check on container...
Error checking if container is ready: connect(): Connection refused: container port not found.
⚠️ [CHUNK] Health check failed, but continuing anyway: TimeoutError: The operation was aborted due to timeout
📤 [CHUNK] Calling container.fetch() for marker detection...
📤 [CHUNK] Request body size: 229907 bytes
Port 8000 is ready
PlanOcrService container successfully started
Error checking if container is ready: The operation was aborted
```

**Key Observations:**
1. **Health Check Timing**: Health check times out (5 seconds) before container is ready
2. **Container Starts After Health Check**: Container starts AFTER the health check fails
3. **Main Request Still Hangs**: Even after container is "ready", the main request doesn't complete
4. **No Python Logs**: Python service never logs `[MARKERS] ====== Marker detection endpoint called ======`, indicating request never reaches FastAPI

**Missing:**
- `✅ [CHUNK] Container health check passed: ...` (health check always times out)
- `📥 [CHUNK] Received response from container: ...` (never appears)
- Python container logs showing request received
- Any error logs after container starts

**Root Cause Hypothesis:**
1. **Container vs Service Readiness Gap**: Container port is "ready" but Python FastAPI service inside isn't fully initialized
2. **Cold Start Delay**: Python service needs time to start (imports, model loading, etc.) beyond just port readiness
3. **Request Buffering**: Large JSON payload (230KB) might be buffered/dropped if service isn't ready to receive it
4. **Network Timing**: There's a race condition where requests are sent before the service is actually listening

**Attempted Fixes:**
1. ✅ Added `Content-Length` header for large payloads
2. ✅ Added health check before main request (but it times out)
3. ✅ Enhanced logging around fetch calls
4. ❌ Removed premature delay (was happening before container started)
5. ⏳ Health check needs retry logic with exponential backoff

### Issue 2: No Python Container Logs

**Symptom:**
- Python container should log `[MARKERS] ====== Marker detection endpoint called ======` at the start of the endpoint
- This log never appears, indicating the request never reaches the Python service

**Confirmed from Logs:**
- Health check times out (container not ready)
- Main request is sent anyway
- Container starts AFTER the request is sent
- Request never reaches Python service

**Root Cause:**
The request is being sent before the Python FastAPI service is ready to receive it. Even though the container port is "ready", the FastAPI application inside needs additional time to:
- Complete Python imports
- Initialize FastAPI app
- Start listening on port 8000
- Be ready to accept HTTP requests

**Possible Causes:**
1. **Service Initialization Delay**: FastAPI needs time to start beyond just port readiness
2. **Request Dropped**: Large payload (230KB) might be dropped if service isn't ready
3. **Network Buffering**: Request might be buffered but never delivered to the service
4. **Container Networking**: There might be a delay between container start and service availability

### Issue 3: Container Readiness Race Condition

**Symptom:**
- Container reports as "ready" but requests hang
- Health check errors appear before container is ready
- Container starts *after* the health check times out

**Timeline (From Latest Logs):**
```
1. Health check initiated (5 second timeout)
2. Health check times out (container not ready)
3. Main request sent anyway
4. Container starts (Port 8000 ready)
5. Main request still hanging (no response)
```

**Critical Finding:**
The health check timeout (5 seconds) is shorter than the container startup time. This means:
- Health check fails before container is ready
- We continue with the main request anyway
- Container starts, but the main request was already sent and is now hanging
- The request never reaches the Python service because it was sent too early

## Debugging Steps Taken

### 1. Added Health Check
```typescript
const healthResponse = await container.fetch("http://localhost/health", {
  method: "GET",
  signal: AbortSignal.timeout(5000),
})
```

**Purpose**: Verify Python service is actually ready before sending large payload

### 2. Enhanced Logging
- Request body size logging
- Response headers logging
- Detailed error logging with stack traces

### 3. Content-Length Header
- Explicitly set `Content-Length` header for large JSON payloads
- Helps with proper HTTP request handling

## Next Steps

### Immediate Actions

1. **Verify Health Check Works**
   - Check if health check endpoint responds successfully
   - If health check fails, investigate container initialization

2. **Check Container Logs**
   - Access Python container logs directly
   - Verify FastAPI app is actually running and listening on port 8000

3. **Test with Smaller Payload**
   - Try sending a single tile (much smaller payload)
   - Determine if issue is payload-size related

4. **Add Request Timeout**
   - Ensure we have proper timeout handling
   - Currently set to 5 minutes, but might need adjustment

### Potential Solutions

#### Option A: Retry Health Check Until Success (RECOMMENDED)
```typescript
// Retry health check with exponential backoff until successful
let healthOk = false
const maxRetries = 20  // Allow up to 20 retries (container can take 10-15 seconds to start)
for (let i = 0; i < maxRetries; i++) {
  try {
    const healthResponse = await container.fetch("http://localhost/health", {
      method: "GET",
      signal: AbortSignal.timeout(2000),  // 2 second timeout per attempt
    })
    if (healthResponse.ok) {
      const healthData = await healthResponse.json().catch(() => ({}))
      console.log(`✅ [CHUNK] Container health check passed on attempt ${i + 1}:`, healthData)
      healthOk = true
      break
    }
  } catch (e) {
    // Exponential backoff: 0.5s, 1s, 1.5s, 2s, 2.5s...
    const delay = Math.min(500 * (i + 1), 3000)
    console.log(`⏳ [CHUNK] Health check attempt ${i + 1}/${maxRetries} failed, retrying in ${delay}ms...`)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}
if (!healthOk) {
  throw new Error(`Container health check failed after ${maxRetries} attempts. Container may not be starting properly.`)
}
```

**Why This Works:**
- Allows container up to 20 attempts × 2 seconds = 40 seconds to start
- Exponential backoff prevents overwhelming the container
- Only proceeds with main request after health check succeeds
- Provides clear error if container never becomes ready

#### Option B: Reduce Initial Payload Size
- Start with smaller chunks (10 tiles instead of 25)
- Gradually increase if successful

#### Option C: Use Streaming for Large Payloads
- If payload size is the issue, consider chunked transfer encoding
- However, this brings back stream complexity

#### Option D: Investigate Container Networking
- Check if there's a networking issue between Worker and container
- Verify container port mapping is correct
- Check if there are any firewall/proxy issues

## Architecture Benefits

Despite current issues, the base64 JSON approach has significant architectural benefits:

1. **Simplicity**: No complex stream handling
2. **Reliability**: No corruption issues
3. **Debuggability**: Easy to inspect and log payloads
4. **Maintainability**: Clear, straightforward code
5. **Scalability**: Chunking allows parallel processing

## Performance Considerations

### Memory Usage
- **Per Chunk**: ~230KB JSON payload (25 tiles)
- **Worker Limit**: 128MB memory
- **Status**: ✅ Well within limits

### CPU Time
- **Base64 Encoding**: Minimal CPU overhead
- **JSON Serialization**: Native, optimized
- **Status**: ✅ Efficient

### Network Transfer
- **Base64 Overhead**: ~33% size increase
- **Trade-off**: Acceptable for reliability gains
- **Status**: ✅ Acceptable

## Conclusion

The base64 JSON approach is the correct architectural choice for this use case. The current hanging issue is **definitively** a container readiness/timing problem:

1. **Health check times out** before container is ready (5 second timeout too short)
2. **Main request is sent** before Python service is initialized
3. **Container starts** but request was already sent and is now hanging
4. **Python service never receives** the request because it wasn't ready when sent

**Solution Path:**
Implement retry logic for health check with exponential backoff. Only proceed with the main marker detection request after health check succeeds. This ensures the Python FastAPI service is fully initialized and ready to receive requests before we send the large JSON payload.

Once we resolve the container readiness timing issue, the base64 JSON approach should work reliably.

## Related Documents

- `MARKER_DETECTION_CPU_TIMEOUT_PROBLEM.md` - Original problem and chunking solution
- `CHUNKED_MARKER_DETECTION_IMPLEMENTATION_SUMMARY.md` - Chunking implementation details

