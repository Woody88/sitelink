// Minimal test worker that doesn't include LiveStore dependencies
// This avoids the OpenTelemetry/node:os issue in cloudflare:test
import { DurableObject } from "cloudflare:workers";

export interface TestEnv {
	DB: D1Database;
	R2_BUCKET: R2Bucket;
	R2_NOTIFICATION_QUEUE: Queue;
	IMAGE_GENERATION_QUEUE: Queue;
	METADATA_EXTRACTION_QUEUE: Queue;
	CALLOUT_DETECTION_QUEUE: Queue;
	DOCLAYOUT_DETECTION_QUEUE: Queue;
	TILE_GENERATION_QUEUE: Queue;
	PLAN_COORDINATOR_DO: DurableObjectNamespace;
	LIVESTORE_CLIENT_DO: DurableObjectNamespace;
	PDF_PROCESSOR: DurableObjectNamespace;
	FIXTURE_LOADER?: Fetcher;
	PDF_CONTAINER_PROXY?: Fetcher;
	TEST_MIGRATIONS?: D1Migration[];
	OPENROUTER_API_KEY?: string;
	OPENROUTER_MODEL?: string;
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
	detectedLayouts: string[];
	generatedTiles: string[];
	status:
		| "image_generation"
		| "metadata_extraction"
		| "awaiting_metadata_complete"
		| "parallel_detection"
		| "tile_generation"
		| "complete"
		| "failed";
	createdAt: number;
	lastError?: string;
}

export class PlanCoordinator extends DurableObject<TestEnv> {
	// ---- Durable storage persistence ----
	// State is persisted to this.ctx.storage so it survives DO eviction
	// during long-running pipeline operations (image gen can take 30+ seconds).

	private async loadState(): Promise<PlanCoordinatorState | null> {
		return (await this.ctx.storage.get<PlanCoordinatorState>("state")) ?? null;
	}

	private async saveState(state: PlanCoordinatorState): Promise<void> {
		await this.ctx.storage.put("state", state);
	}

	// ---- Public RPC methods (called by queue handlers via DO stub) ----

	async initialize(params: {
		planId: string;
		projectId: string;
		organizationId: string;
		totalSheets: number;
		timeoutMs?: number;
	}) {
		const state: PlanCoordinatorState = {
			planId: params.planId,
			projectId: params.projectId,
			organizationId: params.organizationId,
			totalSheets: params.totalSheets,
			generatedImages: [],
			extractedMetadata: [],
			validSheets: [],
			sheetNumberMap: {},
			detectedCallouts: [],
			detectedLayouts: [],
			generatedTiles: [],
			status: "image_generation",
			createdAt: Date.now(),
		};
		await this.saveState(state);
		return { success: true, state };
	}

	async getState(): Promise<PlanCoordinatorState | null> {
		return this.loadState();
	}

	async sheetImageGenerated(sheetId: string) {
		const state = await this.loadState();
		if (!state) throw new Error("PlanCoordinator not initialized");
		if (!state.generatedImages.includes(sheetId)) {
			state.generatedImages.push(sheetId);
		}
		if (
			state.generatedImages.length === state.totalSheets &&
			state.status === "image_generation"
		) {
			state.status = "metadata_extraction";
		}
		await this.saveState(state);
		return this.getProgress(state);
	}

	async sheetMetadataExtracted(
		sheetId: string,
		isValid: boolean,
		sheetNumber?: string,
	) {
		const state = await this.loadState();
		if (!state) throw new Error("PlanCoordinator not initialized");
		if (!state.extractedMetadata.includes(sheetId)) {
			state.extractedMetadata.push(sheetId);
			if (isValid) {
				state.validSheets.push(sheetId);
				if (sheetNumber) {
					state.sheetNumberMap[sheetId] = sheetNumber;
				}
			}
		}
		if (
			state.extractedMetadata.length === state.totalSheets &&
			state.status === "metadata_extraction"
		) {
			state.status = "parallel_detection";
		}
		await this.saveState(state);
		return this.getProgress(state);
	}

	async sheetCalloutsDetected(sheetId: string) {
		const state = await this.loadState();
		if (!state) throw new Error("PlanCoordinator not initialized");
		if (!state.detectedCallouts.includes(sheetId)) {
			state.detectedCallouts.push(sheetId);
		}
		this.checkParallelDetectionComplete(state);
		await this.saveState(state);
		return this.getProgress(state);
	}

	async sheetTilesGenerated(sheetId: string) {
		const state = await this.loadState();
		if (!state) throw new Error("PlanCoordinator not initialized");
		if (!state.generatedTiles.includes(sheetId)) {
			state.generatedTiles.push(sheetId);
		}
		if (
			state.generatedTiles.length === state.validSheets.length &&
			state.status === "tile_generation"
		) {
			state.status = "complete";
		}
		await this.saveState(state);
		return this.getProgress(state);
	}

	async markFailed(error: string) {
		const state = await this.loadState();
		if (!state) throw new Error("PlanCoordinator not initialized");
		state.status = "failed";
		state.lastError = error;
		await this.saveState(state);
		return this.getProgress(state);
	}

	// ---- Fetch handler ----
	// DocLayout detection uses coordinator.fetch() (not RPC).
	// Existing integration tests also call via fetch and expect { success, state } responses.

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		try {
			if (url.pathname === "/initialize" && request.method === "POST") {
				const body = (await request.json()) as {
					planId: string;
					projectId: string;
					organizationId: string;
					totalSheets: number;
					timeoutMs?: number;
				};
				const result = await this.initialize(body);
				return Response.json(result);
			}

			if (url.pathname === "/getState") {
				const state = await this.loadState();
				if (!state) {
					return Response.json({ error: "Not initialized" }, { status: 400 });
				}
				return Response.json(state);
			}

			if (url.pathname === "/sheetImageGenerated" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				await this.sheetImageGenerated(sheetId);
				const state = await this.loadState();
				return Response.json({ success: true, state });
			}

			if (url.pathname === "/sheetMetadataExtracted" && request.method === "POST") {
				const { sheetId, isValid, sheetNumber } = (await request.json()) as {
					sheetId: string;
					isValid: boolean;
					sheetNumber?: string;
				};
				await this.sheetMetadataExtracted(sheetId, isValid, sheetNumber);
				const state = await this.loadState();
				return Response.json({ success: true, state });
			}

			if (url.pathname === "/sheetCalloutsDetected" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				await this.sheetCalloutsDetected(sheetId);
				const state = await this.loadState();
				return Response.json({ success: true, state });
			}

			if (url.pathname === "/sheetLayoutDetected" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				const state = await this.loadState();
				if (!state) {
					return Response.json({ error: "Not initialized" }, { status: 400 });
				}
				if (!state.detectedLayouts.includes(sheetId)) {
					state.detectedLayouts.push(sheetId);
				}
				this.checkParallelDetectionComplete(state);
				await this.saveState(state);
				return Response.json({ success: true, state });
			}

			if (url.pathname === "/sheetTilesGenerated" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				await this.sheetTilesGenerated(sheetId);
				const state = await this.loadState();
				return Response.json({ success: true, state });
			}

			if (url.pathname === "/markFailed" && request.method === "POST") {
				const { error } = (await request.json()) as { error: string };
				await this.markFailed(error);
				const state = await this.loadState();
				return Response.json({ success: true, state });
			}

			return Response.json({ error: "Method not found" }, { status: 404 });
		} catch (error) {
			return Response.json(
				{ error: error instanceof Error ? error.message : String(error) },
				{ status: 500 },
			);
		}
	}

	private checkParallelDetectionComplete(state: PlanCoordinatorState): void {
		if (state.status !== "parallel_detection") return;
		const calloutsComplete =
			state.detectedCallouts.length === state.validSheets.length;
		const layoutsComplete =
			state.detectedLayouts.length === state.validSheets.length;
		if (calloutsComplete && layoutsComplete) {
			state.status = "tile_generation";
		}
	}

	private getProgress(state: PlanCoordinatorState) {
		return {
			planId: state.planId,
			status: state.status,
			progress: {
				images: {
					completed: state.generatedImages.length,
					total: state.totalSheets,
				},
				metadata: {
					completed: state.extractedMetadata.length,
					total: state.totalSheets,
				},
				callouts: {
					completed: state.detectedCallouts.length,
					total: state.validSheets.length,
				},
				layouts: {
					completed: state.detectedLayouts.length,
					total: state.validSheets.length,
				},
				tiles: {
					completed: state.generatedTiles.length,
					total: state.validSheets.length,
				},
			},
			validSheets: state.validSheets,
			validSheetNumbers: state.validSheets.map(
				(id) => state.sheetNumberMap[id] || id,
			),
			sheetNumberMap: state.sheetNumberMap,
		};
	}
}

// Proxies container calls to the real Docker container via PDF_CONTAINER_PROXY service binding.
// This replaces the real PdfProcessor (which extends Container from @cloudflare/containers
// and doesn't work in WSL2/test environments).
export class TestPdfProcessor extends DurableObject<TestEnv> {
	async startAndWaitForPorts(_options?: unknown): Promise<void> {
		// No-op in test environment — container is already running via docker-compose
	}

	override async fetch(request: Request): Promise<Response> {
		if (!this.env.PDF_CONTAINER_PROXY) {
			return Response.json(
				{ error: "PDF_CONTAINER_PROXY not configured" },
				{ status: 503 },
			);
		}
		return this.env.PDF_CONTAINER_PROXY.fetch(request);
	}
}

// Captures LiveStore events committed during pipeline processing.
// Tests can retrieve collected events to validate schema shapes.
// Uses durable storage (like PlanCoordinator) to survive DO eviction during long pipeline runs.
export class LiveStoreCollector extends DurableObject<TestEnv> {
	private async loadEvents(): Promise<
		Array<{ eventName: string; data: Record<string, unknown>; timestamp: number }>
	> {
		return (await this.ctx.storage.get("events")) ?? [];
	}

	private async saveEvents(
		events: Array<{ eventName: string; data: Record<string, unknown>; timestamp: number }>,
	): Promise<void> {
		await this.ctx.storage.put("events", events);
	}

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/commit" && request.method === "POST") {
			const body = (await request.json()) as {
				eventName: string;
				data: Record<string, unknown>;
			};
			const events = await this.loadEvents();
			events.push({ ...body, timestamp: Date.now() });
			await this.saveEvents(events);
			return Response.json({ success: true });
		}

		if (url.pathname === "/events") {
			const eventName = url.searchParams.get("eventName");
			const events = await this.loadEvents();
			const filtered = eventName
				? events.filter((e) => e.eventName === eventName)
				: events;
			return Response.json(filtered);
		}

		if (url.pathname === "/reset" && request.method === "POST") {
			await this.saveEvents([]);
			return Response.json({ success: true });
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}
}

export default {
	async fetch(_request: Request): Promise<Response> {
		return new Response("Test worker");
	},
};
