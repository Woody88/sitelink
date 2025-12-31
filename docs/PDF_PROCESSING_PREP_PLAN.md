# PDF Processing Implementation Plan - Hybrid Approach

**Date:** 2025-10-21 (Updated)
**Status:** Ready for Implementation
**Validated By:** GPT-5 via zen:planner MCP + Gemini 2.5 Pro via zen:thinkdeep + Critical Analysis
**Approach:** Hybrid - Proven code from previous solution + Cloud-native Cloudflare architecture + Durable Objects

---

## Executive Summary

Implement complete PDF-to-tiles processing by combining:

1. **Proven processing pipeline** from `sitelink_bak` (pdftoppm + Sharp)
2. **Cloud-native architecture** using Cloudflare Container Workers + Queues + R2
3. **Real-time progress tracking** using Durable Objects with WebSocket Hibernation API
4. **Concurrency control** via Durable Objects for job deduplication and race condition prevention

### Key Architectural Decision

**Use Cloudflare Container Workers** (not edge workers) because:
- ✅ Sharp requires native binaries (libvips) - cannot run in edge runtime
- ✅ pdftoppm requires poppler-utils system package
- ✅ Container workers support full Node.js/Bun environment
- ✅ All within Cloudflare ecosystem (no external orchestration needed)

---

## What Changed from Original Plan

### ❌ **Removed:**
- pdf-lib/pdfjs (unproven for construction plans)
- Running Sharp in edge workers (impossible - native deps)
- Vague "queue consumer worker" references

### ✅ **Added:**
- **Cloudflare Container Worker** specification
- **pdftoppm** (industry-standard PDF rasterization)
- **Proven Sharp pipeline** from `sitelink_bak/packages/core/lib/image-processing/`
- **Streaming upload strategy** (per-page processing to R2)
- **Dockerfile configuration** with all dependencies
- **Code porting guide** from previous solution
- **Durable Objects** for real-time WebSocket progress tracking
- **Job deduplication** using Durable Objects single-threaded guarantees
- **Versioned R2 paths** to prevent race conditions

### ✅ **Kept:**
- Database schema changes (`processingStatus`, `tileMetadata`)
- Cloudflare Queue integration
- R2 storage
- Frontend polling approach
- DZI tile format

---

## Current State

### What Exists
- ✅ **Files Module**: Handles PDF uploads to R2 (`packages/backend/src/features/files/`)
- ✅ **Plans Module**: Manages plan metadata (`packages/backend/src/features/plans/`)
- ✅ **Projects Module**: Project management with org-scoped access control
- ✅ **R2 Storage**: StorageService integrated for file storage
- ✅ **Proven Processing Code**: Working implementation in `sitelink_bak/packages/core/lib/image-processing/`

### What's Missing
- ❌ `packages/processing/` - Containerized worker package
- ❌ Cloudflare Queue configuration
- ❌ Processing status tracking in database
- ❌ R2 integration in processing pipeline
- ❌ Queue → Container worker integration

---

## Architecture Overview

### Complete Workflow (With Durable Objects)

```
1. User uploads PDF
   ↓
2. Files Module stores in R2
   ↓
3. Backend creates processing job ID (UUID)
   ↓
4. Backend sends job → Cloudflare Queue
   ↓
5. Backend creates Durable Object stub → ProcessingCoordinator[jobId]
   ↓
6. Queue triggers → Cloudflare Container Worker
   ↓
7. Container checks Durable Object for existing job
   └─→ If already processing: SKIP (deduplication)
   └─→ If new: Mark as "claimed" in Durable Object
   ↓
8. Container downloads PDF from R2
   ↓
9. Container updates Durable Object → status: 'processing'
   └─→ Durable Object broadcasts to WebSocket clients
   ↓
10. pdftoppm converts PDF → PNG images (600 DPI)
   ↓
11. For each page, Sharp processes:
   - Resize 1.5x (upscaling for quality)
   - Generate tile pyramid (256x256 JPEG tiles)
   - Upload tiles to R2 with versioned path: /{jobId}/page-N/
   - Update Durable Object with page completion
   └─→ Durable Object broadcasts progress to WebSocket clients
   - Delete local files (free disk space)
   ↓
12. Container updates Durable Object → status: 'complete'
   └─→ Durable Object broadcasts final status to WebSocket clients
   ↓
13. Container updates D1 database with final tileMetadata
   ↓
14. Frontend receives WebSocket event → displays tiles immediately
```

**Key Improvements:**
- **No polling** - Frontend receives real-time updates via WebSocket
- **Job deduplication** - Durable Object prevents duplicate processing
- **Versioned R2 paths** - Each job has unique path (prevents race conditions)
- **Broadcast pattern** - One Durable Object → many connected clients

### Why pdftoppm + Sharp?

**Previous Solution Used:**
- `pdftoppm` from poppler-utils (industry standard)
- Sharp's `.tile()` API with Deep Zoom layout
- 1.5x upscaling before tiling (better quality)
- Multi-page PDF support
- **Proven to work** with construction plans

**vs. Original Plan's pdf-lib/pdfjs:**
- pdf-lib: Limited rendering capabilities
- pdfjs-dist: Browser-focused, not optimized for server
- pdftoppm: Designed specifically for high-quality PDF rasterization

---

## Implementation Plan

### **Phase A: Database Migration**

#### Files to Create
- **Migration File**: `packages/backend/drizzle/migrations/XXXX_add_pdf_processing_fields.sql`

#### SQL Changes
```sql
-- Add processing status tracking
ALTER TABLE plans ADD COLUMN processingStatus TEXT
  CHECK(processingStatus IN ('pending', 'processing', 'complete', 'failed'));

-- Add tile metadata storage (JSON)
ALTER TABLE plans ADD COLUMN tileMetadata TEXT;
```

#### Field Details

**`processingStatus`**:
- Type: `TEXT` (nullable)
- Values: `'pending' | 'processing' | 'complete' | 'failed' | null`
- Purpose: Track PDF processing state
- Default: `null` (for plans without PDFs or before processing)

**`tileMetadata`**:
- Type: `TEXT` (nullable)
- Format: JSON string
- Purpose: Store DZI metadata + progress tracking
- Real-world example (based on actual generated tiles from 7-page construction plan):
  ```json
  {
    "totalPages": 7,
    "completedPages": 7,
    "progress": 100,
    "pages": [
      {
        "pageNumber": 1,
        "width": 10200,
        "height": 6601,
        "scaledWidth": 15300,
        "scaledHeight": 9902,
        "tileCount": 2340,
        "levels": 14,
        "dziPath": "orgs/abc/projects/xyz/plans/123/page-1/output.dzi"
      },
      {
        "pageNumber": 2,
        "width": 6600,
        "height": 4267,
        "scaledWidth": 9900,
        "scaledHeight": 6401,
        "tileCount": 1560,
        "levels": 13,
        "dziPath": "orgs/abc/projects/xyz/plans/123/page-2/output.dzi"
      }
    ],
    "generatedAt": "2025-10-21T12:00:00Z"
  }
  ```

**Field Descriptions:**
- `totalPages` - Total number of pages in the PDF
- `completedPages` - Pages processed so far (for progress tracking)
- `progress` - Percentage complete (0-100)
- `pages[]` - Array of per-page metadata:
  - `pageNumber` - Page index (1-based)
  - `width/height` - Original PNG dimensions from pdftoppm
  - `scaledWidth/scaledHeight` - Dimensions after 1.5x upscaling (what Sharp tiles are based on)
  - `tileCount` - Total number of 256×256 JPEG tiles generated for this page
  - `levels` - Number of zoom levels in the pyramid (0 = thumbnail, 14 = full resolution)
  - `dziPath` - R2 path to the Deep Zoom Image (DZI) XML file for OpenSeadragon
- `generatedAt` - ISO 8601 timestamp when processing completed

**Understanding the Tile Pyramid:**

For a large page (15300×9902 pixels after 1.5x scaling):
- **Level 14** (highest detail): 2340 tiles at 256×256px each → ~600MB
- **Level 13**: ~585 tiles (½ resolution)
- **Level 12**: ~146 tiles (¼ resolution)
- ...progressive downsampling...
- **Level 0** (thumbnail): 1 tile

This allows OpenSeadragon to load only the tiles needed for the current zoom level and viewport.

**The DZI (Deep Zoom Image) File:**

Each page generates an `output.dzi` XML file that OpenSeadragon reads to understand the tile structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
  Format="jpeg"
  Overlap="1"
  TileSize="256">
  <Size Height="9902" Width="15300" />
</Image>
```

This tells the viewer:
- **Format**: Tiles are JPEG images
- **TileSize**: Each tile is 256×256 pixels
- **Overlap**: 1 pixel overlap between tiles (prevents seams)
- **Size**: Full scaled image dimensions (15300×9902)

**Why Store This in the Database:**

1. **Progress Tracking** - Frontend polls and shows "Processing page 3/7 (42%)"
2. **Viewer Initialization** - Frontend knows which pages exist and their DZI paths
3. **Performance Analytics** - Track tile counts and dimensions for monitoring
4. **Failure Recovery** - If processing crashes, know which pages completed successfully
5. **Multi-page Navigation** - Frontend can build page selector UI

#### Commands to Run
```bash
# From packages/backend/
bun run db:generate:migration    # Generate migration file
bun run db:migrate:local         # Apply to local D1 database
bun run db:local:studio          # Verify columns exist in Drizzle Studio
```

---

### **Phase B: TypeScript Schema Updates**

#### File 1: `packages/backend/src/core/database/schemas/index.ts`

**Add fields after `directoryPath`:**
```typescript
export const plans = D.sqliteTable("plans", {
	id: D.text().primaryKey(),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	name: D.text().notNull(),
	description: D.text(),
	directoryPath: D.text("directory_path"),
	processingStatus: D.text("processing_status"),  // ADD THIS
	tileMetadata: D.text("tile_metadata"),          // ADD THIS
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})
```

#### File 2: `packages/backend/src/features/plans/service.ts`

**Update `get()` function:**
```typescript
Effect.map((p) => ({
	id: p.id,
	projectId: p.projectId,
	name: p.name,
	description: p.description,
	directoryPath: p.directoryPath,
	processingStatus: p.processingStatus,  // ADD THIS
	tileMetadata: p.tileMetadata,          // ADD THIS
	createdAt: p.createdAt,
})),
```

**Update `list()` function:**
```typescript
return planList.map((p) => ({
	id: p.id,
	name: p.name,
	description: p.description,
	directoryPath: p.directoryPath,
	processingStatus: p.processingStatus,  // ADD THIS
	tileMetadata: p.tileMetadata,          // ADD THIS
	createdAt: p.createdAt,
}))
```

#### File 3: `packages/backend/src/features/plans/http.ts`

**Update `PlanResponse`:**
```typescript
const PlanResponse = Schema.Struct({
	id: Schema.String,
	projectId: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	directoryPath: Schema.NullOr(Schema.String),
	processingStatus: Schema.NullOr(Schema.String),  // ADD THIS
	tileMetadata: Schema.NullOr(Schema.String),      // ADD THIS
	createdAt: Schema.Date,
})
```

**Update `PlanListResponse`:**
```typescript
const PlanListResponse = Schema.Struct({
	plans: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			name: Schema.String,
			description: Schema.NullOr(Schema.String),
			directoryPath: Schema.NullOr(Schema.String),
			processingStatus: Schema.NullOr(Schema.String),  // ADD THIS
			tileMetadata: Schema.NullOr(Schema.String),      // ADD THIS
			createdAt: Schema.Date,
		}),
	),
})
```

---

### **Phase B.5: Create Durable Object for Progress Tracking**

#### Purpose
Use Cloudflare Durable Objects to:
1. **Real-time progress updates** via WebSocket (no polling)
2. **Job deduplication** - prevent multiple workers from processing the same plan
3. **Concurrency control** - single-threaded guarantees prevent race conditions

#### File: `packages/backend/src/durable-objects/ProcessingCoordinator.ts`

```typescript
import { DurableObject } from "cloudflare:workers"

export interface ProcessingProgress {
  jobId: string
  planId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  totalPages?: number
  completedPages?: number
  progress?: number
  currentPage?: number
  error?: string
  startedAt?: number
  completedAt?: number
}

/**
 * Durable Object for coordinating PDF processing jobs
 * - Prevents duplicate processing via single-threaded execution
 * - Broadcasts real-time progress via WebSocket Hibernation API
 * - Maintains job state across worker restarts
 */
export class ProcessingCoordinator extends DurableObject {
  private sessions: Set<WebSocket> = new Set()

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade for real-time progress
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      this.ctx.acceptWebSocket(server)
      this.sessions.add(server)

      // Attach metadata to survive hibernation
      server.serializeAttachment({
        connectedAt: Date.now(),
        jobId: url.searchParams.get("jobId")
      })

      // Send current state immediately
      const currentState = await this.ctx.storage.get<ProcessingProgress>("state")
      if (currentState) {
        server.send(JSON.stringify(currentState))
      }

      return new Response(null, {
        status: 101,
        webSocket: client
      })
    }

    // REST API for progress updates
    switch (url.pathname) {
      case "/claim":
        return this.handleClaim(request)
      case "/update":
        return this.handleUpdate(request)
      case "/complete":
        return this.handleComplete(request)
      case "/status":
        return this.handleStatus(request)
      default:
        return new Response("Not found", { status: 404 })
    }
  }

  /**
   * Claim a job for processing (deduplication)
   */
  private async handleClaim(request: Request): Promise<Response> {
    const body = await request.json<{ jobId: string; planId: string }>()

    const existingState = await this.ctx.storage.get<ProcessingProgress>("state")

    // Already being processed
    if (existingState && existingState.status === 'processing') {
      return Response.json({
        claimed: false,
        reason: "Job already in progress",
        existingState
      }, { status: 409 })
    }

    // Claim the job
    const newState: ProcessingProgress = {
      jobId: body.jobId,
      planId: body.planId,
      status: 'processing',
      progress: 0,
      startedAt: Date.now()
    }

    await this.ctx.storage.put("state", newState)
    this.broadcast(newState)

    return Response.json({ claimed: true, state: newState })
  }

  /**
   * Update progress (called by container worker)
   */
  private async handleUpdate(request: Request): Promise<Response> {
    const update = await request.json<Partial<ProcessingProgress>>()

    const state = await this.ctx.storage.get<ProcessingProgress>("state")
    if (!state) {
      return Response.json({ error: "No active job" }, { status: 404 })
    }

    const updatedState: ProcessingProgress = { ...state, ...update }
    await this.ctx.storage.put("state", updatedState)

    // Broadcast to all connected WebSocket clients
    this.broadcast(updatedState)

    return Response.json({ success: true, state: updatedState })
  }

  /**
   * Mark job as complete
   */
  private async handleComplete(request: Request): Promise<Response> {
    const body = await request.json<{ status: 'complete' | 'failed'; error?: string }>()

    const state = await this.ctx.storage.get<ProcessingProgress>("state")
    if (!state) {
      return Response.json({ error: "No active job" }, { status: 404 })
    }

    const finalState: ProcessingProgress = {
      ...state,
      status: body.status,
      error: body.error,
      progress: body.status === 'complete' ? 100 : state.progress,
      completedAt: Date.now()
    }

    await this.ctx.storage.put("state", finalState)
    this.broadcast(finalState)

    // Keep state for 24 hours for debugging
    await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000)

    return Response.json({ success: true, state: finalState })
  }

  /**
   * Get current status
   */
  private async handleStatus(request: Request): Promise<Response> {
    const state = await this.ctx.storage.get<ProcessingProgress>("state")
    return Response.json({ state: state || null })
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcast(message: ProcessingProgress) {
    const payload = JSON.stringify(message)

    this.ctx.getWebSockets().forEach((ws) => {
      try {
        ws.send(payload)
      } catch (error) {
        console.error("Failed to send to WebSocket:", error)
      }
    })
  }

  /**
   * Handle WebSocket messages from clients
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Echo back for connection health checks
    if (message === "ping") {
      ws.send("pong")
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason)
    this.sessions.delete(ws)
  }

  /**
   * Cleanup old state (triggered by alarm)
   */
  async alarm() {
    const state = await this.ctx.storage.get<ProcessingProgress>("state")
    if (state && state.completedAt) {
      const age = Date.now() - state.completedAt
      // Delete state after 24 hours
      if (age > 24 * 60 * 60 * 1000) {
        await this.ctx.storage.deleteAll()
      }
    }
  }
}
```

#### Update `packages/backend/wrangler.toml`

Add Durable Object binding:

```toml
[[durable_objects.bindings]]
name = "PROCESSING_COORDINATOR"
class_name = "ProcessingCoordinator"
script_name = "sitelink-backend"

[[migrations]]
tag = "v1"
new_classes = ["ProcessingCoordinator"]
```

#### Update `packages/backend/src/api.ts`

Export the Durable Object:

```typescript
export { ProcessingCoordinator } from "./durable-objects/ProcessingCoordinator"

export default {
  fetch: /* existing handler */,
}
```

---

### **Phase C: Create Processing Package**

#### Directory Structure
```
packages/processing/
├── Dockerfile
├── wrangler.toml
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Queue consumer entry point
│   ├── processor.ts          # Main processing orchestration
│   ├── lib/
│   │   ├── pdf-processor.ts  # PORT from sitelink_bak
│   │   ├── tile-generator.ts # PORT from sitelink_bak
│   │   ├── sharp-service.ts  # PORT from sitelink_bak
│   │   ├── types.ts          # PORT from sitelink_bak
│   │   ├── r2-uploader.ts    # NEW - R2 integration
│   │   └── status-updater.ts # NEW - D1 status updates
│   └── utils/
│       └── temp-storage.ts   # Ephemeral /tmp management
```

#### Dockerfile
```dockerfile
FROM oven/bun:1-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY . .

# Expose port (if needed for HTTP endpoint)
EXPOSE 8080

# Run the worker
CMD ["bun", "run", "src/index.ts"]
```

#### package.json
```json
{
  "name": "@sitelink/processing",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "effect": "catalog:",
    "@effect/platform": "catalog:",
    "@cloudflare/workers-types": "^4.20241127.0",
    "sharp": "^0.33.2"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "wrangler": "^3.95.0"
  }
}
```

#### wrangler.toml
```toml
name = "sitelink-pdf-processor"
main = "src/index.ts"
compatibility_date = "2024-11-27"

# Use container-based worker
workers_dev = true
build.upload.format = "container"

# Queue consumer configuration
[[queues.consumers]]
queue = "pdf-processing-queue"
max_batch_size = 1
max_retries = 3
dead_letter_queue = "pdf-processing-dlq"

# R2 bucket binding
[[r2_buckets]]
binding = "STORAGE_BUCKET"
bucket_name = "sitelink-storage"

# D1 database binding
[[d1_databases]]
binding = "DB"
database_name = "sitelink-db"
database_id = "your-database-id"

# Environment variables
[vars]
ENVIRONMENT = "production"
```

---

### **Phase D: Port Processing Code from sitelink_bak**

#### Step 1: Copy Core Processing Files

From `sitelink_bak/packages/core/lib/image-processing/`, copy:

**1. `pdf-processor.ts`** - pdftoppm wrapper
- ✅ Uses `pdftoppm` via Bun's `$` shell
- ✅ Converts PDF → PNG at 600 DPI
- ✅ Multi-page support
- ⚠️ **Adapt:** Change output from local filesystem to `/tmp`

**2. `tile-generator.ts`** - Sharp tiling
- ✅ Uses Sharp's `.tile()` API
- ✅ 1.5x upscaling before tiling
- ✅ Generates 256x256 JPEG tiles
- ✅ Creates DZI metadata
- ⚠️ **Adapt:** Process one page at a time for memory efficiency

**3. `sharp-service.ts`** - Orchestration
- ✅ Combines PDF → PNG → Tiles pipeline
- ✅ Temp directory management
- ✅ Cleanup after processing
- ⚠️ **Adapt:** Add R2 upload step after each page

**4. `types.ts`** - TypeScript interfaces
- ✅ Copy as-is
- ⚠️ **Add:** R2-specific types

#### Step 2: Create R2 Upload Integration

**New file: `src/lib/r2-uploader.ts`**
```typescript
import type { R2Bucket } from '@cloudflare/workers-types'
import { $ } from 'bun'

/**
 * Upload all tiles from a local directory to R2
 * Maintains directory structure in R2
 */
export async function uploadTilesToR2(
  bucket: R2Bucket,
  localTilesDir: string,
  r2Prefix: string
): Promise<number> {
  // Find all tile files
  const filesOutput = await $`find ${localTilesDir} -type f`.text()
  const files = filesOutput.trim().split('\n').filter(f => f.length > 0)

  let uploadedCount = 0

  for (const filePath of files) {
    // Get relative path for R2 key
    const relativePath = filePath.replace(`${localTilesDir}/`, '')
    const r2Key = `${r2Prefix}/${relativePath}`

    // Read file
    const fileData = await Bun.file(filePath).arrayBuffer()

    // Determine content type
    const contentType = filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
      ? 'image/jpeg'
      : filePath.endsWith('.dzi')
      ? 'text/xml'
      : 'application/octet-stream'

    // Upload to R2
    await bucket.put(r2Key, fileData, {
      httpMetadata: { contentType }
    })

    uploadedCount++
  }

  return uploadedCount
}

/**
 * Upload a single DZI file to R2
 */
export async function uploadDziToR2(
  bucket: R2Bucket,
  localDziPath: string,
  r2Key: string
): Promise<void> {
  const fileData = await Bun.file(localDziPath).arrayBuffer()

  await bucket.put(r2Key, fileData, {
    httpMetadata: { contentType: 'text/xml' }
  })
}
```

#### Step 3: Create Status Update Service

**New file: `src/lib/status-updater.ts`**
```typescript
import type { D1Database } from '@cloudflare/workers-types'

export interface ProcessingStatus {
  planId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  tileMetadata?: {
    totalPages?: number
    completedPages?: number
    progress?: number
    pages?: Array<{
      pageNumber: number
      width: number
      height: number
      scaledWidth: number
      scaledHeight: number
      tileCount: number
      dziPath: string
    }>
    generatedAt?: string
    error?: string
  }
}

/**
 * Update plan processing status in D1
 */
export async function updatePlanStatus(
  db: D1Database,
  status: ProcessingStatus
): Promise<void> {
  const metadataJson = status.tileMetadata
    ? JSON.stringify(status.tileMetadata)
    : null

  await db.prepare(
    `UPDATE plans
     SET processingStatus = ?, tileMetadata = ?
     WHERE id = ?`
  ).bind(
    status.status,
    metadataJson,
    status.planId
  ).run()
}
```

---

### **Phase E: Main Processing Logic**

**File: `src/processor.ts`**

```typescript
import { $ } from 'bun'
import type { R2Bucket, D1Database } from '@cloudflare/workers-types'
import { PdfProcessor } from './lib/pdf-processor'
import { TileGenerator } from './lib/tile-generator'
import { uploadTilesToR2, uploadDziToR2 } from './lib/r2-uploader'
import { updatePlanStatus } from './lib/status-updater'

export interface ProcessingJob {
  planId: string
  fileId: string
  filePath: string  // R2 key for the PDF
  orgId: string
  projectId: string
}

export interface ProcessingEnv {
  STORAGE_BUCKET: R2Bucket
  DB: D1Database
}

/**
 * Main processing function - orchestrates PDF → Tiles pipeline
 * with streaming uploads to R2
 */
export async function processPdfJob(
  job: ProcessingJob,
  env: ProcessingEnv
): Promise<void> {
  const tempDir = `/tmp/job-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const pdfPath = `${tempDir}/input.pdf`
  const pagesDir = `${tempDir}/pages`
  const tilesDir = `${tempDir}/tiles`

  try {
    console.log(`🚀 Starting processing for plan ${job.planId}`)

    // Create temp directories
    await $`mkdir -p ${pagesDir} ${tilesDir}`.quiet()

    // Step 1: Download PDF from R2
    console.log('📥 Downloading PDF from R2...')
    const pdfObject = await env.STORAGE_BUCKET.get(job.filePath)
    if (!pdfObject) {
      throw new Error(`PDF not found in R2: ${job.filePath}`)
    }
    const pdfData = await pdfObject.arrayBuffer()
    await Bun.write(pdfPath, pdfData)
    console.log(`✅ Downloaded ${(pdfData.byteLength / 1024 / 1024).toFixed(2)} MB`)

    // Step 2: Update status to 'processing'
    await updatePlanStatus(env.DB, {
      planId: job.planId,
      status: 'processing',
      tileMetadata: {
        totalPages: 0,
        completedPages: 0,
        progress: 0
      }
    })

    // Step 3: Convert PDF to PNGs using pdftoppm
    console.log('📄 Converting PDF pages to PNG...')
    const pdfProcessor = new PdfProcessor({ resolution: 600, outputFormat: 'png' })
    const pngFiles = await pdfProcessor.convertToImages(pdfPath, pagesDir, 'page')
    console.log(`✅ Generated ${pngFiles.length} pages`)

    const totalPages = pngFiles.length
    const pageMetadata = []

    // Step 4: Process each page and upload immediately
    const tileGenerator = new TileGenerator({
      tileSize: 256,
      overlap: 1,
      format: 'jpeg',
      quality: 90
    })

    for (let i = 0; i < pngFiles.length; i++) {
      const pagePath = pngFiles[i]
      const pageNum = i + 1
      const pageTilesDir = `${tilesDir}/page-${pageNum}`
      const outputPrefix = `orgs/${job.orgId}/projects/${job.projectId}/plans/${job.planId}/page-${pageNum}`

      console.log(`🎨 Processing page ${pageNum}/${totalPages}...`)

      // Create page tiles directory
      await $`mkdir -p ${pageTilesDir}`.quiet()

      // Generate tiles for this page
      const result = await tileGenerator.generateTiles(
        pagePath,
        `${pageTilesDir}/output`
      )

      console.log(`  📊 Generated ${result.metadata.tileCount} tiles`)

      // Upload tiles to R2
      const uploadedCount = await uploadTilesToR2(
        env.STORAGE_BUCKET,
        `${pageTilesDir}/output_files`,
        `${outputPrefix}/tiles`
      )

      console.log(`  ☁️  Uploaded ${uploadedCount} tiles to R2`)

      // Upload DZI metadata
      await uploadDziToR2(
        env.STORAGE_BUCKET,
        `${pageTilesDir}/output.dzi`,
        `${outputPrefix}/output.dzi`
      )

      // Store page metadata
      pageMetadata.push({
        pageNumber: pageNum,
        width: result.metadata.width,
        height: result.metadata.height,
        scaledWidth: result.metadata.scaledWidth,
        scaledHeight: result.metadata.scaledHeight,
        tileCount: result.metadata.tileCount,
        dziPath: `${outputPrefix}/output.dzi`
      })

      // Update progress in database
      await updatePlanStatus(env.DB, {
        planId: job.planId,
        status: 'processing',
        tileMetadata: {
          totalPages,
          completedPages: pageNum,
          progress: Math.round((pageNum / totalPages) * 100),
          pages: pageMetadata
        }
      })

      // Clean up this page's files to free disk space
      await $`rm -rf ${pagePath} ${pageTilesDir}`.quiet()

      console.log(`  ✅ Page ${pageNum} complete (${Math.round((pageNum / totalPages) * 100)}%)`)
    }

    // Step 5: Mark as complete
    console.log('🎉 Processing complete!')
    await updatePlanStatus(env.DB, {
      planId: job.planId,
      status: 'complete',
      tileMetadata: {
        totalPages,
        completedPages: totalPages,
        progress: 100,
        pages: pageMetadata,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('💥 Processing failed:', error)

    // Mark as failed with error details
    await updatePlanStatus(env.DB, {
      planId: job.planId,
      status: 'failed',
      tileMetadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    })

    throw error

  } finally {
    // Always clean up temp directory
    try {
      await $`rm -rf ${tempDir}`.quiet()
      console.log('🧹 Cleaned up temporary files')
    } catch (cleanupError) {
      console.warn('⚠️  Failed to cleanup temp directory:', cleanupError)
    }
  }
}
```

**File: `src/index.ts` (Queue Consumer)**

```typescript
import type { QueueMessage } from '@cloudflare/workers-types'
import { processPdfJob, type ProcessingJob, type ProcessingEnv } from './processor'

export default {
  async queue(
    batch: QueueMessage<ProcessingJob>[],
    env: ProcessingEnv
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        console.log(`📬 Received job: ${message.body.planId}`)
        await processPdfJob(message.body, env)
        console.log(`✅ Job completed: ${message.body.planId}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Job failed: ${message.body.planId}`, error)
        message.retry()
      }
    }
  }
}
```

---

### **Phase F: Backend Queue Integration**

**File: `packages/backend/src/features/files/service.ts`**

Update the `upload()` function to enqueue processing jobs:

```typescript
// After creating the D1 metadata record...

// Enqueue PDF processing if file is a PDF
if (params.fileType === 'application/pdf') {
  console.log(`📤 Enqueuing PDF processing for plan ${params.planId}`)

  // Update plan status to 'pending'
  yield* db.use((db) =>
    db.update(plans)
      .set({ processingStatus: 'pending' })
      .where(eq(plans.id, params.planId))
  )

  // Enqueue processing job
  yield* Effect.tryPromise({
    try: () => env.PDF_PROCESSING_QUEUE.send({
      planId: params.planId,
      fileId,
      filePath,
      orgId: params.orgId,
      projectId: params.projectId,
    }),
    catch: (cause) => new Error(`Failed to enqueue processing: ${cause}`)
  })

  console.log(`✅ Job enqueued for plan ${params.planId}`)
}

return { fileId, filePath }
```

**Add to `packages/backend/wrangler.toml`:**

```toml
# Queue producer binding
[[queues.producers]]
binding = "PDF_PROCESSING_QUEUE"
queue = "pdf-processing-queue"
```

---

## Deployment Strategy

### 1. Deploy Container Worker
```bash
cd packages/processing
bun install
wrangler deploy
```

### 2. Create Queue
```bash
wrangler queues create pdf-processing-queue
wrangler queues create pdf-processing-dlq  # Dead letter queue
```

### 3. Deploy Backend with Queue Binding
```bash
cd packages/backend
bun run deploy
```

### 4. Test Processing
```bash
# Upload a test PDF
curl -X POST http://localhost:8787/api/files/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@test-plan.pdf" \
  -F "planId=plan_123" \
  -F "fileType=application/pdf"

# Check processing status
curl http://localhost:8787/api/plans/plan_123 \
  -H "Authorization: Bearer {token}"
```

---

## R2 Tile Structure (Versioned)

**Important**: Each processing job gets a unique `jobId` to prevent race conditions:

```
orgs/{orgId}/
  projects/{projectId}/
    plans/{planId}/
      {jobId}/          # UUID for this processing job
        page-1/
          output.dzi
          tiles/
            0/          # Zoom level 0 (full resolution)
              0_0.jpg
              1_0.jpg
              ...
            1/          # Zoom level 1
              0_0.jpg
              ...
            2/          # Zoom level 2 (thumbnail)
              0_0.jpg
        page-2/
          output.dzi
          tiles/
            ...
```

**Why versioned paths?**
- Multiple concurrent uploads won't overwrite each other
- Failed processing jobs leave artifacts for debugging
- Users can re-upload revised plans without losing old versions
- Database stores `currentJobId` pointer to active version

---

## Frontend Integration (With WebSockets)

### Real-time Progress Tracking

**No more polling!** Use WebSocket connection to Durable Object for instant updates:

```typescript
import { useEffect, useState } from 'react'

interface ProcessingProgress {
  jobId: string
  planId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  totalPages?: number
  completedPages?: number
  progress?: number
  error?: string
}

/**
 * React hook for real-time PDF processing progress
 */
export function useProcessingProgress(jobId: string) {
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Connect to Durable Object WebSocket
    const ws = new WebSocket(
      `wss://api.example.com/processing/${jobId}/ws`
    )

    ws.onopen = () => {
      console.log('✅ Connected to processing coordinator')
      setConnected(true)

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping')
        }
      }, 30000)

      return () => clearInterval(pingInterval)
    }

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data) as ProcessingProgress
      setProgress(update)

      // Close connection when complete or failed
      if (update.status === 'complete' || update.status === 'failed') {
        ws.close()
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      setConnected(false)
    }

    ws.onclose = () => {
      console.log('🔌 WebSocket closed')
      setConnected(false)
    }

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [jobId])

  return { progress, connected }
}

/**
 * Progress UI Component
 */
export function PDFProcessingProgress({ jobId }: { jobId: string }) {
  const { progress, connected } = useProcessingProgress(jobId)

  if (!progress) {
    return <div>Connecting...</div>
  }

  switch (progress.status) {
    case 'pending':
      return (
        <div className="flex items-center gap-2">
          <Spinner />
          <span>Queued for processing...</span>
        </div>
      )

    case 'processing':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Processing page {progress.completedPages}/{progress.totalPages}</span>
            <span>{progress.progress}%</span>
          </div>
          <ProgressBar value={progress.progress ?? 0} />
          {connected && (
            <div className="text-xs text-green-600">● Live updates</div>
          )}
        </div>
      )

    case 'complete':
      return (
        <div className="text-green-600">
          ✅ Processing complete! {progress.totalPages} pages ready.
        </div>
      )

    case 'failed':
      return (
        <div className="text-red-600">
          ❌ Processing failed: {progress.error}
        </div>
      )
  }
}
```

### Load Tiles in OpenSeadragon

```typescript
/**
 * Load processed plan tiles into OpenSeadragon viewer
 */
export function loadPlanViewer(
  containerId: string,
  orgId: string,
  projectId: string,
  planId: string,
  jobId: string,
  pageNum: number
) {
  const viewer = OpenSeadragon({
    id: containerId,
    prefixUrl: '/openseadragon/images/',
    tileSources: `https://storage.example.com/orgs/${orgId}/projects/${projectId}/plans/${planId}/${jobId}/page-${pageNum}/output.dzi`,

    // Performance optimizations for construction plans
    showNavigationControl: true,
    showRotationControl: true,
    gestureSettingsTouch: {
      pinchToZoom: true,
      flickEnabled: true
    },

    // Preload adjacent tiles for smooth panning
    imageLoaderLimit: 5,

    // Better quality for detailed plans
    minZoomImageRatio: 0.8,
    maxZoomPixelRatio: 2,

    // Enable full screen
    showFullPageControl: true
  })

  return viewer
}

/**
 * Multi-page plan viewer with page navigation
 */
export function MultiPagePlanViewer({ plan }: { plan: Plan }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [viewer, setViewer] = useState<OpenSeadragon.Viewer | null>(null)

  const metadata = plan.tileMetadata ? JSON.parse(plan.tileMetadata) : null

  useEffect(() => {
    if (!metadata) return

    const v = loadPlanViewer(
      'viewer-container',
      plan.orgId,
      plan.projectId,
      plan.id,
      metadata.jobId,
      currentPage
    )

    setViewer(v)

    return () => v.destroy()
  }, [currentPage, metadata])

  if (!metadata) {
    return <div>No tiles available</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page navigation */}
      <div className="flex items-center gap-2 p-4 border-b">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          ← Previous
        </button>

        <span>
          Page {currentPage} of {metadata.totalPages}
        </span>

        <button
          onClick={() => setCurrentPage(p => Math.min(metadata.totalPages, p + 1))}
          disabled={currentPage === metadata.totalPages}
        >
          Next →
        </button>
      </div>

      {/* Viewer */}
      <div id="viewer-container" className="flex-1" />
    </div>
  )
}
```

### Backend API Endpoint for WebSocket Connection

```typescript
// packages/backend/src/features/processing/http.ts
import { Effect, HttpRouter, HttpServer } from "@effect/platform"

export const ProcessingRoutes = HttpRouter.empty.pipe(
  // WebSocket endpoint for progress tracking
  HttpRouter.get(
    "/processing/:jobId/ws",
    Effect.gen(function* () {
      const { jobId } = yield* HttpRouter.params
      const env = yield* Effect.service(CloudflareEnv)

      // Get Durable Object stub
      const id = env.PROCESSING_COORDINATOR.idFromName(jobId)
      const stub = env.PROCESSING_COORDINATOR.get(id)

      // Forward WebSocket upgrade to Durable Object
      const request = yield* HttpServer.request
      return yield* Effect.promise(() => stub.fetch(request.raw))
    })
  ),

  // Get current status (fallback for non-WebSocket clients)
  HttpRouter.get(
    "/processing/:jobId/status",
    Effect.gen(function* () {
      const { jobId } = yield* HttpRouter.params
      const env = yield* Effect.service(CloudflareEnv)

      const id = env.PROCESSING_COORDINATOR.idFromName(jobId)
      const stub = env.PROCESSING_COORDINATOR.get(id)

      const response = await stub.fetch(`http://do/status`)
      const data = await response.json()

      return HttpServer.response.json(data)
    })
  )
)
```

---

## Simplified Implementation Roadmap (Junior-Dev Friendly)

This breaks down the implementation into **bite-sized**, **testable increments** suitable for junior developers.

### **Sprint 1: Database Foundation** (1-2 days) ⭐ START HERE

**Goal**: Add database fields without touching any processing logic

**Tasks**:
1. Add two columns to `plans` table in schema file
   - Location: `packages/backend/src/core/database/schemas/index.ts`
   - Add: `processingStatus` and `tileMetadata`
2. Generate Drizzle migration: `bun run db:generate:migration`
3. Apply locally: `bun run db:migrate:local`
4. Verify in Drizzle Studio: `bun run db:local:studio`
5. Update TypeScript types in `plans/service.ts` and `plans/http.ts`
6. Test: Manually insert data via SQL, verify API returns it

**Success Criteria**: ✅ API returns new fields with null values

---

### **Sprint 2: Durable Object Setup** (2-3 days)

**Goal**: Create real-time progress tracking (without processing)

**Tasks**:
1. Create `ProcessingCoordinator.ts` durable object (copy from plan)
2. Add durable object binding to `wrangler.toml`
3. Export durable object from `api.ts`
4. Deploy: `bun run deploy`
5. Test with `curl` or Postman:
   ```bash
   # Claim a job
   curl -X POST https://api/do/claim -d '{"jobId":"test-1","planId":"plan_123"}'

   # Update progress
   curl -X POST https://api/do/update -d '{"completedPages":3,"totalPages":7}'

   # Get status
   curl https://api/do/status
   ```

**Success Criteria**: ✅ Can claim jobs, update progress, retrieve status

---

### **Sprint 3: Queue Setup** (1-2 days)

**Goal**: Enqueue processing jobs (without actual processing)

**Tasks**:
1. Create Cloudflare Queue: `wrangler queues create pdf-processing-queue`
2. Add queue producer binding to backend `wrangler.toml`
3. Update `files/service.ts` to enqueue job on PDF upload
4. Create mock queue consumer that logs messages:
   ```typescript
   export default {
     async queue(batch, env) {
       for (const msg of batch.messages) {
         console.log('Received job:', msg.body)
         msg.ack()
       }
     }
   }
   ```
5. Deploy and test by uploading a PDF

**Success Criteria**: ✅ PDF upload enqueues job, consumer logs it

---

### **Sprint 4: Mock Processing** (2 days)

**Goal**: Create fake tiles to test full workflow

**Tasks**:
1. Update queue consumer to:
   - Claim job via Durable Object
   - Create fake tile structure in R2 (static test image)
   - Update progress: 0% → 50% → 100%
   - Mark complete in Durable Object
   - Update database with fake metadata
2. Test end-to-end workflow
3. Verify frontend can display "complete" status

**Success Criteria**: ✅ Fake tiles appear in R2, database updated, status = complete

---

### **Sprint 5: WebSocket Frontend** (2-3 days)

**Goal**: Real-time progress UI (connects to existing Durable Object)

**Tasks**:
1. Create `useProcessingProgress` React hook (copy from plan)
2. Create `PDFProcessingProgress` component
3. Connect to WebSocket endpoint
4. Test with mock processing from Sprint 4
5. Verify live progress updates appear in UI

**Success Criteria**: ✅ Frontend shows real-time progress without polling

---

### **Sprint 6: Container Setup** (Senior Dev - 3 days)

**Goal**: Create container with Sharp + pdftoppm

**Tasks**:
1. Create `packages/processing/` directory
2. Write Dockerfile with system dependencies
3. Copy processing code from `sitelink_bak`:
   - `pdf-processor.ts`
   - `tile-generator.ts`
   - `types.ts`
4. Test local Docker build: `docker build .`
5. Test Sharp generates tiles from sample PDF
6. Deploy to Cloudflare Containers

**Success Criteria**: ✅ Container runs, Sharp generates tiles locally

---

### **Sprint 7: R2 Integration** (Senior Dev - 2-3 days)

**Goal**: Upload generated tiles to R2

**Tasks**:
1. Create `r2-uploader.ts` (from plan)
2. Update processor to upload tiles after generation
3. Test: Process sample PDF, verify tiles in R2
4. Verify R2 path structure: `/{orgId}/{projectId}/{planId}/{jobId}/page-1/`

**Success Criteria**: ✅ Tiles uploaded to R2 with correct paths

---

### **Sprint 8: End-to-End Integration** (2 days)

**Goal**: Connect all pieces

**Tasks**:
1. Update queue consumer to call real processor
2. Processor claims job via Durable Object
3. Processor updates progress during processing
4. Processor uploads tiles to R2
5. Processor marks complete + updates database
6. Frontend displays tiles via OpenSeadragon

**Success Criteria**: ✅ Upload PDF → See real-time progress → View tiles

---

### **Sprint 9: Error Handling** (2 days)

**Goal**: Handle failures gracefully

**Tasks**:
1. Add try/catch to processor
2. Mark jobs as `failed` in Durable Object
3. Store error messages in database
4. Test with corrupt PDF
5. Test with network failures
6. Add retry logic to queue consumer

**Success Criteria**: ✅ Failed jobs show error in UI, don't retry infinitely

---

### **Sprint 10: Production Hardening** (2-3 days)

**Goal**: Make production-ready

**Tasks**:
1. Add monitoring/logging
2. Add dead-letter queue for failed jobs
3. Set up Cloudflare Queue metrics
4. Add rate limiting
5. Performance testing with large PDFs
6. Security review (R2 permissions, authentication)

**Success Criteria**: ✅ Production deployment successful

---

## Testing Checklist (Per Sprint)

Each sprint should be **independently testable**:

### Sprint 1
- [ ] Migration applies without errors
- [ ] New fields visible in Drizzle Studio
- [ ] API returns new fields

### Sprint 2
- [ ] Durable Object deploys
- [ ] Can claim/update/status via HTTP
- [ ] Multiple updates work correctly

### Sprint 3
- [ ] Queue created in Cloudflare dashboard
- [ ] Messages enqueued on PDF upload
- [ ] Consumer receives messages

### Sprint 4
- [ ] Fake tiles uploaded to R2
- [ ] Database updated with metadata
- [ ] Status changes: pending → processing → complete

### Sprint 5
- [ ] WebSocket connects
- [ ] Progress updates appear in real-time
- [ ] Connection survives page reload

### Sprint 6-10
- [ ] See detailed checklists in each sprint

---

## Success Criteria (Final)

- ✅ Database has `processingStatus` and `tileMetadata` fields
- ✅ Durable Object provides real-time WebSocket progress updates
- ✅ Job deduplication prevents duplicate processing
- ✅ Versioned R2 paths prevent race conditions
- ✅ Container worker builds and deploys to Cloudflare
- ✅ PDF uploads trigger queue jobs with unique job IDs
- ✅ pdftoppm converts PDFs successfully at 600 DPI
- ✅ Sharp generates DZI tile pyramids correctly (1.5x upscaling)
- ✅ Tiles upload to R2 with versioned path structure
- ✅ Frontend receives real-time progress via WebSocket (no polling)
- ✅ Multi-page PDFs process all pages sequentially
- ✅ Failed jobs update status appropriately with error details
- ✅ OpenSeadragon viewer displays tiles correctly
- ✅ Multi-page navigation works smoothly

---

## References

### Proven Code Source
- `sitelink_bak/packages/core/lib/image-processing/pdf-processor.ts`
- `sitelink_bak/packages/core/lib/image-processing/tile-generator.ts`
- `sitelink_bak/packages/core/lib/image-processing/sharp-service.ts`

### Documentation
- **Cloudflare Queues**: https://developers.cloudflare.com/queues/
- **Cloudflare Container Workers**: https://developers.cloudflare.com/containers/
- **Cloudflare Durable Objects**: https://developers.cloudflare.com/durable-objects/
- **Durable Objects WebSockets**: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- **WebSocket Hibernation API**: https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- **R2 API**: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- **Sharp Tile Generation**: https://sharp.pixelplumbing.com/api-output#tile
- **DZI Format**: https://openseadragon.github.io/
- **poppler-utils**: https://poppler.freedesktop.org/

---

**End of Implementation Plan**
