import type { R2Notification, TileJob } from "./types";
import { PDFDocument } from "pdf-lib";
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

        const sheetPdfBuffer = await env.SitelinkStorage.get(message.body.sheetKey)

        if (!sheetPdfBuffer) {
          console.log(`sheet for ${message.body.sheetKey} not found!`)
          message.ack()
          return
        }

        const container = env.SITELINK_PDF_PROCESSOR.getByName(message.body.uploadId)

        const headers = new Headers()
        sheetPdfBuffer.writeHttpMetadata(headers)

        headers.set('Content-Length', sheetPdfBuffer.size.toString())
        headers.set('X-Sheet-Key', sheetPdfBuffer.key)
        headers.set('X-Sheet-Number', message.body.sheetNumber.toString())
        headers.set('X-Sheet-Total-Count', message.body.totalSheets.toString())
        headers.set('X-Upload-Id', message.body.uploadId)
        headers.set('X-Organization-Id', message.body.organizationId)
        headers.set('X-Project-Id', message.body.projectId)
        headers.set('X-Plan-Id', message.body.planId)

        const response = await container.fetch(new Request(
          `http://localhost/generate-tiles`,
          {
            method: 'POST',
            headers,
            body: sheetPdfBuffer.body
          }
        ))

        if (!response.ok){
          const errorText = await response.text()
          throw new Error(`Container failed: ${response.status} - ${errorText}`)
        }

        await processTileStream(response.body!, env)

        console.log(`✅ Successfully processed sheet ${message.body.sheetNumber}`)
        message.ack()
      } catch (error) {
        console.error(`❌ Error processing tile job:`, error)
        message.retry()
      }
    })
  )

  console.log(`✅ [QUEUE CONSUMER] Finished processing batch`)
}

async function processTileStream(stream: ReadableStream, env: Env) {
  console.log(`✅ [PROCESS_STREAM] Processing tile job for sheet....`)

  // 1. readJsonLine

  // 2. read file bytes
  
  
  // 3. upload to R2

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
