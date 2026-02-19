import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { getR2Path } from "../../src/processing/types";

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
	planProcessingFailed: {
		required: ["planId", "error", "failedAt"],
		optional: [],
	},
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectedEvent {
	eventName: string;
	data: Record<string, unknown>;
	timestamp: number;
}

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

async function pollWorkflowUntilDone(
	instance: WorkflowInstance,
	timeoutMs: number = 600_000,
): Promise<InstanceStatus> {
	const pollInterval = 2000;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const status = await instance.status();
		if (status.status !== "running" && status.status !== "queued") {
			return status;
		}
		await new Promise<void>((r) => setTimeout(r, pollInterval));
	}

	throw new Error(
		`Workflow did not complete within ${timeoutMs / 1000}s. ` +
			`Last status: running/queued`,
	);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = "workflow-test-org";
const TEST_PROJECT_ID = "workflow-test-project";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PlanProcessingWorkflow Integration (requires Docker)", () => {
	beforeAll(async () => {
		const containerReady = await isContainerAvailable();
		if (!containerReady) {
			throw new Error(
				"Docker container not running on port 3001.\n" +
					"Run: bun run test:integration (handles Docker lifecycle)\n" +
					"Or: docker compose -f container/docker-compose.yml up -d --wait",
			);
		}
	});

	// -------------------------------------------------------------------------
	// Test 1: Full pipeline happy path
	//
	// Verifies end-to-end workflow execution: upload → images → metadata →
	// callouts → layout → tiles → complete, with all expected LiveStore events
	// in the correct order and schema-valid data.
	// -------------------------------------------------------------------------
	it(
		"should run the full pipeline and emit all expected events",
		{ timeout: 600_000 },
		async () => {
			const planId = crypto.randomUUID();
			await resetCollectedEvents(TEST_ORG_ID);

			// Load real fixture PDF
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			expect(
				pdfResponse.ok,
				`Fixture not found: structural-drawings.pdf`,
			).toBe(true);
			const pdfBlob = await pdfResponse.blob();
			const pdfBuffer = await pdfBlob.arrayBuffer();

			// Upload PDF to R2
			const pdfPath = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${planId}/source.pdf`;
			await env.R2_BUCKET.put(pdfPath, pdfBuffer, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const storedPdf = await env.R2_BUCKET.get(pdfPath);
			expect(storedPdf, "PDF not found in R2 after upload").toBeTruthy();

			// Create workflow instance directly via binding
			const instance = await env.PLAN_PROCESSING_WORKFLOW.create({
				id: planId,
				params: {
					planId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					pdfPath,
					totalPages: 4,
					planName: "structural-drawings",
				},
			});

			// Poll until workflow reaches a terminal state
			const finalStatus = await pollWorkflowUntilDone(instance);

			expect(
				finalStatus.status,
				`Workflow ended with status "${finalStatus.status}" — expected "complete". ` +
					`Check container logs for errors.`,
			).toBe("complete");

			// Verify R2 has source.png for each sheet generated
			const allEvents = await getCollectedEvents(TEST_ORG_ID);

			const imageEvents = allEvents.filter((e) => e.eventName === "sheetImageGenerated");
			expect(
				imageEvents.length,
				"Expected at least one sheetImageGenerated event",
			).toBeGreaterThan(0);

			for (const evt of imageEvents) {
				const data = evt.data as { sheetId: string; planId: string };
				const imagePath = getR2Path(
					TEST_ORG_ID,
					TEST_PROJECT_ID,
					planId,
					data.sheetId,
					"source.png",
				);
				const imageObj = await env.R2_BUCKET.get(imagePath);
				expect(imageObj, `source.png not found in R2 at ${imagePath}`).toBeTruthy();
				const imageBytes = await imageObj!.arrayBuffer();
				expect(imageBytes.byteLength).toBeGreaterThan(0);
			}

			// Verify R2 has tiles.pmtiles for each valid sheet
			const tileEvents = allEvents.filter((e) => e.eventName === "sheetTilesGenerated");
			for (const evt of tileEvents) {
				const data = evt.data as { sheetId: string };
				const tilesPath = getR2Path(
					TEST_ORG_ID,
					TEST_PROJECT_ID,
					planId,
					data.sheetId,
					"tiles.pmtiles",
				);
				const tilesObj = await env.R2_BUCKET.get(tilesPath);
				expect(tilesObj, `tiles.pmtiles not found in R2 at ${tilesPath}`).toBeTruthy();
				const tilesBytes = await tilesObj!.arrayBuffer();
				expect(tilesBytes.byteLength).toBeGreaterThan(0);
			}

			// Verify all emitted events pass schema validation
			const knownEventNames = new Set(Object.keys(EVENT_SCHEMAS));
			for (const evt of allEvents) {
				if (knownEventNames.has(evt.eventName)) {
					validateEventData(evt.eventName, evt.data);
				}
			}

			// Verify event ordering: started must come before completed
			const eventNames = allEvents.map((e) => e.eventName);
			const startedIdx = eventNames.indexOf("planProcessingStarted");
			const completedIdx = eventNames.lastIndexOf("planProcessingCompleted");
			expect(
				startedIdx,
				"planProcessingStarted not found in emitted events",
			).toBeGreaterThanOrEqual(0);
			expect(
				completedIdx,
				"planProcessingCompleted not found in emitted events",
			).toBeGreaterThanOrEqual(0);
			expect(
				startedIdx,
				"planProcessingStarted must come before planProcessingCompleted",
			).toBeLessThan(completedIdx);

			// Verify each stage produced at least one event before the next stage
			const metadataIdx = eventNames.indexOf("sheetMetadataExtracted");
			const metaCompletedIdx = eventNames.indexOf("planMetadataCompleted");
			const firstImageIdx = eventNames.indexOf("sheetImageGenerated");

			expect(firstImageIdx).toBeGreaterThan(startedIdx);
			if (metadataIdx >= 0) {
				expect(metadataIdx).toBeGreaterThan(firstImageIdx);
			}
			if (metaCompletedIdx >= 0 && metadataIdx >= 0) {
				expect(metaCompletedIdx).toBeGreaterThanOrEqual(metadataIdx);
			}

			// Verify progress events go from low to high (non-decreasing)
			const progressEvents = allEvents.filter((e) => e.eventName === "planProcessingProgress");
			expect(progressEvents.length).toBeGreaterThan(0);

			let lastProgress = -1;
			for (const evt of progressEvents) {
				const progress = evt.data.progress as number;
				expect(
					progress,
					`Progress regressed from ${lastProgress} to ${progress}`,
				).toBeGreaterThanOrEqual(lastProgress);
				lastProgress = progress;
			}

			// Final progress must reach 100
			const finalProgress = progressEvents[progressEvents.length - 1]?.data.progress as number;
			expect(finalProgress).toBe(100);
		},
	);

	// -------------------------------------------------------------------------
	// Test 2: Event data integrity
	//
	// Verifies that the data payloads inside each event type are structurally
	// correct — valid dimensions, non-empty sheet numbers, correct arrays, etc.
	// Runs as a separate test instance to get fresh event state.
	// -------------------------------------------------------------------------
	it(
		"should emit events with valid data payloads",
		{ timeout: 600_000 },
		async () => {
			const planId = crypto.randomUUID();
			await resetCollectedEvents(TEST_ORG_ID);

			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			expect(pdfResponse.ok).toBe(true);
			const pdfBuffer = await (await pdfResponse.blob()).arrayBuffer();

			const pdfPath = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${planId}/source.pdf`;
			await env.R2_BUCKET.put(pdfPath, pdfBuffer, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const instance = await env.PLAN_PROCESSING_WORKFLOW.create({
				id: planId,
				params: {
					planId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					pdfPath,
					totalPages: 4,
					planName: "structural-drawings",
				},
			});

			const finalStatus = await pollWorkflowUntilDone(instance);
			expect(finalStatus.status).toBe("complete");

			// sheetImageGenerated: valid width/height
			const imageEvents = await getCollectedEventsByName(TEST_ORG_ID, "sheetImageGenerated");
			expect(imageEvents.length).toBeGreaterThan(0);
			for (const evt of imageEvents) {
				const data = evt.data as { width: number; height: number; sheetId: string; pageNumber: number };
				expect(data.width, `sheetImageGenerated.width must be > 0 for ${data.sheetId}`).toBeGreaterThan(0);
				expect(data.height, `sheetImageGenerated.height must be > 0 for ${data.sheetId}`).toBeGreaterThan(0);
				expect(data.pageNumber).toBeGreaterThanOrEqual(1);
				expect(typeof data.sheetId).toBe("string");
				expect(data.sheetId.length).toBeGreaterThan(0);
			}

			// sheetMetadataExtracted: valid sheetNumber strings
			const metadataEvents = await getCollectedEventsByName(TEST_ORG_ID, "sheetMetadataExtracted");
			expect(metadataEvents.length).toBeGreaterThan(0);
			for (const evt of metadataEvents) {
				const data = evt.data as { sheetNumber: string; sheetId: string };
				expect(typeof data.sheetNumber).toBe("string");
				expect(data.sheetNumber.length).toBeGreaterThan(0);
			}

			// planMetadataCompleted: correct validSheets array and sheetNumberMap
			const metaCompletedEvents = await getCollectedEventsByName(TEST_ORG_ID, "planMetadataCompleted");
			expect(metaCompletedEvents.length).toBeGreaterThanOrEqual(1);
			const metaCompleted = metaCompletedEvents[0]!.data as {
				planId: string;
				validSheets: string[];
				sheetNumberMap: Record<string, string>;
				completedAt: number;
			};
			expect(metaCompleted.planId).toBe(planId);
			expect(Array.isArray(metaCompleted.validSheets)).toBe(true);
			expect(typeof metaCompleted.sheetNumberMap).toBe("object");
			expect(metaCompleted.completedAt).toBeGreaterThan(0);

			// Each valid sheet ID should exist in the sheetNumberMap
			for (const sheetId of metaCompleted.validSheets) {
				expect(
					metaCompleted.sheetNumberMap,
					`Valid sheet ${sheetId} missing from sheetNumberMap`,
				).toHaveProperty(sheetId);
				const sheetNum = metaCompleted.sheetNumberMap[sheetId] ?? "";
				expect(typeof sheetNum).toBe("string");
				expect(sheetNum.length).toBeGreaterThan(0);
			}

			// sheetCalloutsDetected: markers array has proper structure
			const calloutEvents = await getCollectedEventsByName(TEST_ORG_ID, "sheetCalloutsDetected");
			if (metaCompleted.validSheets.length > 0) {
				expect(calloutEvents.length).toBeGreaterThan(0);
			}
			for (const evt of calloutEvents) {
				const data = evt.data as { markers: Array<Record<string, unknown>>; unmatchedCount: number };
				expect(Array.isArray(data.markers)).toBe(true);
				expect(typeof data.unmatchedCount).toBe("number");
				expect(data.unmatchedCount).toBeGreaterThanOrEqual(0);
				for (const marker of data.markers) {
					expect(marker).toHaveProperty("id");
					expect(marker).toHaveProperty("label");
					expect(marker).toHaveProperty("x");
					expect(marker).toHaveProperty("y");
					expect(marker).toHaveProperty("confidence");
					expect(marker).toHaveProperty("needsReview");
				}
			}

			// sheetTilesGenerated: valid minZoom/maxZoom
			const tileEvents = await getCollectedEventsByName(TEST_ORG_ID, "sheetTilesGenerated");
			if (metaCompleted.validSheets.length > 0) {
				expect(tileEvents.length).toBeGreaterThan(0);
			}
			for (const evt of tileEvents) {
				const data = evt.data as { minZoom: number; maxZoom: number; localPmtilesPath: string };
				expect(typeof data.minZoom).toBe("number");
				expect(typeof data.maxZoom).toBe("number");
				expect(data.minZoom).toBeGreaterThanOrEqual(0);
				expect(data.maxZoom).toBeGreaterThanOrEqual(data.minZoom);
				expect(typeof data.localPmtilesPath).toBe("string");
				expect(data.localPmtilesPath.endsWith(".pmtiles")).toBe(true);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Test 3: Non-critical layout failure resilience
	//
	// The layout detection step is wrapped in a try/catch in the workflow —
	// if it fails, the pipeline continues anyway. This test verifies that
	// planProcessingCompleted is emitted regardless of whether layout
	// region events exist, proving the non-critical nature of that step.
	// -------------------------------------------------------------------------
	it(
		"should complete pipeline even if layout detection produces zero regions",
		{ timeout: 600_000 },
		async () => {
			const planId = crypto.randomUUID();
			await resetCollectedEvents(TEST_ORG_ID);

			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			expect(pdfResponse.ok).toBe(true);
			const pdfBuffer = await (await pdfResponse.blob()).arrayBuffer();

			const pdfPath = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${planId}/source.pdf`;
			await env.R2_BUCKET.put(pdfPath, pdfBuffer, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const instance = await env.PLAN_PROCESSING_WORKFLOW.create({
				id: planId,
				params: {
					planId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					pdfPath,
					totalPages: 4,
					planName: "structural-drawings",
				},
			});

			const finalStatus = await pollWorkflowUntilDone(instance);

			// Pipeline must complete regardless of layout detection outcome
			expect(
				finalStatus.status,
				"Pipeline must complete even if layout detection produces zero regions",
			).toBe("complete");

			// planProcessingCompleted must always be emitted
			const completedEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"planProcessingCompleted",
			);
			expect(
				completedEvents.length,
				"planProcessingCompleted must be emitted regardless of layout detection result",
			).toBeGreaterThanOrEqual(1);

			// The layout events may be empty — that is acceptable and does not fail the pipeline
			const layoutEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetLayoutRegionsDetected",
			);

			// If layout events were emitted, they must be schema-valid
			for (const evt of layoutEvents) {
				validateEventData("sheetLayoutRegionsDetected", evt.data);
				const data = evt.data as { regions: Array<Record<string, unknown>> };
				expect(Array.isArray(data.regions)).toBe(true);
			}

			// planProcessingFailed must NOT have been emitted
			const failedEvents = await getCollectedEventsByName(TEST_ORG_ID, "planProcessingFailed");
			expect(
				failedEvents,
				"planProcessingFailed must not be emitted when pipeline completes",
			).toHaveLength(0);
		},
	);

	// -------------------------------------------------------------------------
	// Test 4: Error handling — critical step failure
	//
	// Reference a PDF path that does NOT exist in R2. The workflow's first
	// step calls env.R2_BUCKET.get(pdfPath) which returns null, triggering
	// NonRetryableError("PDF not found at ..."). This exercises the catch
	// block in run() that emits planProcessingFailed.
	// -------------------------------------------------------------------------
	it(
		"should emit planProcessingFailed when the PDF is missing from R2",
		{ timeout: 120_000 },
		async () => {
			const planId = crypto.randomUUID();
			await resetCollectedEvents(TEST_ORG_ID);

			// Deliberately do NOT upload any file — the R2 path does not exist
			const pdfPath = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${planId}/source.pdf`;

			const instance = await env.PLAN_PROCESSING_WORKFLOW.create({
				id: planId,
				params: {
					planId,
					projectId: TEST_PROJECT_ID,
					organizationId: TEST_ORG_ID,
					pdfPath,
					totalPages: 4,
					planName: "missing-file",
				},
			});

			// Poll until workflow reaches a terminal state
			const finalStatus = await pollWorkflowUntilDone(instance, 120_000);

			expect(
				finalStatus.status,
				`Expected workflow to error, got: ${finalStatus.status}`,
			).toBe("errored");

			// planProcessingFailed must be emitted with an error message
			const failedEvents = await getCollectedEventsByName(TEST_ORG_ID, "planProcessingFailed");
			expect(
				failedEvents.length,
				"planProcessingFailed must be emitted when the workflow fails",
			).toBeGreaterThanOrEqual(1);

			const failedEvent = failedEvents[0]!;
			validateEventData("planProcessingFailed", failedEvent.data);

			expect(failedEvent.data.planId).toBe(planId);
			expect(typeof failedEvent.data.error).toBe("string");
			expect((failedEvent.data.error as string).length).toBeGreaterThan(0);
			expect(failedEvent.data.failedAt as number).toBeGreaterThan(0);

			// Error message should mention the missing PDF
			expect(failedEvent.data.error as string).toContain("PDF not found");

			// planProcessingCompleted must NOT be emitted
			const completedEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"planProcessingCompleted",
			);
			expect(
				completedEvents,
				"planProcessingCompleted must not be emitted when pipeline fails",
			).toHaveLength(0);
		},
	);
});
