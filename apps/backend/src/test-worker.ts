// Minimal test worker that doesn't include LiveStore dependencies
// This avoids the OpenTelemetry/node:os issue in cloudflare:test
import { DurableObject } from "cloudflare:workers";

// Minimal test environment - doesn't include LiveStore types
export interface TestEnv {
	DB: D1Database;
	R2_BUCKET: R2Bucket;
	R2_NOTIFICATION_QUEUE: Queue;
	IMAGE_GENERATION_QUEUE: Queue;
	METADATA_EXTRACTION_QUEUE: Queue;
	CALLOUT_DETECTION_QUEUE: Queue;
	TILE_GENERATION_QUEUE: Queue;
	PLAN_COORDINATOR_DO: DurableObjectNamespace;
	FIXTURE_LOADER?: Fetcher;
	PDF_CONTAINER_PROXY?: Fetcher;
	TEST_MIGRATIONS?: D1Migration[];
}

export interface PlanCoordinatorState {
	planId: string;
	projectId: string;
	organizationId: string;
	totalSheets: number;
	generatedImages: string[];
	extractedMetadata: string[];
	validSheets: string[];
	sheetNumberMap: Record<string, string>;
	detectedCallouts: string[];
	generatedTiles: string[];
	status:
		| "image_generation"
		| "metadata_extraction"
		| "awaiting_metadata_complete"
		| "callout_detection"
		| "tile_generation"
		| "complete"
		| "failed";
	createdAt: number;
	lastError?: string;
}

export class PlanCoordinator extends DurableObject<TestEnv> {
	private state: PlanCoordinatorState | null = null;

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/initialize" && request.method === "POST") {
			const body = (await request.json()) as {
				planId: string;
				projectId: string;
				organizationId: string;
				totalSheets: number;
			};
			return this.handleInitialize(body);
		}

		if (url.pathname === "/getState") {
			return this.handleGetState();
		}

		if (url.pathname === "/sheetImageGenerated" && request.method === "POST") {
			const body = (await request.json()) as { sheetId: string };
			return this.handleSheetImageGenerated(body.sheetId);
		}

		if (
			url.pathname === "/sheetMetadataExtracted" &&
			request.method === "POST"
		) {
			const body = (await request.json()) as {
				sheetId: string;
				isValid: boolean;
			};
			return this.handleSheetMetadataExtracted(body.sheetId, body.isValid);
		}

		if (
			url.pathname === "/sheetCalloutsDetected" &&
			request.method === "POST"
		) {
			const body = (await request.json()) as { sheetId: string };
			return this.handleSheetCalloutsDetected(body.sheetId);
		}

		if (url.pathname === "/sheetTilesGenerated" && request.method === "POST") {
			const body = (await request.json()) as { sheetId: string };
			return this.handleSheetTilesGenerated(body.sheetId);
		}

		if (url.pathname === "/markFailed" && request.method === "POST") {
			const body = (await request.json()) as { error: string };
			return this.handleMarkFailed(body.error);
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}

	private handleInitialize(params: {
		planId: string;
		projectId: string;
		organizationId: string;
		totalSheets: number;
	}): Response {
		this.state = {
			planId: params.planId,
			projectId: params.projectId,
			organizationId: params.organizationId,
			totalSheets: params.totalSheets,
			generatedImages: [],
			extractedMetadata: [],
			validSheets: [],
			sheetNumberMap: {},
			detectedCallouts: [],
			generatedTiles: [],
			status: "image_generation",
			createdAt: Date.now(),
		};
		return Response.json({ success: true, state: this.state });
	}

	private handleGetState(): Response {
		if (!this.state) {
			return Response.json({ error: "Not initialized" }, { status: 400 });
		}
		return Response.json(this.state);
	}

	private handleSheetImageGenerated(sheetId: string): Response {
		if (!this.state) {
			return Response.json({ error: "Not initialized" }, { status: 400 });
		}
		if (!this.state.generatedImages.includes(sheetId)) {
			this.state.generatedImages.push(sheetId);
		}
		if (this.state.generatedImages.length === this.state.totalSheets) {
			this.state.status = "metadata_extraction";
		}
		return Response.json({ success: true, state: this.state });
	}

	private handleSheetMetadataExtracted(
		sheetId: string,
		isValid: boolean,
	): Response {
		if (!this.state) {
			return Response.json({ error: "Not initialized" }, { status: 400 });
		}
		if (!this.state.extractedMetadata.includes(sheetId)) {
			this.state.extractedMetadata.push(sheetId);
		}
		if (isValid && !this.state.validSheets.includes(sheetId)) {
			this.state.validSheets.push(sheetId);
		}
		if (this.state.extractedMetadata.length === this.state.totalSheets) {
			this.state.status = "callout_detection";
		}
		return Response.json({ success: true, state: this.state });
	}

	private handleSheetCalloutsDetected(sheetId: string): Response {
		if (!this.state) {
			return Response.json({ error: "Not initialized" }, { status: 400 });
		}
		if (!this.state.detectedCallouts.includes(sheetId)) {
			this.state.detectedCallouts.push(sheetId);
		}
		if (this.state.detectedCallouts.length === this.state.validSheets.length) {
			this.state.status = "tile_generation";
		}
		return Response.json({ success: true, state: this.state });
	}

	private handleSheetTilesGenerated(sheetId: string): Response {
		if (!this.state) {
			return Response.json({ error: "Not initialized" }, { status: 400 });
		}
		if (!this.state.generatedTiles.includes(sheetId)) {
			this.state.generatedTiles.push(sheetId);
		}
		if (this.state.generatedTiles.length === this.state.validSheets.length) {
			this.state.status = "complete";
		}
		return Response.json({ success: true, state: this.state });
	}

	private handleMarkFailed(error: string): Response {
		if (!this.state) {
			return Response.json({ error: "Not initialized" }, { status: 400 });
		}
		this.state.status = "failed";
		this.state.lastError = error;
		return Response.json({ success: true, state: this.state });
	}
}

export default {
	async fetch(_request: Request): Promise<Response> {
		return new Response("Test worker");
	},
};
