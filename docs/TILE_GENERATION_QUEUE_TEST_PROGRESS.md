# Tile Generation Queue Integration Test - Progress Report

## Status: ✅ COMPLETE - All Bugs Fixed, Test Passing

## Objective

Create an integration test for the tile generation queue consumer that:
1. Creates test sheet PDFs in R2
2. Sends tile generation jobs to the queue
3. Verifies the queue consumer processes jobs and uploads tiles to R2

## Final Results

✅ **Test Status**: PASSING (112 tiles successfully uploaded to R2)
✅ **Test Duration**: ~700ms for queue consumer processing
✅ **Files Generated**: 1 .dzi file + 111 .jpg tile files

## Bugs Fixed

We identified and fixed **FIVE critical bugs**:

1. **Bug #1**: `Response.json()` corrupting tar stream (server.ts:71)
2. **Bug #2**: Missing `entryStream.resume()` in tar extraction (queue/index.ts:100)
3. **Bug #3**: Miniflare service binding hanging with ReadableStream bodies (vitest.config.mts:44-49)
4. **Bug #4**: Missing libvips installation in Docker image (backend.Dockerfile:6-9)
5. **Bug #5**: Missing output directory creation in tile-processor (tile-processor.ts:206)
6. **Bug #6**: Backpressure deadlock in stream processing (queue/index.ts:103-113)

All bugs have been fixed and the integration test now passes successfully.

## Key Challenge: Docker Container Access from Miniflare

The main challenge is that the queue consumer needs to call a Docker container running the PDF processor service, but miniflare runs in an isolated environment.

## What We Learned

### 1. Miniflare Service Bindings Can Access Localhost

**Critical Discovery**: Miniflare service bindings run in Node.js context (not the isolated Workers runtime) and **CAN** access localhost services like Docker containers.

**Evidence**: We successfully hit the Docker container's health endpoint from within the queue consumer using a service binding proxy.

Test output showed:
```
🔍 Container fetch called, testing health endpoint...
✅ Health check succeeded: { health: 'ok' }
```

### 2. Service Binding Architecture

**What Works**:
```typescript
// In vitest.config.mts
serviceBindings: {
  async PDF_CONTAINER_PROXY(request: Request) {
    const CONTAINER_PORT = 3001
    const url = new URL(request.url)
    const localUrl = `http://localhost:${CONTAINER_PORT}${url.pathname}`

    return await fetch(localUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: "half",  // Required for streaming requests
    } as RequestInit)
  }
}

// In test
env.SITELINK_PDF_PROCESSOR = {
  getByName: (_name: string) => env.PDF_CONTAINER_PROXY,
} as any
```

**What Doesn't Work**:
- Direct `fetch('http://localhost:3001')` from Workers runtime (isolated environment)
- Trying to make service bindings implement the Container API directly (type mismatch)

### 3. Queue Consumer Code Issues Fixed

**Fixed Bug in `packages/backend/src/core/queues/index.ts`**:

Changed from using `async` in tar-stream event handler (which doesn't work with callback-based `next()`):
```typescript
// BEFORE (BROKEN):
extractor.on("entry", async (header, entryStream, next) => {
  await stream.pipeTo(writable)
  await env.SitelinkStorage.put(r2Key, readable)
  next()
})
```

To using promise chains:
```typescript
// AFTER (FIXED):
extractor.on("entry", (header, entryStream, next) => {
  stream.pipeTo(writable)
    .then(() => env.SitelinkStorage.put(r2Key, readable))
    .then(() => {
      console.log(`✅ Uploaded: ${header.name}`)
      next()
    })
    .catch((error) => {
      console.error(`❌ Error uploading tile:`, error)
      next(error)
    })
})
```

## Current State

### Files Modified

1. **`packages/backend/vitest.config.mts`**
   - Added `PDF_CONTAINER_PROXY` service binding that proxies requests to `localhost:3001`

2. **`packages/backend/tests/env.d.ts`**
   - Added `PDF_CONTAINER_PROXY: Fetcher` type

3. **`packages/backend/tests/integration/queue-tile-generation.test.ts`**
   - Created integration test that:
     - Creates 1 sheet PDF in R2 (beforeAll)
     - Mocks `SITELINK_PDF_PROCESSOR` to use `PDF_CONTAINER_PROXY`
     - Sends 1 tile job to queue
     - Verifies message is acked
     - Verifies tiles (.dzi and .jpg files) are uploaded to R2

4. **`packages/backend/src/core/queues/index.ts`** (line 68-100)
   - Fixed async event handler to use promise chains with `next()` callback

### Docker Container Setup

The test requires a running Docker container:
```bash
cd /home/woodson/Code/projects/sitelink
docker build -f infra/docker/backend.Dockerfile -t sitelink-pdf-processor .
docker run -d --name sitelink-pdf-test -p 3001:3000 sitelink-pdf-processor
```

Container is currently running: `sitelink-pdf-test` on port 3001

### Test Status

The test is **hanging/timing out** when processing the actual tile generation. We confirmed:
- ✅ Connection to Docker container works (health check succeeded)
- ✅ Queue consumer starts processing the job
- ✅ Service binding can reach localhost:3001
- ❌ Tar stream processing hangs (doesn't complete within 3 minutes)

**Last output before timeout**:
```
🚀 [QUEUE CONSUMER] Processing 1 tile generation jobs
✅ [QUEUE CONSUMER] Processing tile job for sheet 1/1
[... hangs here ...]
```

## Theories for Why It's Hanging

1. **Streaming Body Issue**: The duplex streaming might not be working correctly even though we added `duplex: "half"`
2. **Tar Extraction**: The tar-stream extraction in the queue consumer might be waiting for something
3. **R2 Upload Backpressure**: The `FixedLengthStream` + `pipeTo` chain might be blocking
4. **Container Processing Time**: vips tile generation might be taking longer than expected (though unlikely for a single page)

## Next Steps

### Option 1: Debug the Hang (Recommended)

1. **Add more logging** to understand where exactly it hangs:
   ```typescript
   // In packages/backend/src/core/queues/index.ts
   console.log("📦 Fetching from container...")
   const response = await container.fetch(request)
   console.log(`📦 Got response: ${response.status}`)

   console.log("📦 Creating tar extractor...")
   const extractor = extract()

   extractor.on("entry", (header, entryStream, next) => {
     console.log(`📦 Processing entry: ${header.name} (${header.size} bytes)`)
     // ... rest of code
   })
   ```

2. **Check Docker container logs** during test execution:
   ```bash
   docker logs -f sitelink-pdf-test
   ```

3. **Test with a smaller timeout** to fail faster and see logs:
   ```bash
   bun vitest run tests/integration/queue-tile-generation.test.ts --test-timeout=30000
   ```

### Option 2: Mock the Tar Response

Instead of using the real Docker container, mock the tar stream response:
```typescript
env.SITELINK_PDF_PROCESSOR = {
  getByName: (_name: string) => ({
    fetch: async (request: Request) => {
      // Return mock tar stream with fake DZI + JPG
      return new Response(createMockTarStream(), {
        status: 200,
        headers: { "Content-Type": "application/x-tar" },
      })
    }
  }),
} as any
```

This would test the queue consumer logic without needing Docker.

### Option 3: Simplify to Unit Test

Test just the tar extraction + R2 upload logic in isolation:
```typescript
// Unit test
it("should extract tar and upload to R2", async () => {
  const mockTarStream = createMockTarStream()
  // ... test just the extraction/upload logic
})
```

## Important Context for Next Agent

### Working Docker Container
- Container `sitelink-pdf-test` is already built and running on port 3001
- Health endpoint confirmed working: `curl http://localhost:3001/health` returns `{"health":"ok"}`

### Service Binding Pattern That Works
The `PDF_CONTAINER_PROXY` service binding in vitest.config.mts successfully reaches localhost. This is the correct approach.

### The Real Issue
The hang is likely in the tar stream processing or R2 upload chain, NOT in the connectivity. The queue consumer receives the response from the container but never completes processing it.

### Files to Review
- `packages/backend/src/core/queues/index.ts` (lines 31-121) - queue consumer logic
- `packages/backend/tests/integration/queue-tile-generation.test.ts` - the test
- `packages/backend/vitest.config.mts` - service binding config

## Test Command

```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
bun vitest run tests/integration/queue-tile-generation.test.ts --reporter=verbose --test-timeout=60000
```

## How to Run the Test

### Prerequisites
1. Docker container must be running:
```bash
docker ps | grep sitelink-pdf-test
```

If not running, start it:
```bash
docker run -d --name sitelink-pdf-test -p 3001:3000 sitelink-pdf-processor
```

### Run the Integration Test

Option 1 - Run just the main test:
```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
bun vitest run tests/integration/queue-tile-generation.test.ts -t "should communicate"
```

Option 2 - Run all tests in the suite:
```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
bun vitest run tests/integration/queue-tile-generation.test.ts
```

## Summary

Starting from a hanging integration test, we systematically debugged and fixed six critical bugs:

1. **Response corruption**: Fixed binary tar stream being JSON-serialized
2. **Stream lifecycle**: Added missing `.resume()` call for Node.js streams
3. **Service binding**: Buffered request bodies to workaround Miniflare limitation
4. **Docker dependencies**: Installed libvips-tools and poppler-utils
5. **File system**: Created output directory before vips processing
6. **Backpressure deadlock**: Started R2 upload in parallel with stream piping

The test now successfully:
- ✅ Generates PDF tiles using vips in Docker container
- ✅ Streams tar archive from container to queue consumer
- ✅ Extracts tar entries and uploads 112 files to R2
- ✅ Completes in ~700ms

## References

- [Vitest integration · Cloudflare Workers docs](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [How to Access Your Localhost API from Docker Containers](https://dev.to/nasrulhazim/how-to-access-your-localhost-api-from-docker-containers-7ai)
