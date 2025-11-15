import type { TileJob } from "./types";

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