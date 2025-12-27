import { describe, expect, it, mock, beforeEach } from "bun:test"
import { markerDetectionQueueConsumer } from "../../../src/core/queues"
import type { MarkerDetectionJob } from "../../../src/core/queues/types"

/**
 * LEGACY TESTS - SKIPPED
 *
 * These tests were never completed (missing SitelinkStorage.get() mock).
 * They test the old tile-based marker detection approach which is being replaced
 * by the new per-sheet approach (see queue-sheet-marker-detection.test.ts).
 *
 * The new architecture sends full sheet PDFs to callout-processor instead of
 * chunked base64-encoded tiles to plan-ocr-service.
 */
describe.skip("Marker Detection Queue Consumer (LEGACY - tile-based approach)", () => {
	let mockEnv: any
	let mockContainer: any
	let mockStorage: any

	beforeEach(() => {
		// Mock R2 Storage with tile listings
		mockStorage = {
			list: mock((options: { prefix: string }) => {
				// Return mock tile objects
				return Promise.resolve({
					objects: [
						{ key: `${options.prefix}sheet-1/0_0.jpg` },
						{ key: `${options.prefix}sheet-1/0_1.jpg` },
						{ key: `${options.prefix}sheet-2/0_0.jpg` },
						{ key: `${options.prefix}sheet-2/0_1.jpg` },
						{ key: `${options.prefix}sheet-1/sheet.dzi` }, // Should be filtered out (not .jpg)
					],
					truncated: false,
				})
			}),
		}

		// Mock plan-ocr-service container
		mockContainer = {
			fetch: mock((url: string, options: RequestInit) => {
				// Mock successful marker detection
				const markers = [
					{
						marker_text: "3/A7",
						detail: "3",
						sheet: "A7",
						marker_type: "circular",
						confidence: 0.95,
						is_valid: true,
						fuzzy_matched: false,
						source_tile: "sheet-1/0_0.jpg",
						bbox: { x: 100, y: 200, w: 50, h: 50 },
					},
					{
						marker_text: "5/A8",
						detail: "5",
						sheet: "A8",
						marker_type: "triangular",
						confidence: 0.88,
						is_valid: true,
						fuzzy_matched: true,
						source_tile: "sheet-2/0_1.jpg",
						bbox: { x: 150, y: 250, w: 45, h: 45 },
					},
				]

				return Promise.resolve(
					new Response(JSON.stringify({ markers }), {
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
			PLAN_OCR_SERVICE: mockContainer,
			SitelinkDB: mockDB,
		}
	})

	it("should successfully detect markers for a plan", async () => {
		const job: MarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5", "A6", "A7", "A8", "A9"],
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
			queue: "marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await markerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify R2 list was called with correct prefix
		expect(mockStorage.list).toHaveBeenCalledTimes(1)
		const listCall = mockStorage.list.mock.calls[0][0]
		expect(listCall.prefix).toBe("organizations/org-1/projects/proj-1/plans/plan-456/sheets/")

		// Verify container was called correctly
		expect(mockContainer.fetch).toHaveBeenCalledTimes(1)
		const [url, options] = mockContainer.fetch.mock.calls[0]
		expect(url).toBe("http://localhost/api/detect-markers")
		expect(options.method).toBe("POST")
		expect(options.headers["Content-Type"]).toBe("application/json")

		// Verify request body contains tile keys and valid sheets
		const body = JSON.parse(options.body)
		expect(body.valid_sheets).toEqual(["A5", "A6", "A7", "A8", "A9"])
		expect(body.tile_keys).toHaveLength(4) // Only .jpg files
		expect(body.tile_keys).toContain("organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1/0_0.jpg")
		expect(body.tile_keys).toContain("organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-2/0_1.jpg")

		// Verify message was acknowledged
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
		expect(mockMessage.retry).not.toHaveBeenCalled()
	})

	it("should handle plans with no tiles gracefully", async () => {
		// Mock R2 to return no tiles
		mockStorage.list = mock(() => {
			return Promise.resolve({
				objects: [],
				truncated: false,
			})
		})

		const job: MarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5"],
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
			queue: "marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await markerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Should not call container if no tiles found
		expect(mockContainer.fetch).not.toHaveBeenCalled()

		// Message should still be acknowledged (nothing to do)
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
		expect(mockMessage.retry).not.toHaveBeenCalled()
	})

	it("should retry when plan-ocr-service returns error", async () => {
		// Mock container to return error
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response("Model timeout", {
					status: 500,
					statusText: "Internal Server Error",
				})
			)
		})

		const job: MarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5", "A6"],
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
			queue: "marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await markerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify message was retried
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should filter out non-jpg files from tile list", async () => {
		// Mock R2 to return mixed file types
		mockStorage.list = mock(() => {
			return Promise.resolve({
				objects: [
					{ key: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1/0_0.jpg" },
					{ key: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1/sheet.dzi" },
					{ key: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1/metadata.json" },
					{ key: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-2/0_0.jpg" },
					{ key: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-2/0_1.png" }, // Wrong format
				],
				truncated: false,
			})
		})

		const job: MarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5", "A6"],
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
			queue: "marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await markerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify only .jpg files were sent
		const [_, options] = mockContainer.fetch.mock.calls[0]
		const body = JSON.parse(options.body)
		expect(body.tile_keys).toHaveLength(2)
		expect(body.tile_keys.every((key: string) => key.endsWith(".jpg"))).toBe(true)
	})

	it("should process multiple marker detection jobs", async () => {
		const jobs: MarkerDetectionJob[] = [
			{
				uploadId: "upload-123",
				planId: "plan-456",
				organizationId: "org-1",
				projectId: "proj-1",
				validSheets: ["A5", "A6"],
			},
			{
				uploadId: "upload-789",
				planId: "plan-999",
				organizationId: "org-2",
				projectId: "proj-2",
				validSheets: ["B1", "B2"],
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
			queue: "marker-detection-queue",
			messages: mockMessages,
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await markerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify both jobs were processed
		expect(mockStorage.list).toHaveBeenCalledTimes(2)
		expect(mockContainer.fetch).toHaveBeenCalledTimes(2)
		mockMessages.forEach((msg) => {
			expect(msg.ack).toHaveBeenCalledTimes(1)
			expect(msg.retry).not.toHaveBeenCalled()
		})
	})

	it("should continue processing when one job fails", async () => {
		// First call succeeds, second fails
		let callCount = 0
		mockContainer.fetch = mock(() => {
			callCount++
			if (callCount === 1) {
				return Promise.resolve(
					new Response(JSON.stringify({ markers: [] }), {
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

		const jobs: MarkerDetectionJob[] = [
			{
				uploadId: "upload-123",
				planId: "plan-456",
				organizationId: "org-1",
				projectId: "proj-1",
				validSheets: ["A5"],
			},
			{
				uploadId: "upload-789",
				planId: "plan-999",
				organizationId: "org-2",
				projectId: "proj-2",
				validSheets: ["B1"],
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
			queue: "marker-detection-queue",
			messages: mockMessages,
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await markerDetectionQueueConsumer(batch, mockEnv, ctx)

		// First message acknowledged, second retried
		expect(mockMessages[0].ack).toHaveBeenCalledTimes(1)
		expect(mockMessages[0].retry).not.toHaveBeenCalled()
		expect(mockMessages[1].retry).toHaveBeenCalledTimes(1)
		expect(mockMessages[1].ack).not.toHaveBeenCalled()
	})
})
