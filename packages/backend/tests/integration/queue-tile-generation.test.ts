import { env, createMessageBatch, getQueueResult, createExecutionContext } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import { PDFDocument } from "pdf-lib"
import type { TileJob } from "../../src/core/queues/types"
import worker from "../../src/index"
import { loadSamplePDF } from "../helpers"
import { waitOnExecutionContext } from "cloudflare:test"

const TEST_ORG_ID = "test-org-1"
const TEST_PROJECT_ID = "test-project-1"
const TEST_PLAN_ID = "test-plan-1"
const TEST_UPLOAD_ID = "test-upload-1"

beforeAll(async () => {
	// Load sample PDF
	const pdfBytes = await loadSamplePDF()
	const pdfDoc = await PDFDocument.load(pdfBytes)

	// Extract first page as a sheet PDF
	const singlePageDoc = await PDFDocument.create()
	const [page] = await singlePageDoc.copyPages(pdfDoc, [0])
	singlePageDoc.addPage(page)
	const sheetBytes = await singlePageDoc.save()

	// Upload to R2
	const sheetKey = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/sheet-1.pdf`
	await env.SitelinkStorage.put(sheetKey, sheetBytes)

	console.log("✅ Test setup complete: Created 1 sheet PDF in R2")
})

describe("Tile Generation Queue Consumer", () => {
	it("should reach Docker container health endpoint via proxy", async () => {
		// Test the proxy first
		const healthResponse = await env.PDF_CONTAINER_PROXY.fetch(new Request("http://localhost/health"))
		expect(healthResponse.status).toBe(200)
		const data = await healthResponse.json()
		console.log("✅ Health check response:", data)
		expect(data).toEqual({ health: "ok" })
	})

	it("should send ArrayBuffer body through proxy", async () => {
		// Test sending a small ArrayBuffer through the proxy
		const testData = new Uint8Array([1, 2, 3, 4, 5])
		console.log(`📦 Sending ${testData.length} bytes through proxy...`)

		const request = new Request("http://localhost/generate-tiles", {
			method: "POST",
			body: testData,
			headers: {
				"Content-Type": "application/pdf",
				"X-Sheet-Key": "test",
				"X-Sheet-Number": "1",
				"X-Sheet-Total-Count": "1",
				"X-Upload-Id": "test",
				"X-Organization-Id": "test",
				"X-Project-Id": "test",
				"X-Plan-Id": "test",
			},
		})

		console.log("📦 Making fetch request...")
		const response = await env.PDF_CONTAINER_PROXY.fetch(request)
		console.log(`📦 Got response: ${response.status}`)
		expect(response).toBeDefined()
	})

	it("should communicate with Docker container from queue consumer", async () => {
		// Mock SITELINK_PDF_PROCESSOR to use PDF_CONTAINER_PROXY service binding
		const originalContainer = env.SITELINK_PDF_PROCESSOR
		env.SITELINK_PDF_PROCESSOR = {
			getByName: (_name: string) => env.PDF_CONTAINER_PROXY,
		} as any

		try {
			// Create single TileJob message
			const job: TileJob = {
				uploadId: TEST_UPLOAD_ID,
				projectId: TEST_PROJECT_ID,
				planId: TEST_PLAN_ID,
				organizationId: TEST_ORG_ID,
				sheetNumber: 1,
				sheetKey: `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/sheet-1.pdf`,
				totalSheets: 1,
			}

			// Create MessageBatch
			const batch = createMessageBatch<TileJob>("tile-generation-queue", [
				{ id: "msg-1", timestamp: new Date(), body: job, attempts: 1 },
			])

			// Trigger queue consumer
			const ctx = createExecutionContext()
			await worker.queue(batch as any, env, ctx)
			await waitOnExecutionContext(ctx)

			// Verify message was acked
			const result = await getQueueResult(batch, ctx)
			expect(result.explicitAcks).toEqual(["msg-1"])

			// Verify tiles were uploaded to R2
			const sheet1Prefix = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-1/`
			const sheet1Files = await env.SitelinkStorage.list({ prefix: sheet1Prefix })

			console.log(`✅ Found ${sheet1Files.objects.length} files for sheet 1`)

			// Check for .dzi file
			const dziFiles = sheet1Files.objects.filter((obj) => obj.key.endsWith(".dzi"))
			expect(dziFiles.length).toBeGreaterThan(0)

			// Check for .jpg tile files
			const jpgFiles = sheet1Files.objects.filter((obj) => obj.key.endsWith(".jpg"))
			expect(jpgFiles.length).toBeGreaterThan(0)
		} finally {
			// Restore original container binding
			env.SITELINK_PDF_PROCESSOR = originalContainer
		}
	})
})
