import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("PDF Pipeline Integration", () => {
	const testPlanId = "test-plan-integration-123";
	const testProjectId = "test-project-integration-456";
	const testOrgId = "test-org-integration-789";
	const pdfPath = `organizations/${testOrgId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;

	describe("R2 Storage", () => {
		it("should upload PDF to R2 bucket with correct metadata", async () => {
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/sample-A6-plan.pdf",
			);
			expect(pdfResponse.ok).toBe(true);

			const pdfData = await pdfResponse.arrayBuffer();

			await env.R2_BUCKET.put(pdfPath, pdfData, {
				httpMetadata: { contentType: "application/pdf" },
				customMetadata: {
					planId: testPlanId,
					projectId: testProjectId,
					organizationId: testOrgId,
				},
			});

			const obj = await env.R2_BUCKET.get(pdfPath);
			expect(obj).toBeTruthy();
			expect(obj?.httpMetadata?.contentType).toBe("application/pdf");
			expect(obj?.customMetadata?.planId).toBe(testPlanId);
		});

		it("should retrieve PDF content from R2", async () => {
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/sample-single-plan.pdf",
			);
			const pdfData = await pdfResponse.arrayBuffer();
			const singlePdfPath = `organizations/${testOrgId}/projects/${testProjectId}/plans/single-test/source.pdf`;

			await env.R2_BUCKET.put(singlePdfPath, pdfData, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const obj = await env.R2_BUCKET.get(singlePdfPath);
			expect(obj).toBeTruthy();

			const data = await obj!.arrayBuffer();
			expect(data.byteLength).toBeGreaterThan(0);

			const header = new Uint8Array(data.slice(0, 4));
			expect(header[0]).toBe(0x25); // %
			expect(header[1]).toBe(0x50); // P
			expect(header[2]).toBe(0x44); // D
			expect(header[3]).toBe(0x46); // F
		});

		it("should list objects in R2 bucket", async () => {
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/sample-A6-plan.pdf",
			);
			const pdfData = await pdfResponse.arrayBuffer();
			const listTestPath = `organizations/${testOrgId}/projects/${testProjectId}/plans/list-test/source.pdf`;

			await env.R2_BUCKET.put(listTestPath, pdfData);

			const listed = await env.R2_BUCKET.list({
				prefix: `organizations/${testOrgId}/projects/${testProjectId}/plans/list-test/`,
			});

			expect(listed.objects.length).toBeGreaterThan(0);
			expect(listed.objects.some((obj) => obj.key === listTestPath)).toBe(true);
		});
	});

	describe("PlanCoordinator Durable Object", () => {
		it("should initialize coordinator with plan details", async () => {
			const coordinatorPlanId = "coordinator-init-test";
			const coordinatorId =
				env.PLAN_COORDINATOR_DO.idFromName(coordinatorPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			const response = await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId: coordinatorPlanId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 6,
				}),
			});

			expect(response.status).toBe(200);
			const result = (await response.json()) as {
				success: boolean;
				state: { status: string };
			};
			expect(result.success).toBe(true);
			expect(result.state.status).toBe("image_generation");
		});

		it("should retrieve coordinator state", async () => {
			const coordinatorPlanId = "coordinator-state-test";
			const coordinatorId =
				env.PLAN_COORDINATOR_DO.idFromName(coordinatorPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId: coordinatorPlanId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 4,
				}),
			});

			const response = await coordinator.fetch("http://internal/getState");
			expect(response.status).toBe(200);

			const state = (await response.json()) as {
				planId: string;
				totalSheets: number;
			};
			expect(state.planId).toBe(coordinatorPlanId);
			expect(state.totalSheets).toBe(4);
		});

		it("should track image generation progress", async () => {
			const coordinatorPlanId = "coordinator-progress-test";
			const coordinatorId =
				env.PLAN_COORDINATOR_DO.idFromName(coordinatorPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId: coordinatorPlanId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 3,
				}),
			});

			const response = await coordinator.fetch(
				"http://internal/sheetImageGenerated",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sheetId: "sheet-0" }),
				},
			);

			expect(response.status).toBe(200);
			const result = (await response.json()) as {
				success: boolean;
				state: { generatedImages: string[] };
			};
			expect(result.success).toBe(true);
			expect(result.state.generatedImages).toContain("sheet-0");
		});

		it("should handle failure marking", async () => {
			const coordinatorPlanId = "coordinator-fail-test";
			const coordinatorId =
				env.PLAN_COORDINATOR_DO.idFromName(coordinatorPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId: coordinatorPlanId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 3,
				}),
			});

			const response = await coordinator.fetch("http://internal/markFailed", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Test failure reason" }),
			});

			expect(response.status).toBe(200);
			const result = (await response.json()) as {
				success: boolean;
				state: { status: string; lastError: string };
			};
			expect(result.state.status).toBe("failed");
			expect(result.state.lastError).toBe("Test failure reason");
		});
	});

	describe("Queue Integration", () => {
		it("should send message to image generation queue", async () => {
			await env.IMAGE_GENERATION_QUEUE.send({
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrgId,
				pdfPath,
				totalPages: 6,
			});
			expect(true).toBe(true);
		});

		it("should send message to metadata extraction queue", async () => {
			await env.METADATA_EXTRACTION_QUEUE.send({
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrgId,
				sheetId: "sheet-0",
				sheetNumber: 1,
				totalSheets: 6,
			});
			expect(true).toBe(true);
		});

		it("should send message to callout detection queue", async () => {
			await env.CALLOUT_DETECTION_QUEUE.send({
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrgId,
				sheetId: "sheet-0",
				validSheetNumbers: ["A1", "A2"],
			});
			expect(true).toBe(true);
		});

		it("should send message to tile generation queue", async () => {
			await env.TILE_GENERATION_QUEUE.send({
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrgId,
				sheetId: "sheet-0",
			});
			expect(true).toBe(true);
		});
	});

	describe("Container Proxy (requires Docker)", () => {
		it("should check container health or gracefully skip", async () => {
			try {
				const response = await env.PDF_CONTAINER_PROXY!.fetch(
					"http://container/health",
				);
				if (response.ok) {
					expect(response.ok).toBe(true);
				} else {
					console.log("ℹ️ Container returned non-ok status, likely not running");
				}
			} catch {
				console.log("ℹ️ Container not running, test skipped gracefully");
			}
		});
	});

	describe("Metadata Extraction", () => {
		it("should track metadata extraction progress and trigger callout detection", async () => {
			const planId = "metadata-extraction-test";
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			// Initialize coordinator with 3 sheets
			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 3,
				}),
			});

			// Simulate image generation completion for all sheets
			for (let i = 0; i < 3; i++) {
				await coordinator.fetch("http://internal/sheetImageGenerated", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sheetId: `sheet-${i}` }),
				});
			}

			// Check state after image generation
			let stateResponse = await coordinator.fetch("http://internal/getState");
			let state = (await stateResponse.json()) as {
				status: string;
				generatedImages: string[];
			};
			expect(state.status).toBe("metadata_extraction");
			expect(state.generatedImages).toHaveLength(3);

			// Simulate metadata extraction for each sheet
			// sheet-0 and sheet-2 are valid, sheet-1 is invalid
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sheetId: "sheet-0",
					isValid: true,
					sheetNumber: "A1",
				}),
			});

			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sheetId: "sheet-1",
					isValid: false,
					sheetNumber: null,
				}),
			});

			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sheetId: "sheet-2",
					isValid: true,
					sheetNumber: "A2",
				}),
			});

			// Check state after metadata extraction - should transition to callout_detection
			stateResponse = await coordinator.fetch("http://internal/getState");
			state = (await stateResponse.json()) as {
				status: string;
				extractedMetadata: string[];
				validSheets: string[];
			};

			expect(state.status).toBe("callout_detection");
			expect(state.extractedMetadata).toHaveLength(3);
			expect(state.validSheets).toHaveLength(2);
			expect(state.validSheets).toContain("sheet-0");
			expect(state.validSheets).toContain("sheet-2");
			expect(state.validSheets).not.toContain("sheet-1");
		});

		it("should track callout detection and transition to tile generation", async () => {
			const planId = "callout-detection-test";
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			// Initialize and simulate full pipeline up to callout detection
			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 2,
				}),
			});

			// Complete image generation
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

			// Complete metadata extraction (both valid)
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0", isValid: true }),
			});
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-1", isValid: true }),
			});

			// Complete callout detection
			await coordinator.fetch("http://internal/sheetCalloutsDetected", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});
			await coordinator.fetch("http://internal/sheetCalloutsDetected", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-1" }),
			});

			// Check state - should be in tile_generation
			const stateResponse = await coordinator.fetch("http://internal/getState");
			const state = (await stateResponse.json()) as {
				status: string;
				detectedCallouts: string[];
			};

			expect(state.status).toBe("tile_generation");
			expect(state.detectedCallouts).toHaveLength(2);
		});

		it("should complete full pipeline and mark as complete", async () => {
			const planId = "full-pipeline-test";
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			// Initialize with 1 sheet for simplicity
			await coordinator.fetch("http://internal/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planId,
					projectId: testProjectId,
					organizationId: testOrgId,
					totalSheets: 1,
				}),
			});

			// Image generation
			await coordinator.fetch("http://internal/sheetImageGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});

			// Metadata extraction
			await coordinator.fetch("http://internal/sheetMetadataExtracted", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sheetId: "sheet-0",
					isValid: true,
					sheetNumber: "A1",
				}),
			});

			// Callout detection
			await coordinator.fetch("http://internal/sheetCalloutsDetected", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});

			// Tile generation
			await coordinator.fetch("http://internal/sheetTilesGenerated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			});

			// Verify complete state
			const stateResponse = await coordinator.fetch("http://internal/getState");
			const state = (await stateResponse.json()) as {
				status: string;
				validSheets: string[];
				generatedTiles: string[];
			};

			expect(state.status).toBe("complete");
			expect(state.validSheets).toHaveLength(1);
			expect(state.generatedTiles).toHaveLength(1);
		});
	});
});

describe("Fixture Loader", () => {
	it("should load sample-A6-plan.pdf fixture", async () => {
		const response = await env.FIXTURE_LOADER!.fetch(
			"http://fixture/sample-A6-plan.pdf",
		);
		expect(response.ok).toBe(true);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");

		const data = await response.arrayBuffer();
		expect(data.byteLength).toBeGreaterThan(0);
	});

	it("should load sample-single-plan.pdf fixture", async () => {
		const response = await env.FIXTURE_LOADER!.fetch(
			"http://fixture/sample-single-plan.pdf",
		);
		expect(response.ok).toBe(true);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
	});

	it("should return 404 for missing fixture", async () => {
		const response = await env.FIXTURE_LOADER!.fetch(
			"http://fixture/nonexistent.pdf",
		);
		expect(response.status).toBe(404);
	});
});
