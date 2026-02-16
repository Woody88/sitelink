import { describe, expect, it, vi } from "vitest";
import {
	handleDocLayoutDetectionQueue,
	handleCalloutDetectionQueue,
} from "../processing/queue-consumer";
import type {
	CalloutDetectionJob,
	DocLayoutDetectionJob,
	ImageGenerationJob,
} from "../processing/types";
import { getR2Path } from "../processing/types";
import type { Env } from "../types/env";

interface MockMessage<T> {
	body: T;
	ack: ReturnType<typeof vi.fn>;
	retry: ReturnType<typeof vi.fn>;
}

function createMockMessage<T>(body: T): MockMessage<T> {
	return {
		body,
		ack: vi.fn(),
		retry: vi.fn(),
	};
}

function createMockBatch<T>(messages: MockMessage<T>[]): MessageBatch<T> {
	return {
		messages,
		queue: "test-queue",
		ackAll: vi.fn(),
		retryAll: vi.fn(),
	};
}

const testOrganizationId = "test-org-123";
const testProjectId = "test-project-456";
const testPlanId = "test-plan-789";
const testSheetId = "sheet-0";

function createMockEnvForDocLayout(options?: {
	containerResponse?: Response;
	containerShouldThrow?: boolean;
	r2HasImage?: boolean;
}) {
	const coordinatorFetchCalls: Array<{
		url: string;
		body: Record<string, unknown>;
	}> = [];
	const liveStoreRequests: Array<{
		url: string;
		body: Record<string, unknown>;
	}> = [];

	const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
	if (options?.r2HasImage !== false) {
		const imagePath = getR2Path(
			testOrganizationId,
			testProjectId,
			testPlanId,
			testSheetId,
			"source.png",
		);
		r2Objects.set(imagePath, {
			data: new ArrayBuffer(1024),
			metadata: { httpMetadata: { contentType: "image/png" } },
		});
	}

	const mockContainer = {
		startAndWaitForPorts: vi.fn(async () => {}),
		fetch: vi.fn(async (_url: string) => {
			if (options?.containerShouldThrow) {
				throw new Error("Container crashed");
			}
			return (
				options?.containerResponse ??
				Response.json({
					regions: [
						{
							class: "schedule",
							bbox: [0.1, 0.2, 0.3, 0.4],
							confidence: 0.92,
						},
					],
				})
			);
		}),
	};

	const mockEnv: Partial<Env> = {
		R2_BUCKET: {
			get: vi.fn(async (key: string) => {
				const obj = r2Objects.get(key);
				if (!obj) return null;
				return {
					arrayBuffer: async () => obj.data,
					text: async () => new TextDecoder().decode(obj.data),
					httpMetadata: obj.metadata?.httpMetadata,
				};
			}),
		} as any,
		PDF_PROCESSOR: {
			idFromName: vi.fn(() => "container-id"),
			get: vi.fn(() => mockContainer),
		} as any,
		PLAN_COORDINATOR_DO: {
			idFromName: vi.fn(() => "coordinator-id"),
			get: vi.fn(() => ({
				fetch: vi.fn(async (url: string, init?: RequestInit) => {
					const body = init?.body
						? JSON.parse(init.body as string)
						: {};
					coordinatorFetchCalls.push({ url, body });
					return Response.json({ success: true });
				}),
			})),
		} as any,
		LIVESTORE_CLIENT_DO: {
			idFromName: vi.fn(() => "livestore-id"),
			get: vi.fn(() => ({
				fetch: vi.fn(async (url: string, init?: RequestInit) => {
					const body = init?.body
						? JSON.parse(init.body as string)
						: {};
					liveStoreRequests.push({ url, body });
					return Response.json({ success: true });
				}),
			})),
		} as any,
	};

	return {
		mockEnv,
		mockContainer,
		coordinatorFetchCalls,
		liveStoreRequests,
	};
}

describe("Queue Message Format Validation", () => {
	it("should validate ImageGenerationJob includes planName", () => {
		const job: ImageGenerationJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			pdfPath:
				"organizations/org-789/projects/project-456/plans/plan-123/source.pdf",
			totalPages: 10,
			planName: "sample-plan",
		};

		expect(job).toHaveProperty("planName");
		expect(typeof job.planName).toBe("string");
	});

	it("should validate CalloutDetectionJob uses validSheetNumbers", () => {
		const job: CalloutDetectionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: "sheet-001",
			sheetNumber: "A1",
			validSheetNumbers: ["A1", "A3", "S1"],
		};

		expect(job).toHaveProperty("validSheetNumbers");
		expect(job).toHaveProperty("sheetNumber");
		expect(Array.isArray(job.validSheetNumbers)).toBe(true);
	});

	it("should validate DocLayoutDetectionJob message structure", () => {
		const job: DocLayoutDetectionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: "sheet-001",
			sheetNumber: "A1",
		};

		expect(job).toHaveProperty("planId");
		expect(job).toHaveProperty("sheetId");
		expect(job).toHaveProperty("sheetNumber");
	});
});

describe("R2 Path Generation", () => {
	it("should generate correct base plan path", () => {
		const path = getR2Path("org-123", "proj-456", "plan-789");
		expect(path).toBe("organizations/org-123/projects/proj-456/plans/plan-789");
	});

	it("should generate correct sheet image path", () => {
		const path = getR2Path(
			"org-123",
			"proj-456",
			"plan-789",
			"sheet-001",
			"source.png",
		);
		expect(path).toBe(
			"organizations/org-123/projects/proj-456/plans/plan-789/sheets/sheet-001/source.png",
		);
	});
});

describe("DocLayout Detection Handler (Real Handler)", () => {
	it("should call container /detect-layout and ACK on success", async () => {
		const { mockEnv, mockContainer } =
			createMockEnvForDocLayout();

		const job: DocLayoutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
			sheetNumber: "A1",
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

		expect(message.ack).toHaveBeenCalledTimes(1);
		expect(message.retry).not.toHaveBeenCalled();
		expect(mockContainer.fetch).toHaveBeenCalledTimes(1);

		const containerCall = mockContainer.fetch.mock.calls[0][0] as string;
		expect(containerCall).toContain("/detect-layout");
	});

	it("should notify coordinator via fetch on success", async () => {
		const { mockEnv, coordinatorFetchCalls } =
			createMockEnvForDocLayout();

		const job: DocLayoutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

		const coordinatorCall = coordinatorFetchCalls.find((c) =>
			c.url.includes("sheetLayoutDetected"),
		);
		expect(coordinatorCall).toBeDefined();
		expect(coordinatorCall!.body.sheetId).toBe(testSheetId);
	});

	it("should emit sheetLayoutRegionsDetected LiveStore event", async () => {
		const { mockEnv, liveStoreRequests } = createMockEnvForDocLayout();

		const job: DocLayoutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

		const liveStoreEvent = liveStoreRequests.find(
			(r) => r.body.eventName === "sheetLayoutRegionsDetected",
		);
		expect(liveStoreEvent).toBeDefined();
		expect(liveStoreEvent!.body.data.sheetId).toBe(testSheetId);
		expect(liveStoreEvent!.body.data.regions).toHaveLength(1);
		expect(liveStoreEvent!.body.data.regions[0].regionClass).toBe("schedule");
	});

	it("should ACK (not retry) on container failure", async () => {
		const { mockEnv } = createMockEnvForDocLayout({
			containerShouldThrow: true,
		});

		const job: DocLayoutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

		expect(message.ack).toHaveBeenCalledTimes(1);
		expect(message.retry).not.toHaveBeenCalled();
	});

	it("should still notify coordinator even on container failure", async () => {
		const { mockEnv, coordinatorFetchCalls } = createMockEnvForDocLayout({
			containerShouldThrow: true,
		});

		const job: DocLayoutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

		const coordinatorCall = coordinatorFetchCalls.find((c) =>
			c.url.includes("sheetLayoutDetected"),
		);
		expect(coordinatorCall).toBeDefined();
		expect(coordinatorCall!.body.sheetId).toBe(testSheetId);
	});

	it("should ACK on container HTTP error (500)", async () => {
		const { mockEnv } = createMockEnvForDocLayout({
			containerResponse: Response.json(
				{ error: "Model not loaded" },
				{ status: 500 },
			),
		});

		const job: DocLayoutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

		expect(message.ack).toHaveBeenCalledTimes(1);
		expect(message.retry).not.toHaveBeenCalled();
	});
});

describe("Callout Detection Handler - Grid Bubbles (Real Handler)", () => {
	it("should emit grid bubbles event when container returns grid_bubbles", async () => {
		const liveStoreRequests: Array<{
			url: string;
			body: Record<string, unknown>;
		}> = [];

		const r2Objects = new Map<string, { data: ArrayBuffer; metadata: any }>();
		const imagePath = getR2Path(
			testOrganizationId,
			testProjectId,
			testPlanId,
			testSheetId,
			"source.png",
		);
		r2Objects.set(imagePath, {
			data: new ArrayBuffer(1024),
			metadata: {},
		});

		const mockEnv: Partial<Env> = {
			R2_BUCKET: {
				get: vi.fn(async (key: string) => {
					const obj = r2Objects.get(key);
					if (!obj) return null;
					return {
						arrayBuffer: async () => obj.data,
						httpMetadata: obj.metadata?.httpMetadata,
					};
				}),
			} as any,
			PDF_PROCESSOR: {
				idFromName: vi.fn(() => "container-id"),
				get: vi.fn(() => ({
					startAndWaitForPorts: vi.fn(async () => {}),
					fetch: vi.fn(async () =>
						Response.json({
							markers: [
								{
									id: "m1",
									label: "1",
									x: 100,
									y: 200,
									confidence: 0.95,
									needsReview: false,
								},
							],
							unmatchedCount: 0,
							grid_bubbles: [
								{
									label: "A",
									x: 50,
									y: 50,
									width: 30,
									height: 30,
									confidence: 0.88,
								},
								{
									label: "B",
									x: 800,
									y: 50,
									width: 30,
									height: 30,
									confidence: 0.91,
								},
							],
						}),
					),
				})),
			} as any,
			PLAN_COORDINATOR_DO: {
				idFromName: vi.fn(() => "coordinator-id"),
				get: vi.fn(() => ({
					sheetCalloutsDetected: vi.fn(async () => ({ success: true })),
				})),
			} as any,
			LIVESTORE_CLIENT_DO: {
				idFromName: vi.fn(() => "livestore-id"),
				get: vi.fn(() => ({
					fetch: vi.fn(async (url: string, init?: RequestInit) => {
						const body = init?.body
							? JSON.parse(init.body as string)
							: {};
						liveStoreRequests.push({ url, body });
						return Response.json({ success: true });
					}),
				})),
			} as any,
		};

		const job: CalloutDetectionJob = {
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			sheetId: testSheetId,
			sheetNumber: "A1",
			validSheetNumbers: ["A1"],
		};

		const message = createMockMessage(job);
		const batch = createMockBatch([message]);

		await handleCalloutDetectionQueue(batch, mockEnv as Env);

		expect(message.ack).toHaveBeenCalledTimes(1);

		const gridBubbleEvent = liveStoreRequests.find(
			(r) => r.body.eventName === "sheetGridBubblesDetected",
		);
		expect(gridBubbleEvent).toBeDefined();
		expect(gridBubbleEvent!.body.data.bubbles).toHaveLength(2);
		expect(gridBubbleEvent!.body.data.bubbles[0].label).toBe("A");
		expect(gridBubbleEvent!.body.data.bubbles[1].label).toBe("B");
	});
});

describe("Parallel Job Creation Logic", () => {
	it("should create matching callout and DocLayout jobs for same sheets", () => {
		const validSheets = [
			{ sheetId: "sheet-0", sheetNumber: "A1" },
			{ sheetId: "sheet-2", sheetNumber: "S1" },
		];
		const validSheetNumbers = validSheets.map((s) => s.sheetNumber);

		const calloutJobs: CalloutDetectionJob[] = validSheets.map((sheet) => ({
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: sheet.sheetId,
			sheetNumber: sheet.sheetNumber,
			validSheetNumbers,
		}));

		const docLayoutJobs: DocLayoutDetectionJob[] = validSheets.map(
			(sheet) => ({
				planId: "plan-123",
				projectId: "project-456",
				organizationId: "org-789",
				sheetId: sheet.sheetId,
				sheetNumber: sheet.sheetNumber,
			}),
		);

		expect(calloutJobs).toHaveLength(2);
		expect(docLayoutJobs).toHaveLength(2);

		for (let i = 0; i < validSheets.length; i++) {
			expect(calloutJobs[i].sheetId).toBe(docLayoutJobs[i].sheetId);
			expect(calloutJobs[i].sheetNumber).toBe(docLayoutJobs[i].sheetNumber);
			expect(calloutJobs[i].planId).toBe(docLayoutJobs[i].planId);
		}
	});
});
