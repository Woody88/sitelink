# PDF Processing Architecture

## Overview

This document describes the simplified PDF processing pipeline for converting construction plan PDFs into deep-zoom tiles for web viewing.

## Architecture Decision: vips Direct Conversion

After evaluating multiple approaches (see consensus analysis below), we've chosen the **vips direct conversion** approach for maximum simplicity and performance.

### Why vips?

1. **Eliminates intermediate files**: PDF → DZI tiles directly (no PNG, no single-page PDFs)
2. **Significantly faster**: Benchmarks show substantial performance improvement over pdftoppm + Sharp
3. **Simpler pipeline**: Fewer steps = fewer failure modes
4. **Battle-tested**: libvips is used in production by major document management systems

## Processing Pipeline

### High-Level Flow

```
1. User Uploads PDF via Mobile App/Web
    ↓
2. Cloudflare Worker receives upload
    ↓
3. Worker stores original PDF in R2
    ↓
4. Worker creates Durable Object for job state
    ↓
5. Durable Object registers job metadata & kicks off container
    ↓
6. Cloudflare Container receives ProcessingJob
    ↓
7. Container downloads PDF from R2
    ↓
8. Container processes each page with vips
    ↓
9. Container uploads tiles to R2
    ↓
10. Container updates Durable Object progress after each page
    ↓
11. Durable Object broadcasts progress to connected clients
    ↓
12. When complete, Durable Object marks job finished
```

### Detailed Component Interaction

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Mobile App │────▶│ Worker (Upload)  │────▶│  R2 (PDF Storage)  │
└─────────────┘     └──────────────────┘     └────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Durable Object  │◀──────┐
                    │  (Job State)     │       │
                    └──────────────────┘       │
                              │                │
                              ▼                │
                    ┌──────────────────┐       │
                    │ Container Service│───────┘
                    │ (vips processing)│   Updates progress
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  R2 (Tiles)      │
                    └──────────────────┘
```

### Storage Structure

```
storage/
├── organizations/
│   └── {org-id}/
│       └── projects/
│           └── {project-id}/
│               ├── uploads/
│               │   └── {upload-id}/
│               │       ├── original/
│               │       │   └── {upload-id}.pdf    # KEEP FOREVER (legal compliance)
│               │       └── metadata.json
│               │
│               └── sheets/
│                   └── {sheet-id}/
│                       ├── tiles/
│                       │   ├── {sheet-id}.dzi
│                       │   └── {sheet-id}_files/  # Tile pyramid
│                       └── metadata.json
```

### Why Keep the Original PDF?

- **Legal compliance**: Construction documents must be retained 3-23 years depending on jurisdiction
- **Disaster recovery**: Can regenerate tiles at higher quality or different settings
- **User value**: Downloadable source document with metadata and searchable text
- **Storage cost**: ~1-2% of total storage (negligible)

## Component Responsibilities

### 1. Cloudflare Worker (Upload Handler)

**Responsibilities:**
- Receive PDF upload from client
- Validate file (type, size, permissions)
- Store original PDF in R2
- Create Durable Object instance for job tracking
- Return job ID to client

```typescript
// packages/backend/src/features/plans/upload-handler.ts
import { Effect } from "effect"
import { StorageService } from "../../core/storage"
import { PlansService } from "./service"

export const uploadPlanHandler = Effect.gen(function* () {
  const storage = yield* StorageService
  const plans = yield* PlansService
  const request = yield* HttpServerRequest.HttpServerRequest

  // 1. Parse multipart form data
  const formData = await request.formData()
  const file = formData.get("file") as File
  const projectId = formData.get("projectId") as string
  const organizationId = request.headers.get("X-Organization-Id")

  // 2. Generate IDs
  const uploadId = crypto.randomUUID()
  const planId = crypto.randomUUID()

  // 3. Store original PDF in R2
  const pdfPath = `organizations/${organizationId}/projects/${projectId}/uploads/${uploadId}/original/${uploadId}.pdf`
  await storage.upload(pdfPath, await file.arrayBuffer())

  // 4. Create Durable Object for job state
  const jobId = `job-${uploadId}`
  const jobStub = env.PROCESSING_JOBS.get(env.PROCESSING_JOBS.idFromName(jobId))

  // 5. Initialize job in Durable Object
  await jobStub.initialize({
    jobId,
    uploadId,
    planId,
    organizationId,
    projectId,
    pdfPath,
    filename: file.name,
    fileSize: file.size,
    uploadedAt: Date.now()
  })

  // 6. Durable Object will kick off container processing
  // (handled internally by DO)

  // 7. Return job ID to client
  return yield* HttpServerResponse.json({
    jobId,
    planId,
    uploadId,
    status: "pending",
    message: "Processing started"
  })
})
```

### 2. Durable Object (Job State Manager)

**Responsibilities:**
- Store job metadata and progress
- Kick off container processing
- Receive progress updates from container
- Broadcast progress to connected WebSocket clients
- Handle job completion/failure

```typescript
// packages/backend/src/features/processing/job-state.do.ts
import { DurableObject } from "cloudflare:workers"

export interface ProcessingJob {
  jobId: string
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  pdfPath: string
  filename: string
  fileSize: number
  uploadedAt: number
}

export interface JobProgress {
  jobId: string
  uploadId: string
  planId: string
  status: "pending" | "processing" | "complete" | "partial_failure" | "failed"
  totalPages?: number
  completedPages?: number
  failedPages?: number[]
  progress?: number
  startedAt?: number
  completedAt?: number
  lastError?: {
    page: number
    message: string
    timestamp: number
  }
}

export class ProcessingJobState extends DurableObject {

  async initialize(job: ProcessingJob): Promise<void> {
    // Store job metadata
    await this.ctx.storage.put("job", job)

    // Initialize progress
    const progress: JobProgress = {
      jobId: job.jobId,
      uploadId: job.uploadId,
      planId: job.planId,
      status: "pending",
      startedAt: Date.now()
    }
    await this.ctx.storage.put("progress", progress)

    // Kick off container processing
    await this.startContainerProcessing(job)
  }

  private async startContainerProcessing(job: ProcessingJob): Promise<void> {
    // Call Cloudflare Container API
    // This is a fetch to your container service endpoint
    const response = await fetch(this.env.CONTAINER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.env.CONTAINER_API_KEY}`
      },
      body: JSON.stringify({
        jobId: job.jobId,
        uploadId: job.uploadId,
        organizationId: job.organizationId,
        projectId: job.projectId,
        pdfPath: job.pdfPath,
        // Container will use this to call back for progress updates
        callbackUrl: `${this.env.WORKER_URL}/processing/jobs/${job.jobId}/progress`
      })
    })

    if (!response.ok) {
      await this.updateProgress({
        status: "failed",
        lastError: {
          page: -1,
          message: `Failed to start container: ${response.statusText}`,
          timestamp: Date.now()
        }
      })
    }
  }

  async getProgress(): Promise<JobProgress> {
    return await this.ctx.storage.get<JobProgress>("progress") || {
      jobId: this.ctx.id.toString(),
      status: "pending"
    }
  }

  async updateProgress(update: Partial<JobProgress>): Promise<void> {
    const current = await this.getProgress()
    const updated = { ...current, ...update }
    await this.ctx.storage.put("progress", updated)

    // Broadcast to all connected WebSocket clients
    this.ctx.getWebSockets().forEach(ws => {
      ws.send(JSON.stringify({
        type: "progress_update",
        data: updated
      }))
    })
  }

  async markPageComplete(pageNum: number, totalPages: number): Promise<void> {
    const progress = await this.getProgress()
    const completedPages = (progress.completedPages || 0) + 1
    const progressPercent = Math.round((completedPages / totalPages) * 100)

    await this.updateProgress({
      status: "processing",
      completedPages,
      progress: progressPercent,
      totalPages
    })

    // Check if all pages complete
    if (completedPages === totalPages) {
      await this.updateProgress({
        status: "complete",
        completedAt: Date.now()
      })
    }
  }

  async markPageFailed(pageNum: number, error: string): Promise<void> {
    const progress = await this.getProgress()
    const failedPages = [...(progress.failedPages || []), pageNum]

    await this.updateProgress({
      failedPages,
      status: "partial_failure",
      lastError: {
        page: pageNum,
        message: error,
        timestamp: Date.now()
      }
    })
  }

  // WebSocket handler for real-time updates
  async webSocketMessage(ws: WebSocket, message: string) {
    const msg = JSON.parse(message)

    if (msg.type === "subscribe") {
      // Send current progress immediately
      const progress = await this.getProgress()
      ws.send(JSON.stringify({
        type: "progress_update",
        data: progress
      }))
    }
  }
}
```

### 3. Cloudflare Container (Processing Service)

**Responsibilities:**
- Receive processing job from Durable Object
- Download PDF from R2
- Process each page with vips
- Upload tiles to R2
- Report progress back to Durable Object

```typescript
// Container service main handler
import { $ } from "bun"
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { PDFDocument } from "pdf-lib"

interface ContainerRequest {
  jobId: string
  uploadId: string
  organizationId: string
  projectId: string
  pdfPath: string
  callbackUrl: string  // Durable Object endpoint for progress updates
}

async function handleProcessingRequest(req: ContainerRequest) {
  console.log(`Processing job ${req.jobId}`)

  try {
    // 1. Download PDF from R2
    const pdfBuffer = await downloadFromR2(req.pdfPath)
    const localPdfPath = `/tmp/${req.uploadId}.pdf`
    await Bun.write(localPdfPath, pdfBuffer)

    // 2. Get page count
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const totalPages = pdfDoc.getPageCount()

    // 3. Notify Durable Object: starting processing
    await fetch(req.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_progress",
        status: "processing",
        totalPages,
        completedPages: 0,
        progress: 0
      })
    })

    // 4. Process each page
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      try {
        await processPage(req, localPdfPath, pageNum, totalPages)

        // Notify Durable Object: page complete
        await fetch(req.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "page_complete",
            pageNum,
            totalPages
          })
        })

      } catch (error) {
        // Notify Durable Object: page failed
        await fetch(req.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "page_failed",
            pageNum,
            error: error.message
          })
        })
      }
    }

    // 5. Cleanup
    await Bun.file(localPdfPath).unlink()

  } catch (error) {
    console.error(`Job ${req.jobId} failed:`, error)

    // Notify Durable Object: job failed
    await fetch(req.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_progress",
        status: "failed",
        lastError: {
          page: -1,
          message: error.message,
          timestamp: Date.now()
        }
      })
    })
  }
}

async function processPage(
  req: ContainerRequest,
  pdfPath: string,
  pageNum: number,
  totalPages: number
) {
  const sheetId = `sheet-${pageNum + 1}`
  const outputDir = `/tmp/${req.uploadId}/${sheetId}`
  const dziPath = `${outputDir}/${sheetId}.dzi`

  // Create output directory
  await $`mkdir -p ${outputDir}`.quiet()

  // Generate tiles using vips (0-indexed page number)
  await $`vips dzsave ${pdfPath}[page=${pageNum},dpi=300] ${dziPath} --tile-size 256 --overlap 1`

  // Upload DZI and tiles to R2
  const r2BasePath = `organizations/${req.organizationId}/projects/${req.projectId}/sheets/${sheetId}/tiles`
  await uploadDirectoryToR2(outputDir, r2BasePath)

  // Cleanup temp files
  await $`rm -rf ${outputDir}`.quiet()
}
```

### Worker Endpoint for Container Callbacks

```typescript
// packages/backend/src/features/processing/http.ts
export const updateJobProgress = HttpApiEndpoint.post("updateJobProgress", "/jobs/:jobId/progress").pipe(
  HttpApiEndpoint.setPath("/processing/jobs/:jobId/progress")
)

export const updateJobProgressHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const { jobId } = request.params
  const body = await request.json()

  // Get Durable Object stub
  const id = env.PROCESSING_JOBS.idFromName(jobId)
  const stub = env.PROCESSING_JOBS.get(id)

  // Route action to appropriate DO method
  switch (body.action) {
    case "update_progress":
      await stub.updateProgress(body)
      break

    case "page_complete":
      await stub.markPageComplete(body.pageNum, body.totalPages)
      break

    case "page_failed":
      await stub.markPageFailed(body.pageNum, body.error)
      break
  }

  return yield* HttpServerResponse.json({ success: true })
})
```

## vips Command Specification

### Single Page Conversion

```bash
vips dzsave input.pdf[page=N,dpi=300] output.dzi \
  --tile-size 256 \
  --overlap 1
```

### Parameters Explained

| Parameter | Value | Reason |
|-----------|-------|--------|
| `page=N` | 0-indexed page number | Process single page from multi-page PDF |
| `dpi=300` | 300 DPI | Standard resolution for construction drawings |
| `--tile-size 256` | 256 pixels | OpenSeadragon standard, matches our Sharp config |
| `--overlap 1` | 1 pixel | Prevents seams during rendering |

### Output Format

- **DZI file**: `{sheet-id}.dzi` (XML metadata)
- **Tiles directory**: `{sheet-id}_files/` containing zoom levels
- **Tile format**: JPEG (vips default, good balance of quality/size)

## Implementation in Container

### Dockerfile Setup

```dockerfile
FROM ubuntu:22.04

# Install vips
RUN apt-get update && apt-get install -y \
    libvips-tools \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Your application code
COPY . /app
WORKDIR /app
```

### Processing Service (TypeScript/Bun)

```typescript
import { $ } from "bun"
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { PDFDocument } from "pdf-lib"

interface ProcessingJob {
  jobId: string
  uploadId: string
  organizationId: string
  projectId: string
  pdfPath: string  // R2 path
  totalPages?: number
}

async function processUpload(job: ProcessingJob) {
  // 1. Download PDF from R2
  const pdfBuffer = await downloadFromR2(job.pdfPath)
  const localPdfPath = `/tmp/${job.uploadId}.pdf`
  await Bun.write(localPdfPath, pdfBuffer)

  // 2. Get page count
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()

  // 3. Update job with total pages
  await updateJobProgress(job.jobId, {
    status: "processing",
    totalPages,
    completedPages: 0,
    progress: 0
  })

  // 4. Process each page
  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    try {
      await processPage(job, localPdfPath, pageNum, totalPages)
    } catch (error) {
      await handlePageFailure(job, pageNum, error)
    }
  }

  // 5. Cleanup
  await Bun.file(localPdfPath).unlink()

  // 6. Mark complete
  await updateJobProgress(job.jobId, {
    status: "complete",
    completedPages: totalPages,
    progress: 100,
    completedAt: Date.now()
  })
}

async function processPage(
  job: ProcessingJob,
  pdfPath: string,
  pageNum: number,
  totalPages: number
) {
  const sheetId = `sheet-${pageNum + 1}`
  const outputDir = `/tmp/${job.uploadId}/${sheetId}`
  const dziPath = `${outputDir}/${sheetId}.dzi`

  // Create output directory
  await $`mkdir -p ${outputDir}`.quiet()

  // Generate tiles using vips
  await $`vips dzsave ${pdfPath}[page=${pageNum},dpi=300] ${dziPath} --tile-size 256 --overlap 1`

  // Upload DZI and tiles to R2
  const r2BasePath = `organizations/${job.organizationId}/projects/${job.projectId}/sheets/${sheetId}/tiles`
  await uploadDirectoryToR2(outputDir, r2BasePath)

  // Update progress
  const completedPages = pageNum + 1
  const progress = Math.round((completedPages / totalPages) * 100)

  await updateJobProgress(job.jobId, {
    status: "processing",
    completedPages,
    progress
  })

  // Cleanup temp files
  await $`rm -rf ${outputDir}`.quiet()
}
```

## Failure Handling

### Failure Types

1. **PDF Download Failure**: Network issues, R2 unavailable
2. **Page Processing Failure**: Corrupt page, vips error, OOM
3. **Upload Failure**: Network issues, R2 unavailable
4. **Container Crash**: OOM, timeout, infrastructure failure

### Retry Strategy

#### Page-Level Retries

```typescript
async function processPage(job: ProcessingJob, pdfPath: string, pageNum: number, totalPages: number) {
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 1000

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ... processing logic ...
      return // Success!

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES

      if (isLastAttempt) {
        // Give up, mark page as failed
        await markPageFailed(job.jobId, pageNum, error)
        throw error
      }

      // Wait before retry (exponential backoff)
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      await Bun.sleep(delay)

      console.warn(`Retrying page ${pageNum}, attempt ${attempt + 1}/${MAX_RETRIES}`)
    }
  }
}

async function handlePageFailure(job: ProcessingJob, pageNum: number, error: Error) {
  // Store failure info in Durable Object
  await updateJobProgress(job.jobId, {
    status: "partial_failure",
    failedPages: [pageNum],
    lastError: {
      page: pageNum,
      message: error.message,
      timestamp: Date.now()
    }
  })

  // Optional: Capture debug artifacts
  if (process.env.DEBUG) {
    await captureDebugArtifacts(job, pageNum, error)
  }
}
```

#### Job-Level Idempotency

```typescript
async function processPage(job: ProcessingJob, pdfPath: string, pageNum: number, totalPages: number) {
  const sheetId = `sheet-${pageNum + 1}`
  const r2BasePath = `organizations/${job.organizationId}/projects/${job.projectId}/sheets/${sheetId}/tiles`

  // Check if already processed (idempotent)
  const dziPath = `${r2BasePath}/${sheetId}.dzi`
  const exists = await checkR2ObjectExists(dziPath)

  if (exists) {
    console.log(`Sheet ${sheetId} already processed, skipping...`)
    return
  }

  // ... proceed with processing ...
}
```

### Container Crash Recovery

When a container crashes mid-processing, the job remains in "processing" state. Use a cleanup/recovery mechanism:

```typescript
// In Worker: Check for stale jobs periodically
async function cleanupStaleJobs() {
  const staleJobs = await findJobsInState("processing", {
    olderThan: Date.now() - 30 * 60 * 1000 // 30 minutes
  })

  for (const job of staleJobs) {
    // Re-queue for processing
    await requeueJob(job.jobId)
  }
}
```

## Progress Monitoring with Durable Objects

### Durable Object: ProcessingJobState

```typescript
// packages/backend/src/features/processing/job-state.do.ts
import { DurableObject } from "cloudflare:workers"

export interface JobProgress {
  jobId: string
  uploadId: string
  planId: string
  status: "pending" | "processing" | "complete" | "partial_failure" | "failed"
  totalPages?: number
  completedPages?: number
  failedPages?: number[]
  progress?: number
  startedAt?: number
  completedAt?: number
  lastError?: {
    page: number
    message: string
    timestamp: number
  }
}

export class ProcessingJobState extends DurableObject {
  async getProgress(): Promise<JobProgress> {
    return await this.ctx.storage.get<JobProgress>("progress") || {
      jobId: this.ctx.id.toString(),
      status: "pending"
    }
  }

  async updateProgress(update: Partial<JobProgress>): Promise<void> {
    const current = await this.getProgress()
    const updated = { ...current, ...update }
    await this.ctx.storage.put("progress", updated)

    // Broadcast to connected WebSocket clients (if any)
    this.ctx.broadcast(JSON.stringify(updated))
  }

  async markPageComplete(pageNum: number, totalPages: number): Promise<void> {
    const progress = await this.getProgress()
    const completedPages = (progress.completedPages || 0) + 1
    const progressPercent = Math.round((completedPages / totalPages) * 100)

    await this.updateProgress({
      completedPages,
      progress: progressPercent,
      status: completedPages === totalPages ? "complete" : "processing"
    })
  }

  async markPageFailed(pageNum: number, error: string): Promise<void> {
    const progress = await this.getProgress()
    const failedPages = [...(progress.failedPages || []), pageNum]

    await this.updateProgress({
      failedPages,
      status: "partial_failure",
      lastError: {
        page: pageNum,
        message: error,
        timestamp: Date.now()
      }
    })
  }
}
```

### Worker API: Query Progress

```typescript
// packages/backend/src/features/processing/http.ts
import { HttpApiEndpoint } from "@effect/platform"

export const getJobProgress = HttpApiEndpoint.get("getJobProgress", "/jobs/:jobId/progress").pipe(
  HttpApiEndpoint.setPath("/processing/jobs/:jobId/progress")
)

// Implementation
export const getJobProgressHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const { jobId } = request.params

  // Get Durable Object stub
  const id = env.PROCESSING_JOBS.idFromName(jobId)
  const stub = env.PROCESSING_JOBS.get(id)

  // Query progress
  const progress = await stub.getProgress()

  return yield* HttpServerResponse.json(progress)
})
```

### Real-Time Progress with WebSockets (Optional)

```typescript
// In Durable Object
export class ProcessingJobState extends DurableObject {
  async webSocketMessage(ws: WebSocket, message: string) {
    if (message === "subscribe") {
      // Client wants real-time updates
      ws.accept()

      // Send current progress immediately
      const progress = await this.getProgress()
      ws.send(JSON.stringify(progress))
    }
  }

  async updateProgress(update: Partial<JobProgress>): Promise<void> {
    const current = await this.getProgress()
    const updated = { ...current, ...update }
    await this.ctx.storage.put("progress", updated)

    // Broadcast to all connected WebSocket clients
    this.ctx.getWebSockets().forEach(ws => {
      ws.send(JSON.stringify(updated))
    })
  }
}
```

### Frontend: Subscribe to Progress

```typescript
// Mobile app or web dashboard
const ws = new WebSocket(`wss://api.sitelink.app/processing/jobs/${jobId}/subscribe`)

ws.onmessage = (event) => {
  const progress = JSON.parse(event.data)

  // Update UI
  updateProgressBar(progress.progress)
  updateStatus(`Processing page ${progress.completedPages}/${progress.totalPages}`)

  if (progress.status === "complete") {
    showSuccess("Plan processing complete!")
    ws.close()
  } else if (progress.status === "failed") {
    showError(`Processing failed: ${progress.lastError?.message}`)
    ws.close()
  }
}
```

## Monitoring and Observability

### Key Metrics to Track

1. **Processing Time**: Total time per plan, average time per page
2. **Success Rate**: Percentage of successfully processed pages/plans
3. **Failure Rate**: Pages/plans that failed after all retries
4. **Queue Depth**: Number of pending jobs
5. **Container Utilization**: Memory, CPU usage

### Logging Strategy

```typescript
async function processPage(job: ProcessingJob, pdfPath: string, pageNum: number, totalPages: number) {
  const startTime = Date.now()

  try {
    console.log(JSON.stringify({
      event: "page_processing_started",
      jobId: job.jobId,
      pageNum,
      totalPages,
      timestamp: startTime
    }))

    // ... processing logic ...

    const duration = Date.now() - startTime
    console.log(JSON.stringify({
      event: "page_processing_complete",
      jobId: job.jobId,
      pageNum,
      duration,
      timestamp: Date.now()
    }))

  } catch (error) {
    console.error(JSON.stringify({
      event: "page_processing_failed",
      jobId: job.jobId,
      pageNum,
      error: error.message,
      duration: Date.now() - startTime,
      timestamp: Date.now()
    }))
    throw error
  }
}
```

## Performance Considerations

### Container Resource Limits

```yaml
# Example container config
resources:
  memory: 2GB      # vips can be memory-intensive with large PDFs
  cpu: 2           # Parallel processing capability
  timeout: 600s    # 10 minutes max per job
```

### Concurrency Control

```typescript
// Limit concurrent page processing to avoid OOM
const CONCURRENT_PAGES = 2  // Process 2 pages at a time

async function processUpload(job: ProcessingJob) {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()

  // Process in batches
  for (let i = 0; i < totalPages; i += CONCURRENT_PAGES) {
    const batch = Array.from(
      { length: Math.min(CONCURRENT_PAGES, totalPages - i) },
      (_, j) => i + j
    )

    await Promise.all(
      batch.map(pageNum => processPage(job, localPdfPath, pageNum, totalPages))
    )
  }
}
```

## Debug Mode

### Enabling Debug Artifacts

```typescript
if (process.env.DEBUG === "true") {
  // Keep intermediate files on failure
  await $`mkdir -p /tmp/debug/${job.jobId}/${sheetId}`.quiet()

  // Extract page as separate PDF for inspection
  const debugPdf = await PDFDocument.create()
  const [page] = await debugPdf.copyPages(pdfDoc, [pageNum])
  debugPdf.addPage(page)
  const pdfBytes = await debugPdf.save()

  await Bun.write(`/tmp/debug/${job.jobId}/${sheetId}/page.pdf`, pdfBytes)

  // Upload to R2 with TTL
  await uploadToR2WithTTL(
    `/tmp/debug/${job.jobId}/${sheetId}`,
    `debug/${job.jobId}/${sheetId}`,
    7 * 24 * 60 * 60  // 7 days TTL
  )
}
```

## Consensus Analysis Summary

We evaluated three approaches:

1. **Approach A**: Multi-page PDF → Single-page PDFs → PNG → DZI tiles
2. **Approach B**: Multi-page PDF → Direct PNG extraction (pdftoppm -f/-l) → DZI tiles
3. **Approach C** (chosen): Multi-page PDF → vips direct → DZI tiles

**Winner: Approach C (vips)**

- Eliminates all intermediate files
- Significantly faster in benchmarks
- Simpler codebase with fewer failure modes
- Industry-proven (used in document management systems)
- Direct support for PDF input with page selection

Key insight: `vips dzsave` can read PDFs directly with `[page=N,dpi=300]` syntax, making intermediate extraction steps unnecessary.

## References

- libvips documentation: https://www.libvips.org/
- Deep Zoom Image format: https://docs.microsoft.com/en-us/previous-versions/windows/silverlight/dotnet-windows-silverlight/cc645077(v=vs.95)
- OpenSeadragon viewer: https://openseadragon.github.io/
- Construction document retention requirements: https://www.pbmares.com/construction-document-retention/
