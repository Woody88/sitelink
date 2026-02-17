import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { handleImageGenerationQueue } from "../../src/processing/queue-consumer";
import { getR2Path } from "../../src/processing/types";
import type { ImageGenerationJob } from "../../src/processing/types";

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

interface CollectedEvent {
	eventName: string;
	data: Record<string, unknown>;
	timestamp: number;
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

const TEST_ORG_ID = "batch-render-test-org";
const TEST_PROJECT_ID = "batch-render-test-project";
const TEST_FIXTURE = "structural-drawings.pdf";

describe("Batch Render: /render-pages endpoint (requires Docker)", () => {
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

	it("should call /render-pages on the container and get valid response", async () => {
		// Load a multi-page PDF fixture
		const pdfResponse = await env.FIXTURE_LOADER!.fetch(
			`http://fixture/${TEST_FIXTURE}`,
		);
		expect(pdfResponse.ok, `Fixture not found: ${TEST_FIXTURE}`).toBe(true);
		const pdfBuffer = await pdfResponse.arrayBuffer();

		// Call /render-pages directly through the proxy
		const containerId = env.PDF_PROCESSOR.idFromName("batch-render-test");
		const container = env.PDF_PROCESSOR.get(containerId) as any;
		await container.startAndWaitForPorts();

		const response = await container.fetch("http://container/render-pages", {
			method: "POST",
			headers: {
				"Content-Type": "application/pdf",
				"X-Plan-Id": "batch-test-plan",
				"X-Page-Numbers": JSON.stringify([1, 2]),
			},
			body: pdfBuffer,
		});

		expect(response.ok, `Batch render failed: ${response.status}`).toBe(true);

		const result = (await response.json()) as {
			pages: Array<{
				pageNumber: number;
				pngBase64: string;
				width: number;
				height: number;
			}>;
		};

		expect(result.pages).toHaveLength(2);

		for (const page of result.pages) {
			expect(page.pageNumber).toBeGreaterThan(0);
			expect(page.width).toBeGreaterThan(0);
			expect(page.height).toBeGreaterThan(0);
			expect(page.pngBase64.length).toBeGreaterThan(0);

			// Decode base64 and verify PNG magic bytes
			const binaryString = atob(page.pngBase64);
			const bytes = new Uint8Array(binaryString.length);
			for (let j = 0; j < binaryString.length; j++) {
				bytes[j] = binaryString.charCodeAt(j);
			}
			// PNG magic bytes: 0x89 0x50 0x4E 0x47
			expect(bytes[0]).toBe(0x89);
			expect(bytes[1]).toBe(0x50); // P
			expect(bytes[2]).toBe(0x4e); // N
			expect(bytes[3]).toBe(0x47); // G
		}
	});

	it("should return 400 for missing X-Plan-Id header", async () => {
		const containerId = env.PDF_PROCESSOR.idFromName("batch-render-test-400");
		const container = env.PDF_PROCESSOR.get(containerId) as any;
		await container.startAndWaitForPorts();

		const response = await container.fetch("http://container/render-pages", {
			method: "POST",
			headers: {
				"Content-Type": "application/pdf",
				"X-Page-Numbers": "[1]",
			},
			body: new ArrayBuffer(10),
		});

		expect(response.status).toBe(400);
	});

	it("should return 400 for missing X-Page-Numbers header", async () => {
		const containerId = env.PDF_PROCESSOR.idFromName("batch-render-test-400b");
		const container = env.PDF_PROCESSOR.get(containerId) as any;
		await container.startAndWaitForPorts();

		const response = await container.fetch("http://container/render-pages", {
			method: "POST",
			headers: {
				"Content-Type": "application/pdf",
				"X-Plan-Id": "test-plan",
			},
			body: new ArrayBuffer(10),
		});

		expect(response.status).toBe(400);
	});
});

describe("Batch Render: Full pipeline uses batched endpoint (requires Docker)", () => {
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
		await resetCollectedEvents(TEST_ORG_ID);
	});

	it(
		"handleImageGenerationQueue renders ALL pages and uploads each to R2",
		{ timeout: 120_000 },
		async () => {
			testPlanId = `batch-pipeline-${Date.now()}`;
			pdfR2Path = `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${testPlanId}/source.pdf`;

			// Upload fixture PDF to R2
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				`http://fixture/${TEST_FIXTURE}`,
			);
			expect(pdfResponse.ok).toBe(true);
			const pdfData = await pdfResponse.arrayBuffer();
			await env.R2_BUCKET.put(pdfR2Path, pdfData, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const job: ImageGenerationJob = {
				planId: testPlanId,
				projectId: TEST_PROJECT_ID,
				organizationId: TEST_ORG_ID,
				pdfPath: pdfR2Path,
				totalPages: 4,
				planName: "structural-drawings",
			};

			const message = createMockMessage(job);
			const batch = createMockBatch([message]);

			await handleImageGenerationQueue(batch, env as any);

			expect(
				message.ackCalled,
				"Image generation failed (message retried, not acked)",
			).toBe(true);
			expect(message.retryCalled).toBe(false);

			// Verify coordinator state
			const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(testPlanId);
			const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId) as any;
			const state = await coordinator.getState();

			expect(state.status).toBe("metadata_extraction");
			expect(state.generatedImages.length).toBeGreaterThan(0);

			// Verify ALL sheet images are in R2
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

				// Verify PNG magic bytes
				const header = new Uint8Array(imageBytes.slice(0, 4));
				expect(header[0]).toBe(0x89);
				expect(header[1]).toBe(0x50); // P
				expect(header[2]).toBe(0x4e); // N
				expect(header[3]).toBe(0x47); // G
			}

			// Verify LiveStore events emitted per sheet
			const imageEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"sheetImageGenerated",
			);
			expect(imageEvents.length).toBe(state.generatedImages.length);

			for (const evt of imageEvents) {
				expect(evt.data).toHaveProperty("sheetId");
				expect(evt.data).toHaveProperty("planId");
				expect(evt.data).toHaveProperty("width");
				expect(evt.data).toHaveProperty("height");
				expect(evt.data).toHaveProperty("generatedAt");
				expect(evt.data.planId).toBe(testPlanId);
			}

			// Verify progress events were emitted
			const progressEvents = await getCollectedEventsByName(
				TEST_ORG_ID,
				"planProcessingProgress",
			);
			expect(progressEvents.length).toBeGreaterThan(0);
		},
	);
});
