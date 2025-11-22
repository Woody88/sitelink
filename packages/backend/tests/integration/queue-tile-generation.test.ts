import { env, createExecutionContext, waitOnExecutionContext, getQueueResult } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import { QueueService } from "../../src/core/queues/service"
import { TileGenerationQueue } from "../../src/core/bindings"
import type { R2Notification, TileJob } from "../../src/core/queues/types"
import worker from "../../src/index"
import { createMessageBatch } from "cloudflare:test"
import { loadSamplePDF } from "../helpers"

const TEST_R2_ACCOUNT = "test-account"
const TEST_ORGANIZATION_ID = "1"
const TEST_PROJECT_ID = "1"
const TEST_PLAN_ID = "1"
const TEST_UPLOAD_ID = "1"
const TEST_PDF_KEY_PREFIX = `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}`
const TEST_PDF_KEY = `${TEST_PDF_KEY_PREFIX}/original.pdf`

beforeAll(async () => {
  const pdf = await loadSamplePDF()
  await env.SitelinkStorage.put(TEST_PDF_KEY, pdf)

	const r2Events =[
		{
			account: TEST_R2_ACCOUNT,
			action: "PutObject",
			bucket: "sitelink-storage",
			object: { key: TEST_PDF_KEY },
			eventTime: new Date().toISOString(),
		},
	]

	const batch = createMessageBatch<R2Notification>("pdf-processing-queue", [
		{id: "msg-1", timestamp: new Date(), body: r2Events[0], attempts: 1},
	])

	const ctx = createExecutionContext()
	await worker.queue(batch as any, env, ctx)
	await waitOnExecutionContext(ctx)

	console.log("pdf processing completed!")
})


describe("Queue Multiple Tiles", () => {
	it("should queue multiple tile jobs and consumer processes them", async () => {
		const sheetCount = 7
		// Create test tile jobs
		const jobs = Array.from({ length: sheetCount }, (_, index) => {
			const sheetNumber = index + 1

			return {
				uploadId: TEST_UPLOAD_ID,
				projectId: TEST_PROJECT_ID,
				planId: TEST_PLAN_ID,
				organizationId: TEST_ORGANIZATION_ID,
				sheetNumber,
				sheetKey: `${TEST_PDF_KEY_PREFIX}/sheet-${sheetNumber}.pdf`,
				totalSheets: sheetCount,
			} satisfies TileJob
		})
		

		const batch = createMessageBatch<TileJob>("tile-generation-queue", jobs.map(job => ({
			id: job.sheetKey,
			timestamp: new Date(),
			body: job,
			attempts: 1
		})))

		// Step 2: Create mock MessageBatch and trigger consumer
		// In test environment, we simulate Cloudflare calling the queue handler
		// In production, Cloudflare automatically creates batches and calls the handler
		const ctx = createExecutionContext()

		// Step 3: Trigger the queue consumer
		await worker.queue(batch as any, env, ctx)
    const result = await getQueueResult(batch, ctx)
		await waitOnExecutionContext(ctx)
    
    expect(result.explicitAcks).toEqual(jobs.map( _ => _.sheetKey))
	})
})
