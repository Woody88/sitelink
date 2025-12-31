# PDF Processing Implementation TODO

## Progress Summary

We're implementing a PDF tile generation system using Cloudflare Workers + Containers + Durable Objects.

### ✅ Completed
1. **Durable Object (ProcessingJobState)** - Basic WebSocket initialization
   - File: `packages/backend/src/features/processing/pdf-processing-job.do.ts`
   - Status: WebSocket connection setup complete, debugging port connection issue
   - Container communication via WebSocket on port 3000

### 🚧 In Progress
- Debugging container port connection error
- Need to verify container starts and exposes port 3000 correctly

### 📋 Remaining Tasks

#### 2. Create Processing Feature Module Structure
- [ ] Create `packages/backend/src/features/processing/service.ts`
- [ ] Create `packages/backend/src/features/processing/http.ts`
- [ ] Create `packages/backend/src/features/processing/index.ts`
- Note: ProcessingService will run IN the container, not the Worker

#### 3. Implement Plans Upload Handler
- [ ] Update `packages/backend/src/features/plans/service.ts`
- [ ] Add upload method that:
  - Stores PDF in R2
  - Creates Durable Object for job
  - Returns jobId to client
- [ ] Worker creates DO, DO starts container via WebSocket

#### 4. Add Job Progress Query Endpoint
- [ ] HTTP endpoint: `GET /processing/jobs/:jobId`
- [ ] Queries Durable Object for current progress
- [ ] Returns job state (status, progress %, completed pages, etc.)

#### 5. Add Container Callback Endpoint
- [ ] Not needed! Using WebSocket for bidirectional communication
- Container sends messages to DO via WebSocket
- DO updates state based on messages

#### 6. Container Service Structure (Already Created)
- ✅ Dockerfile: `infra/docker/backend.Dockerfile`
- ✅ Main entry: `packages/backend/src/features/processing/main.ts`
- ✅ Bun WebSocket server on port 3000
- Current issue: Port not connecting to DO

#### 7. Implement vips Processing Logic in Container
- [ ] Receive job + PDF data via WebSocket from DO
- [ ] Extract pages with pdf-lib
- [ ] Generate tiles with vips: `vips dzsave input.pdf[page=N,dpi=300] output.dzi --tile-size 256 --overlap 1`
- [ ] Send tiles back to DO via WebSocket (base64 encoded)
- [ ] Send progress updates after each page

#### 8. R2 Helper Functions
- Not needed! DO has direct R2 access via `env.SitelinkStorage`
- DO downloads PDF and sends to container
- Container sends tiles back, DO uploads to R2

#### 9. Write Local Integration Test
- [ ] Test: Upload PDF → Create job → Container processes → Check progress
- [ ] Use `cloudflare:test` for testing
- [ ] Mock or use real container

---

## Architecture Summary

```
User Upload
    ↓
Worker (upload handler)
    ↓
Store PDF in R2
    ↓
Create Durable Object
    ↓
DO initializes WebSocket to Container
    ↓
DO sends PDF data via WebSocket
    ↓
Container processes with vips
    ↓
Container sends tiles via WebSocket
    ↓
DO receives tiles and uploads to R2
    ↓
Client polls progress endpoint
```

### Key Decisions Made

1. **WebSocket Communication**: DO ↔ Container via WebSocket (not HTTP callbacks)
2. **R2 Access**: Only DO accesses R2 (container doesn't need credentials)
3. **Progress Monitoring**: Polling (not WebSocket to client) for MVP
4. **Storage Strategy**: Keep original multi-page PDF, no single-page PDFs
5. **Tile Generation**: Direct vips conversion (no intermediate PNGs)

### Files Created/Modified

- `packages/backend/src/features/processing/pdf-processing-job.do.ts` - Durable Object
- `packages/backend/src/features/processing/main.ts` - Container WebSocket server
- `packages/backend/wrangler.jsonc` - Container configuration
- `infra/docker/backend.Dockerfile` - Container image
- `docs/PDF_PROCESSING_ARCHITECTURE.md` - Full architecture documentation

### Current Issue

Getting error: "container port not found. Make sure you exposed the port in your container definition."

**Troubleshooting steps:**
1. ✅ Removed invalid `@cloudflare/containers` import
2. ✅ Added `defaultPort = 3000` to DO class
3. ✅ Container Dockerfile exposes port 3000
4. ✅ Bun server listens on port 3000
5. ⏳ Need to verify container actually starts

**Next step:** Check if "Server running at..." log appears when wrangler starts. If not, container isn't starting.

### Reference Documentation

- Main architecture: `docs/PDF_PROCESSING_ARCHITECTURE.md`
- Cloudflare Containers demo: https://github.com/cloudflare/containers-demos/tree/main/websockets
- Tiles strategy: `docs/TILES_STRATEGY.md`
