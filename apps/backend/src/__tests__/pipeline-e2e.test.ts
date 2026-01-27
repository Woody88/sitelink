import { describe, expect, it, vi } from "vitest";
import {
	handleImageGenerationQueue,
	handleMetadataExtractionQueue,
	handleCalloutDetectionQueue,
	handleTileGenerationQueue,
} from "../processing/queue-consumer";
import {
	handleR2NotificationQueue,
	parseR2EventPath,
	type R2EventNotification,
} from "../processing/r2-with-notifications";
import type {
	ImageGenerationJob,
	MetadataExtractionJob,
	CalloutDetectionJob,
	TileGenerationJob,
} from "../processing/types";
import { getR2Path } from "../processing/types";
import type { Env } from "../types/env";

interface MockMessage<T> {
	body: T;
	ack: () => void;
	retry: () => void;
}

function createMockMessage<T>(body: T): MockMessage<T> {
	return {
		body,
		ack: vi.fn(),
		retry: vi.fn(),
	};
}

function createMockBatch<T>(messages: MockMessage<T>[]): MessageBatch<T> {
	return {
		messages,
		queue: "test-queue",
		ackAll: vi.fn(),
		retryAll: vi.fn(),
	};
}

const testOrganizationId = "test-org-123";
const testProjectId = "test-project-456";
const testPlanId = "test-plan-789";
const testSheetId = "sheet-0";

function createMockEnv(options?: {
	coordinatorState?: any;
	r2Objects?: Map<string, { data: ArrayBuffer; metadata: any }>;
}) {
	const r2Objects =
		options?.r2Objects ?? new Map<string, { data: ArrayBuffer; metadata: any }>();
	const queuedMessages: Record<string, any[]> = {
		IMAGE_GENERATION_QUEUE: [],
		METADATA_EXTRACTION_QUEUE: [],
		CALLOUT_DETECTION_QUEUE: [],
		TILE_GENERATION_QUEUE: [],
		R2_NOTIFICATION_QUEUE: [],
	};
	const liveStoreRequests: any[] = [];
	const coordinatorCalls: any[] = [];

	let coordinatorState = options?.coordinatorState ?? {
		planId: testPlanId,
		projectId: testProjectId,
		organizationId: testOrganizationId,
		totalSheets: 1,
		generatedImages: [],
		extractedMetadata: [],
		validSheets: [],
		sheetNumberMap: {},
		detectedCallouts: [],
		generatedTiles: [],
		status: "image_generation",
		createdAt: Date.now(),
	};

	const mockContainer = {
		startAndWaitForPorts: vi.fn(async () => {}),
		fetch: vi.fn(async (url: string, _init?: RequestInit) => {
			if (url.includes("/generate-images")) {
				return Response.json({
					sheets: [
						{ sheetId: "sheet-0", width: 3000, height: 2000, pageNumber: 1 },
					],
					totalPages: 1,
				});
			}
			if (url.includes("/render-page")) {
				return new Response(new ArrayBuffer(1024), {
					headers: { "Content-Type": "image/png" },
				});
			}
			if (url.includes("/extract-metadata")) {
				return Response.json({
					sheetNumber: "A1",
					title: "Floor Plan",
					discipline: "Architectural",
					isValid: true,
				});
			}
			if (url.includes("/detect-callouts")) {
				return Response.json({
					markers: [
						{
							id: "m1",
							label: "1",
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
			return Response.json({ error: "Unknown" }, { status: 404 });
		}),
	};

	const mockCoordinator = {
		initialize: vi.fn(async (params: any) => {
			coordinatorCalls.push({ method: "initialize", params });
			coordinatorState = {
				...coordinatorState,
				...params,
				generatedImages: [],
				extractedMetadata: [],
				validSheets: [],
				sheetNumberMap: {},
				detectedCallouts: [],
				generatedTiles: [],
				status: "image_generation",
			};
			return { success: true, state: coordinatorState };
		}),
		getState: vi.fn(async () => coordinatorState),
		sheetImageGenerated: vi.fn(async (sheetId: string) => {
			coordinatorCalls.push({ method: "sheetImageGenerated", sheetId });
			if (!coordinatorState.generatedImages.includes(sheetId)) {
				coordinatorState.generatedImages.push(sheetId);
			}
			if (
				coordinatorState.generatedImages.length === coordinatorState.totalSheets
			) {
				coordinatorState.status = "metadata_extraction";
			}
			return { success: true };
		}),
		sheetMetadataExtracted: vi.fn(
			async (sheetId: string, isValid: boolean, sheetNumber?: string) => {
				coordinatorCalls.push({
					method: "sheetMetadataExtracted",
					sheetId,
					isValid,
					sheetNumber,
				});
				if (!coordinatorState.extractedMetadata.includes(sheetId)) {
					coordinatorState.extractedMetadata.push(sheetId);
					if (isValid) {
						coordinatorState.validSheets.push(sheetId);
						if (sheetNumber) {
							coordinatorState.sheetNumberMap[sheetId] = sheetNumber;
						}
					}
				}
				if (
					coordinatorState.extractedMetadata.length ===
					coordinatorState.totalSheets
				) {
					coordinatorState.status = "callout_detection";
				}
				return { success: true };
			},
		),
		sheetCalloutsDetected: vi.fn(async (sheetId: string) => {
			coordinatorCalls.push({ method: "sheetCalloutsDetected", sheetId });
			if (!coordinatorState.detectedCallouts.includes(sheetId)) {
				coordinatorState.detectedCallouts.push(sheetId);
			}
			if (
				coordinatorState.detectedCallouts.length ===
				coordinatorState.validSheets.length
			) {
				coordinatorState.status = "tile_generation";
			}
			return { success: true };
		}),
		sheetTilesGenerated: vi.fn(async (sheetId: string) => {
			coordinatorCalls.push({ method: "sheetTilesGenerated", sheetId });
			if (!coordinatorState.generatedTiles.includes(sheetId)) {
				coordinatorState.generatedTiles.push(sheetId);
			}
			if (
				coordinatorState.generatedTiles.length ===
				coordinatorState.validSheets.length
			) {
				coordinatorState.status = "complete";
			}
			return { success: true };
		}),
		markFailed: vi.fn(async (error: string) => {
			coordinatorCalls.push({ method: "markFailed", error });
			coordinatorState.status = "failed";
			coordinatorState.lastError = error;
			return { success: true };
		}),
	};

	const mockEnv: Partial<Env> = {
		R2_BUCKET: {
			put: vi.fn(async (key: string, data: ArrayBuffer, opts?: any) => {
				r2Objects.set(key, { data, metadata: opts });
				return {};
			}),
			get: vi.fn(async (key: string) => {
				const obj = r2Objects.get(key);
				if (!obj) return null;
				return {
					arrayBuffer: async () => obj.data,
					text: async () => new TextDecoder().decode(obj.data),
					httpMetadata: obj.metadata?.httpMetadata,
					customMetadata: obj.metadata?.customMetadata,
				};
			}),
			delete: vi.fn(async () => {}),
			list: vi.fn(async () => ({
				objects: Array.from(r2Objects.keys()).map((key) => ({ key })),
			})),
		} as any,
		IMAGE_GENERATION_QUEUE: {
			send: vi.fn(async (message: any) => {
				queuedMessages.IMAGE_GENERATION_QUEUE.push(message);
			}),
		} as any,
		METADATA_EXTRACTION_QUEUE: {
			send: vi.fn(async (message: any) => {
				queuedMessages.METADATA_EXTRACTION_QUEUE.push(message);
			}),
		} as any,
		CALLOUT_DETECTION_QUEUE: {
			send: vi.fn(async (message: any) => {
				queuedMessages.CALLOUT_DETECTION_QUEUE.push(message);
			}),
		} as any,
		TILE_GENERATION_QUEUE: {
			send: vi.fn(async (message: any) => {
				queuedMessages.TILE_GENERATION_QUEUE.push(message);
			}),
		} as any,
		R2_NOTIFICATION_QUEUE: {
			send: vi.fn(async (message: any) => {
				queuedMessages.R2_NOTIFICATION_QUEUE.push(message);
			}),
		} as any,
		PLAN_COORDINATOR_DO: {
			idFromName: vi.fn((name: string) => ({ toString: () => name })),
			get: vi.fn(() => mockCoordinator),
		} as any,
		LIVESTORE_CLIENT_DO: {
			idFromName: vi.fn((name: string) => ({ name })),
			get: vi.fn(() => ({
				fetch: vi.fn(async (url: string, options: any) => {
					liveStoreRequests.push({ url, options });
					return new Response(JSON.stringify({ success: true }), {
						status: 200,
					});
				}),
			})),
		} as any,
		PDF_PROCESSOR: {
			idFromName: vi.fn((name: string) => ({ toString: () => name })),
			get: vi.fn(() => mockContainer),
		} as any,
	};

	return {
		mockEnv: mockEnv as Env,
		mockContainer,
		mockCoordinator,
		queuedMessages,
		liveStoreRequests,
		coordinatorCalls,
		r2Objects,
		getCoordinatorState: () => coordinatorState,
	};
}

describe("Pipeline Stage Tests", () => {
	describe("Stage 1: R2 Notification Handler", () => {
		it("should parse R2 path and queue image generation job", async () => {
			const { mockEnv, queuedMessages, liveStoreRequests } = createMockEnv();
			const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;

			const notification: R2EventNotification = {
				account: "test-account",
				bucket: "sitelink-files",
				object: {
					key: pdfPath,
					size: 1024,
					eTag: "test-etag",
				},
				action: "PutObject",
				eventTime: new Date().toISOString(),
			};

			const message = createMockMessage(notification);
			const batch = createMockBatch([message]);

			await handleR2NotificationQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(queuedMessages.IMAGE_GENERATION_QUEUE).toHaveLength(1);
			expect(queuedMessages.IMAGE_GENERATION_QUEUE[0]).toMatchObject({
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				pdfPath,
			});

			expect(liveStoreRequests).toHaveLength(1);
			const liveStoreBody = JSON.parse(liveStoreRequests[0].options.body);
			expect(liveStoreBody.eventName).toBe("planProcessingStarted");
			expect(liveStoreBody.data.planId).toBe(testPlanId);
		});

		it("should ignore non-PDF uploads", async () => {
			const { mockEnv, queuedMessages } = createMockEnv();

			const notification: R2EventNotification = {
				account: "test-account",
				bucket: "sitelink-files",
				object: {
					key: `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/image.png`,
					size: 1024,
					eTag: "test-etag",
				},
				action: "PutObject",
				eventTime: new Date().toISOString(),
			};

			const message = createMockMessage(notification);
			const batch = createMockBatch([message]);

			await handleR2NotificationQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(queuedMessages.IMAGE_GENERATION_QUEUE).toHaveLength(0);
		});

		it("should handle CompleteMultipartUpload action for large PDFs", async () => {
			const { mockEnv, queuedMessages } = createMockEnv();
			const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;

			const notification: R2EventNotification = {
				account: "test-account",
				bucket: "sitelink-files",
				object: {
					key: pdfPath,
					size: 100 * 1024 * 1024, // 100MB
					eTag: "test-etag",
				},
				action: "CompleteMultipartUpload",
				eventTime: new Date().toISOString(),
			};

			const message = createMockMessage(notification);
			const batch = createMockBatch([message]);

			await handleR2NotificationQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(queuedMessages.IMAGE_GENERATION_QUEUE).toHaveLength(1);
		});
	});

	describe("Stage 2: Image Generation Handler", () => {
		it("should call container and emit LiveStore events", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
			r2Objects.set(pdfPath, {
				data: new ArrayBuffer(1024),
				metadata: { httpMetadata: { contentType: "application/pdf" } },
			});

			const {
				mockEnv,
				mockContainer,
				mockCoordinator,
				liveStoreRequests,
			} = createMockEnv({ r2Objects });

			const job: ImageGenerationJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				pdfPath,
				totalPages: 1,
				planName: "test-plan",
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleImageGenerationQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(mockContainer.startAndWaitForPorts).toHaveBeenCalled();
			expect(mockContainer.fetch).toHaveBeenCalledWith(
				"http://container/generate-images",
				expect.any(Object),
			);
			expect(mockContainer.fetch).toHaveBeenCalledWith(
				"http://container/render-page",
				expect.any(Object),
			);

			expect(mockCoordinator.initialize).toHaveBeenCalled();
			expect(mockCoordinator.sheetImageGenerated).toHaveBeenCalledWith(
				"sheet-0",
			);

			const imageGeneratedEvent = liveStoreRequests.find((r) => {
				const body = JSON.parse(r.options.body);
				return body.eventName === "sheetImageGenerated";
			});
			expect(imageGeneratedEvent).toBeDefined();
			const eventBody = JSON.parse(imageGeneratedEvent.options.body);
			expect(eventBody.data.sheetId).toBe("sheet-0");
			expect(eventBody.data.pageNumber).toBe(1);
		});

		it("should retry on container failure", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
			r2Objects.set(pdfPath, {
				data: new ArrayBuffer(1024),
				metadata: {},
			});

			const { mockEnv, mockContainer } = createMockEnv({ r2Objects });
			mockContainer.fetch.mockRejectedValueOnce(new Error("Container error"));

			const job: ImageGenerationJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				pdfPath,
				totalPages: 1,
				planName: "test-plan",
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleImageGenerationQueue(batch, mockEnv);

			expect(message.retry).toHaveBeenCalled();
			expect(message.ack).not.toHaveBeenCalled();
		});

		it("should retry when PDF not found in R2", async () => {
			const { mockEnv } = createMockEnv();

			const job: ImageGenerationJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				pdfPath: "nonexistent/path.pdf",
				totalPages: 1,
				planName: "test-plan",
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleImageGenerationQueue(batch, mockEnv);

			expect(message.retry).toHaveBeenCalled();
		});
	});

	describe("Stage 3: Metadata Extraction Handler", () => {
		it("should extract metadata and emit LiveStore events", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				testSheetId,
				"source.png",
			);
			r2Objects.set(imagePath, {
				data: new ArrayBuffer(1024),
				metadata: { httpMetadata: { contentType: "image/png" } },
			});

			const {
				mockEnv,
				mockContainer,
				mockCoordinator,
				liveStoreRequests,
			} = createMockEnv({ r2Objects });

			const job: MetadataExtractionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: testSheetId,
				sheetNumber: 1,
				totalSheets: 1,
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleMetadataExtractionQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(mockContainer.fetch).toHaveBeenCalledWith(
				"http://container/extract-metadata",
				expect.any(Object),
			);

			expect(mockCoordinator.sheetMetadataExtracted).toHaveBeenCalledWith(
				testSheetId,
				true,
				"A1",
			);

			const metadataEvent = liveStoreRequests.find((r) => {
				const body = JSON.parse(r.options.body);
				return body.eventName === "sheetMetadataExtracted";
			});
			expect(metadataEvent).toBeDefined();
			const eventBody = JSON.parse(metadataEvent.options.body);
			expect(eventBody.data.sheetNumber).toBe("A1");
			expect(eventBody.data.sheetTitle).toBe("Floor Plan");
		});

		it("should handle invalid sheets", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				testSheetId,
				"source.png",
			);
			r2Objects.set(imagePath, {
				data: new ArrayBuffer(1024),
				metadata: {},
			});

			const { mockEnv, mockContainer, mockCoordinator } = createMockEnv({
				r2Objects,
			});

			mockContainer.fetch.mockImplementation(async (url: string) => {
				if (url.includes("/extract-metadata")) {
					return Response.json({
						sheetNumber: null,
						title: null,
						isValid: false,
					});
				}
				return Response.json({ error: "Unknown" }, { status: 404 });
			});

			const job: MetadataExtractionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: testSheetId,
				sheetNumber: 1,
				totalSheets: 1,
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleMetadataExtractionQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(mockCoordinator.sheetMetadataExtracted).toHaveBeenCalledWith(
				testSheetId,
				false,
				undefined,
			);
		});
	});

	describe("Stage 4: Callout Detection Handler", () => {
		it("should detect callouts and emit LiveStore events", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				testSheetId,
				"source.png",
			);
			r2Objects.set(imagePath, {
				data: new ArrayBuffer(1024),
				metadata: {},
			});

			const {
				mockEnv,
				mockContainer,
				mockCoordinator,
				liveStoreRequests,
			} = createMockEnv({ r2Objects });

			const job: CalloutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: testSheetId,
				sheetNumber: "A1",
				validSheetNumbers: ["A1", "A2"],
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleCalloutDetectionQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(mockContainer.fetch).toHaveBeenCalledWith(
				"http://container/detect-callouts",
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Sheet-Number": "A1",
						"X-Valid-Sheet-Numbers": JSON.stringify(["A1", "A2"]),
					}),
				}),
			);

			expect(mockCoordinator.sheetCalloutsDetected).toHaveBeenCalledWith(
				testSheetId,
			);

			const calloutEvent = liveStoreRequests.find((r) => {
				const body = JSON.parse(r.options.body);
				return body.eventName === "sheetCalloutsDetected";
			});
			expect(calloutEvent).toBeDefined();
			const eventBody = JSON.parse(calloutEvent.options.body);
			expect(eventBody.data.markers).toHaveLength(1);
			expect(eventBody.data.markers[0].label).toBe("1");
			expect(eventBody.data.markers[0].confidence).toBe(0.95);
		});

		it("should handle sheets with no callouts", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				testSheetId,
				"source.png",
			);
			r2Objects.set(imagePath, {
				data: new ArrayBuffer(1024),
				metadata: {},
			});

			const { mockEnv, mockContainer, liveStoreRequests } = createMockEnv({
				r2Objects,
			});

			mockContainer.fetch.mockImplementation(async (url: string) => {
				if (url.includes("/detect-callouts")) {
					return Response.json({
						markers: [],
						unmatchedCount: 0,
					});
				}
				return Response.json({ error: "Unknown" }, { status: 404 });
			});

			const job: CalloutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: testSheetId,
				sheetNumber: "A1",
				validSheetNumbers: ["A1"],
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleCalloutDetectionQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			const calloutEvent = liveStoreRequests.find((r) => {
				const body = JSON.parse(r.options.body);
				return body.eventName === "sheetCalloutsDetected";
			});
			expect(calloutEvent).toBeDefined();
			const eventBody = JSON.parse(calloutEvent.options.body);
			expect(eventBody.data.markers).toHaveLength(0);
		});
	});

	describe("Stage 5: Tile Generation Handler", () => {
		it("should generate tiles and emit LiveStore events", async () => {
			const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				testSheetId,
				"source.png",
			);
			r2Objects.set(imagePath, {
				data: new ArrayBuffer(1024),
				metadata: {},
			});

			const {
				mockEnv,
				mockContainer,
				mockCoordinator,
				liveStoreRequests,
			} = createMockEnv({ r2Objects });

			const job: TileGenerationJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: testSheetId,
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleTileGenerationQueue(batch, mockEnv);

			expect(message.ack).toHaveBeenCalled();
			expect(mockContainer.fetch).toHaveBeenCalledWith(
				"http://container/generate-tiles",
				expect.any(Object),
			);

			expect(mockCoordinator.sheetTilesGenerated).toHaveBeenCalledWith(
				testSheetId,
			);

			const pmtilesPath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				testSheetId,
				"tiles.pmtiles",
			);
			expect(r2Objects.has(pmtilesPath)).toBe(true);

			const tileEvent = liveStoreRequests.find((r) => {
				const body = JSON.parse(r.options.body);
				return body.eventName === "sheetTilesGenerated";
			});
			expect(tileEvent).toBeDefined();
			const eventBody = JSON.parse(tileEvent.options.body);
			expect(eventBody.data.localPmtilesPath).toBe(pmtilesPath);
		});
	});
});

describe("Full Pipeline E2E Test", () => {
	it("should process PDF through all stages to completion", async () => {
		const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		r2Objects.set(pdfPath, {
			data: new ArrayBuffer(1024),
			metadata: { httpMetadata: { contentType: "application/pdf" } },
		});

		const {
			mockEnv,
			queuedMessages,
			liveStoreRequests,
			coordinatorCalls,
			getCoordinatorState,
		} = createMockEnv({ r2Objects });

		const r2Notification: R2EventNotification = {
			account: "test-account",
			bucket: "sitelink-files",
			object: {
				key: pdfPath,
				size: 1024,
				eTag: "test-etag",
			},
			action: "PutObject",
			eventTime: new Date().toISOString(),
		};
		const r2Message = createMockMessage(r2Notification);
		await handleR2NotificationQueue(createMockBatch([r2Message]), mockEnv);

		expect(queuedMessages.IMAGE_GENERATION_QUEUE).toHaveLength(1);
		const imageJob = queuedMessages.IMAGE_GENERATION_QUEUE[0];
		expect(imageJob.planId).toBe(testPlanId);

		const imageMessage = createMockMessage(imageJob as ImageGenerationJob);
		await handleImageGenerationQueue(createMockBatch([imageMessage]), mockEnv);

		expect(imageMessage.ack).toHaveBeenCalled();
		const initCall = coordinatorCalls.find((c) => c.method === "initialize");
		expect(initCall).toBeDefined();
		expect(initCall.params.totalSheets).toBe(1);

		const state1 = getCoordinatorState();
		expect(state1.generatedImages).toContain("sheet-0");
		expect(state1.status).toBe("metadata_extraction");

		const imagePath = getR2Path(
			testOrganizationId,
			testProjectId,
			testPlanId,
			"sheet-0",
			"source.png",
		);
		expect(r2Objects.has(imagePath)).toBe(true);

		const metadataJob: MetadataExtractionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: "sheet-0",
			sheetNumber: 1,
			totalSheets: 1,
		};
		const metadataMessage = createMockMessage(metadataJob);
		await handleMetadataExtractionQueue(
			createMockBatch([metadataMessage]),
			mockEnv,
		);

		expect(metadataMessage.ack).toHaveBeenCalled();
		const state2 = getCoordinatorState();
		expect(state2.extractedMetadata).toContain("sheet-0");
		expect(state2.validSheets).toContain("sheet-0");
		expect(state2.sheetNumberMap["sheet-0"]).toBe("A1");
		expect(state2.status).toBe("callout_detection");

		const calloutJob: CalloutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: "sheet-0",
			sheetNumber: "A1",
			validSheetNumbers: ["A1"],
		};
		const calloutMessage = createMockMessage(calloutJob);
		await handleCalloutDetectionQueue(
			createMockBatch([calloutMessage]),
			mockEnv,
		);

		expect(calloutMessage.ack).toHaveBeenCalled();
		const state3 = getCoordinatorState();
		expect(state3.detectedCallouts).toContain("sheet-0");
		expect(state3.status).toBe("tile_generation");

		const tileJob: TileGenerationJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: "sheet-0",
		};
		const tileMessage = createMockMessage(tileJob);
		await handleTileGenerationQueue(createMockBatch([tileMessage]), mockEnv);

		expect(tileMessage.ack).toHaveBeenCalled();
		const finalState = getCoordinatorState();
		expect(finalState.generatedTiles).toContain("sheet-0");
		expect(finalState.status).toBe("complete");

		const pmtilesPath = getR2Path(
			testOrganizationId,
			testProjectId,
			testPlanId,
			"sheet-0",
			"tiles.pmtiles",
		);
		expect(r2Objects.has(pmtilesPath)).toBe(true);

		const eventNames = liveStoreRequests.map((r) => {
			const body = JSON.parse(r.options.body);
			return body.eventName;
		});
		expect(eventNames).toContain("planProcessingStarted");
		expect(eventNames).toContain("sheetImageGenerated");
		expect(eventNames).toContain("sheetMetadataExtracted");
		expect(eventNames).toContain("sheetCalloutsDetected");
		expect(eventNames).toContain("sheetTilesGenerated");
	});

	it("should handle multi-sheet PDF processing", async () => {
		const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		r2Objects.set(pdfPath, {
			data: new ArrayBuffer(2048),
			metadata: { httpMetadata: { contentType: "application/pdf" } },
		});

		const { mockEnv, mockContainer, getCoordinatorState } = createMockEnv({
			r2Objects,
		});

		mockContainer.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
			if (url.includes("/generate-images")) {
				return Response.json({
					sheets: [
						{ sheetId: "sheet-0", width: 3000, height: 2000, pageNumber: 1 },
						{ sheetId: "sheet-1", width: 3000, height: 2000, pageNumber: 2 },
						{ sheetId: "sheet-2", width: 3000, height: 2000, pageNumber: 3 },
					],
					totalPages: 3,
				});
			}
			if (url.includes("/render-page")) {
				return new Response(new ArrayBuffer(1024), {
					headers: { "Content-Type": "image/png" },
				});
			}
			if (url.includes("/extract-metadata")) {
				const sheetId = init?.headers
					? (init.headers as Record<string, string>)["X-Sheet-Id"]
					: "unknown";
				const sheetNumberMap: Record<string, string> = {
					"sheet-0": "A1",
					"sheet-1": "A2",
					"sheet-2": "S1",
				};
				return Response.json({
					sheetNumber: sheetNumberMap[sheetId] ?? "unknown",
					title: `Sheet ${sheetId}`,
					isValid: true,
				});
			}
			if (url.includes("/detect-callouts")) {
				return Response.json({
					markers: [
						{
							id: "m1",
							label: "1",
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
			return Response.json({ error: "Unknown" }, { status: 404 });
		});

		const imageJob: ImageGenerationJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			pdfPath,
			totalPages: 3,
			planName: "test-plan",
		};
		await handleImageGenerationQueue(
			createMockBatch([createMockMessage(imageJob)]),
			mockEnv,
		);

		const state1 = getCoordinatorState();
		expect(state1.totalSheets).toBe(3);
		expect(state1.generatedImages).toHaveLength(3);
		expect(state1.status).toBe("metadata_extraction");

		for (let i = 0; i < 3; i++) {
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				`sheet-${i}`,
				"source.png",
			);
			expect(r2Objects.has(imagePath)).toBe(true);
		}

		for (let i = 0; i < 3; i++) {
			const metadataJob: MetadataExtractionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: `sheet-${i}`,
				sheetNumber: i + 1,
				totalSheets: 3,
			};
			await handleMetadataExtractionQueue(
				createMockBatch([createMockMessage(metadataJob)]),
				mockEnv,
			);
		}

		const state2 = getCoordinatorState();
		expect(state2.extractedMetadata).toHaveLength(3);
		expect(state2.validSheets).toHaveLength(3);
		expect(state2.status).toBe("callout_detection");

		const sheetNumbers = ["A1", "A2", "S1"];
		for (let i = 0; i < 3; i++) {
			const calloutJob: CalloutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: `sheet-${i}`,
				sheetNumber: sheetNumbers[i],
				validSheetNumbers: sheetNumbers,
			};
			await handleCalloutDetectionQueue(
				createMockBatch([createMockMessage(calloutJob)]),
				mockEnv,
			);
		}

		const state3 = getCoordinatorState();
		expect(state3.detectedCallouts).toHaveLength(3);
		expect(state3.status).toBe("tile_generation");

		for (let i = 0; i < 3; i++) {
			const tileJob: TileGenerationJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: `sheet-${i}`,
			};
			await handleTileGenerationQueue(
				createMockBatch([createMockMessage(tileJob)]),
				mockEnv,
			);
		}

		const finalState = getCoordinatorState();
		expect(finalState.generatedTiles).toHaveLength(3);
		expect(finalState.status).toBe("complete");

		for (let i = 0; i < 3; i++) {
			const pmtilesPath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				`sheet-${i}`,
				"tiles.pmtiles",
			);
			expect(r2Objects.has(pmtilesPath)).toBe(true);
		}
	});

	it("should handle mixed valid/invalid sheets", async () => {
		const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		r2Objects.set(pdfPath, {
			data: new ArrayBuffer(2048),
			metadata: { httpMetadata: { contentType: "application/pdf" } },
		});

		const { mockEnv, mockContainer, getCoordinatorState } = createMockEnv({
			r2Objects,
		});

		mockContainer.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
			if (url.includes("/generate-images")) {
				return Response.json({
					sheets: [
						{ sheetId: "sheet-0", width: 3000, height: 2000, pageNumber: 1 },
						{ sheetId: "sheet-1", width: 3000, height: 2000, pageNumber: 2 },
						{ sheetId: "sheet-2", width: 3000, height: 2000, pageNumber: 3 },
					],
					totalPages: 3,
				});
			}
			if (url.includes("/render-page")) {
				return new Response(new ArrayBuffer(1024), {
					headers: { "Content-Type": "image/png" },
				});
			}
			if (url.includes("/extract-metadata")) {
				const sheetId = init?.headers
					? (init.headers as Record<string, string>)["X-Sheet-Id"]
					: "unknown";
				if (sheetId === "sheet-1") {
					return Response.json({
						sheetNumber: null,
						title: null,
						isValid: false,
					});
				}
				const sheetNumberMap: Record<string, string> = {
					"sheet-0": "A1",
					"sheet-2": "S1",
				};
				return Response.json({
					sheetNumber: sheetNumberMap[sheetId] ?? "unknown",
					title: `Sheet ${sheetId}`,
					isValid: true,
				});
			}
			if (url.includes("/detect-callouts")) {
				return Response.json({
					markers: [],
					unmatchedCount: 0,
				});
			}
			if (url.includes("/generate-tiles")) {
				return new Response(new ArrayBuffer(2048));
			}
			return Response.json({ error: "Unknown" }, { status: 404 });
		});

		const imageJob: ImageGenerationJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			pdfPath,
			totalPages: 3,
			planName: "test-plan",
		};
		await handleImageGenerationQueue(
			createMockBatch([createMockMessage(imageJob)]),
			mockEnv,
		);

		for (let i = 0; i < 3; i++) {
			const metadataJob: MetadataExtractionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: `sheet-${i}`,
				sheetNumber: i + 1,
				totalSheets: 3,
			};
			await handleMetadataExtractionQueue(
				createMockBatch([createMockMessage(metadataJob)]),
				mockEnv,
			);
		}

		const state2 = getCoordinatorState();
		expect(state2.extractedMetadata).toHaveLength(3);
		expect(state2.validSheets).toHaveLength(2);
		expect(state2.validSheets).toContain("sheet-0");
		expect(state2.validSheets).not.toContain("sheet-1");
		expect(state2.validSheets).toContain("sheet-2");

		const validSheetNumbers = ["A1", "S1"];
		for (const sheetId of state2.validSheets) {
			const sheetNumber = state2.sheetNumberMap[sheetId];
			const calloutJob: CalloutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId,
				sheetNumber,
				validSheetNumbers,
			};
			await handleCalloutDetectionQueue(
				createMockBatch([createMockMessage(calloutJob)]),
				mockEnv,
			);
		}

		const state3 = getCoordinatorState();
		expect(state3.detectedCallouts).toHaveLength(2);
		expect(state3.status).toBe("tile_generation");

		for (const sheetId of state2.validSheets) {
			const tileJob: TileGenerationJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId,
			};
			await handleTileGenerationQueue(
				createMockBatch([createMockMessage(tileJob)]),
				mockEnv,
			);
		}

		const finalState = getCoordinatorState();
		expect(finalState.generatedTiles).toHaveLength(2);
		expect(finalState.status).toBe("complete");
	});
});

describe("Error Handling", () => {
	it("should handle container returning error status", async () => {
		const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		r2Objects.set(pdfPath, {
			data: new ArrayBuffer(1024),
			metadata: {},
		});

		const { mockEnv, mockContainer } = createMockEnv({ r2Objects });

		mockContainer.fetch.mockImplementation(async (url: string) => {
			if (url.includes("/generate-images")) {
				return Response.json(
					{ error: "Internal server error" },
					{ status: 500 },
				);
			}
			return Response.json({ error: "Unknown" }, { status: 404 });
		});

		const job: ImageGenerationJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			pdfPath,
			totalPages: 1,
			planName: "test-plan",
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleImageGenerationQueue(batch, mockEnv);

		expect(message.retry).toHaveBeenCalled();
		expect(message.ack).not.toHaveBeenCalled();
	});

	it("should handle LiveStore emission failure gracefully", async () => {
		const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
		const imagePath = getR2Path(
			testOrganizationId,
			testProjectId,
			testPlanId,
			testSheetId,
			"source.png",
		);
		r2Objects.set(imagePath, {
			data: new ArrayBuffer(1024),
			metadata: {},
		});

		const { mockEnv } = createMockEnv({ r2Objects });

		const liveStoreMock = mockEnv.LIVESTORE_CLIENT_DO as any;
		liveStoreMock.get = vi.fn(() => ({
			fetch: vi.fn().mockRejectedValue(new Error("LiveStore unavailable")),
		}));

		const job: MetadataExtractionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
			sheetNumber: 1,
			totalSheets: 1,
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleMetadataExtractionQueue(batch, mockEnv);

		expect(message.ack).toHaveBeenCalled();
	});

	it("should handle missing R2 image during tile generation", async () => {
		const { mockEnv } = createMockEnv();

		const job: TileGenerationJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: "nonexistent-sheet",
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleTileGenerationQueue(batch, mockEnv);

		expect(message.retry).toHaveBeenCalled();
		expect(message.ack).not.toHaveBeenCalled();
	});
});

describe("Path Parsing", () => {
	it("should correctly parse valid R2 paths", () => {
		const testCases = [
			{
				path: "organizations/org-123/projects/proj-456/plans/plan-789/source.pdf",
				expected: {
					organizationId: "org-123",
					projectId: "proj-456",
					planId: "plan-789",
				},
			},
			{
				path: "organizations/test-org-123/projects/test-project-456/plans/test-plan-789/source.pdf",
				expected: {
					organizationId: "test-org-123",
					projectId: "test-project-456",
					planId: "test-plan-789",
				},
			},
		];

		for (const tc of testCases) {
			const result = parseR2EventPath(tc.path);
			expect(result).not.toBeNull();
			expect(result?.organizationId).toBe(tc.expected.organizationId);
			expect(result?.projectId).toBe(tc.expected.projectId);
			expect(result?.planId).toBe(tc.expected.planId);
		}
	});

	it("should return null for invalid paths", () => {
		const invalidPaths = [
			"",
			"invalid",
			"organizations/org/source.pdf",
			"organizations/org/projects/proj/source.pdf",
			"organizations/org/projects/proj/plans/plan/image.png",
			"orgs/org/projects/proj/plans/plan/source.pdf",
		];

		for (const path of invalidPaths) {
			expect(parseR2EventPath(path)).toBeNull();
		}
	});
});
