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
        await processJob(message, env)
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

async function processJob(message: Message<TileJob>, env: Env) {
  const job = message.body
  console.log(`✅ [QUEUE CONSUMER] Processing tile job for sheet ${job.sheetNumber}/${job.totalSheets}`)
  console.log(`   Upload ID: ${job.uploadId}`)
  console.log(`   Plan ID: ${job.planId}`)
  console.log(`   Sheet Key: ${job.sheetKey}`)
  // Acknowledge the message to mark it as processed
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
