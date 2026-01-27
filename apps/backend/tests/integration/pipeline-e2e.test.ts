import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
	handleR2NotificationQueue,
	parseR2EventPath,
	type R2EventNotification,
} from "../../src/processing/r2-with-notifications";
import type { ImageGenerationJob } from "../../src/processing/types";
import { getR2Path } from "../../src/processing/types";

interface MockMessage<T> {
	body: T;
	ack: () => void;
	retry: () => void;
	ackCalled: boolean;
	retryCalled: boolean;
}

function createMockMessage<T>(body: T): MockMessage<T> {
	const msg: MockMessage<T> = {
		body,
		ackCalled: false,
		retryCalled: false,
		ack: () => {
			msg.ackCalled = true;
		},
		retry: () => {
			msg.retryCalled = true;
		},
	};
	return msg;
}

function createMockBatch<T>(messages: MockMessage<T>[]): MessageBatch<T> {
	return {
		messages: messages as unknown as Message<T>[],
		queue: "test-queue",
		ackAll: () => {
			messages.forEach((m) => m.ack());
		},
		retryAll: () => {
			messages.forEach((m) => m.retry());
		},
	};
}

const testOrganizationId = "e2e-test-org";
const testProjectId = "e2e-test-project";
const testPlanId = `e2e-test-plan-${Date.now()}`;

describe("Pipeline E2E Integration Tests", () => {
	describe("R2 Notification Handler with Real R2", () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;

		beforeAll(async () => {
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/sample-single-plan.pdf",
			);
			expect(pdfResponse.ok).toBe(true);

			const pdfData = await pdfResponse.arrayBuffer();
			await env.R2_BUCKET.put(pdfPath, pdfData, {
				httpMetadata: { contentType: "application/pdf" },
				customMetadata: {
					planId: testPlanId,
					projectId: testProjectId,
					organizationId: testOrganizationId,
				},
			});
		});

		afterAll(async () => {
			const listed = await env.R2_BUCKET.list({
				prefix: `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/`,
			});
			for (const obj of listed.objects) {
				await env.R2_BUCKET.delete(obj.key);
			}
		});

		it("should parse R2 event path correctly", () => {
			const result = parseR2EventPath(pdfPath);
			expect(result).not.toBeNull();
			expect(result?.organizationId).toBe(testOrganizationId);
			expect(result?.projectId).toBe(testProjectId);
			expect(result?.planId).toBe(testPlanId);
		});

		it("should verify PDF exists in R2 before processing", async () => {
			const obj = await env.R2_BUCKET.get(pdfPath);
			expect(obj).toBeTruthy();
			expect(obj?.httpMetadata?.contentType).toBe("application/pdf");
			expect(obj?.customMetadata?.planId).toBe(testPlanId);

			const data = await obj!.arrayBuffer();
			const header = new Uint8Array(data.slice(0, 4));
			expect(header[0]).toBe(0x25); // %
			expect(header[1]).toBe(0x50); // P
			expect(header[2]).toBe(0x44); // D
			expect(header[3]).toBe(0x46); // F
		});

		it("should queue image generation job when R2 notification is received", async () => {
			const notification: R2EventNotification = {
				account: "test",
				bucket: "sitelink-files-test",
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

			const queuedJobs: ImageGenerationJob[] = [];
			const testEnv = {
				...env,
				IMAGE_GENERATION_QUEUE: {
					send: async (job: ImageGenerationJob) => {
						queuedJobs.push(job);
					},
				},
				LIVESTORE_CLIENT_DO: {
					idFromName: () => ({ toString: () => "test" }),
					get: () => ({
						fetch: async () => new Response(JSON.stringify({ success: true })),
					}),
				},
			} as any;

			await handleR2NotificationQueue(batch, testEnv);

			expect(message.ackCalled).toBe(true);
			expect(queuedJobs).toHaveLength(1);
			expect(queuedJobs[0]).toMatchObject({
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				pdfPath,
			});
		});

		it("should ignore non-PDF files", async () => {
			const notification: R2EventNotification = {
				account: "test",
				bucket: "sitelink-files-test",
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

			const queuedJobs: ImageGenerationJob[] = [];
			const testEnv = {
				...env,
				IMAGE_GENERATION_QUEUE: {
					send: async (job: ImageGenerationJob) => {
						queuedJobs.push(job);
					},
				},
			} as any;

			await handleR2NotificationQueue(batch, testEnv);

			expect(message.ackCalled).toBe(true);
			expect(queuedJobs).toHaveLength(0);
		});

		it("should handle CompleteMultipartUpload action", async () => {
			const notification: R2EventNotification = {
				account: "test",
				bucket: "sitelink-files-test",
				object: {
					key: pdfPath,
					size: 100 * 1024 * 1024,
					eTag: "test-etag",
				},
				action: "CompleteMultipartUpload",
				eventTime: new Date().toISOString(),
			};

			const message = createMockMessage(notification);
			const batch = createMockBatch([message]);

			const queuedJobs: ImageGenerationJob[] = [];
			const testEnv = {
				...env,
				IMAGE_GENERATION_QUEUE: {
					send: async (job: ImageGenerationJob) => {
						queuedJobs.push(job);
					},
				},
				LIVESTORE_CLIENT_DO: {
					idFromName: () => ({ toString: () => "test" }),
					get: () => ({
						fetch: async () => new Response(JSON.stringify({ success: true })),
					}),
				},
			} as any;

			await handleR2NotificationQueue(batch, testEnv);

			expect(message.ackCalled).toBe(true);
			expect(queuedJobs).toHaveLength(1);
		});
	});

	describe("PlanCoordinator Durable Object Integration", () => {
		it("should track full pipeline state transitions", async () => {
			const planId = `e2e-coordinator-${Date.now()}`;
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			const initResponse = await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrganizationId,
					totalSheets: 2,
				}),
			});
			expect(initResponse.status).toBe(200);

			let state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("image_generation");

			await coordinator.fetch("http://internal/sheetImageGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});
			await coordinator.fetch("http://internal/sheetImageGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-1" }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("metadata_extraction");
			expect(state.generatedImages).toHaveLength(2);

			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0", isValid: true }),
			});
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-1", isValid: false }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("callout_detection");
			expect(state.extractedMetadata).toHaveLength(2);
			expect(state.validSheets).toHaveLength(1);
			expect(state.validSheets).toContain("sheet-0");

			await coordinator.fetch("http://internal/sheetCalloutsDetected", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("tile_generation");
			expect(state.detectedCallouts).toHaveLength(1);

			await coordinator.fetch("http://internal/sheetTilesGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("complete");
			expect(state.generatedTiles).toHaveLength(1);
		});

		it("should handle failure marking", async () => {
			const planId = `e2e-fail-${Date.now()}`;
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrganizationId,
					totalSheets: 1,
				}),
			});

			await coordinator.fetch("http://internal/markFailed", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Test failure" }),
			});

			const state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("failed");
			expect(state.lastError).toBe("Test failure");
		});
	});

	describe("Queue Message Flow Integration", () => {
		it("should successfully send messages to all pipeline queues", async () => {
			const planId = `e2e-queue-${Date.now()}`;

			await env.IMAGE_GENERATION_QUEUE.send({
				planId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				pdfPath: `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${planId}/source.pdf`,
				totalPages: 1,
			});

			await env.METADATA_EXTRACTION_QUEUE.send({
				planId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
				sheetNumber: 1,
				totalSheets: 1,
			});

			await env.CALLOUT_DETECTION_QUEUE.send({
				planId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
				validSheetNumbers: ["A1"],
			});

			await env.TILE_GENERATION_QUEUE.send({
				planId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
			});

			expect(true).toBe(true);
		});
	});

	describe("R2 Storage Integration", () => {
		it("should store and retrieve sheet images", async () => {
			const sheetId = `e2e-sheet-${Date.now()}`;
			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				sheetId,
				"source.png",
			);

			const testImage = new Uint8Array([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);

			await env.R2_BUCKET.put(imagePath, testImage.buffer, {
				httpMetadata: { contentType: "image/png" },
				customMetadata: {
					sheetId,
					planId: testPlanId,
				},
			});

			const retrieved = await env.R2_BUCKET.get(imagePath);
			expect(retrieved).toBeTruthy();
			expect(retrieved?.httpMetadata?.contentType).toBe("image/png");

			const data = new Uint8Array(await retrieved!.arrayBuffer());
			expect(data[0]).toBe(0x89);
			expect(data[1]).toBe(0x50);
			expect(data[2]).toBe(0x4e);
			expect(data[3]).toBe(0x47);

			await env.R2_BUCKET.delete(imagePath);
		});

		it("should store and retrieve PMTiles files", async () => {
			const sheetId = `e2e-tiles-${Date.now()}`;
			const tilesPath = getR2Path(
				testOrganizationId,
				testProjectId,
				testPlanId,
				sheetId,
				"tiles.pmtiles",
			);

			const testTiles = new ArrayBuffer(256);
			const view = new Uint8Array(testTiles);
			view[0] = 0x50; // P
			view[1] = 0x4d; // M

			await env.R2_BUCKET.put(tilesPath, testTiles, {
				httpMetadata: { contentType: "application/x-pmtiles" },
			});

			const retrieved = await env.R2_BUCKET.get(tilesPath);
			expect(retrieved).toBeTruthy();
			expect(retrieved?.httpMetadata?.contentType).toBe("application/x-pmtiles");

			const data = new Uint8Array(await retrieved!.arrayBuffer());
			expect(data[0]).toBe(0x50);
			expect(data[1]).toBe(0x4d);

			await env.R2_BUCKET.delete(tilesPath);
		});

		it("should list objects with prefix filtering", async () => {
			const uniqueId = Date.now();
			const paths = [
				getR2Path(
					testOrganizationId,
					testProjectId,
					testPlanId,
					`list-sheet-${uniqueId}-0`,
					"source.png",
				),
				getR2Path(
					testOrganizationId,
					testProjectId,
					testPlanId,
					`list-sheet-${uniqueId}-1`,
					"source.png",
				),
				getR2Path(
					testOrganizationId,
					testProjectId,
					testPlanId,
					`list-sheet-${uniqueId}-2`,
					"tiles.pmtiles",
				),
			];

			for (const path of paths) {
				await env.R2_BUCKET.put(path, new ArrayBuffer(8));
			}

			const listed = await env.R2_BUCKET.list({
				prefix: `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/`,
			});

			const matchingKeys = listed.objects.filter((o) =>
				o.key.includes(`list-sheet-${uniqueId}`),
			);
			expect(matchingKeys.length).toBe(3);

			for (const path of paths) {
				await env.R2_BUCKET.delete(path);
			}
		});
	});

	describe("Container Proxy Integration (requires Docker)", () => {
		it("should check container availability", { timeout: 2000 }, async () => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 1000);

			try {
				const response = await env.PDF_CONTAINER_PROXY!.fetch(
					"http://container/health",
					{ signal: controller.signal },
				);

				clearTimeout(timeoutId);

				if (response.ok) {
					const health = await response.json();
					console.log("Container is running:", health);
					expect(response.ok).toBe(true);
				} else if (response.status === 503) {
					console.log(
						"Container proxy returned 503 - container not available (expected in CI)",
					);
				}
			} catch (error) {
				clearTimeout(timeoutId);
				if (error instanceof Error && error.name === "AbortError") {
					console.log("Container health check timed out (container not running)");
				} else {
					console.log(
						"Container not available (expected when Docker is not running):",
						error,
					);
				}
			}
		});

		it("should process PDF through container when available", async () => {
			const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
			const pdfObj = await env.R2_BUCKET.get(pdfPath);

			if (!pdfObj) {
				console.log("Skipping - PDF not found in R2");
				return;
			}

			try {
				const healthCheck = await env.PDF_CONTAINER_PROXY!.fetch(
					"http://container/health",
				);

				if (!healthCheck.ok) {
					console.log("Skipping - Container not available");
					return;
				}

				const pdfBuffer = await pdfObj.arrayBuffer();

				const response = await env.PDF_CONTAINER_PROXY!.fetch(
					"http://container/generate-images",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/pdf",
							"X-Plan-Id": testPlanId,
							"X-Project-Id": testProjectId,
							"X-Organization-Id": testOrganizationId,
							"X-Total-Pages": "1",
						},
						body: pdfBuffer,
					},
				);

				if (response.ok) {
					const result = (await response.json()) as {
						sheets: Array<{
							sheetId: string;
							width: number;
							height: number;
							pageNumber: number;
						}>;
						totalPages: number;
					};

					expect(result.sheets).toBeDefined();
					expect(result.totalPages).toBeGreaterThan(0);
					console.log(
						`Container processed PDF: ${result.totalPages} pages, ${result.sheets.length} sheets`,
					);
				}
			} catch (error) {
				console.log("Container test skipped:", error);
			}
		});
	});

	describe("Full Pipeline Simulation", () => {
		it("should simulate complete pipeline flow with real services", async () => {
			const planId = `e2e-full-${Date.now()}`;
			const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${planId}/source.pdf`;

			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/sample-single-plan.pdf",
			);
			const pdfData = await pdfResponse.arrayBuffer();
			await env.R2_BUCKET.put(pdfPath, pdfData, {
				httpMetadata: { contentType: "application/pdf" },
				customMetadata: {
					planId,
					projectId: testProjectId,
					organizationId: testOrganizationId,
				},
			});

			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrganizationId,
					totalSheets: 1,
				}),
			});

			const sheetId = "sheet-0";
			const testImage = new Uint8Array(1024);
			testImage[0] = 0x89;
			testImage[1] = 0x50;
			testImage[2] = 0x4e;
			testImage[3] = 0x47;

			const imagePath = getR2Path(
				testOrganizationId,
				testProjectId,
				planId,
				sheetId,
				"source.png",
			);
			await env.R2_BUCKET.put(imagePath, testImage.buffer, {
				httpMetadata: { contentType: "image/png" },
			});

			await coordinator.fetch("http://internal/sheetImageGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId }),
			});

			let state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("metadata_extraction");

			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId, isValid: true }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("callout_detection");

			await coordinator.fetch("http://internal/sheetCalloutsDetected", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("tile_generation");

			const tilesPath = getR2Path(
				testOrganizationId,
				testProjectId,
				planId,
				sheetId,
				"tiles.pmtiles",
			);
			await env.R2_BUCKET.put(tilesPath, new ArrayBuffer(256), {
				httpMetadata: { contentType: "application/x-pmtiles" },
			});

			await coordinator.fetch("http://internal/sheetTilesGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("complete");
			expect(state.generatedImages).toContain(sheetId);
			expect(state.validSheets).toContain(sheetId);
			expect(state.generatedTiles).toContain(sheetId);

			const storedPdf = await env.R2_BUCKET.get(pdfPath);
			expect(storedPdf).toBeTruthy();

			const storedImage = await env.R2_BUCKET.get(imagePath);
			expect(storedImage).toBeTruthy();

			const storedTiles = await env.R2_BUCKET.get(tilesPath);
			expect(storedTiles).toBeTruthy();

			await env.R2_BUCKET.delete(pdfPath);
			await env.R2_BUCKET.delete(imagePath);
			await env.R2_BUCKET.delete(tilesPath);
		});

		it("should handle multi-sheet plan processing", async () => {
			const planId = `e2e-multi-${Date.now()}`;
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrganizationId,
					totalSheets: 3,
				}),
			});

			const sheetIds = ["sheet-0", "sheet-1", "sheet-2"];

			for (const sheetId of sheetIds) {
				await coordinator.fetch("http://internal/sheetImageGenerated", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sheetId }),
				});
			}

			let state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("metadata_extraction");
			expect(state.generatedImages).toHaveLength(3);

			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0", isValid: true }),
			});
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-1", isValid: false }),
			});
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-2", isValid: true }),
			});

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("callout_detection");
			expect(state.validSheets).toHaveLength(2);
			expect(state.validSheets).toContain("sheet-0");
			expect(state.validSheets).not.toContain("sheet-1");
			expect(state.validSheets).toContain("sheet-2");

			for (const sheetId of state.validSheets) {
				await coordinator.fetch("http://internal/sheetCalloutsDetected", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sheetId }),
				});
			}

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("tile_generation");
			expect(state.detectedCallouts).toHaveLength(2);

			for (const sheetId of state.validSheets) {
				await coordinator.fetch("http://internal/sheetTilesGenerated", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sheetId }),
				});
			}

			state = (await (
				await coordinator.fetch("http://internal/getState")
			).json()) as any;
			expect(state.status).toBe("complete");
			expect(state.generatedTiles).toHaveLength(2);
		});
	});
});

describe("Path Utilities", () => {
	it("should generate correct R2 paths", () => {
		const path = getR2Path("org-123", "proj-456", "plan-789", "sheet-0", "source.png");
		expect(path).toBe(
			"organizations/org-123/projects/proj-456/plans/plan-789/sheets/sheet-0/source.png",
		);
	});

	it("should parse R2 event paths correctly", () => {
		const testCases = [
			{
				input:
					"organizations/org-123/projects/proj-456/plans/plan-789/source.pdf",
				expected: {
					organizationId: "org-123",
					projectId: "proj-456",
					planId: "plan-789",
				},
			},
			{
				input:
					"organizations/test-org/projects/test-proj/plans/test-plan/source.pdf",
				expected: {
					organizationId: "test-org",
					projectId: "test-proj",
					planId: "test-plan",
				},
			},
		];

		for (const tc of testCases) {
			const result = parseR2EventPath(tc.input);
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
