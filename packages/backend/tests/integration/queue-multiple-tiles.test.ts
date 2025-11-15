import { env, createExecutionContext, waitOnExecutionContext, getQueueResult } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import { QueueService } from "../../src/core/queues/service"
import { TileGenerationQueue } from "../../src/core/bindings"
import type { TileJob } from "../../src/core/queues/types"
import worker from "../../src/index"
import { createMessageBatch } from "cloudflare:test"

describe("Queue Multiple Tiles", () => {
	it("should queue multiple tile jobs and consumer processes them", async () => {
		// Create test tile jobs
		const jobs: TileJob[] = [
			{
				uploadId: "test-upload-1",
				projectId: "test-project-1",
				planId: "test-plan-1",
				organizationId: "test-org-1",
				sheetNumber: 0,
				sheetKey: "organizations/test-org-1/projects/test-project-1/plans/test-plan-1/uploads/test-upload-1/sheet-0.pdf",
				totalSheets: 2,
			},
			{
				uploadId: "test-upload-1",
				projectId: "test-project-1",
				planId: "test-plan-1",
				organizationId: "test-org-1",
				sheetNumber: 1,
				sheetKey: "organizations/test-org-1/projects/test-project-1/plans/test-plan-1/uploads/test-upload-1/sheet-1.pdf",
				totalSheets: 2,
			},
		]

		const batch = createMessageBatch<TileJob>("tile-generation-queue", [
			{ id: "msg-1", timestamp: new Date(), body: jobs[0], attempts: 1 },
			{ id: "msg-2", timestamp: new Date(), body: jobs[1], attempts: 1 },
		])
		// Create binding layer for the queue
		const QueueBindingLayer = Layer.succeed(
			TileGenerationQueue,
			env.TILE_GENERATION_QUEUE,
		)

		// Create QueueService with the binding
		const QueueServiceLive = QueueService.Default.pipe(
			Layer.provide(QueueBindingLayer),
		)

		// Step 1: Send messages to the queue
		await Effect.gen(function* () {
			const queue = yield* QueueService
			// Convert TileJob[] to MessageSendRequest[] format
			const messages = jobs.map(job => ({ body: job }))
			yield* queue.sendBatch(messages)
		}).pipe(
			Effect.provide(QueueServiceLive),
			Effect.runPromise,
		)

		// Step 2: Create mock MessageBatch and trigger consumer
		// In test environment, we simulate Cloudflare calling the queue handler
		// In production, Cloudflare automatically creates batches and calls the handler
		const ctx = createExecutionContext()
		
		// Create MessageBatch with the jobs we just queued
		// This simulates what Cloudflare does when it delivers messages to the consumer
		const ackedMessages: string[] = []
		const retriedMessages: string[] = []
		

		// Step 3: Trigger the queue consumer
		if (!worker.queue) {
			throw new Error("Queue handler not exported from worker")
		}

		await worker.queue(batch as any, env, ctx)
    const result = await getQueueResult(batch as unknown as MessageBatch<TileJob>, ctx)
		await waitOnExecutionContext(ctx)
    
    expect(result.explicitAcks).toEqual(["msg-1","msg-2"])
		// // Step 4: Verify consumer processed the messages
		// expect(batch.messages.length).toBe(2)
		// expect(ackedMessages.length).toBe(2)
		// expect(retriedMessages.length).toBe(0)
		
		// // Verify the jobs were processed correctly
		// expect(batch.messages[0]?.body.uploadId).toBe("test-upload-1")
		// expect(batch.messages[0]?.body.sheetNumber).toBe(0)
		// expect(batch.messages[1]?.body.sheetNumber).toBe(1)
	})
})
