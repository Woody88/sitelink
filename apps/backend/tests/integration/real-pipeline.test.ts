import { SELF, env, applyD1Migrations } from "cloudflare:test";
import { describe, expect, it, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Event schema shapes — mirrors packages/domain/src/events.ts
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

// ---------------------------------------------------------------------------
// Integration tests (require Docker container on port 3001)
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
