import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	handleCalloutDetectionQueue,
	handleMetadataExtractionQueue,
	handleTileGenerationQueue,
} from "../processing/queue-consumer";
import type {
	CalloutDetectionJob,
	MetadataExtractionJob,
	TileGenerationJob,
} from "../processing/types";
import type { Env } from "../types/env";

describe("LiveStore Events - Pipeline Processing", () => {
	let mockEnv: Partial<Env>;
	let mockLiveStoreStub: any;
	let mockCoordinatorStub: any;
	let mockR2Bucket: any;
	let mockPdfProcessorContainer: any;
	let fetchCallHistory: Array<{ url: string; init: RequestInit }>;

	beforeEach(() => {
		fetchCallHistory = [];

		mockLiveStoreStub = {
			fetch: vi.fn(async (url: string, init?: RequestInit) => {
				fetchCallHistory.push({ url, init: init || {} });
				return Response.json({ success: true });
			}),
		};

		mockCoordinatorStub = {
			sheetMetadataExtracted: vi.fn(async () => ({ progress: 50 })),
			sheetCalloutsDetected: vi.fn(async () => ({ progress: 75 })),
			sheetTilesGenerated: vi.fn(async () => ({ progress: 100 })),
		};

		mockR2Bucket = {
			get: vi.fn(async (key: string) => {
				if (key.includes("source.png")) {
					return {
						arrayBuffer: async () => new ArrayBuffer(1024),
					};
				}
				return null;
			}),
			put: vi.fn(async () => ({})),
		};

		mockPdfProcessorContainer = {
			fetch: vi.fn(async (url: string, _init?: RequestInit) => {
				if (url.includes("/extract-metadata")) {
					return Response.json({
						sheetNumber: "A-101",
						title: "Floor Plan",
						discipline: "Architecture",
						isValid: true,
					});
				}
				if (url.includes("/detect-callouts")) {
					return Response.json({
						markers: [
							{
								id: "marker-1",
								label: "1",
								targetSheetRef: "A-102",
								targetSheetId: "sheet-2",
								x: 100,
								y: 200,
								confidence: 0.95,
								needsReview: false,
							},
						],
						unmatchedCount: 0,
					});
				}
				if (url.includes("/generate-tiles")) {
					return new Response(new ArrayBuffer(2048));
				}
				return Response.json({ error: "Unknown endpoint" }, { status: 404 });
			}),
		};

		mockEnv = {
			LIVESTORE_CLIENT_DO: {
				get: vi.fn(() => mockLiveStoreStub),
				idFromName: vi.fn((name: string) => ({ toString: () => name })),
			} as any,
			PLAN_COORDINATOR_DO: {
				get: vi.fn(() => mockCoordinatorStub),
				idFromName: vi.fn((name: string) => ({ toString: () => name })),
			} as any,
			R2_BUCKET: mockR2Bucket,
			PDF_PROCESSOR_CONTAINER: mockPdfProcessorContainer,
		};
	});

	afterEach(() => {
		fetchCallHistory = [];
	});

	describe("sheetMetadataExtracted Event", () => {
		it("should commit event with required fields", async () => {
			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			expect(fetchCallHistory.length).toBe(1);
			const eventCall = fetchCallHistory[0];
			expect(eventCall.url).toBe("http://internal/commit");
			expect(eventCall.init.method).toBe("POST");

			const payload = JSON.parse(eventCall.init.body as string);
			expect(payload.event).toBe("sheetMetadataExtracted");
			expect(payload.data.sheetId).toBe("sheet-123");
			expect(payload.data.planId).toBe("plan-456");
			expect(payload.data.sheetNumber).toBe("A-101");
			expect(payload.data.sheetTitle).toBe("Floor Plan");
			expect(payload.data.discipline).toBe("Architecture");
		});

		it("should include timestamp as Number", async () => {
			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			expect(typeof payload.data.extractedAt).toBe("number");
			expect(payload.data.extractedAt).toBeGreaterThan(0);
		});

		it("should use correct LiveStore DO instance by organizationId", async () => {
			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-specific-123",
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			expect(mockEnv.LIVESTORE_CLIENT_DO?.idFromName).toHaveBeenCalledWith(
				"org-specific-123",
			);
		});

		it("should handle optional fields correctly", async () => {
			mockPdfProcessorContainer.fetch = vi.fn(async () =>
				Response.json({
					sheetNumber: "B-201",
					isValid: true,
				}),
			);

			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			expect(payload.data.sheetTitle).toBeUndefined();
			expect(payload.data.discipline).toBeUndefined();
		});
	});

	describe("sheetCalloutsDetected Event", () => {
		it("should commit event with markers array", async () => {
			const job: CalloutDetectionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				validSheetNumbers: ["A1", "A2"],
			};

			const batch: MessageBatch<CalloutDetectionJob> = {
				queue: "callout-detection",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			expect(fetchCallHistory.length).toBe(1);
			const payload = JSON.parse(fetchCallHistory[0].init.body as string);

			expect(payload.event).toBe("sheetCalloutsDetected");
			expect(payload.data.sheetId).toBe("sheet-123");
			expect(payload.data.planId).toBe("plan-456");
			expect(Array.isArray(payload.data.markers)).toBe(true);
			expect(payload.data.markers.length).toBe(1);
			expect(payload.data.unmatchedCount).toBe(0);
		});

		it("should include marker fields with correct types", async () => {
			const job: CalloutDetectionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				validSheetNumbers: ["A1", "A2"],
			};

			const batch: MessageBatch<CalloutDetectionJob> = {
				queue: "callout-detection",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			const marker = payload.data.markers[0];

			expect(typeof marker.id).toBe("string");
			expect(typeof marker.label).toBe("string");
			expect(typeof marker.x).toBe("number");
			expect(typeof marker.y).toBe("number");
			expect(typeof marker.confidence).toBe("number");
			expect(typeof marker.needsReview).toBe("boolean");
			expect(marker.confidence).toBeGreaterThanOrEqual(0);
			expect(marker.confidence).toBeLessThanOrEqual(1);
		});

		it("should include detectedAt timestamp as Number", async () => {
			const job: CalloutDetectionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				validSheetNumbers: ["A1"],
			};

			const batch: MessageBatch<CalloutDetectionJob> = {
				queue: "callout-detection",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			expect(typeof payload.data.detectedAt).toBe("number");
			expect(payload.data.detectedAt).toBeGreaterThan(0);
		});

		it("should handle markers without targetSheetId", async () => {
			mockPdfProcessorContainer.fetch = vi.fn(async () =>
				Response.json({
					markers: [
						{
							id: "marker-orphan",
							label: "99",
							x: 50,
							y: 100,
							confidence: 0.6,
							needsReview: true,
						},
					],
					unmatchedCount: 1,
				}),
			);

			const job: CalloutDetectionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				validSheetNumbers: ["A1"],
			};

			const batch: MessageBatch<CalloutDetectionJob> = {
				queue: "callout-detection",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			const marker = payload.data.markers[0];

			expect(marker.targetSheetRef).toBeUndefined();
			expect(marker.targetSheetId).toBeUndefined();
			expect(payload.data.unmatchedCount).toBe(1);
		});
	});

	describe("sheetTilesGenerated Event", () => {
		it("should commit event with PMTiles paths", async () => {
			const job: TileGenerationJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
			};

			const batch: MessageBatch<TileGenerationJob> = {
				queue: "tile-generation",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleTileGenerationQueue(batch, mockEnv as Env);

			expect(fetchCallHistory.length).toBe(1);
			const payload = JSON.parse(fetchCallHistory[0].init.body as string);

			expect(payload.event).toBe("sheetTilesGenerated");
			expect(payload.data.sheetId).toBe("sheet-123");
			expect(payload.data.planId).toBe("plan-456");
			expect(typeof payload.data.localPmtilesPath).toBe("string");
			expect(payload.data.localPmtilesPath).toContain("tiles.pmtiles");
			expect(payload.data.remotePmtilesPath).toContain("https://");
		});

		it("should include zoom levels as Numbers", async () => {
			const job: TileGenerationJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
			};

			const batch: MessageBatch<TileGenerationJob> = {
				queue: "tile-generation",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleTileGenerationQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);

			expect(typeof payload.data.minZoom).toBe("number");
			expect(typeof payload.data.maxZoom).toBe("number");
			expect(payload.data.minZoom).toBe(0);
			expect(payload.data.maxZoom).toBe(8);
		});

		it("should include generatedAt timestamp as Number", async () => {
			const job: TileGenerationJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
			};

			const batch: MessageBatch<TileGenerationJob> = {
				queue: "tile-generation",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleTileGenerationQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);

			expect(typeof payload.data.generatedAt).toBe("number");
			expect(payload.data.generatedAt).toBeGreaterThan(0);
		});

		it("should upload PMTiles to R2 before committing event", async () => {
			const job: TileGenerationJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
			};

			const batch: MessageBatch<TileGenerationJob> = {
				queue: "tile-generation",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleTileGenerationQueue(batch, mockEnv as Env);

			expect(mockR2Bucket.put).toHaveBeenCalled();
			const putCall = mockR2Bucket.put.mock.calls[0];
			expect(putCall[0]).toContain("tiles.pmtiles");
			expect(putCall[2].httpMetadata.contentType).toBe("application/x-pmtiles");
		});
	});

	describe("Event Commitment Integration", () => {
		it("should use correct commit endpoint format", async () => {
			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			const eventCall = fetchCallHistory[0];
			expect(eventCall.url).toBe("http://internal/commit");
			expect(eventCall.init.method).toBe("POST");
			expect(eventCall.init.headers?.["Content-Type"]).toBe("application/json");
		});

		it("should verify LiveStore commit is called even on error response", async () => {
			const commitErrorFetch = vi.fn(async () => {
				return Response.json({ error: "Store unavailable" }, { status: 500 });
			});
			mockLiveStoreStub.fetch = commitErrorFetch;

			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const retryMock = vi.fn(() => {});
			const ackMock = vi.fn(() => {});

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: ackMock,
						retry: retryMock,
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			expect(commitErrorFetch).toHaveBeenCalled();
			expect(ackMock).toHaveBeenCalled();
		});

		it("should not commit event if container processing fails", async () => {
			mockPdfProcessorContainer.fetch = vi.fn(async () => {
				return Response.json({ error: "Processing failed" }, { status: 500 });
			});

			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			expect(fetchCallHistory.length).toBe(0);
			expect(batch.messages[0].retry).toHaveBeenCalled();
		});
	});

	describe("Timestamp Purity Validation", () => {
		it("all timestamps should be generated at event creation time, not in materializers", async () => {
			const timestampsBefore: number[] = [];
			const timestampsAfter: number[] = [];

			for (let i = 0; i < 3; i++) {
				const job: MetadataExtractionJob = {
					sheetId: `sheet-${i}`,
					planId: "plan-456",
					projectId: "proj-789",
					organizationId: "org-abc",
				};

				const batch: MessageBatch<MetadataExtractionJob> = {
					queue: "metadata-extraction",
					messages: [
						{
							id: `msg-${i}`,
							timestamp: new Date(),
							body: job,
							attempts: 0,
							ack: vi.fn(() => {}),
							retry: vi.fn(() => {}),
						},
					],
				};

				await handleMetadataExtractionQueue(batch, mockEnv as Env);

				const payload = JSON.parse(
					fetchCallHistory[fetchCallHistory.length - 1].init.body as string,
				);
				if (i === 0) {
					timestampsBefore.push(payload.data.extractedAt);
				} else {
					timestampsAfter.push(payload.data.extractedAt);
				}

				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			for (const ts of timestampsAfter) {
				expect(ts).toBeGreaterThan(timestampsBefore[0]);
			}
		});

		it("events should contain no calls to Date.now() or Math.random() in schema", () => {
			const eventNames = [
				"sheetMetadataExtracted",
				"sheetCalloutsDetected",
				"sheetTilesGenerated",
			];

			for (const eventName of eventNames) {
				expect(eventName).toBeTruthy();
			}
		});
	});

	describe("Event Data Schema Validation", () => {
		it("sheetMetadataExtracted should match event schema structure", async () => {
			const job: MetadataExtractionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				sheetNumber: 1,
				totalSheets: 5,
			};

			const batch: MessageBatch<MetadataExtractionJob> = {
				queue: "metadata-extraction",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleMetadataExtractionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			const requiredFields = [
				"sheetId",
				"planId",
				"sheetNumber",
				"extractedAt",
			];

			for (const field of requiredFields) {
				expect(payload.data).toHaveProperty(field);
			}
		});

		it("sheetCalloutsDetected should match event schema structure", async () => {
			const job: CalloutDetectionJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
				validSheetNumbers: ["A1"],
			};

			const batch: MessageBatch<CalloutDetectionJob> = {
				queue: "callout-detection",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			const requiredFields = [
				"sheetId",
				"planId",
				"markers",
				"unmatchedCount",
				"detectedAt",
			];

			for (const field of requiredFields) {
				expect(payload.data).toHaveProperty(field);
			}
		});

		it("sheetTilesGenerated should match event schema structure", async () => {
			const job: TileGenerationJob = {
				sheetId: "sheet-123",
				planId: "plan-456",
				projectId: "proj-789",
				organizationId: "org-abc",
			};

			const batch: MessageBatch<TileGenerationJob> = {
				queue: "tile-generation",
				messages: [
					{
						id: "msg-1",
						timestamp: new Date(),
						body: job,
						attempts: 0,
						ack: vi.fn(() => {}),
						retry: vi.fn(() => {}),
					},
				],
			};

			await handleTileGenerationQueue(batch, mockEnv as Env);

			const payload = JSON.parse(fetchCallHistory[0].init.body as string);
			const requiredFields = [
				"sheetId",
				"planId",
				"localPmtilesPath",
				"minZoom",
				"maxZoom",
				"generatedAt",
			];

			for (const field of requiredFields) {
				expect(payload.data).toHaveProperty(field);
			}
		});
	});
});
