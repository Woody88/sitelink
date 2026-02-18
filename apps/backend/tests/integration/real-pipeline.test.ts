import { SELF, env, applyD1Migrations } from "cloudflare:test";
import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import {
	handleR2NotificationQueue,
	type R2EventNotification,
} from "../../src/processing/r2-with-notifications";
import {
	handleImageGenerationQueue,
	handleMetadataExtractionQueue,
	handleCalloutDetectionQueue,
	handleDocLayoutDetectionQueue,
	handleTileGenerationQueue,
} from "../../src/processing/queue-consumer";
import { getR2Path } from "../../src/processing/types";
import type {
	ImageGenerationJob,
	MetadataExtractionJob,
	CalloutDetectionJob,
	DocLayoutDetectionJob,
	TileGenerationJob,
} from "../../src/processing/types";

// ---------------------------------------------------------------------------
// Event schema shapes — mirrors packages/domain/src/events.ts
//
// LIMITATION: These are a hand-maintained copy of the real Effect Schema
// definitions. If the schemas in events.ts change, these must be updated
// manually. A drift between these and the real schemas is a test bug.
//
// TODO: Import `events` from `@sitelink/domain` and use Schema.decodeUnknownSync
// for validation. Currently blocked by @livestore/livestore -> OpenTelemetry
// transitive import causing crashes in the cloudflare:test (workerd) environment.
// ---------------------------------------------------------------------------
const EVENT_SCHEMAS: Record<string, { required: string[]; optional: string[] }> = {
	planProcessingStarted: {
		required: ["planId", "startedAt"],
		optional: [],
	},
	planProcessingProgress: {
		required: ["planId", "progress"],
		optional: [],
	},
	sheetImageGenerated: {
		required: [
			"sheetId",
			"projectId",
			"planId",
			"planName",
			"pageNumber",
			"localImagePath",
			"width",
			"height",
			"generatedAt",
		],
		optional: ["remoteImagePath"],
	},
	sheetMetadataExtracted: {
		required: ["sheetId", "planId", "sheetNumber", "extractedAt"],
		optional: ["sheetTitle", "discipline"],
	},
	planMetadataCompleted: {
		required: ["planId", "validSheets", "sheetNumberMap", "completedAt"],
		optional: [],
	},
	sheetCalloutsDetected: {
		required: ["sheetId", "planId", "markers", "unmatchedCount", "detectedAt"],
		optional: [],
	},
	sheetLayoutRegionsDetected: {
		required: ["sheetId", "regions", "detectedAt"],
		optional: [],
	},
	sheetGridBubblesDetected: {
		required: ["sheetId", "bubbles", "detectedAt"],
		optional: [],
	},
	sheetTilesGenerated: {
		required: ["sheetId", "planId", "localPmtilesPath", "minZoom", "maxZoom", "generatedAt"],
		optional: ["remotePmtilesPath"],
	},
	planProcessingCompleted: {
		required: ["planId", "sheetCount", "completedAt"],
		optional: [],
	},
	planUploaded: {
		required: ["id", "projectId", "fileName", "fileSize", "mimeType", "localPath", "remotePath", "uploadedBy", "uploadedAt"],
		optional: [],
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateEventData(eventName: string, data: Record<string, unknown>) {
	const schema = EVENT_SCHEMAS[eventName];
	if (!schema) {
		throw new Error(
			`[SchemaValidation] No schema defined for event: ${eventName}. ` +
				`Add it to EVENT_SCHEMAS or the event is unknown.`,
		);
	}

	const allAllowed = new Set([...schema.required, ...schema.optional]);
	const dataKeys = Object.keys(data);

	const extraKeys = dataKeys.filter((k) => !allAllowed.has(k));
	expect(
		extraKeys,
		`Event "${eventName}" has unexpected fields: [${extraKeys.join(", ")}]. ` +
			`Allowed: [${[...allAllowed].join(", ")}]`,
	).toEqual([]);

	for (const key of schema.required) {
		expect(
			data,
			`Event "${eventName}" missing required field "${key}"`,
		).toHaveProperty(key);
	}
}

interface CollectedEvent {
	eventName: string;
	data: Record<string, unknown>;
	timestamp: number;
}

async function getCollectedEvents(organizationId: string): Promise<CollectedEvent[]> {
	const stub = env.LIVESTORE_CLIENT_DO.get(
		env.LIVESTORE_CLIENT_DO.idFromName(organizationId),
	);
	const response = await stub.fetch("http://internal/events");
	return response.json() as Promise<CollectedEvent[]>;
}

async function getCollectedEventsByName(
	organizationId: string,
	eventName: string,
): Promise<CollectedEvent[]> {
	const stub = env.LIVESTORE_CLIENT_DO.get(
		env.LIVESTORE_CLIENT_DO.idFromName(organizationId),
	);
	const response = await stub.fetch(
		`http://internal/events?eventName=${encodeURIComponent(eventName)}`,
	);
	return response.json() as Promise<CollectedEvent[]>;
}

async function resetCollectedEvents(organizationId: string): Promise<void> {
	const stub = env.LIVESTORE_CLIENT_DO.get(
		env.LIVESTORE_CLIENT_DO.idFromName(organizationId),
	);
	await stub.fetch("http://internal/reset", { method: "POST" });
}

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

async function isContainerAvailable(): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);
		const response = await env.PDF_CONTAINER_PROXY!.fetch(
			"http://container/health",
			{ signal: controller.signal },
		);
		clearTimeout(timeoutId);
		return response.ok;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TEST_ORG_ID = "integration-test-org";
const TEST_PROJECT_ID = "integration-test-project";
const TEST_FIXTURE = "structural-4page.pdf";

// Auth constants for upload tests
const TEST_USER_ID = "test-user-001";
const TEST_USER_EMAIL = "test@sitelink.dev";
const TEST_USER_NAME = "Test User";
const TEST_SESSION_TOKEN = "test-session-token-integration";
const TEST_SESSION_EXPIRY = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

async function seedAuthData(): Promise<void> {
	// Apply D1 migrations to create user/session tables
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS!);

	const now = Date.now();
	await env.DB.prepare(
		"INSERT OR REPLACE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
	)
		.bind(TEST_USER_ID, TEST_USER_NAME, TEST_USER_EMAIL, now, now)
		.run();

	await env.DB.prepare(
		"INSERT OR REPLACE INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind("test-session-001", TEST_SESSION_EXPIRY, TEST_SESSION_TOKEN, now, now, TEST_USER_ID)
		.run();
}

// ---------------------------------------------------------------------------
// Unit tests (no Docker required)
// ---------------------------------------------------------------------------

describe("LiveStore Event Schema Validation", () => {
	it("should reject planProcessingProgress with extra fields (upload-stuck bug)", () => {
		const correctData = { planId: "plan-1", progress: 50 };
		validateEventData("planProcessingProgress", correctData);

		const buggyData = {
			planId: "plan-1",
			stage: "image_generation",
			progress: 50,
			message: "Processing...",
			updatedAt: Date.now(),
		};

		const schema = EVENT_SCHEMAS.planProcessingProgress;
		const allAllowed = new Set([...schema.required, ...schema.optional]);
		const extraKeys = Object.keys(buggyData).filter((k) => !allAllowed.has(k));
		expect(extraKeys).toEqual(["stage", "message", "updatedAt"]);
	});

	it("should validate all pipeline event schemas have no extra fields", () => {
		const testData: Record<string, Record<string, unknown>> = {
			planProcessingStarted: { planId: "p1", startedAt: 1000 },
			planProcessingProgress: { planId: "p1", progress: 25 },
			sheetImageGenerated: {
				sheetId: "s1",
				projectId: "proj1",
				planId: "p1",
				planName: "test",
				pageNumber: 1,
				localImagePath: "/path/to/image.png",
				remoteImagePath: "/api/r2/path",
				width: 3300,
				height: 2550,
				generatedAt: 1000,
			},
			sheetMetadataExtracted: {
				sheetId: "s1",
				planId: "p1",
				sheetNumber: "A1",
				sheetTitle: "Floor Plan",
				discipline: "architectural",
				extractedAt: 1000,
			},
			planMetadataCompleted: {
				planId: "p1",
				validSheets: ["s1"],
				sheetNumberMap: { s1: "A1" },
				completedAt: 1000,
			},
			sheetCalloutsDetected: {
				sheetId: "s1",
				planId: "p1",
				markers: [],
				unmatchedCount: 0,
				detectedAt: 1000,
			},
			sheetLayoutRegionsDetected: {
				sheetId: "s1",
				regions: [],
				detectedAt: 1000,
			},
			sheetTilesGenerated: {
				sheetId: "s1",
				planId: "p1",
				localPmtilesPath: "/path/tiles.pmtiles",
				remotePmtilesPath: "/api/r2/tiles",
				minZoom: 0,
				maxZoom: 5,
				generatedAt: 1000,
			},
			planProcessingCompleted: {
				planId: "p1",
				sheetCount: 1,
				completedAt: 1000,
			},
		};

		for (const [eventName, data] of Object.entries(testData)) {
			validateEventData(eventName, data);
		}
	});

	it("should detect missing required fields", () => {
		const incompleteData = { planId: "p1" }; // missing "progress"
		const schema = EVENT_SCHEMAS.planProcessingProgress;
		const missingKeys = schema.required.filter(
			(k) => !(k in incompleteData),
		);
		expect(missingKeys).toContain("progress");
	});
});

describe("LiveStore Collector DO", () => {
	const orgId = "collector-test-org";

	beforeEach(async () => {
		await resetCollectedEvents(orgId);
	});

	it("should collect events committed via fetch", async () => {
		const stub = env.LIVESTORE_CLIENT_DO.get(
			env.LIVESTORE_CLIENT_DO.idFromName(orgId),
		);

		await stub.fetch("http://internal/commit?storeId=" + orgId, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				eventName: "planProcessingProgress",
				data: { planId: "test-plan", progress: 42 },
			}),
		});

		const events = await getCollectedEvents(orgId);
		expect(events).toHaveLength(1);
		expect(events[0].eventName).toBe("planProcessingProgress");
		expect(events[0].data).toEqual({ planId: "test-plan", progress: 42 });
	});

	it("should filter events by name", async () => {
		const stub = env.LIVESTORE_CLIENT_DO.get(
			env.LIVESTORE_CLIENT_DO.idFromName(orgId),
		);

		await stub.fetch("http://internal/commit", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				eventName: "planProcessingStarted",
				data: { planId: "p1", startedAt: 1000 },
			}),
		});
		await stub.fetch("http://internal/commit", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				eventName: "planProcessingProgress",
				data: { planId: "p1", progress: 50 },
			}),
		});

		const progressEvents = await getCollectedEventsByName(orgId, "planProcessingProgress");
		expect(progressEvents).toHaveLength(1);
		expect(progressEvents[0].data).toEqual({ planId: "p1", progress: 50 });
	});
});

describe("PlanCoordinator RPC Methods (real coordinator)", () => {
	it("should transition through full state machine via RPC with real dispatch", async () => {
		const planId = "rpc-test-plan";
		const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
		const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;

		const initResult = await coordinator.initialize({
			planId,
			projectId: TEST_PROJECT_ID,
			organizationId: TEST_ORG_ID,
			totalSheets: 1,
		});
		expect(initResult.success).toBe(true);

		let state = await coordinator.getState();
		expect(state.status).toBe("image_generation");

		// sheetImageGenerated triggers triggerMetadataExtraction() which sends to queue
		await coordinator.sheetImageGenerated("sheet-0");
		state = await coordinator.getState();
		expect(state.status).toBe("metadata_extraction");

		// sheetMetadataExtracted triggers emitMetadataCompleted() + triggerCalloutDetection() + triggerDocLayoutDetection()
		await coordinator.sheetMetadataExtracted("sheet-0", true, "A1");
		state = await coordinator.getState();
		expect(state.status).toBe("parallel_detection");

		await coordinator.sheetCalloutsDetected("sheet-0");
		state = await coordinator.getState();
		// Still in parallel_detection -- layout not done yet
		expect(state.status).toBe("parallel_detection");
		expect(state.detectedCallouts).toHaveLength(1);
		expect(state.detectedLayouts).toHaveLength(0);

		// DocLayout uses fetch (not RPC) -- also works with real coordinator
		await coordinator.fetch("http://internal/sheetLayoutDetected", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sheetId: "sheet-0" }),
		});

		state = await coordinator.getState();
		// checkParallelDetectionComplete triggers triggerTileGeneration()
		expect(state.status).toBe("tile_generation");

		// sheetTilesGenerated triggers emitProcessingComplete()
		await coordinator.sheetTilesGenerated("sheet-0");
		state = await coordinator.getState();
		expect(state.status).toBe("complete");
	});

	it("should handle zero valid sheets (metadata all invalid)", async () => {
		const planId = "rpc-zero-valid";
		const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId);
		const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;

		await coordinator.initialize({
			planId,
			projectId: TEST_PROJECT_ID,
			organizationId: TEST_ORG_ID,
			totalSheets: 2,
		});

		await coordinator.sheetImageGenerated("sheet-0");
		await coordinator.sheetImageGenerated("sheet-1");
		let state = await coordinator.getState();
		expect(state.status).toBe("metadata_extraction");

		// Both sheets invalid
		await coordinator.sheetMetadataExtracted("sheet-0", false);
		await coordinator.sheetMetadataExtracted("sheet-1", false);
		state = await coordinator.getState();
		expect(state.status).toBe("parallel_detection");
		expect(state.validSheets).toHaveLength(0);

		// With 0 valid sheets, parallel detection is already "complete" (0 === 0)
		// But nothing calls checkParallelDetectionComplete -- this mirrors a real edge case
		// where the coordinator would be stuck without external intervention
	});
});

// ---------------------------------------------------------------------------
// Integration tests (require Docker container on port 3001)
//
// These tests call real queue handler functions against a real Docker container.
// They MUST be run via `bun run test:integration` which handles Docker lifecycle.
// If Docker is not running, these tests FAIL (not skip).
//
// The PlanCoordinator is the REAL coordinator from src/processing/plan-coordinator.ts.
// It dispatches to queues (triggerMetadataExtraction, triggerCalloutDetection, etc.)
// and emits LiveStore events (planMetadataCompleted, planProcessingCompleted).
// Queue messages from coordinator dispatch go to miniflare (can't auto-consume --
// known miniflare limitation). Tests still manually drive each pipeline stage.
// ---------------------------------------------------------------------------

describe("Container Integration (requires Docker)", () => {
	let containerReady = false;

	beforeAll(async () => {
		containerReady = await isContainerAvailable();
		if (!containerReady) {
			throw new Error(
				"Docker container not running on port 3001.\n" +
					"Run: bun run test:integration (handles Docker lifecycle)\n" +
					"Or: docker compose -f container/docker-compose.yml up -d --wait",
			);
		}
	});

	it("should proxy health check to container", async () => {
		const response = await env.PDF_CONTAINER_PROXY!.fetch("http://container/health");
		expect(response.ok).toBe(true);

		const body = (await response.json()) as { status: string };
		expect(body.status).toBe("healthy");
	});

	it("should proxy health check via TestPdfProcessor DO", async () => {
		const containerId = env.PDF_PROCESSOR.idFromName("proxy-test");
		const container = env.PDF_PROCESSOR.get(containerId) as any;

		await container.startAndWaitForPorts();

		const response = await container.fetch("http://container/health");
		expect(response.ok).toBe(true);

		const body = (await response.json()) as { status: string };
		expect(body.status).toBe("healthy");
	});
});

describe("Full Pipeline with Real Container", () => {
	// planId is set by the upload endpoint (Stage 1) and shared across all stages
	let testPlanId: string;
	let pdfR2Path: string;

	beforeAll(async () => {
		const containerReady = await isContainerAvailable();
		if (!containerReady) {
			throw new Error(
				"Docker container not running on port 3001.\n" +
					"Run: bun run test:integration (handles Docker lifecycle)\n" +
					"Or: docker compose -f container/docker-compose.yml up -d --wait",
			);
		}

		// Seed D1 with test user and session for upload auth
		await seedAuthData();
		await resetCollectedEvents(TEST_ORG_ID);
	});

	it("Stage 1: Upload PDF via HTTP endpoint", async () => {
		// Load fixture PDF
		const pdfResponse = await env.FIXTURE_LOADER!.fetch(
			`http://fixture/${TEST_FIXTURE}`,
		);
		expect(pdfResponse.ok, `Fixture not found: ${TEST_FIXTURE}`).toBe(true);
		const pdfBlob = await pdfResponse.blob();

		// Build multipart form data
		const formData = new FormData();
		formData.append("file", new File([pdfBlob], TEST_FIXTURE, { type: "application/pdf" }));
		formData.append("projectId", TEST_PROJECT_ID);
		formData.append("organizationId", TEST_ORG_ID);

		// Call the real upload endpoint with auth
		const uploadResponse = await SELF.fetch("http://worker/api/plans/upload", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${TEST_SESSION_TOKEN}`,
			},
			body: formData,
		});

		expect(uploadResponse.status, `Upload failed: ${await uploadResponse.clone().text()}`).toBe(200);

		const result = (await uploadResponse.json()) as {
			success: boolean;
			planId: string;
			message: string;
		};
		expect(result.success).toBe(true);
		expect(result.planId).toBeTruthy();

		// Store planId for subsequent stages
		testPlanId = result.planId;
		pdfR2Path = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${testPlanId}/source.pdf`;

		// Verify PDF was stored in R2
		const storedPdf = await env.R2_BUCKET.get(pdfR2Path);
		expect(storedPdf, "PDF not found in R2 after upload").toBeTruthy();
		const storedSize = (await storedPdf!.arrayBuffer()).byteLength;
		expect(storedSize).toBeGreaterThan(0);
	});

	it("Stage 1b: R2 notification triggers image generation queue", async () => {
		// The upload endpoint sent a simulated R2 notification to the queue.
		// Miniflare doesn't auto-consume queue messages, so we manually invoke
		// the R2 notification handler with the same notification payload.
		const notification: R2EventNotification = {
			account: "test",
			bucket: "sitelink-files-test",
			object: { key: pdfR2Path, size: 1024, eTag: "test-etag" },
			action: "PutObject",
			eventTime: new Date().toISOString(),
		};

		const queuedJobs: ImageGenerationJob[] = [];
		const message = createMockMessage(notification);
		const batch = createMockBatch([message]);

		await handleR2NotificationQueue(batch, {
			...env,
			IMAGE_GENERATION_QUEUE: {
				send: async (job: ImageGenerationJob) => {
					queuedJobs.push(job);
				},
			},
		} as any);

		expect(message.ackCalled).toBe(true);
		expect(queuedJobs).toHaveLength(1);
		expect(queuedJobs[0].planId).toBe(testPlanId);
		expect(queuedJobs[0].pdfPath).toBe(pdfR2Path);

		const startedEvents = await getCollectedEventsByName(
			TEST_ORG_ID,
			"planProcessingStarted",
		);
		expect(startedEvents.length).toBeGreaterThanOrEqual(1);
		validateEventData("planProcessingStarted", startedEvents[0].data);
	});

	it(
		"Stage 2: Image generation via real container",
		{ timeout: 120_000 },
		async () => {
			const job: ImageGenerationJob = {
				planId: testPlanId,
				projectId: TEST_PROJECT_ID,
				organizationId: TEST_ORG_ID,
				pdfPath: pdfR2Path,
				totalPages: 4,
				planName: "4-Structural-Drawings",
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleImageGenerationQueue(batch, env as any);

			expect(message.ackCalled, "Image generation failed (message retried, not acked)").toBe(true);
			expect(message.retryCalled).toBe(false);

			// Real coordinator: after all images generated, transitions to metadata_extraction
			// AND calls triggerMetadataExtraction() which sends jobs to METADATA_EXTRACTION_QUEUE
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
			const state = await coordinator.getState();
			expect(state, "Coordinator state is null after image generation").not.toBeNull();
			expect(state.status).toBe("metadata_extraction");
			expect(state.generatedImages.length).toBeGreaterThan(0);

			for (const sheetId of state.generatedImages) {
				const imagePath = getR2Path(
					TEST_ORG_ID,
					TEST_PROJECT_ID,
					testPlanId,
					sheetId,
					"source.png",
				);
				const imageObj = await env.R2_BUCKET.get(imagePath);
				expect(imageObj, `Image not found at ${imagePath}`).toBeTruthy();
				const imageBytes = await imageObj!.arrayBuffer();
				expect(imageBytes.byteLength).toBeGreaterThan(0);
			}

			const progressEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"planProcessingProgress",
			);
			for (const evt of progressEvents) {
				validateEventData("planProcessingProgress", evt.data);
			}

			const imageEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetImageGenerated",
			);
			expect(imageEvents.length).toBeGreaterThan(0);
			for (const evt of imageEvents) {
				validateEventData("sheetImageGenerated", evt.data);
			}
		},
	);

	it(
		"Stage 3: Metadata extraction via real container",
		{ timeout: 120_000 },
		async () => {
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
			const state = await coordinator.getState();

			expect(state, "Coordinator state is null").not.toBeNull();
			expect(
				state.status,
				"Coordinator should be in metadata_extraction after Stage 2",
			).toBe("metadata_extraction");

			for (let i = 0; i < state.generatedImages.length; i++) {
				const sheetId = state.generatedImages[i];
				const job: MetadataExtractionJob = {
					planId: testPlanId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					sheetId,
					sheetNumber: i + 1,
					totalSheets: state.totalSheets,
				};

				const message = createMockMessage(job);
				const batch = createMockBatch([message]);

				await handleMetadataExtractionQueue(batch, env as any);

				expect(
					message.ackCalled,
					`Metadata extraction failed for ${sheetId} (message retried, not acked)`,
				).toBe(true);
			}

			// Real coordinator: after all metadata extracted, transitions to parallel_detection
			// AND calls emitMetadataCompleted() + triggerCalloutDetection() + triggerDocLayoutDetection()
			const postState = await coordinator.getState();
			expect(postState.status).toBe("parallel_detection");

			if (postState.validSheets.length === 0) {
				console.warn(
					"[Integration] WARNING: Metadata extraction found 0 valid sheets.\n" +
						"This is expected without OPENROUTER_API_KEY. " +
						"Stages 4a, 4b, and 5 will have no sheets to process.\n" +
						"Set OPENROUTER_API_KEY in your environment for full pipeline coverage.",
				);
			}

			const metadataEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetMetadataExtracted",
			);
			expect(metadataEvents.length).toBeGreaterThan(0);
			for (const evt of metadataEvents) {
				validateEventData("sheetMetadataExtracted", evt.data);
			}

			// Real coordinator emits planMetadataCompleted
			const metaCompletedEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"planMetadataCompleted",
			);
			expect(metaCompletedEvents.length).toBeGreaterThanOrEqual(1);
			const metaCompletedEvent = metaCompletedEvents[0]!;
			validateEventData("planMetadataCompleted", metaCompletedEvent.data);
			expect(metaCompletedEvent.data.planId).toBe(testPlanId);
		},
	);

	it(
		"Stage 4a: Callout detection (YOLO 4-class) via real container",
		{ timeout: 120_000 },
		async () => {
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
			const state = await coordinator.getState();

			expect(state, "Coordinator state is null").not.toBeNull();
			expect(
				state.status,
				"Coordinator should be in parallel_detection after Stage 3",
			).toBe("parallel_detection");

			if (state.validSheets.length === 0) {
				// No valid sheets -- nothing to detect callouts on. This is NOT a test failure;
				// it means metadata extraction didn't find valid sheet numbers (likely missing API key).
				// The coordinator correctly transitioned to parallel_detection.
				return;
			}

			const validSheetNumbers = state.validSheets.map(
				(id: string) => state.sheetNumberMap[id] || id,
			);

			for (const sheetId of state.validSheets) {
				const job: CalloutDetectionJob = {
					planId: testPlanId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					sheetId,
					sheetNumber: state.sheetNumberMap[sheetId],
					validSheetNumbers,
				};

				const message = createMockMessage(job);
				const batch = createMockBatch([message]);

				await handleCalloutDetectionQueue(batch, env as any);

				expect(
					message.ackCalled,
					`Callout detection failed for ${sheetId}`,
				).toBe(true);
			}

			const postCalloutState = await coordinator.getState();
			expect(postCalloutState.status).toBe("parallel_detection");
			expect(postCalloutState.detectedCallouts.length).toBe(
				postCalloutState.validSheets.length,
			);
			expect(postCalloutState.detectedLayouts.length).toBe(0);

			const calloutEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetCalloutsDetected",
			);
			expect(calloutEvents.length).toBeGreaterThan(0);
			for (const evt of calloutEvents) {
				validateEventData("sheetCalloutsDetected", evt.data);
				const markers = evt.data.markers as Array<Record<string, unknown>>;
				expect(Array.isArray(markers)).toBe(true);
				for (const marker of markers) {
					expect(marker).toHaveProperty("id");
					expect(marker).toHaveProperty("label");
					expect(marker).toHaveProperty("x");
					expect(marker).toHaveProperty("y");
					expect(marker).toHaveProperty("confidence");
					expect(marker).toHaveProperty("needsReview");
				}
			}
		},
	);

	it(
		"Stage 4b: DocLayout region detection (DocLayout-YOLO) via real container",
		{ timeout: 120_000 },
		async () => {
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
			const state = await coordinator.getState();

			expect(state, "Coordinator state is null").not.toBeNull();
			expect(
				state.status,
				"Coordinator should be in parallel_detection after Stage 4a",
			).toBe("parallel_detection");

			if (state.validSheets.length === 0) {
				// No valid sheets -- see note in Stage 4a
				return;
			}

			expect(
				state.detectedCallouts.length,
				"Stage 4a (callouts) must complete before 4b",
			).toBe(state.validSheets.length);

			for (const sheetId of state.validSheets) {
				const job: DocLayoutDetectionJob = {
					planId: testPlanId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					sheetId,
					sheetNumber: state.sheetNumberMap[sheetId],
				};

				const message = createMockMessage(job);
				const batch = createMockBatch([message]);

				await handleDocLayoutDetectionQueue(batch, env as any);

				expect(message.ackCalled, `DocLayout detection failed for ${sheetId}`).toBe(true);
			}

			// Real coordinator: after both callouts + layouts done, checkParallelDetectionComplete
			// transitions to tile_generation AND calls triggerTileGeneration()
			const postLayoutState = await coordinator.getState();
			expect(postLayoutState.status).toBe("tile_generation");
			expect(postLayoutState.detectedLayouts.length).toBe(
				postLayoutState.validSheets.length,
			);
			expect(postLayoutState.detectedCallouts.length).toBe(
				postLayoutState.validSheets.length,
			);

			const layoutEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetLayoutRegionsDetected",
			);
			for (const evt of layoutEvents) {
				validateEventData("sheetLayoutRegionsDetected", evt.data);
				const regions = evt.data.regions as Array<Record<string, unknown>>;
				expect(Array.isArray(regions)).toBe(true);
				for (const region of regions) {
					expect(region).toHaveProperty("id");
					expect(region).toHaveProperty("regionClass");
					expect(region).toHaveProperty("x");
					expect(region).toHaveProperty("y");
					expect(region).toHaveProperty("width");
					expect(region).toHaveProperty("height");
					expect(region).toHaveProperty("confidence");
				}
			}
		},
	);

	it(
		"Stage 5: PMTiles tile generation via real container",
		{ timeout: 120_000 },
		async () => {
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
			const state = await coordinator.getState();

			expect(state, "Coordinator state is null").not.toBeNull();

			if (state.validSheets.length === 0) {
				// With 0 valid sheets, coordinator may still be in parallel_detection
				// because nothing triggered checkParallelDetectionComplete.
				// This is a known edge case -- the real coordinator would be stuck here.
				expect(state.status).toBe("parallel_detection");
				return;
			}

			expect(
				state.status,
				"Coordinator should be in tile_generation after Stage 4b",
			).toBe("tile_generation");

			for (const sheetId of state.validSheets) {
				const job: TileGenerationJob = {
					planId: testPlanId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					sheetId,
				};

				const message = createMockMessage(job);
				const batch = createMockBatch([message]);

				await handleTileGenerationQueue(batch, env as any);

				expect(
					message.ackCalled,
					`Tile generation failed for ${sheetId}`,
				).toBe(true);
			}

			// Real coordinator: after all tiles generated, transitions to complete
			// AND calls emitProcessingComplete()
			const finalState = await coordinator.getState();
			expect(finalState.status).toBe("complete");

			for (const sheetId of finalState.validSheets) {
				const tilesPath = getR2Path(
					TEST_ORG_ID,
					TEST_PROJECT_ID,
					testPlanId,
					sheetId,
					"tiles.pmtiles",
				);
				const tilesObj = await env.R2_BUCKET.get(tilesPath);
				expect(tilesObj, `PMTiles not found at ${tilesPath}`).toBeTruthy();
				const tilesBytes = await tilesObj!.arrayBuffer();
				expect(tilesBytes.byteLength).toBeGreaterThan(0);
			}

			const tileEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetTilesGenerated",
			);
			expect(tileEvents.length).toBeGreaterThan(0);
			for (const evt of tileEvents) {
				validateEventData("sheetTilesGenerated", evt.data);
			}
		},
	);

	it("should have valid LiveStore events for the entire pipeline", async () => {
		const allEvents = await getCollectedEvents(TEST_ORG_ID);

		const eventCounts: Record<string, number> = {};
		for (const evt of allEvents) {
			eventCounts[evt.eventName] = (eventCounts[evt.eventName] || 0) + 1;
		}

		for (const evt of allEvents) {
			validateEventData(evt.eventName, evt.data);
		}

		expect(eventCounts.planProcessingStarted).toBeGreaterThanOrEqual(1);
		expect(eventCounts.planProcessingProgress).toBeGreaterThanOrEqual(1);
		expect(eventCounts.sheetImageGenerated).toBeGreaterThanOrEqual(1);

		// Real coordinator emits these events (previously untested)
		expect(eventCounts.planMetadataCompleted).toBeGreaterThanOrEqual(1);

		// planProcessingCompleted is only emitted if validSheets > 0 and pipeline reaches completion
		const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
		const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
		const finalState = await coordinator.getState();
		if (finalState?.status === "complete") {
			expect(eventCounts.planProcessingCompleted).toBeGreaterThanOrEqual(1);
		}
	});
});

describe("Upload endpoint auth validation", () => {
	beforeAll(async () => {
		await seedAuthData();
	});

	it("should reject requests without auth token", async () => {
		const formData = new FormData();
		formData.append("file", new File(["fake"], "test.pdf", { type: "application/pdf" }));
		formData.append("projectId", "proj-1");
		formData.append("organizationId", "org-1");

		const response = await SELF.fetch("http://worker/api/plans/upload", {
			method: "POST",
			body: formData,
		});

		expect(response.status).toBe(401);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("Missing authorization token");
	});

	it("should reject requests with invalid session token", async () => {
		const formData = new FormData();
		formData.append("file", new File(["fake"], "test.pdf", { type: "application/pdf" }));
		formData.append("projectId", "proj-1");
		formData.append("organizationId", "org-1");

		const response = await SELF.fetch("http://worker/api/plans/upload", {
			method: "POST",
			headers: { Authorization: "Bearer invalid-token-xyz" },
			body: formData,
		});

		expect(response.status).toBe(401);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("Invalid or expired session");
	});

	it("should reject non-PDF files", async () => {
		const formData = new FormData();
		formData.append("file", new File(["not a pdf"], "test.txt", { type: "text/plain" }));
		formData.append("projectId", "proj-1");
		formData.append("organizationId", "org-1");

		const response = await SELF.fetch("http://worker/api/plans/upload", {
			method: "POST",
			headers: { Authorization: `Bearer ${TEST_SESSION_TOKEN}` },
			body: formData,
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("File must be a PDF");
	});

	it("should reject requests with missing form fields", async () => {
		const formData = new FormData();
		formData.append("file", new File(["fake"], "test.pdf", { type: "application/pdf" }));
		// Missing projectId and organizationId

		const response = await SELF.fetch("http://worker/api/plans/upload", {
			method: "POST",
			headers: { Authorization: `Bearer ${TEST_SESSION_TOKEN}` },
			body: formData,
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("Missing required fields");
	});
});
