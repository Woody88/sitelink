import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { PlanCoordinatorState } from "../../src/test-worker";

const testOrganizationId = "coord-test-org";
const testProjectId = "coord-test-project";

async function createCoordinator(totalSheets: number) {
	const planId = `coord-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
	const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

	await coordinator.fetch("http://internal/initialize", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			planId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			totalSheets,
		}),
	});

	const getState = async (): Promise<PlanCoordinatorState> => {
		const res = await coordinator.fetch("http://internal/getState");
		return res.json() as Promise<PlanCoordinatorState>;
	};

	return { coordinator, planId, getState };
}

async function postAction(
	coordinator: DurableObjectStub,
	path: string,
	body: Record<string, unknown>,
) {
	return coordinator.fetch(`http://internal${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("PlanCoordinator State Machine (Real DO)", () => {
	describe("Initialization", () => {
		it("should initialize with correct default values", async () => {
			const { getState } = await createCoordinator(3);
			const state = await getState();

			expect(state.status).toBe("image_generation");
			expect(state.totalSheets).toBe(3);
			expect(state.generatedImages).toHaveLength(0);
			expect(state.extractedMetadata).toHaveLength(0);
			expect(state.validSheets).toHaveLength(0);
			expect(state.sheetNumberMap).toEqual({});
			expect(state.detectedCallouts).toHaveLength(0);
			expect(state.detectedLayouts).toHaveLength(0);
			expect(state.generatedTiles).toHaveLength(0);
		});

		it("should return null state if getState called before initialize", async () => {
			const planId = `uninit-${Date.now()}`;
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId);

			const res = await coordinator.fetch("http://internal/getState");
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toBeNull();
		});
	});

	describe("Image Generation Phase", () => {
		it("should track images and transition to metadata_extraction", async () => {
			const { coordinator, getState } = await createCoordinator(2);

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});
			let state = await getState();
			expect(state.generatedImages).toHaveLength(1);
			expect(state.status).toBe("image_generation");

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-1",
			});
			state = await getState();
			expect(state.generatedImages).toHaveLength(2);
			expect(state.status).toBe("metadata_extraction");
		});

		it("should deduplicate sheet IDs", async () => {
			const { coordinator, getState } = await createCoordinator(2);

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});

			const state = await getState();
			expect(state.generatedImages).toHaveLength(1);
		});
	});

	describe("Metadata Extraction Phase", () => {
		it("should track valid sheets with sheetNumber and transition to parallel_detection", async () => {
			const { coordinator, getState } = await createCoordinator(2);

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-1",
			});

			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-0",
				isValid: true,
				sheetNumber: "A1",
			});
			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-1",
				isValid: false,
			});

			const state = await getState();
			expect(state.extractedMetadata).toHaveLength(2);
			expect(state.validSheets).toEqual(["sheet-0"]);
			expect(state.sheetNumberMap["sheet-0"]).toBe("A1");
			expect(state.status).toBe("parallel_detection");
		});
	});

	describe("Parallel Detection Phase", () => {
		async function setupParallelDetection() {
			const { coordinator, getState, planId } =
				await createCoordinator(3);

			for (let i = 0; i < 3; i++) {
				await postAction(coordinator, "/sheetImageGenerated", {
					sheetId: `sheet-${i}`,
				});
			}

			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-0",
				isValid: true,
				sheetNumber: "A1",
			});
			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-1",
				isValid: false,
			});
			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-2",
				isValid: true,
				sheetNumber: "S1",
			});

			const state = await getState();
			expect(state.status).toBe("parallel_detection");
			expect(state.validSheets).toEqual(["sheet-0", "sheet-2"]);

			return { coordinator, getState, planId };
		}

		it("should NOT transition when only callouts complete", async () => {
			const { coordinator, getState } = await setupParallelDetection();

			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-2",
			});

			const state = await getState();
			expect(state.detectedCallouts).toHaveLength(2);
			expect(state.detectedLayouts).toHaveLength(0);
			expect(state.status).toBe("parallel_detection");
		});

		it("should NOT transition when only layouts complete", async () => {
			const { coordinator, getState } = await setupParallelDetection();

			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-2",
			});

			const state = await getState();
			expect(state.detectedLayouts).toHaveLength(2);
			expect(state.detectedCallouts).toHaveLength(0);
			expect(state.status).toBe("parallel_detection");
		});

		it("should transition to tile_generation when BOTH complete", async () => {
			const { coordinator, getState } = await setupParallelDetection();

			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-2",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-2",
			});

			const state = await getState();
			expect(state.status).toBe("tile_generation");
		});

		it("should transition regardless of callout/layout order", async () => {
			const { coordinator, getState } = await setupParallelDetection();

			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-2",
			});

			let state = await getState();
			expect(state.status).toBe("parallel_detection");

			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-2",
			});

			state = await getState();
			expect(state.status).toBe("tile_generation");
		});

		it("should deduplicate layout detection calls", async () => {
			const { coordinator, getState } = await setupParallelDetection();

			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});

			const state = await getState();
			expect(state.detectedLayouts).toHaveLength(1);
		});
	});

	describe("Tile Generation Phase", () => {
		it("should transition to complete when all tiles generated", async () => {
			const { coordinator, getState } = await createCoordinator(1);

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-0",
				isValid: true,
				sheetNumber: "A1",
			});
			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});

			let state = await getState();
			expect(state.status).toBe("tile_generation");

			await postAction(coordinator, "/sheetTilesGenerated", {
				sheetId: "sheet-0",
			});

			state = await getState();
			expect(state.status).toBe("complete");
		});
	});

	describe("Error Handling", () => {
		it("should mark as failed with error message", async () => {
			const { coordinator, getState } = await createCoordinator(1);

			await postAction(coordinator, "/markFailed", {
				error: "Container processing failed",
			});

			const state = await getState();
			expect(state.status).toBe("failed");
			expect(state.lastError).toBe("Container processing failed");
		});

		it("should be able to fail from parallel_detection status", async () => {
			const { coordinator, getState } = await createCoordinator(1);

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-0",
				isValid: true,
				sheetNumber: "A1",
			});

			let state = await getState();
			expect(state.status).toBe("parallel_detection");

			await postAction(coordinator, "/markFailed", {
				error: "Detection timeout",
			});

			state = await getState();
			expect(state.status).toBe("failed");
		});
	});

	describe("Full Pipeline State Transitions", () => {
		it("should follow image_generation -> metadata_extraction -> parallel_detection -> tile_generation -> complete", async () => {
			const { coordinator, getState } = await createCoordinator(2);
			const transitions: string[] = [];

			let state = await getState();
			transitions.push(state.status);

			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetImageGenerated", {
				sheetId: "sheet-1",
			});
			state = await getState();
			transitions.push(state.status);

			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-0",
				isValid: true,
				sheetNumber: "A1",
			});
			await postAction(coordinator, "/sheetMetadataExtracted", {
				sheetId: "sheet-1",
				isValid: true,
				sheetNumber: "A2",
			});
			state = await getState();
			transitions.push(state.status);

			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetCalloutsDetected", {
				sheetId: "sheet-1",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetLayoutDetected", {
				sheetId: "sheet-1",
			});
			state = await getState();
			transitions.push(state.status);

			await postAction(coordinator, "/sheetTilesGenerated", {
				sheetId: "sheet-0",
			});
			await postAction(coordinator, "/sheetTilesGenerated", {
				sheetId: "sheet-1",
			});
			state = await getState();
			transitions.push(state.status);

			expect(transitions).toEqual([
				"image_generation",
				"metadata_extraction",
				"parallel_detection",
				"tile_generation",
				"complete",
			]);
		});
	});
});

describe("PlanCoordinator HTTP Interface (Real DO)", () => {
	it("should return 404 for unknown endpoints", async () => {
		const planId = `http-test-${Date.now()}`;
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

		const res = await coordinator.fetch("http://internal/nonexistent");
		expect(res.status).toBe(404);
	});

	it("should accept POST for /sheetLayoutDetected", async () => {
		const planId = `http-layout-${Date.now()}`;
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

		await coordinator.fetch("http://internal/sheetImageGenerated", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sheetId: "sheet-0" }),
		});
		await coordinator.fetch("http://internal/sheetMetadataExtracted", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sheetId: "sheet-0",
				isValid: true,
				sheetNumber: "A1",
			}),
		});

		const res = await coordinator.fetch(
			"http://internal/sheetLayoutDetected",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sheetId: "sheet-0" }),
			},
		);
		expect(res.status).toBe(200);
	});
});
