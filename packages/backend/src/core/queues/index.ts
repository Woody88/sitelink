import type { R2Notification, TileJob, MetadataExtractionJob, MarkerDetectionJob, SheetMarkerDetectionJob } from "./types";
import { PDFDocument } from "pdf-lib";
import { extract } from "tar-stream"
import { Readable } from "node:stream"
import { drizzle } from "drizzle-orm/d1"
import { eq, and } from "drizzle-orm"
import { planSheets, planMarkers, processingJobs } from "../database/schemas"

// Timeout for tar extraction (5 minutes)
const TAR_EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Helper function to fetch tiles from R2 and encode them as base64
 * Returns a JSON payload ready to send to the Python container
 */
async function generateBase64TilesPayload(
  tileKeys: string[],
  env: Env
): Promise<{ tiles: Array<{ filename: string; data: string }> }> {
  console.log(`🎯 [BASE64] Fetching ${tileKeys.length} tiles from R2...`)

  // Fetch all tiles in parallel
  const tilePromises = tileKeys.map(async (key) => {
    try {
      const obj = await env.SitelinkStorage.get(key)
      if (!obj) {
        console.warn(`⚠️ Tile not found: ${key}`)
        return null
      }
      
      // Read tile data as ArrayBuffer
      const data = await obj.arrayBuffer()
      
      // Convert to base64 using btoa with Uint8Array
      const uint8Array = new Uint8Array(data)
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]!)
      }
      const base64 = btoa(binary)
      
      // Extract filename from key
      const filename = key.split('/').pop() || key
      
      return { filename, data: base64 }
    } catch (error) {
      console.error(`❌ Error fetching tile ${key}:`, error)
      return null
    }
  })

  const tiles = (await Promise.all(tilePromises)).filter((t): t is { filename: string; data: string } => t !== null)
  
  console.log(`✅ [BASE64] Successfully encoded ${tiles.length}/${tileKeys.length} tiles`)
  
  return { tiles }
}

/**
 * Insert markers with deduplication to prevent duplicate markers across chunks
 * Checks for existing markers by planId + sheetNumber + markerType + x + y coordinates
 */
async function insertMarkersWithDeduplication(
  markers: Array<{
    marker_text: string
    detail: string
    sheet: string
    marker_type: string
    confidence: number
    is_valid: boolean
    fuzzy_matched?: boolean
    source_tile?: string
    sheet_number?: number
    bbox?: { x: number; y: number; w: number; h: number }
  }>,
  chunkId: string,
  planId: string,
  uploadId: string,
  env: Env
): Promise<{ inserted: number; duplicates: number }> {
  const db = drizzle(env.SitelinkDB)

  let inserted = 0
  let duplicates = 0

  console.log(`💾 [DEDUP] Processing ${markers.length} markers for chunk ${chunkId}`)

  for (const marker of markers) {
    // Check if marker already exists
    // We deduplicate based on: planId + sheetNumber + markerType + coordinates (x, y from bbox)
    const sheetNumber = marker.sheet_number || 1
    const x = marker.bbox?.x || 0
    const y = marker.bbox?.y || 0

    const existing = await db
      .select({ id: planMarkers.id })
      .from(planMarkers)
      .where(
        and(
          eq(planMarkers.planId, planId),
          eq(planMarkers.sheetNumber, sheetNumber),
          eq(planMarkers.markerType, marker.marker_type),
          eq(planMarkers.bbox, marker.bbox ? JSON.stringify(marker.bbox) : null)
        )
      )
      .then((rows) => rows[0])

    if (existing) {
      duplicates++
      console.log(`⏭️  [DEDUP] Skipping duplicate marker: ${marker.marker_text} at (${x}, ${y})`)
      continue
    }

    // Insert new marker with chunk metadata
    const markerRecord = {
      id: crypto.randomUUID(),
      uploadId: uploadId,
      planId: planId,
      sheetNumber: sheetNumber,
      markerText: marker.marker_text,
      detail: marker.detail,
      sheet: marker.sheet,
      markerType: marker.marker_type,
      confidence: marker.confidence,
      isValid: marker.is_valid,
      fuzzyMatched: marker.fuzzy_matched ?? false,
      sourceTile: marker.source_tile ?? null,
      bbox: marker.bbox ? JSON.stringify(marker.bbox) : null,
    }

    await db.insert(planMarkers).values(markerRecord)
    inserted++
  }

  console.log(`✅ [DEDUP] Inserted ${inserted} new markers, skipped ${duplicates} duplicates for chunk ${chunkId}`)

  return { inserted, duplicates }
}

export async function tileGenerationQueueConsumer(
  batch: MessageBatch<TileJob>,
  env: Env,
  _ctx: ExecutionContext
) {
  console.log(`🚀 [QUEUE CONSUMER] Processing ${batch.messages.length} tile generation 
jobs`)

  // Process all messages and wait for completion
  await Promise.allSettled(
    batch.messages.map(async (message) => {
      try {
        await processJob(message, env)
        console.log(`✅ Successfully processed sheet ${message.body.sheetNumber}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Error processing tile job for sheet ${message.body.sheetNumber}:`, error)
        message.retry()
      }
    })
  )

  console.log(`✅ [QUEUE CONSUMER] Finished processing batch`)
}

async function processJob(message: Message<TileJob>, env: Env) {
  const job = message.body
  console.log(`✅ [QUEUE CONSUMER] Processing tile job for sheet ${job.sheetNumber}/${job.totalSheets}`)
  console.log(`   Upload ID: ${job.uploadId}`)
  console.log(`   Plan ID: ${job.planId}`)
  console.log(`   Sheet Key: ${job.sheetKey}`)
  // Use sheetId for container isolation - each sheet gets its own container instance
  const container = env.SITELINK_PDF_PROCESSOR.getByName(job.sheetId)
  const sheet = await env.SitelinkStorage.get(job.sheetKey)

  if (!sheet){
    console.error(`❌ Sheet not found: ${job.sheetKey}`)
    throw new Error(`Sheet not found: ${job.sheetKey}`)
  }

  // With wrangler 4.50.0, we can stream R2 bodies directly through service bindings
  console.log(`📦 Streaming sheet PDF from R2 to container...`)

  const request = new Request("http://localhost/generate-tiles", {
    method: "POST",
    body: sheet.body,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": sheet.size.toString(), // CRITICAL: Required for streaming through service bindings
      "X-Sheet-Key": job.sheetKey,
      "X-Sheet-Number": job.sheetNumber.toString(),
      "X-Sheet-Total-Count": job.totalSheets.toString(),
      "X-Upload-Id": job.uploadId,
      "X-Organization-Id": job.organizationId,
      "X-Project-Id": job.projectId,
      "X-Plan-Id": job.planId,
    },
  })

  console.log(`📦 Fetching tiles from container for sheet ${job.sheetNumber}...`)

  // Cloudflare's defaultPort mechanism ensures container is ready before responding
  // No manual health check needed - the first fetch will block until port is ready

  // Add timeout for container fetch (15 minutes for tile generation + cold start)
  const CONTROLLER_TIMEOUT_MS = 15 * 60 * 1000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(`⏱️ Container fetch timeout after ${CONTROLLER_TIMEOUT_MS / 1000}s`)
    controller.abort()
  }, CONTROLLER_TIMEOUT_MS)
  
  try {
    console.log(`📦 Sending tile generation request to container...`)
    const response = await container.fetch(request, { signal: controller.signal })
    clearTimeout(timeoutId)
    console.log(`📦 Container response: ${response.status} ${response.statusText}, Content-Type: ${response.headers.get('Content-Type')}`)

    if (!response.ok){
      const errorText = await response.text().catch(() => 'No error details')
      console.error(`❌ Failed to generate tiles: ${response.statusText}`, errorText)
      throw new Error(`Failed to generate tiles: ${response.statusText} - ${errorText}`)
    }

    console.log(`📦 Starting tar extraction...`)
  const extractor = extract()

  // Track tile count
  let tileCount = 0

  extractor.on("entry", (header, entryStream, next) => {
    console.log(`📦 Processing tar entry: ${header.name} (${header.size} bytes)`)

    if (header.size === undefined) {
      console.error(`❌ Tar entry ${header.name} has no size`)
      next(new Error(`Tar entry ${header.name} has no size`))
      return
    }

    // Ensure header.size is an integer
    const size = Number.parseInt(String(header.size), 10)
    if (Number.isNaN(size) || size < 0) {
      console.error(`❌ Tar entry ${header.name} has invalid size: ${header.size}`)
      next(new Error(`Tar entry ${header.name} has invalid size: ${header.size}`))
      return
    }

    const {writable, readable} = new FixedLengthStream(size)

    // Determine content type
    const contentType = header.name.endsWith('.jpg')
      ? 'image/jpeg'
      : header.name.endsWith('.dzi')
      ? 'application/xml'
      : 'application/octet-stream'

    // Count JPEG tiles only (not DZI metadata files)
    if (header.name.endsWith('.jpg')) {
      tileCount++
    }

    const r2Key = `organizations/${job.organizationId}/projects/${job.projectId}/plans/${job.planId}/sheets/sheet-${job.sheetNumber}/${header.name}`

    // CRITICAL: Resume the Node.js stream BEFORE starting the async pipeline
    // Without this, the stream stays paused and pipeTo() never receives data
    entryStream.resume()
    console.log(`📦 Stream resumed, starting pipeline for ${header.name}`)

    // Manually convert Node.js stream to Web ReadableStream
    // Readable.toWeb() doesn't work reliably in Cloudflare Workers
    const webStream = new ReadableStream({
      start(controller) {
        entryStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk))
        })
        
        entryStream.on('end', () => {
          controller.close()
        })
        
        entryStream.on('error', (error) => {
          controller.error(error)
        })
      },
      cancel() {
        entryStream.destroy()
      }
    })

    // Start R2 upload immediately (must run in parallel with pipeTo to avoid backpressure deadlock)
    console.log(`📦 Starting R2 upload for: ${r2Key}`)
    const uploadPromise = env.SitelinkStorage.put(r2Key, readable, {
      httpMetadata: { contentType }
    })

    // Process stream asynchronously but call next() when done
    webStream.pipeTo(writable)
      .then(() => {
        console.log(`📦 Stream piped, waiting for upload to complete...`)
        return uploadPromise
      })
      .then(() => {
        console.log(`✅ Uploaded: ${header.name} (${size} bytes)`)
        next()
      })
      .catch((error) => {
        console.error(`❌ Error uploading tile:`, error)
        next(error)
      })
  })

  await Promise.race([
    new Promise<void>((resolve, reject) => {
      // CRITICAL: Attach event listeners BEFORE any stream operations
      extractor.on("finish", () => {
        console.log("✅ All tiles uploaded to R2")
        resolve()
      })

      extractor.on("error", (error) => {
        console.error("❌ Tar extraction error:", error)
        reject(error)
      })

      // Add null check and detailed logging
      if (!response.body) {
        const error = new Error("Container returned empty response body (null)")
        console.error(`❌ ${error.message}`)
        reject(error)
        return
      }

      console.log(`📦 Converting Web stream to Node stream and piping to extractor...`)
      try {
        const nodeStream = Readable.fromWeb(response.body as any)
        nodeStream.pipe(extractor)
      } catch (error) {
        console.error(`❌ Failed to pipe stream:`, error)
        reject(error)
      }
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => {
        const error = new Error(`Tar extraction timeout after ${TAR_EXTRACTION_TIMEOUT_MS / 1000}s`)
        console.error(`❌ ${error.message}`)
        reject(error)
      }, TAR_EXTRACTION_TIMEOUT_MS)
    )
  ])

    console.log(`✅ Successfully generated ${tileCount} tiles for sheet ${job.sheetNumber}`)

    // Update database: mark sheet as complete with tile count
    const db = drizzle(env.SitelinkDB)
  console.log(`💾 Updating plan_sheets table for sheet ${job.sheetNumber}...`)

  // First, get the sheet ID from the database
  const sheetRecord = await db
    .select({ id: planSheets.id })
    .from(planSheets)
    .where(eq(planSheets.sheetKey, job.sheetKey))
    .then((rows) => rows[0])

  if (!sheetRecord) {
    console.error(`❌ Sheet record not found for key: ${job.sheetKey}`)
    throw new Error(`Sheet record not found for key: ${job.sheetKey}`)
  }

  await db.update(planSheets)
    .set({
      status: "complete",
      tileCount: tileCount,
      processingCompletedAt: new Date()
    })
    .where(eq(planSheets.id, sheetRecord.id))

  console.log(`✅ Updated plan_sheets: status=complete, tileCount=${tileCount}`)

  // Notify PlanCoordinator that this sheet's tile generation is complete
  console.log(`📦 Notifying PlanCoordinator of tile completion...`)
  try {
    const coordinatorId = env.PLAN_COORDINATOR.idFromName(job.uploadId)
    const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)
    const coordinatorResponse = await coordinator.fetch("http://localhost/tile-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetNumber: job.sheetNumber,
      }),
    })

    if (!coordinatorResponse.ok) {
      const errorText = await coordinatorResponse.text()
      console.error(`❌ Failed to notify PlanCoordinator: ${coordinatorResponse.statusText}`, errorText)
      throw new Error(`Failed to notify PlanCoordinator: ${coordinatorResponse.statusText}`)
    }

    const coordinatorResult = await coordinatorResponse.json() as {
      success: boolean
      progress: {
        completedTiles: number
        totalSheets: number
        status: string
      }
    }
    console.log(`✅ PlanCoordinator updated - Tile Progress: ${coordinatorResult.progress.completedTiles}/${coordinatorResult.progress.totalSheets}`)
  } catch (error) {
    console.error(`❌ Error notifying PlanCoordinator:`, error)
    throw error
  }

    console.log(`✅ Successfully generated tiles for sheet ${job.sheetNumber}`)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`❌ Container fetch timeout after ${CONTROLLER_TIMEOUT_MS / 1000}s`)
      throw new Error(`Tile generation timeout: Container did not respond within ${CONTROLLER_TIMEOUT_MS / 1000} seconds`)
    }
    console.error(`❌ Error generating tiles for sheet ${job.sheetNumber}:`, error)
    throw error
  }
}


export async function pdfProcessingQueueConsumer(batch: MessageBatch<R2Notification>, env: Env, _ctx: ExecutionContext) {
  console.log(`🚀 [QUEUE CONSUMER] Processing ${batch.messages.length} PDF processing jobs`)

  // Process all messages and wait for completion
  await Promise.allSettled(
    batch.messages.map(async (message) => {
      try {
        console.log("Loading PDF from R2...")
        const pdfBuffer = await env.SitelinkStorage.get(message.body.object.key).then((pdfObject) => pdfObject?.arrayBuffer())
        if (!pdfBuffer) {
          throw new Error(`PDF not found: ${message.body.object.key}`)
        }

        const pdfDoc = await PDFDocument.load(pdfBuffer)
        const totalPages = pdfDoc.getPageCount()

        const match = message.body.object.key.match(/^organizations\/([^\/]+)\/projects\/([^\/]+)\/plans\/([^\/]+)\/uploads\/([^\/]+)\/original\.pdf$/)
        if (!match) {
          throw new Error(`Invalid PDF key: ${message.body.object.key}`)
        }

        const [_, organizationId, projectId, planId, uploadId] = match
        if (!organizationId || !projectId || !planId || !uploadId) {
          throw new Error(`Invalid PDF key format: ${message.body.object.key}`)
        }

        // Update processing job: set status to "processing" and totalPages
        const db = drizzle(env.SitelinkDB)
        const job = await db
          .select({ id: processingJobs.id })
          .from(processingJobs)
          .where(eq(processingJobs.uploadId, uploadId))
          .then((rows) => rows[0])

        if (job) {
          await db
            .update(processingJobs)
            .set({
              status: "processing",
              totalPages,
              startedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(processingJobs.id, job.id))
          console.log(`✅ Updated processing job ${job.id}: status=processing, totalPages=${totalPages}`)
        }

        // Step 1: Split PDF into individual sheets with 1-indexed file naming (sheet-1.pdf, sheet-2.pdf, etc.)
        console.log(`📄 Splitting PDF into ${totalPages} sheets...`)
        const sheetKeys: string[] = []
        for (let i = 0; i < totalPages; i++){
          const sheetBytes = await splitPdfIntoSheets(pdfDoc, i)
          const sheetKey = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/uploads/${uploadId}/sheet-${i+1}.pdf`
          await env.SitelinkStorage.put(sheetKey, sheetBytes)
          sheetKeys.push(sheetKey)
        }
        console.log(`✅ Split PDF into ${totalPages} sheets and uploaded to R2`)

        // ========== DATABASE INTEGRATION: Insert PLAN_SHEETS records ==========
        console.log(`💾 Inserting ${totalPages} sheet records into database...`)

        const sheetRecords = []
        for (let i = 0; i < totalPages; i++) {
          const sheetId = crypto.randomUUID()
          const sheetNumber = i + 1 // 1-indexed
          const sheetKey = sheetKeys[i]
          if (!sheetKey) {
            throw new Error(`Sheet key not found for index ${i}`)
          }

          sheetRecords.push({
            id: sheetId,
            uploadId,
            planId,
            sheetNumber,
            sheetKey,
            metadataStatus: "pending" as const,
            createdAt: new Date(),
          })
        }

        await db.insert(planSheets).values(sheetRecords)
        console.log(`✅ Successfully inserted ${sheetRecords.length} sheet records into database`)
        // ========== END DATABASE INTEGRATION ==========

        // Step 2: Initialize the PlanCoordinator
        console.log(`📋 Initializing PlanCoordinator for uploadId=${uploadId}, totalSheets=${totalPages}`)
        const coordinatorId = env.PLAN_COORDINATOR.idFromName(uploadId)
        const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)

        // Dynamic timeout: 10 min base + 5 min per sheet (accounts for container startup, processing, retries)
        // Example: 1 sheet = 15 min, 7 sheets = 45 min, 20 sheets = 110 min
        const timeoutMs = (10 * 60 * 1000) + (totalPages * 5 * 60 * 1000)
        console.log(`📋 Setting timeout to ${Math.round(timeoutMs / 60000)} minutes for ${totalPages} sheets`)

        const coordinatorResponse = await coordinator.fetch("http://localhost/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId,
            totalSheets: totalPages,
            timeoutMs,
          }),
        })

        if (!coordinatorResponse.ok) {
          throw new Error(`Failed to initialize PlanCoordinator: ${coordinatorResponse.statusText}`)
        }

        const coordinatorInitResult = await coordinatorResponse.json()
        console.log(`✅ PlanCoordinator initialized:`, coordinatorInitResult)

        // Step 3: Enqueue metadata extraction jobs for each sheet
        console.log(`📝 Enqueueing metadata extraction jobs for ${totalPages} sheets...`)
        const metadataJobs: MetadataExtractionJob[] = []
        for (let i = 0; i < totalPages; i++) {
          const sheetNumber = i + 1 // 1-indexed
          const sheetRecord = sheetRecords[i]
          const sheetKey = sheetKeys[i]
          if (!sheetRecord || !sheetKey) {
            throw new Error(`Sheet record or key not found for index ${i}`)
          }
          const job: MetadataExtractionJob = {
            uploadId,
            planId,
            sheetId: sheetRecord.id,
            sheetNumber,
            sheetKey,
            totalSheets: totalPages,
          }
          metadataJobs.push(job)
        }

        // Send all metadata extraction jobs to the queue
        for (const job of metadataJobs) {
          await env.METADATA_EXTRACTION_QUEUE.send(job)
          console.log(`📝 Enqueued metadata extraction job: sheet ${job.sheetNumber}/${job.totalSheets}`)
        }

        console.log(`✅ Successfully processed PDF processing job for ${message.body.object.key}`)
        
        // Update processing job: set status to "complete" when PDF processing is done
        // Note: This marks PDF splitting as complete, but tiles may still be processing
        if (job) {
          await db
            .update(processingJobs)
            .set({
              status: "processing", // Keep as "processing" since tiles are still being generated
              updatedAt: new Date(),
            })
            .where(eq(processingJobs.id, job.id))
        }
        
        message.ack()
      } catch (error) {
        console.error(`❌ Error processing PDF processing job:`, error)
        
        // Update processing job: set status to "failed" on error
        const db = drizzle(env.SitelinkDB)
        const match = message.body.object.key.match(/^organizations\/([^\/]+)\/projects\/([^\/]+)\/plans\/([^\/]+)\/uploads\/([^\/]+)\/original\.pdf$/)
        if (match) {
          const [_, , , , uploadId] = match
          if (uploadId) {
            const job = await db
              .select({ id: processingJobs.id })
              .from(processingJobs)
              .where(eq(processingJobs.uploadId, uploadId))
              .then((rows) => rows[0])
          
          if (job) {
            await db
              .update(processingJobs)
              .set({
                status: "failed",
                lastError: error instanceof Error ? error.message : String(error),
                updatedAt: new Date(),
              })
              .where(eq(processingJobs.id, job.id))
            console.log(`❌ Updated processing job ${job.id}: status=failed`)
          }
          }
        }
        
        message.retry()
      }
    })
  )

  console.log(`✅ [QUEUE CONSUMER] Finished pdf processing batch`)
}

async function splitPdfIntoSheets(pdfDoc: PDFDocument, index: number) {
  const singlePageDoc = await PDFDocument.create()
  const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [index])
  singlePageDoc.addPage(copiedPage)
  return await singlePageDoc.save()
}

export async function metadataExtractionQueueConsumer(
  batch: MessageBatch<MetadataExtractionJob>,
  env: Env,
  _ctx: ExecutionContext
) {
  console.log(`🚀 [QUEUE CONSUMER] Processing ${batch.messages.length} metadata extraction jobs`)

  // Process all messages in parallel
  await Promise.allSettled(
    batch.messages.map(async (message) => {
      try {
        await processMetadataJob(message, env)
        console.log(`✅ Successfully extracted metadata for sheet ${message.body.sheetNumber}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Error extracting metadata for sheet ${message.body.sheetNumber}:`, error)
        message.retry()
      }
    })
  )

  console.log(`✅ [QUEUE CONSUMER] Finished processing metadata extraction batch`)
}

async function processMetadataJob(message: Message<MetadataExtractionJob>, env: Env) {
  const job = message.body
  console.log(`📝 [METADATA] Extracting metadata for sheet ${job.sheetNumber}/${job.totalSheets}`)
  console.log(`   Upload ID: ${job.uploadId}`)
  console.log(`   Sheet ID: ${job.sheetId}`)
  console.log(`   Sheet Key: ${job.sheetKey}`)

  // Get the sheet PDF from R2
  const sheet = await env.SitelinkStorage.get(job.sheetKey)
  if (!sheet) {
    console.error(`❌ Sheet not found: ${job.sheetKey}`)
    throw new Error(`Sheet not found: ${job.sheetKey}`)
  }

  // Get the sheet content as blob
  const sheetBlob = await sheet.blob()

  // Use sheetId for container isolation - each sheet gets its own container instance
  const container = env.PLAN_OCR_SERVICE.getByName(job.sheetId)

  // Cloudflare's defaultPort mechanism ensures container is ready before responding
  // No manual health check needed - the first fetch will block until port is ready

  // Call the plan-ocr-service to extract metadata
  console.log(`📝 Calling plan-ocr-service for metadata extraction...`)
  const response = await container.fetch("http://localhost/api/extract-metadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Sheet-Id": job.sheetId,
    },
    body: sheetBlob,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Failed to extract metadata: ${response.statusText}`, errorText)
    throw new Error(`Failed to extract metadata: ${response.statusText}`)
  }

  const result = await response.json() as { sheet_number: string }
  console.log(`✅ Extracted sheet number: ${result.sheet_number}`)

  // Update the database with the extracted metadata
  const db = drizzle(env.SitelinkDB)
  console.log(`💾 Updating database for sheet ${job.sheetId}...`)
  await db.update(planSheets)
    .set({
      sheetName: result.sheet_number,
      metadataStatus: "extracted",
      metadataExtractedAt: new Date()
    })
    .where(eq(planSheets.id, job.sheetId))
  console.log(`✅ Database updated with extracted metadata`)

  // Update processing job: increment completedPages
  const processingJob = await db
    .select({ id: processingJobs.id, completedPages: processingJobs.completedPages })
    .from(processingJobs)
    .where(eq(processingJobs.uploadId, job.uploadId))
    .then((rows) => rows[0])

  if (processingJob) {
    const newCompletedPages = (processingJob.completedPages || 0) + 1
    const progress = Math.round((newCompletedPages / job.totalSheets) * 100)
    await db
      .update(processingJobs)
      .set({
        completedPages: newCompletedPages,
        progress,
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, processingJob.id))
    console.log(`✅ Updated processing job: completedPages=${newCompletedPages}/${job.totalSheets}, progress=${progress}%`)
  }

  // Notify PlanCoordinator that this sheet's metadata extraction is complete
  console.log(`📝 Notifying PlanCoordinator of sheet completion...`)
  try {
    const coordinatorId = env.PLAN_COORDINATOR.idFromName(job.uploadId)
    const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)
    const coordinatorResponse = await coordinator.fetch("http://localhost/sheet-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetNumber: job.sheetNumber,
        validSheets: [],  // Will be accumulated progressively during marker detection phase
      }),
    })

    if (!coordinatorResponse.ok) {
      const errorText = await coordinatorResponse.text()
      console.error(`❌ Failed to notify PlanCoordinator: ${coordinatorResponse.statusText}`, errorText)
      throw new Error(`Failed to notify PlanCoordinator: ${coordinatorResponse.statusText}`)
    }

    const coordinatorResult = await coordinatorResponse.json() as {
      success: boolean
      progress: {
        completedSheets: number
        totalSheets: number
        status: string
      }
    }
    console.log(`✅ PlanCoordinator updated - Progress: ${coordinatorResult.progress.completedSheets}/${coordinatorResult.progress.totalSheets}`)
  } catch (error) {
    console.error(`❌ Error notifying PlanCoordinator:`, error)
    throw error
  }

  console.log(`✅ Successfully extracted metadata for sheet ${job.sheetNumber}`)
}

export async function markerDetectionQueueConsumer(
  batch: MessageBatch<MarkerDetectionJob>,
  env: Env,
  _ctx: ExecutionContext
) {
  console.log(`🚀 [QUEUE CONSUMER] Processing ${batch.messages.length} marker detection jobs`)

  // Process messages one at a time (marker detection is plan-level, not sheet-level)
  await Promise.allSettled(
    batch.messages.map(async (message) => {
      try {
        await processMarkerDetectionJob(message, env)
        console.log(`✅ Successfully detected markers for plan ${message.body.planId}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Error detecting markers for plan ${message.body.planId}:`, error)
        message.retry()
      }
    })
  )

  console.log(`✅ [QUEUE CONSUMER] Finished processing marker detection batch`)
}

async function processMarkerDetectionJob(message: Message<MarkerDetectionJob>, env: Env) {
  const job = message.body

  // Check if this is a chunked job
  const isChunked = job.isChunked ?? false

  if (isChunked) {
    console.log(`🎯 [MARKERS - CHUNKED] Processing chunk ${job.chunkIndex! + 1}/${job.totalChunks} for plan ${job.planId}`)
    console.log(`   Upload ID: ${job.uploadId}`)
    console.log(`   Chunk ID: ${job.chunkId}`)
    console.log(`   Tiles in chunk: ${job.tileKeys?.length || 0}`)
  } else {
    console.log(`🎯 [MARKERS] Detecting markers for plan ${job.planId}`)
    console.log(`   Upload ID: ${job.uploadId}`)
    console.log(`   Valid Sheets: ${job.validSheets.join(", ")}`)
  }

  let tileKeys: string[]
  let tileCount: number

  // Determine which tiles to process
  if (isChunked && job.tileKeys && job.tileKeys.length > 0) {
    // CHUNKED PATH: Use specific tiles from the job
    tileKeys = job.tileKeys
    tileCount = tileKeys.length
    console.log(`🎯 [CHUNK] Processing ${tileCount} tiles in chunk ${job.chunkIndex! + 1}/${job.totalChunks}`)
  } else {
    // NON-CHUNKED PATH: List all tiles from R2
    const tilePrefix = `organizations/${job.organizationId}/projects/${job.projectId}/plans/${job.planId}/sheets/`
    console.log(`🎯 Listing tiles from R2: ${tilePrefix}`)

    const tileList = await env.SitelinkStorage.list({ prefix: tilePrefix })
    tileKeys = tileList.objects
      .filter(obj => obj.key.endsWith('.jpg'))
      .map(obj => obj.key)

    console.log(`🎯 Found ${tileKeys.length} tile images`)

    if (tileKeys.length === 0) {
      console.warn(`⚠️ No tiles found for plan ${job.planId}`)
      return
    }

    tileCount = tileKeys.length
  }

  // Fetch tiles from R2 and encode as base64
  console.log(`📦 [BASE64] Fetching and encoding ${tileCount} tiles...`)
  const payload = await generateBase64TilesPayload(tileKeys, env)
  
  if (payload.tiles.length === 0) {
    console.error(`❌ Failed to fetch any tiles from R2`)
    throw new Error("Failed to fetch tiles from R2")
  }

  // Build JSON request body
  const requestBody = {
    tiles: payload.tiles,
    valid_sheets: job.validSheets,
    strict_filtering: true
  }

  const bodyJson = JSON.stringify(requestBody)
  console.log(`📦 [BASE64] JSON payload size: ${bodyJson.length} bytes (${payload.tiles.length} tiles)`)

  // Use planId for marker detection - processes all sheets together
  const container = env.PLAN_OCR_SERVICE.getByName(job.planId)

  // Log request details
  if (isChunked) {
    console.log(`🎯 [CHUNK] Sending base64 tiles to plan-ocr-service for marker detection...`)
    console.log(`   Plan ID: ${job.planId}`)
    console.log(`   Upload ID: ${job.uploadId}`)
    console.log(`   Chunk: ${job.chunkIndex! + 1}/${job.totalChunks}`)
    console.log(`   Tiles in chunk: ${payload.tiles.length}`)
  } else {
    console.log(`🎯 Sending base64 tiles to plan-ocr-service for marker detection...`)
    console.log(`   Plan ID: ${job.planId}`)
    console.log(`   Upload ID: ${job.uploadId}`)
    console.log(`   Valid Sheets: ${job.validSheets.join(", ")}`)
    console.log(`   Tiles: ${payload.tiles.length}`)
  }

  // Add timeout for marker detection (5 minutes - marker detection can take a while with LLM validation)
  const MARKER_DETECTION_TIMEOUT_MS = 5 * 60 * 1000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error(`⏱️ Marker detection timeout after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s`)
    controller.abort()
  }, MARKER_DETECTION_TIMEOUT_MS)

  // Health check: Ensure the Python service is ready before sending the large payload
  // Retry with exponential backoff until container is ready
  // Extended retries to handle cold start model initialization (10-20 seconds)
  console.log(`🏥 [CHUNK] Performing health check on container (with retries)...`)
  let healthOk = false
  const maxRetries = 30  // Increased from 20 to handle longer cold starts (up to 90s total)
  for (let i = 0; i < maxRetries; i++) {
    try {
      const healthResponse = await container.fetch("http://localhost/health", {
        method: "GET",
        signal: AbortSignal.timeout(3000),  // Increased from 2000ms to 3000ms per attempt
      })

      if (healthResponse.ok) {
        // Check if service is actually ready, not just initializing
        const healthData = await healthResponse.json().catch(() => ({})) as { status?: string; service?: string; message?: string }

        if (healthData.status === 'initializing') {
          // Service explicitly says it's not ready yet (models still loading)
          console.log(`⏳ [CHUNK] Health check attempt ${i + 1}/${maxRetries}: service initializing, will retry...`)
          // Don't set healthOk = true, continue to next iteration
        } else {
          // Service is ready (status="ready")
          console.log(`✅ [CHUNK] Container health check passed on attempt ${i + 1}/${maxRetries}:`, healthData)
          healthOk = true
          break
        }
      } else if (healthResponse.status === 503) {
        // Service explicitly says it's not ready yet (503 Service Unavailable)
        console.log(`⏳ [CHUNK] Health check attempt ${i + 1}/${maxRetries}: service unavailable (503), retrying...`)
      } else {
        console.log(`⏳ [CHUNK] Health check attempt ${i + 1}/${maxRetries} returned ${healthResponse.status}, retrying...`)
      }
    } catch (e) {
      // Exponential backoff: 1s, 2s, 3s, 3s, 3s... (max 3s)
      const delay = Math.min(1000 * (i + 1), 3000)
      if (i < maxRetries - 1) {
        console.log(`⏳ [CHUNK] Health check attempt ${i + 1}/${maxRetries} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Add delay before retry even when status check didn't throw
    if (!healthOk && i < maxRetries - 1) {
      const delay = Math.min(1000 * (i + 1), 3000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  if (!healthOk) {
    throw new Error(`Container health check failed after ${maxRetries} attempts. Container may not be starting properly or models failed to load.`)
  }

  console.log(`✅ [CHUNK] Container is ready, proceeding with marker detection`)

  let response: Response
  try {
    console.log(`📤 [CHUNK] Calling container.fetch() for marker detection...`)
    console.log(`📤 [CHUNK] Request body size: ${bodyJson.length} bytes`)
    response = await container.fetch("http://localhost/api/detect-markers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": bodyJson.length.toString(), // Explicitly set Content-Length for large payloads
      },
      body: bodyJson,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    console.log(`📥 [CHUNK] Received response from container: ${response.status} ${response.statusText}`)
    console.log(`📥 [CHUNK] Response headers:`, Object.fromEntries(response.headers.entries()))
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`❌ Marker detection aborted due to timeout after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s`)
      throw new Error(`Marker detection container timed out after ${MARKER_DETECTION_TIMEOUT_MS / 1000}s.`)
    }
    console.error(`❌ Error fetching from marker detection container:`, error)
    console.error(`❌ Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Failed to detect markers: ${response.statusText}`, errorText)
    throw new Error(`Failed to detect markers: ${response.statusText}`)
  }

  console.log(`📥 Received response from marker detection service, parsing JSON...`)
  const apiResponse = await response.json() as {
    markers: Array<{
      text: string  // API returns 'text', not 'marker_text'
      detail: string
      sheet: string
      type: string  // API returns 'type', not 'marker_type'
      confidence: number
      is_valid: boolean
      fuzzy_matched?: boolean
      source_tile?: string
      bbox?: { x: number; y: number; w: number; h: number }
    }>
  }

  // Map API response to backend format
  const result = {
    markers: apiResponse.markers.map(m => ({
      marker_text: m.text,
      detail: m.detail,
      sheet: m.sheet,
      marker_type: m.type || 'unknown', // Default to 'unknown' if type is missing
      confidence: m.confidence,
      is_valid: m.is_valid,
      fuzzy_matched: m.fuzzy_matched,
      source_tile: m.source_tile,
      sheet_number: undefined, // Not provided by API
      bbox: m.bbox
    }))
  }

  if (isChunked) {
    console.log(`✅ [CHUNK ${job.chunkIndex! + 1}/${job.totalChunks}] Detected ${result.markers.length} markers`)
  } else {
    console.log(`✅ Detected ${result.markers.length} markers`)
  }

  // Insert markers into the database
  const db = drizzle(env.SitelinkDB)

  if (result.markers.length > 0) {
    if (isChunked && job.chunkId) {
      // CHUNKED PATH: Use deduplication to prevent duplicates across chunks
      console.log(`💾 [CHUNK] Inserting markers with deduplication for chunk ${job.chunkId}...`)
      const dedupResult = await insertMarkersWithDeduplication(
        result.markers,
        job.chunkId,
        job.planId,
        job.uploadId,
        env
      )
      console.log(`✅ [CHUNK ${job.chunkIndex! + 1}/${job.totalChunks}] Inserted ${dedupResult.inserted} new markers, skipped ${dedupResult.duplicates} duplicates`)
    } else {
      // NON-CHUNKED PATH: Direct insert (existing logic)
      console.log(`💾 Inserting ${result.markers.length} markers into database...`)
      const markerRecords = result.markers.map((marker) => ({
        id: crypto.randomUUID(),
        uploadId: job.uploadId,
        planId: job.planId,
        sheetNumber: marker.sheet_number || 1, // Extract from marker data, default to 1 if not provided
        markerText: marker.marker_text,
        detail: marker.detail,
        sheet: marker.sheet,
        markerType: marker.marker_type,
        confidence: marker.confidence,
        isValid: marker.is_valid,
        fuzzyMatched: marker.fuzzy_matched ?? false,
        sourceTile: marker.source_tile ?? null,
        bbox: marker.bbox ? JSON.stringify(marker.bbox) : null,
      }))

      await db.insert(planMarkers).values(markerRecords)
      console.log(`✅ Successfully inserted ${markerRecords.length} markers into database`)
    }
  } else {
    if (isChunked) {
      console.log(`⚠️ [CHUNK ${job.chunkIndex! + 1}/${job.totalChunks}] No markers detected, skipping database insert`)
    } else {
      console.log(`⚠️ No markers detected, skipping database insert`)
    }
  }

  if (isChunked) {
    console.log(`✅ [CHUNK ${job.chunkIndex! + 1}/${job.totalChunks}] Successfully processed ${result.markers.length} markers`)
  } else {
    console.log(`✅ Successfully detected and stored ${result.markers.length} markers`)
  }
}

/**
 * NEW: Per-sheet marker detection queue consumer (no chunking, sends PDF directly)
 * Uses callout-processor container instead of plan-ocr-service
 */
export async function sheetMarkerDetectionQueueConsumer(
  batch: MessageBatch<SheetMarkerDetectionJob>,
  env: Env,
  _ctx: ExecutionContext
) {
  console.log(`🚀 [SHEET MARKER QUEUE] Processing ${batch.messages.length} sheet marker detection jobs`)

  // Process all messages in parallel
  await Promise.allSettled(
    batch.messages.map(async (message) => {
      try {
        await processSheetMarkerDetectionJob(message, env)
        console.log(`✅ Successfully detected markers for sheet ${message.body.sheetNumber}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Error detecting markers for sheet ${message.body.sheetNumber}:`, error)
        message.retry()
      }
    })
  )

  console.log(`✅ [SHEET MARKER QUEUE] Finished processing batch`)
}

async function processSheetMarkerDetectionJob(message: Message<SheetMarkerDetectionJob>, env: Env) {
  const job = message.body

  console.log(`🎯 [SHEET MARKER] Processing sheet ${job.sheetNumber}/${job.totalSheets}`)
  console.log(`   Upload ID: ${job.uploadId}`)
  console.log(`   Plan ID: ${job.planId}`)
  console.log(`   Sheet ID: ${job.sheetId}`)
  console.log(`   Sheet Key: ${job.sheetKey}`)
  console.log(`   Valid Sheets: ${job.validSheets.join(", ")}`)

  // Step 1: Get the sheet PDF from R2
  const sheet = await env.SitelinkStorage.get(job.sheetKey)
  if (!sheet) {
    console.error(`❌ Sheet not found: ${job.sheetKey}`)
    throw new Error(`Sheet not found: ${job.sheetKey}`)
  }

  console.log(`📄 Retrieved sheet PDF from R2 (${sheet.size} bytes)`)

  // Step 2: Call callout-processor container with PDF body
  // Use sheetId for container isolation - each sheet gets its own container instance
  const containerId = env.CALLOUT_PROCESSOR.idFromName(job.sheetId)
  const container = env.CALLOUT_PROCESSOR.get(containerId)

  // Build headers with sheet metadata
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "X-Valid-Sheets": job.validSheets.join(","),
    "X-Sheet-Number": job.sheetNumber.toString(),
    "X-Total-Sheets": job.totalSheets.toString(),
    "X-Plan-Id": job.planId,
    "X-Sheet-Id": job.sheetId,
  }

  console.log(`🔍 Calling callout-processor for marker detection...`)
  console.log(`   Headers:`, headers)

  const response = await container.fetch("http://container/api/detect-markers", {
    method: "POST",
    headers,
    body: sheet.body,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "No error details")
    console.error(`❌ Failed to detect markers: ${response.statusText}`, errorText)
    throw new Error(`Failed to detect markers: ${response.statusText}`)
  }

  // Step 3: Parse the response
  const result = await response.json() as {
    markers: Array<{
      marker_text: string
      detail: string
      sheet: string
      marker_type: string
      confidence: number
      is_valid: boolean
      fuzzy_matched?: boolean
      bbox?: { x: number; y: number; w: number; h: number }
    }>
  }

  console.log(`✅ Detected ${result.markers.length} markers`)

  // Step 4: Insert markers into plan_markers table
  if (result.markers.length > 0) {
    const db = drizzle(env.SitelinkDB)
    console.log(`💾 Inserting ${result.markers.length} markers into database...`)

    // Insert markers one at a time to avoid D1's "too many SQL variables" limit
    // D1/SQLite has a limit on variables per query (~100), and batch inserts exceed it
    let insertedCount = 0
    for (const marker of result.markers) {
      const markerRecord = {
        id: crypto.randomUUID(),
        uploadId: job.uploadId,
        planId: job.planId,
        sheetNumber: job.sheetNumber,
        markerText: marker.marker_text,
        detail: marker.detail,
        sheet: marker.sheet,
        markerType: marker.marker_type,
        confidence: marker.confidence,
        isValid: marker.is_valid,
        fuzzyMatched: marker.fuzzy_matched ?? false,
        sourceTile: null, // No tiles in new approach
        bbox: marker.bbox ? JSON.stringify(marker.bbox) : null,
      }
      await db.insert(planMarkers).values(markerRecord)
      insertedCount++
    }
    console.log(`✅ Successfully inserted ${insertedCount} markers into database`)
  } else {
    console.log(`⚠️ No markers detected for sheet ${job.sheetNumber}, skipping database insert`)
  }

  // Step 5: Notify PlanCoordinator that this sheet's marker detection is complete
  try {
    const coordinatorId = env.PLAN_COORDINATOR.idFromName(job.uploadId)
    const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)
    await coordinator.fetch("http://localhost/marker-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetNumber: job.sheetNumber })
    })
    console.log(`📡 Notified PlanCoordinator of marker completion for sheet ${job.sheetNumber}`)
  } catch (callbackError) {
    // Log but don't fail - the markers are already saved
    console.error(`⚠️ Failed to notify PlanCoordinator:`, callbackError)
  }

  console.log(`✅ Successfully processed sheet ${job.sheetNumber}/${job.totalSheets}`)
}
