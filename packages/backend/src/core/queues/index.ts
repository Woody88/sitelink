import type { R2Notification, TileJob } from "./types";
import { PDFDocument } from "pdf-lib";
import { extract } from "tar-stream"
import {Readable } from "node:stream"

export async function tileGenerationQueueConsumer(
  batch: MessageBatch<TileJob>,
  env: Env,
  ctx: ExecutionContext
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
  const container = env.SITELINK_PDF_PROCESSOR.getByName(job.planId)
  const sheet = await env.SitelinkStorage.get(job.sheetKey)

  if (!sheet){
    console.error(`❌ Sheet not found: ${job.sheetKey}`)
    throw new Error(`Sheet not found: ${job.sheetKey}`)
  }

  // Buffer the R2 body before sending to container to avoid streaming issues through service binding
  console.log(`📦 Buffering sheet PDF from R2...`)
  const sheetBuffer = await sheet.arrayBuffer()
  console.log(`📦 Buffered ${sheetBuffer.byteLength} bytes`)

  const request = new Request("http://localhost/generate-tiles", {
    method: "POST",
    body: sheetBuffer,
    headers: {
      "Content-Type": "application/pdf",
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
  const response = await container.fetch(request)
  console.log(`📦 Container response: ${response.status} ${response.statusText}, Content-Type: ${response.headers.get('Content-Type')}`)

  if (!response.ok){
    console.error(`❌ Failed to generate tiles: ${response.statusText}`)
    throw new Error(`Failed to generate tiles: ${response.statusText}`)
  }

  console.log(`📦 Starting tar extraction...`)
  const extractor = extract()

  extractor.on("entry", (header, entryStream, next) => {
    console.log(`📦 Processing tar entry: ${header.name} (${header.size} bytes)`)

    if (header.size === undefined) {
      console.error(`❌ Tar entry ${header.name} has no size`)
      next(new Error(`Tar entry ${header.name} has no size`))
      return
    }

    const stream = Readable.toWeb(entryStream)
    const {writable, readable} = new FixedLengthStream(header.size)

    // Determine content type
    const contentType = header.name.endsWith('.jpg')
      ? 'image/jpeg'
      : header.name.endsWith('.dzi')
      ? 'application/xml'
      : 'application/octet-stream'

    const r2Key = `organizations/${job.organizationId}/projects/${job.projectId}/plans/${job.planId}/sheets/sheet-${job.sheetNumber}/${header.name}`

    // CRITICAL: Resume the Node.js stream BEFORE starting the async pipeline
    // Without this, the stream stays paused and pipeTo() never receives data
    entryStream.resume()
    console.log(`📦 Stream resumed, starting pipeline for ${header.name}`)

    // Start R2 upload immediately (must run in parallel with pipeTo to avoid backpressure deadlock)
    console.log(`📦 Starting R2 upload for: ${r2Key}`)
    const uploadPromise = env.SitelinkStorage.put(r2Key, readable, {
      httpMetadata: { contentType }
    })

    // Process stream asynchronously but call next() when done
    stream.pipeTo(writable)
      .then(() => {
        console.log(`📦 Stream piped, waiting for upload to complete...`)
        return uploadPromise
      })
      .then(() => {
        console.log(`✅ Uploaded: ${header.name} (${header.size} bytes)`)
        next()
      })
      .catch((error) => {
        console.error(`❌ Error uploading tile:`, error)
        next(error)
      })
  })

  await new Promise<void>((resolve, reject) => {
    extractor.on("finish", () => {
      console.log("✅ All tiles uploaded to R2")
      resolve()
    })

    extractor.on("error", (error) => {
      console.error("❌ Tar extraction error:", error)
      reject(error)
    })

    console.log(`📦 Converting Web stream to Node stream and piping to extractor...`)
    const nodeStream = Readable.fromWeb(response.body as any)
    nodeStream.pipe(extractor)
  })

  console.log(`✅ Successfully generated tiles for sheet ${job.sheetNumber}`)
  message.ack()
}


export async function pdfProcessingQueueConsumer(batch: MessageBatch<R2Notification>, env: Env, ctx: ExecutionContext) {
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

        // Split PDF into individual sheets with 1-indexed file naming (sheet-1.pdf, sheet-2.pdf, etc.)
        for (let i = 0; i < totalPages; i++){
          const sheetBytes = await splitPdfIntoSheets(pdfDoc, i)
          const sheetKey = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/uploads/${uploadId}/sheet-${i+1}.pdf`
          await env.SitelinkStorage.put(sheetKey, sheetBytes)
        }
        console.log(`✅ Successfully processed PDF processing job for ${message.body.object.key}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Error processing PDF processing job:`, error)
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
