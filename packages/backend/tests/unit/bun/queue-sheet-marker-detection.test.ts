import { describe, expect, it, mock, beforeEach } from "bun:test"
import { sheetMarkerDetectionQueueConsumer } from "../../../src/core/queues"
import type { SheetMarkerDetectionJob } from "../../../src/core/queues/types"

describe("Sheet Marker Detection Queue Consumer", () => {
	let mockEnv: any
	let mockContainer: any
	let mockStorage: any
	let mockDB: any

	beforeEach(() => {
		// Mock R2 Storage for fetching sheet PDFs
		mockStorage = {
			get: mock((key: string) => {
				// Return mock PDF blob
				const mockPdfContent = new ArrayBuffer(1024) // Fake PDF bytes
				return Promise.resolve({
					body: mockPdfContent,
					size: 1024,
					httpEtag: "abc123",
				})
			}),
		}

		// Mock callout-processor container
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

		// Mock D1 database for inserting markers
		mockDB = {
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
			CALLOUT_PROCESSOR: mockContainer,
			SitelinkDB: mockDB,
		}
	})

	it("should successfully detect markers for a single sheet", async () => {
		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5", "A6", "A7", "A8", "A9"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify R2 get was called with correct sheet key
		expect(mockStorage.get).toHaveBeenCalledTimes(1)
		expect(mockStorage.get).toHaveBeenCalledWith(job.sheetKey)

		// Verify container was called correctly
		expect(mockContainer.fetch).toHaveBeenCalledTimes(1)
		const [url, options] = mockContainer.fetch.mock.calls[0]
		expect(url).toBe("http://localhost/api/detect-markers")
		expect(options.method).toBe("POST")
		expect(options.headers["Content-Type"]).toBe("application/pdf")

		// Verify custom headers are set correctly
		expect(options.headers["X-Valid-Sheets"]).toBe("A5,A6,A7,A8,A9")
		expect(options.headers["X-Sheet-Number"]).toBe("1")
		expect(options.headers["X-Total-Sheets"]).toBe("5")
		expect(options.headers["X-Plan-Id"]).toBe("plan-456")
		expect(options.headers["X-Sheet-Id"]).toBe("sheet-uuid-1")

		// Verify request body is the PDF content (not base64)
		expect(options.body).toBeInstanceOf(ArrayBuffer)

		// Verify message was acknowledged
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
		expect(mockMessage.retry).not.toHaveBeenCalled()
	})

	it("should insert detected markers into plan_markers table", async () => {
		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A7", "A8"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 2,
		}

		// Mock container response with specific markers
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response(
					JSON.stringify({
						markers: [
							{
								marker_text: "3/A7",
								detail: "3",
								sheet: "A7",
								marker_type: "circular",
								confidence: 0.95,
								is_valid: true,
								fuzzy_matched: false,
								bbox: { x: 100, y: 200, w: 50, h: 50 },
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					}
				)
			)
		})

		const mockMessage = {
			id: "msg-1",
			timestamp: new Date(),
			body: job,
			attempts: 1,
			ack: mock(() => {}),
			retry: mock(() => {}),
		}

		const batch = {
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify database insert was called
		expect(mockDB.prepare).toHaveBeenCalled()
		const prepareCalls = mockDB.prepare.mock.calls

		// Look for INSERT INTO plan_markers (Drizzle generates lowercase SQL)
		const insertCall = prepareCalls.find((call: any[]) =>
			call[0].toLowerCase().includes("insert into") && call[0].includes("plan_markers")
		)
		expect(insertCall).toBeDefined()

		// Verify the SQL includes expected columns
		const insertSQL = insertCall[0]
		expect(insertSQL).toContain("plan_id")
		expect(insertSQL).toContain("sheet_number") // Changed from sheet_id to sheet_number
		expect(insertSQL).toContain("marker_text")
		expect(insertSQL).toContain("detail")
		expect(insertSQL).toContain("sheet")
		expect(insertSQL).toContain("marker_type")
		expect(insertSQL).toContain("confidence")
		expect(insertSQL).toContain("is_valid")
		expect(insertSQL).toContain("fuzzy_matched")
		expect(insertSQL).toContain("bbox") // Single JSON column, not separate x/y/w/h columns

		// Verify message was acknowledged
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
	})

	it("should handle empty marker results gracefully", async () => {
		// Mock container to return no markers
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response(JSON.stringify({ markers: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				})
			)
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 1,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Container should have been called
		expect(mockContainer.fetch).toHaveBeenCalledTimes(1)

		// No database inserts should have been attempted for markers
		const prepareCalls = mockDB.prepare.mock.calls
		const insertCalls = prepareCalls.filter((call: any[]) =>
			call[0].includes("INSERT INTO plan_markers")
		)
		expect(insertCalls.length).toBe(0)

		// Message should still be acknowledged (job completed successfully, just no markers)
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
		expect(mockMessage.retry).not.toHaveBeenCalled()
	})

	it("should retry when callout-processor returns error", async () => {
		// Mock container to return error
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response("Model timeout", {
					status: 500,
					statusText: "Internal Server Error",
				})
			)
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5", "A6"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 2,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify message was retried
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should retry when sheet PDF not found in R2", async () => {
		// Mock R2 to return null (file not found)
		mockStorage.get = mock(() => {
			return Promise.resolve(null)
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 1,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Should not call container if sheet not found
		expect(mockContainer.fetch).not.toHaveBeenCalled()

		// Message should be retried (sheet might not be ready yet)
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should retry when R2 fetch throws error", async () => {
		// Mock R2 to throw error
		mockStorage.get = mock(() => {
			throw new Error("R2 connection timeout")
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 1,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Message should be retried
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should process multiple sheet jobs in batch", async () => {
		const jobs: SheetMarkerDetectionJob[] = [
			{
				uploadId: "upload-123",
				planId: "plan-456",
				organizationId: "org-1",
				projectId: "proj-1",
				validSheets: ["A5", "A6"],
				sheetId: "sheet-uuid-1",
				sheetNumber: 1,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
				totalSheets: 2,
			},
			{
				uploadId: "upload-123",
				planId: "plan-456",
				organizationId: "org-1",
				projectId: "proj-1",
				validSheets: ["A5", "A6"],
				sheetId: "sheet-uuid-2",
				sheetNumber: 2,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-2.pdf",
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
			queue: "sheet-marker-detection-queue",
			messages: mockMessages,
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify both sheets were fetched from R2
		expect(mockStorage.get).toHaveBeenCalledTimes(2)
		expect(mockStorage.get).toHaveBeenCalledWith(jobs[0].sheetKey)
		expect(mockStorage.get).toHaveBeenCalledWith(jobs[1].sheetKey)

		// Verify both sheets were sent to container
		expect(mockContainer.fetch).toHaveBeenCalledTimes(2)

		// Verify both messages were acknowledged
		mockMessages.forEach((msg) => {
			expect(msg.ack).toHaveBeenCalledTimes(1)
			expect(msg.retry).not.toHaveBeenCalled()
		})
	})

	it("should continue processing when one job fails", async () => {
		// First sheet succeeds, second fails
		let getCallCount = 0
		mockStorage.get = mock(() => {
			getCallCount++
			if (getCallCount === 1) {
				return Promise.resolve({
					body: new ArrayBuffer(1024),
					size: 1024,
					httpEtag: "abc123",
				})
			} else {
				throw new Error("R2 timeout")
			}
		})

		const jobs: SheetMarkerDetectionJob[] = [
			{
				uploadId: "upload-123",
				planId: "plan-456",
				organizationId: "org-1",
				projectId: "proj-1",
				validSheets: ["A5"],
				sheetId: "sheet-uuid-1",
				sheetNumber: 1,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
				totalSheets: 2,
			},
			{
				uploadId: "upload-123",
				planId: "plan-456",
				organizationId: "org-1",
				projectId: "proj-1",
				validSheets: ["A5"],
				sheetId: "sheet-uuid-2",
				sheetNumber: 2,
				sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-2.pdf",
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
			queue: "sheet-marker-detection-queue",
			messages: mockMessages,
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// First message acknowledged, second retried
		expect(mockMessages[0].ack).toHaveBeenCalledTimes(1)
		expect(mockMessages[0].retry).not.toHaveBeenCalled()
		expect(mockMessages[1].retry).toHaveBeenCalledTimes(1)
		expect(mockMessages[1].ack).not.toHaveBeenCalled()
	})

	it("should handle database insertion errors by retrying", async () => {
		// Mock database to fail on insert (Drizzle generates lowercase SQL)
		mockDB.prepare = mock((sql: string) => {
			if (sql.toLowerCase().includes("insert into") && sql.includes("plan_markers")) {
				return {
					bind: mock(() => ({
						run: mock(() => {
							throw new Error("Database constraint violation")
						}),
					})),
				}
			}
			return {
				bind: mock(() => ({
					run: mock(() => Promise.resolve({ success: true })),
					all: mock(() => Promise.resolve({ results: [] })),
					first: mock(() => Promise.resolve(null)),
				})),
				run: mock(() => Promise.resolve({ success: true })),
			}
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A7"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 1,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Message should be retried due to database error
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should set correct headers for different sheet numbers", async () => {
		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5", "A6", "A7"],
			sheetId: "sheet-uuid-3",
			sheetNumber: 3,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-3.pdf",
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify headers match sheet number 3 of 5
		const [_, options] = mockContainer.fetch.mock.calls[0]
		expect(options.headers["X-Sheet-Number"]).toBe("3")
		expect(options.headers["X-Total-Sheets"]).toBe("5")
	})

	it("should handle malformed marker response from container", async () => {
		// Mock container to return invalid JSON
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response("Invalid JSON{", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				})
			)
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A5"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 1,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Should retry on malformed response
		expect(mockMessage.retry).toHaveBeenCalledTimes(1)
		expect(mockMessage.ack).not.toHaveBeenCalled()
	})

	it("should batch insert multiple markers from same sheet", async () => {
		// Mock container to return multiple markers
		mockContainer.fetch = mock(() => {
			return Promise.resolve(
				new Response(
					JSON.stringify({
						markers: [
							{
								marker_text: "1/A7",
								detail: "1",
								sheet: "A7",
								marker_type: "circular",
								confidence: 0.95,
								is_valid: true,
								fuzzy_matched: false,
								bbox: { x: 10, y: 20, w: 30, h: 40 },
							},
							{
								marker_text: "2/A7",
								detail: "2",
								sheet: "A7",
								marker_type: "circular",
								confidence: 0.92,
								is_valid: true,
								fuzzy_matched: false,
								bbox: { x: 50, y: 60, w: 30, h: 40 },
							},
							{
								marker_text: "3/A8",
								detail: "3",
								sheet: "A8",
								marker_type: "triangular",
								confidence: 0.88,
								is_valid: true,
								fuzzy_matched: true,
								bbox: { x: 100, y: 120, w: 35, h: 45 },
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					}
				)
			)
		})

		const job: SheetMarkerDetectionJob = {
			uploadId: "upload-123",
			planId: "plan-456",
			organizationId: "org-1",
			projectId: "proj-1",
			validSheets: ["A7", "A8"],
			sheetId: "sheet-uuid-1",
			sheetNumber: 1,
			sheetKey: "organizations/org-1/projects/proj-1/plans/plan-456/sheets/sheet-1.pdf",
			totalSheets: 1,
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
			queue: "sheet-marker-detection-queue",
			messages: [mockMessage],
		} as any

		const ctx = {} as ExecutionContext

		// Execute consumer
		await sheetMarkerDetectionQueueConsumer(batch, mockEnv, ctx)

		// Verify database prepare was called for batch insert
		expect(mockDB.prepare).toHaveBeenCalled()
		const prepareCalls = mockDB.prepare.mock.calls

		// Should have a single INSERT with multiple VALUE rows or multiple INSERT calls (Drizzle generates lowercase SQL)
		const insertCalls = prepareCalls.filter((call: any[]) =>
			call[0].toLowerCase().includes("insert into") && call[0].includes("plan_markers")
		)
		expect(insertCalls.length).toBeGreaterThan(0)

		// Message should be acknowledged
		expect(mockMessage.ack).toHaveBeenCalledTimes(1)
	})
})
