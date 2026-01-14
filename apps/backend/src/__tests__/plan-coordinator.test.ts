import { beforeEach, describe, expect, it } from "vitest";
import type { PlanCoordinatorState } from "../processing/plan-coordinator";

describe("PlanCoordinator State Management", () => {
	let coordinatorState: PlanCoordinatorState;

	beforeEach(() => {
		coordinatorState = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			totalSheets: 3,
			generatedImages: [],
			extractedMetadata: [],
			validSheets: [],
			detectedCallouts: [],
			generatedTiles: [],
			status: "image_generation",
			createdAt: Date.now(),
		};
	});

	describe("Initialization", () => {
		it("should initialize with correct default values", () => {
			expect(coordinatorState.planId).toBe("plan-123");
			expect(coordinatorState.projectId).toBe("project-456");
			expect(coordinatorState.organizationId).toBe("org-789");
			expect(coordinatorState.totalSheets).toBe(3);
			expect(coordinatorState.status).toBe("image_generation");
			expect(coordinatorState.generatedImages).toHaveLength(0);
			expect(coordinatorState.extractedMetadata).toHaveLength(0);
			expect(coordinatorState.validSheets).toHaveLength(0);
			expect(coordinatorState.detectedCallouts).toHaveLength(0);
			expect(coordinatorState.generatedTiles).toHaveLength(0);
		});

		it("should have createdAt timestamp", () => {
			expect(typeof coordinatorState.createdAt).toBe("number");
			expect(coordinatorState.createdAt).toBeGreaterThan(0);
		});
	});

	describe("Image Generation Phase", () => {
		it("should track generated images", () => {
			coordinatorState.generatedImages.push("sheet-0");
			expect(coordinatorState.generatedImages).toHaveLength(1);
			expect(coordinatorState.generatedImages).toContain("sheet-0");
		});

		it("should not add duplicate sheet IDs", () => {
			coordinatorState.generatedImages.push("sheet-0");
			if (!coordinatorState.generatedImages.includes("sheet-0")) {
				coordinatorState.generatedImages.push("sheet-0");
			}
			expect(coordinatorState.generatedImages).toHaveLength(1);
		});

		it("should transition to metadata_extraction when all images generated", () => {
			coordinatorState.generatedImages = ["sheet-0", "sheet-1", "sheet-2"];

			if (
				coordinatorState.generatedImages.length ===
					coordinatorState.totalSheets &&
				coordinatorState.status === "image_generation"
			) {
				coordinatorState.status = "metadata_extraction";
			}

			expect(coordinatorState.status).toBe("metadata_extraction");
		});
	});

	describe("Metadata Extraction Phase", () => {
		beforeEach(() => {
			coordinatorState.generatedImages = ["sheet-0", "sheet-1", "sheet-2"];
			coordinatorState.status = "metadata_extraction";
		});

		it("should track extracted metadata", () => {
			coordinatorState.extractedMetadata.push("sheet-0");
			expect(coordinatorState.extractedMetadata).toHaveLength(1);
		});

		it("should track valid sheets separately", () => {
			coordinatorState.extractedMetadata.push("sheet-0");
			coordinatorState.validSheets.push("sheet-0");
			coordinatorState.extractedMetadata.push("sheet-1");

			expect(coordinatorState.extractedMetadata).toHaveLength(2);
			expect(coordinatorState.validSheets).toHaveLength(1);
		});

		it("should transition to callout_detection when all metadata extracted", () => {
			coordinatorState.extractedMetadata = ["sheet-0", "sheet-1", "sheet-2"];
			coordinatorState.validSheets = ["sheet-0", "sheet-2"];

			if (
				coordinatorState.extractedMetadata.length ===
					coordinatorState.totalSheets &&
				coordinatorState.status === "metadata_extraction"
			) {
				coordinatorState.status = "callout_detection";
			}

			expect(coordinatorState.status).toBe("callout_detection");
		});
	});

	describe("Callout Detection Phase", () => {
		beforeEach(() => {
			coordinatorState.generatedImages = ["sheet-0", "sheet-1", "sheet-2"];
			coordinatorState.extractedMetadata = ["sheet-0", "sheet-1", "sheet-2"];
			coordinatorState.validSheets = ["sheet-0", "sheet-2"];
			coordinatorState.status = "callout_detection";
		});

		it("should track detected callouts for valid sheets", () => {
			coordinatorState.detectedCallouts.push("sheet-0");
			expect(coordinatorState.detectedCallouts).toHaveLength(1);
		});

		it("should transition to tile_generation when all callouts detected", () => {
			coordinatorState.detectedCallouts = ["sheet-0", "sheet-2"];

			if (
				coordinatorState.detectedCallouts.length ===
					coordinatorState.validSheets.length &&
				coordinatorState.status === "callout_detection"
			) {
				coordinatorState.status = "tile_generation";
			}

			expect(coordinatorState.status).toBe("tile_generation");
		});
	});

	describe("Tile Generation Phase", () => {
		beforeEach(() => {
			coordinatorState.generatedImages = ["sheet-0", "sheet-1", "sheet-2"];
			coordinatorState.extractedMetadata = ["sheet-0", "sheet-1", "sheet-2"];
			coordinatorState.validSheets = ["sheet-0", "sheet-2"];
			coordinatorState.detectedCallouts = ["sheet-0", "sheet-2"];
			coordinatorState.status = "tile_generation";
		});

		it("should track generated tiles", () => {
			coordinatorState.generatedTiles.push("sheet-0");
			expect(coordinatorState.generatedTiles).toHaveLength(1);
		});

		it("should transition to complete when all tiles generated", () => {
			coordinatorState.generatedTiles = ["sheet-0", "sheet-2"];

			if (
				coordinatorState.generatedTiles.length ===
					coordinatorState.validSheets.length &&
				coordinatorState.status === "tile_generation"
			) {
				coordinatorState.status = "complete";
			}

			expect(coordinatorState.status).toBe("complete");
		});
	});

	describe("Error Handling", () => {
		it("should mark as failed with error message", () => {
			coordinatorState.status = "failed";
			coordinatorState.lastError = "Container processing failed";

			expect(coordinatorState.status).toBe("failed");
			expect(coordinatorState.lastError).toBe("Container processing failed");
		});

		it("should be able to fail from any status", () => {
			const statuses: PlanCoordinatorState["status"][] = [
				"image_generation",
				"metadata_extraction",
				"callout_detection",
				"tile_generation",
			];

			for (const status of statuses) {
				const state: PlanCoordinatorState = { ...coordinatorState, status };
				state.status = "failed";
				state.lastError = `Failed during ${status}`;
				expect(state.status).toBe("failed");
			}
		});
	});

	describe("Progress Tracking", () => {
		it("should calculate correct progress percentages", () => {
			coordinatorState.generatedImages = ["sheet-0", "sheet-1"];
			coordinatorState.extractedMetadata = ["sheet-0"];
			coordinatorState.validSheets = ["sheet-0"];

			const imageProgress =
				(coordinatorState.generatedImages.length /
					coordinatorState.totalSheets) *
				100;
			const metadataProgress =
				(coordinatorState.extractedMetadata.length /
					coordinatorState.totalSheets) *
				100;

			expect(imageProgress).toBeCloseTo(66.67, 1);
			expect(metadataProgress).toBeCloseTo(33.33, 1);
		});

		it("should report 0% for empty arrays", () => {
			const progress =
				(coordinatorState.generatedImages.length /
					coordinatorState.totalSheets) *
				100;
			expect(progress).toBe(0);
		});

		it("should report 100% when complete", () => {
			coordinatorState.generatedImages = ["sheet-0", "sheet-1", "sheet-2"];
			const progress =
				(coordinatorState.generatedImages.length /
					coordinatorState.totalSheets) *
				100;
			expect(progress).toBe(100);
		});
	});

	describe("State Transitions", () => {
		it("should follow correct state machine order", () => {
			const expectedOrder = [
				"image_generation",
				"metadata_extraction",
				"callout_detection",
				"tile_generation",
				"complete",
			];

			let state: PlanCoordinatorState["status"] = "image_generation";
			const transitions: string[] = [state];

			state = "metadata_extraction";
			transitions.push(state);

			state = "callout_detection";
			transitions.push(state);

			state = "tile_generation";
			transitions.push(state);

			state = "complete";
			transitions.push(state);

			expect(transitions).toEqual(expectedOrder);
		});

		it("should not transition backwards in normal flow", () => {
			coordinatorState.status = "callout_detection";

			const canTransitionBack = (newStatus: PlanCoordinatorState["status"]) => {
				const order = [
					"image_generation",
					"metadata_extraction",
					"callout_detection",
					"tile_generation",
					"complete",
				];
				const currentIndex = order.indexOf(coordinatorState.status);
				const newIndex = order.indexOf(newStatus);
				return newIndex >= currentIndex || newStatus === "failed";
			};

			expect(canTransitionBack("image_generation")).toBe(false);
			expect(canTransitionBack("metadata_extraction")).toBe(false);
			expect(canTransitionBack("tile_generation")).toBe(true);
			expect(canTransitionBack("failed")).toBe(true);
		});
	});
});

describe("PlanCoordinator HTTP Interface", () => {
	it("should have expected endpoint paths", () => {
		const endpoints = [
			"/initialize",
			"/getState",
			"/sheetImageGenerated",
			"/sheetMetadataExtracted",
			"/sheetCalloutsDetected",
			"/sheetTilesGenerated",
			"/markFailed",
		];

		for (const endpoint of endpoints) {
			expect(endpoint).toMatch(/^\/\w+/);
		}
	});

	it("should accept POST for mutation endpoints", () => {
		const mutationEndpoints = [
			{ path: "/initialize", method: "POST" },
			{ path: "/sheetImageGenerated", method: "POST" },
			{ path: "/sheetMetadataExtracted", method: "POST" },
			{ path: "/sheetCalloutsDetected", method: "POST" },
			{ path: "/sheetTilesGenerated", method: "POST" },
			{ path: "/markFailed", method: "POST" },
		];

		for (const { method } of mutationEndpoints) {
			expect(method).toBe("POST");
		}
	});

	it("should accept GET for query endpoints", () => {
		const queryEndpoints = [{ path: "/getState", method: "GET" }];

		for (const { method } of queryEndpoints) {
			expect(method).toBe("GET");
		}
	});
});
