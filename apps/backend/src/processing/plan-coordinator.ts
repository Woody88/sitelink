import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export interface PlanCoordinatorState {
	planId: string;
	projectId: string;
	organizationId: string;
	totalSheets: number;
	// Stage 1: Image Generation
	generatedImages: string[]; // Sheet IDs with generated images
	// Stage 2: Metadata Extraction
	extractedMetadata: string[]; // Sheet IDs with extracted metadata
	validSheets: string[]; // Sheet IDs that passed metadata extraction
	sheetNumberMap: Record<string, string>; // Map of sheetId -> sheetNumber (e.g., "sheet-0" -> "A1")
	// Stage 3: Callout Detection
	detectedCallouts: string[]; // Sheet IDs with detected callouts
	// Stage 4: PMTiles Generation
	generatedTiles: string[]; // Sheet IDs with generated tiles
	// Processing status
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

export class PlanCoordinator extends DurableObject<Env> {
	private state: PlanCoordinatorState | null = null;

	async initialize(params: {
		planId: string;
		projectId: string;
		organizationId: string;
		totalSheets: number;
		timeoutMs?: number;
	}) {
		const {
			planId,
			projectId,
			organizationId,
			totalSheets,
			timeoutMs = 30 * 60 * 1000,
		} = params;

		console.log(
			`[PlanCoordinator] Initializing for planId=${planId}, totalSheets=${totalSheets}`,
		);

		this.state = {
			planId,
			projectId,
			organizationId,
			totalSheets,
			generatedImages: [],
			extractedMetadata: [],
			validSheets: [],
			sheetNumberMap: {},
			detectedCallouts: [],
			generatedTiles: [],
			status: "image_generation",
			createdAt: Date.now(),
		};

		await this.ctx.storage.put("state", this.state);
		await this.ctx.storage.setAlarm(Date.now() + timeoutMs);

		return { success: true, state: this.state };
	}

	async getState(): Promise<PlanCoordinatorState | null> {
		if (!this.state) {
			this.state =
				(await this.ctx.storage.get<PlanCoordinatorState>("state")) ?? null;
		}
		return this.state;
	}

	async sheetImageGenerated(sheetId: string) {
		const state = await this.ensureState();

		if (!state.generatedImages.includes(sheetId)) {
			state.generatedImages.push(sheetId);
			await this.ctx.storage.put("state", state);
			console.log(
				`[PlanCoordinator] Image generated: ${state.generatedImages.length}/${state.totalSheets}`,
			);
		}

		if (
			state.generatedImages.length === state.totalSheets &&
			state.status === "image_generation"
		) {
			console.log(
				`[PlanCoordinator] All images generated. Transitioning to metadata extraction.`,
			);
			state.status = "metadata_extraction";
			await this.ctx.storage.put("state", state);
			await this.triggerMetadataExtraction();
		}

		return this.getProgress();
	}

	async sheetMetadataExtracted(
		sheetId: string,
		isValid: boolean,
		sheetNumber?: string,
	) {
		const state = await this.ensureState();

		if (!state.extractedMetadata.includes(sheetId)) {
			state.extractedMetadata.push(sheetId);
			if (isValid) {
				state.validSheets.push(sheetId);
				// Store sheet number - REQUIRED for callout detection to work properly
				// If sheetNumber is missing, this indicates an extraction failure
				if (sheetNumber) {
					state.sheetNumberMap[sheetId] = sheetNumber;
					console.log(
						`[PlanCoordinator] Valid sheet: ${sheetId} -> ${sheetNumber}`,
					);
				} else {
					console.warn(
						`[PlanCoordinator] Valid sheet ${sheetId} has NO sheet number - callout matching will fail!`,
					);
				}
			}
			await this.ctx.storage.put("state", state);
			console.log(
				`[PlanCoordinator] Metadata extracted: ${state.extractedMetadata.length}/${state.totalSheets}`,
			);
		}

		if (
			state.extractedMetadata.length === state.totalSheets &&
			state.status === "metadata_extraction"
		) {
			console.log(
				`[PlanCoordinator] All metadata extracted. Valid sheets: ${state.validSheets.length}`,
			);
			state.status = "callout_detection";
			await this.ctx.storage.put("state", state);

			// Emit planMetadataCompleted event with validSheets
			await this.emitMetadataCompleted();

			await this.triggerCalloutDetection();
		}

		return this.getProgress();
	}

	async sheetCalloutsDetected(sheetId: string) {
		const state = await this.ensureState();

		if (!state.detectedCallouts.includes(sheetId)) {
			state.detectedCallouts.push(sheetId);
			await this.ctx.storage.put("state", state);
			console.log(
				`[PlanCoordinator] Callouts detected: ${state.detectedCallouts.length}/${state.validSheets.length}`,
			);
		}

		if (
			state.detectedCallouts.length === state.validSheets.length &&
			state.status === "callout_detection"
		) {
			console.log(
				`[PlanCoordinator] All callouts detected. Transitioning to tile generation.`,
			);
			state.status = "tile_generation";
			await this.ctx.storage.put("state", state);
			await this.triggerTileGeneration();
		}

		return this.getProgress();
	}

	async sheetTilesGenerated(sheetId: string) {
		const state = await this.ensureState();

		if (!state.generatedTiles.includes(sheetId)) {
			state.generatedTiles.push(sheetId);
			await this.ctx.storage.put("state", state);
			console.log(
				`[PlanCoordinator] Tiles generated: ${state.generatedTiles.length}/${state.validSheets.length}`,
			);
		}

		if (
			state.generatedTiles.length === state.validSheets.length &&
			state.status === "tile_generation"
		) {
			console.log(
				`[PlanCoordinator] All tiles generated. Processing complete!`,
			);
			state.status = "complete";
			await this.ctx.storage.put("state", state);
			await this.emitProcessingComplete();
		}

		return this.getProgress();
	}

	async markFailed(error: string) {
		const state = await this.ensureState();
		state.status = "failed";
		state.lastError = error;
		await this.ctx.storage.put("state", state);
		return this.getProgress();
	}

	private async ensureState(): Promise<PlanCoordinatorState> {
		if (!this.state) {
			this.state =
				(await this.ctx.storage.get<PlanCoordinatorState>("state")) ?? null;
			if (!this.state) {
				throw new Error("PlanCoordinator not initialized");
			}
		}
		return this.state;
	}

	private getProgress() {
		if (!this.state) return null;
		// Build valid sheet numbers array from map
		const validSheetNumbers = this.state.validSheets.map(
			(id) => this.state!.sheetNumberMap[id] || id,
		);
		return {
			planId: this.state.planId,
			status: this.state.status,
			progress: {
				images: {
					completed: this.state.generatedImages.length,
					total: this.state.totalSheets,
				},
				metadata: {
					completed: this.state.extractedMetadata.length,
					total: this.state.totalSheets,
				},
				callouts: {
					completed: this.state.detectedCallouts.length,
					total: this.state.validSheets.length,
				},
				tiles: {
					completed: this.state.generatedTiles.length,
					total: this.state.validSheets.length,
				},
			},
			validSheets: this.state.validSheets,
			validSheetNumbers,
			sheetNumberMap: this.state.sheetNumberMap,
		};
	}

	private async triggerMetadataExtraction() {
		const state = await this.ensureState();
		console.log(
			`[PlanCoordinator] Triggering metadata extraction for ${state.totalSheets} sheets`,
		);

		for (let i = 0; i < state.totalSheets; i++) {
			const sheetId = state.generatedImages[i];
			await this.env.METADATA_EXTRACTION_QUEUE.send({
				planId: state.planId,
				projectId: state.projectId,
				organizationId: state.organizationId,
				sheetId,
				sheetNumber: i + 1,
				totalSheets: state.totalSheets,
			});
		}
	}

	private async triggerCalloutDetection() {
		const state = await this.ensureState();
		// Get array of valid sheet numbers (e.g., ["A1", "A2", "S1"]) for callout matching
		const validSheetNumbers: string[] = [];
		for (const id of state.validSheets) {
			const sheetNumber = state.sheetNumberMap[id];
			if (sheetNumber) {
				validSheetNumbers.push(sheetNumber);
			} else {
				console.error(
					`[PlanCoordinator] Sheet ${id} missing from sheetNumberMap! This will break callout detection.`,
				);
			}
		}
		console.log(
			`[PlanCoordinator] Triggering callout detection for ${state.validSheets.length} valid sheets`,
		);
		console.log(
			`[PlanCoordinator] Valid sheet numbers: ${validSheetNumbers.join(", ")}`,
		);
		console.log(
			`[PlanCoordinator] Sheet number map: ${JSON.stringify(state.sheetNumberMap)}`,
		);

		for (const sheetId of state.validSheets) {
			const sheetNumber = state.sheetNumberMap[sheetId];
			await this.env.CALLOUT_DETECTION_QUEUE.send({
				planId: state.planId,
				projectId: state.projectId,
				organizationId: state.organizationId,
				sheetId,
				sheetNumber,
				validSheetNumbers, // Pass sheet numbers (A1, A2) not IDs (sheet-0)
			});
		}
	}

	private async triggerTileGeneration() {
		const state = await this.ensureState();
		console.log(
			`[PlanCoordinator] Triggering tile generation for ${state.validSheets.length} valid sheets`,
		);

		for (const sheetId of state.validSheets) {
			await this.env.TILE_GENERATION_QUEUE.send({
				planId: state.planId,
				projectId: state.projectId,
				organizationId: state.organizationId,
				sheetId,
			});
		}
	}

	private async emitMetadataCompleted() {
		const state = await this.ensureState();
		console.log(
			`[PlanCoordinator] Emitting metadata completed event for plan ${state.planId}`,
		);

		try {
			const liveStoreStub = this.env.LIVESTORE_CLIENT_DO.get(
				this.env.LIVESTORE_CLIENT_DO.idFromName(state.organizationId),
			);

			await liveStoreStub.fetch(
				"http://internal/commit?storeId=" + state.organizationId,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						eventName: "planMetadataCompleted",
						data: {
							planId: state.planId,
							validSheets: state.validSheets, // Sheet IDs for materializer
							sheetNumberMap: state.sheetNumberMap, // Map of sheetId -> sheetNumber
							completedAt: Date.now(),
						},
					}),
				},
			);
		} catch (error) {
			console.warn(
				`[PlanCoordinator] Failed to emit metadata completed event:`,
				error,
			);
		}
	}

	private async emitProcessingComplete() {
		const state = await this.ensureState();
		console.log(
			`[PlanCoordinator] Emitting processing complete event for plan ${state.planId}`,
		);

		try {
			const liveStoreStub = this.env.LIVESTORE_CLIENT_DO.get(
				this.env.LIVESTORE_CLIENT_DO.idFromName(state.organizationId),
			);

			await liveStoreStub.fetch(
				"http://internal/commit?storeId=" + state.organizationId,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						eventName: "planProcessingCompleted",
						data: {
							planId: state.planId,
							sheetCount: state.validSheets.length,
							completedAt: Date.now(),
						},
					}),
				},
			);
		} catch (error) {
			console.warn(
				`[PlanCoordinator] Failed to emit processing complete event:`,
				error,
			);
		}
	}

	override async alarm() {
		const state = await this.getState();
		if (state && state.status !== "complete" && state.status !== "failed") {
			console.log(
				`[PlanCoordinator] Timeout reached for plan ${state.planId}. Marking as failed.`,
			);
			await this.markFailed("Processing timeout exceeded");
		}
	}

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			if (path === "/initialize" && request.method === "POST") {
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

			if (path === "/getState" && request.method === "GET") {
				const state = await this.getState();
				return Response.json(state);
			}

			if (path === "/sheetImageGenerated" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				const result = await this.sheetImageGenerated(sheetId);
				return Response.json(result);
			}

			if (path === "/sheetMetadataExtracted" && request.method === "POST") {
				const { sheetId, isValid, sheetNumber } = (await request.json()) as {
					sheetId: string;
					isValid: boolean;
					sheetNumber?: string;
				};
				const result = await this.sheetMetadataExtracted(
					sheetId,
					isValid,
					sheetNumber,
				);
				return Response.json(result);
			}

			if (path === "/sheetCalloutsDetected" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				const result = await this.sheetCalloutsDetected(sheetId);
				return Response.json(result);
			}

			if (path === "/sheetTilesGenerated" && request.method === "POST") {
				const { sheetId } = (await request.json()) as { sheetId: string };
				const result = await this.sheetTilesGenerated(sheetId);
				return Response.json(result);
			}

			if (path === "/markFailed" && request.method === "POST") {
				const { error } = (await request.json()) as { error: string };
				const result = await this.markFailed(error);
				return Response.json(result);
			}

			if (path === "/alarm" && request.method === "POST") {
				await this.alarm();
				return Response.json({ success: true });
			}

			return Response.json({ error: "Method not found" }, { status: 404 });
		} catch (error) {
			return Response.json(
				{ error: error instanceof Error ? error.message : String(error) },
				{ status: 500 },
			);
		}
	}
}
