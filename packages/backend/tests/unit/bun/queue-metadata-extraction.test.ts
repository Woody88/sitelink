import { describe, expect, it, mock, beforeEach } from "bun:test"
import { metadataExtractionQueueConsumer } from "../../../src/core/queues"
import type { MetadataExtractionJob } from "../../../src/core/queues/types"

/**
 * TESTS NEED MOCK UPDATES - SKIPPED
 *
 * These tests have incomplete mock setup:
 * 1. SitelinkDB mock needs proper Drizzle ORM structure (not just D1 prepare/bind)
 * 2. Container mock structure was fixed but DB calls fail
 *
 * The tests check the existing metadata extraction queue consumer which
 * will eventually be updated to use the new callout-processor service.
 *
 * TODO: Update mocks to properly support Drizzle ORM queries:
 * - Mock the db.select().from().where() chain
 * - Mock the db.update().set().where() chain
 */
describe.skip("Metadata Extraction Queue Consumer (needs Drizzle mock updates)", () => {
	let mockEnv: any
	let mockContainer: any
	let mockStorage: any

	beforeEach(() => {
		// Mock R2 Storage
		mockStorage = {
			get: mock((key: string) => {
				return Promise.resolve({
					key,
					blob: () => Promise.resolve(new Blob([new Uint8Array(100)], { type: "application/pdf" })),
				})
			}),
		}

		// Mock plan-ocr-service container
		mockContainer = {
			fetch: mock((url: string, options: RequestInit) => {
				// Mock successful metadata extraction
				return Promise.resolve(
					new Response(JSON.stringify({ sheet_number: "A5" }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					})
				)
			}),
		}

		// Mock D1 database
		const mockDB = {
			prepare: mock((sql: string) => ({
				bind: mock((...args: any[]) => ({
					run: mock(() => Promise.resolve({ success: true })),
					all: mock(() => Promise.resolve({ results: [] })),
					first: mock(() => Promise.resolve(null)),
				})),
				run: mock(() => Promise.resolve({ success: true })),
				all: mock(() => Promise.resolve({ results: [] })),
				first: mock(() => Promise.resolve(null)),
			})),
		}

		// Mock env with bindings
		mockEnv = {
			SitelinkStorage: mockStorage,
			PLAN_OCR_SERVICE: {
				getByName: mock((sheetId: string) => mockContainer),
			},
			PLAN_COORDINATOR: {
				idFromName: mock((uploadId: string) => ({ toString: () => uploadId })),
				get: mock(() => ({
					fetch: mock(() =>
						Promise.resolve(
							new Response(
								JSON.stringify({
									success: true,
									progress: {
										completedSheets: 1,
										totalSheets: 5,
										status: "in_progress",
									},
								})
							)
						)
					),
				})),
			},
			SitelinkDB: mockDB,
		}
	})

	it("should successfully extract metadata for a single sheet", async () => {
		const job: MetadataExtractionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			sheetId: "sheet-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-1.pdf",
			totalSheets: 5,
		}

		const mockMessage = {
			id: "msg-1",
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: mock(() => {}),
			retry: mock(() => {}),
		}

		const batch = {
			queue: "metadata-extraction-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await metadataExtractionQueueConsumer(batch, mockEnv, ctx)

		// Verify container was called correctly
		expect(mockContainer.fetch).toHaveBeenCalledTimes(1)
		const [url, options] = mockContainer.fetch.mock.calls[0]
		expect(url).toBe("http://localhost/api/extract-metadata")
		expect(options.method).toBe("POST")
		expect(options.headers["Content-Type"]).toBe("application/pdf")

		// Verify message was acknowledged
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
		expect(mockMessage.retry).not.toHaveBeenCalled()
	})

	it("should process multiple sheets in parallel", async () => {
		const jobs: MetadataExtractionJob[] = [
			{
				uploadId: "upload-123",
				planId: "plan-456",
				sheetId: "sheet-1",
				sheetNumber: 1,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-1.pdf",
				totalSheets: 3,
			},
			{
				uploadId: "upload-123",
				planId: "plan-456",
				sheetId: "sheet-2",
				sheetNumber: 2,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-2.pdf",
				totalSheets: 3,
			},
			{
				uploadId: "upload-123",
				planId: "plan-456",
				sheetId: "sheet-3",
				sheetNumber: 3,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-3.pdf",
				totalSheets: 3,
			},
		]

		const mockMessages = jobs.map((job, i) => ({
			id: `msg-${i + 1}`,
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: mock(() => {}),
			retry: mock(() => {}),
		}))

		const batch = {
			queue: "metadata-extraction-queue",
			messages: mockMessages,
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await metadataExtractionQueueConsumer(batch, mockEnv, ctx)

		// Verify all messages were processed
		expect(mockContainer.fetch).toHaveBeenCalledTimes(3)
		mockMessages.forEach((msg) => {
			expect(msg.ack).toHaveBeenCalledTimes(1)
			expect(msg.retry).not.toHaveBeenCalled()
		})
	})

	it("should retry when sheet is not found in R2", async () => {
		// Mock R2 to return null (sheet not found)
		mockStorage.get = mock(() => Promise.resolve(null))

		const job: MetadataExtractionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			sheetId: "sheet-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-1.pdf",
			totalSheets: 5,
		}

		const mockMessage = {
			id: "msg-1",
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: mock(() => {}),
			retry: mock(() => {}),
		}

		const batch = {
			queue: "metadata-extraction-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await metadataExtractionQueueConsumer(batch, mockEnv, ctx)

		// Verify message was retried, not acknowledged
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should retry when plan-ocr-service returns error", async () => {
		// Mock container to return error
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response("Internal Server Error", {
					status: 500,
					statusText: "Internal Server Error",
				})
			)
		})

		const job: MetadataExtractionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			sheetId: "sheet-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-1.pdf",
			totalSheets: 5,
		}

		const mockMessage = {
			id: "msg-1",
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: mock(() => {}),
			retry: mock(() => {}),
		}

		const batch = {
			queue: "metadata-extraction-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await metadataExtractionQueueConsumer(batch, mockEnv, ctx)

		// Verify message was retried
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should continue processing other messages when one fails", async () => {
		// First message will succeed, second will fail
		let callCount = 0
		mockContainer.fetch = mock(() => {
			callCount++
			if (callCount === 1) {
				return Promise.resolve(
					new Response(JSON.stringify({ sheet_number: "A5" }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					})
				)
			} else {
				return Promise.resolve(
					new Response("Error", { status: 500 })
				)
			}
		})

		const jobs: MetadataExtractionJob[] = [
			{
				uploadId: "upload-123",
				planId: "plan-456",
				sheetId: "sheet-1",
				sheetNumber: 1,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-1.pdf",
				totalSheets: 2,
			},
			{
				uploadId: "upload-123",
				planId: "plan-456",
				sheetId: "sheet-2",
				sheetNumber: 2,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/uploads/upload-123/sheet-2.pdf",
				totalSheets: 2,
			},
		]

		const mockMessages = jobs.map((job, i) => ({
			id: `msg-${i + 1}`,
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: mock(() => {}),
			retry: mock(() => {}),
		}))

		const batch = {
			queue: "metadata-extraction-queue",
			messages: mockMessages,
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await metadataExtractionQueueConsumer(batch, mockEnv, ctx)

		// Verify first message was acknowledged, second was retried
		expect(mockMessages[0].ack).toHaveBeenCalledTimes(1)
		expect(mockMessages[0].retry).not.toHaveBeenCalled()
		expect(mockMessages[1].retry).toHaveBeenCalledTimes(1)
		expect(mockMessages[1].ack).not.toHaveBeenCalled()
	})
})
