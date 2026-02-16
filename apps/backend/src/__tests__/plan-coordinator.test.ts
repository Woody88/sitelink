import { describe, expect, it, vi } from "vitest";
import {
	handleDocLayoutDetectionQueue,
	handleCalloutDetectionQueue,
} from "../processing/queue-consumer";
import type {
	CalloutDetectionJob,
	DocLayoutDetectionJob,
} from "../processing/types";
import type { Env } from "../types/env";

// PlanCoordinator is a Durable Object — its state machine is tested via
// real DO instances in tests/integration/plan-coordinator.test.ts.
// These unit tests verify coordinator interactions through the queue handlers.

const testOrganizationId = "test-org-123";
const testProjectId = "test-project-456";
const testPlanId = "test-plan-789";

function createMockEnv() {
	const coordinatorFetchCalls: Array<{
		url: string;
		body: Record<string, unknown>;
	}> = [];
	const coordinatorMethodCalls: Array<{
		method: string;
		args: unknown[];
	}> = [];

	const mockEnv: Partial<Env> = {
		R2_BUCKET: {
			get: vi.fn(async (_key: string) => {
				return {
					arrayBuffer: async () => new ArrayBuffer(1024),
					httpMetadata: { contentType: "image/png" },
				};
			}),
		} as any,
		PDF_PROCESSOR: {
			idFromName: vi.fn(() => "container-id"),
			get: vi.fn(() => ({
				startAndWaitForPorts: vi.fn(async () => {}),
				fetch: vi.fn(async (url: string) => {
					if (url.includes("/detect-layout")) {
						return Response.json({
							regions: [
								{
									class: "schedule",
									bbox: [0.1, 0.2, 0.3, 0.4],
									confidence: 0.92,
								},
								{
									class: "notes",
									bbox: [0.5, 0.6, 0.2, 0.3],
									confidence: 0.88,
								},
							],
						});
					}
					if (url.includes("/detect-callouts")) {
						return Response.json({
							markers: [],
							unmatchedCount: 0,
							grid_bubbles: [],
						});
					}
					return Response.json({ error: "Unknown" }, { status: 404 });
				}),
			})),
		} as any,
		PLAN_COORDINATOR_DO: {
			idFromName: vi.fn(() => "coordinator-id"),
			get: vi.fn(() => ({
				sheetCalloutsDetected: vi.fn(async (sheetId: string) => {
					coordinatorMethodCalls.push({
						method: "sheetCalloutsDetected",
						args: [sheetId],
					});
					return { success: true };
				}),
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
				fetch: vi.fn(async () => Response.json({ success: true })),
			})),
		} as any,
	};

	return { mockEnv, coordinatorFetchCalls, coordinatorMethodCalls };
}

describe("PlanCoordinator Interactions via Handlers", () => {
	describe("Callout Detection -> Coordinator", () => {
		it("should notify coordinator via sheetCalloutsDetected method", async () => {
			const { mockEnv, coordinatorMethodCalls } = createMockEnv();

			const job: CalloutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
				sheetNumber: "A1",
				validSheetNumbers: ["A1"],
			};

			const message = {
				body: job,
				ack: vi.fn(),
				retry: vi.fn(),
			};
			const batch = {
				messages: [message],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			expect(message.ack).toHaveBeenCalledTimes(1);
			const call = coordinatorMethodCalls.find(
				(c) => c.method === "sheetCalloutsDetected",
			);
			expect(call).toBeDefined();
			expect(call!.args[0]).toBe("sheet-0");
		});
	});

	describe("DocLayout Detection -> Coordinator", () => {
		it("should notify coordinator via fetch /sheetLayoutDetected", async () => {
			const { mockEnv, coordinatorFetchCalls } = createMockEnv();

			const job: DocLayoutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
				sheetNumber: "A1",
			};

			const message = {
				body: job,
				ack: vi.fn(),
				retry: vi.fn(),
			};
			const batch = {
				messages: [message],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			};

			await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

			const layoutCall = coordinatorFetchCalls.find((c) =>
				c.url.includes("sheetLayoutDetected"),
			);
			expect(layoutCall).toBeDefined();
			expect(layoutCall!.body.sheetId).toBe("sheet-0");
		});

		it("should notify coordinator even on container failure", async () => {
			const coordinatorFetchCalls: Array<{
				url: string;
				body: Record<string, unknown>;
			}> = [];

			const mockEnv: Partial<Env> = {
				R2_BUCKET: {
					get: vi.fn(async () => ({
						arrayBuffer: async () => new ArrayBuffer(1024),
						httpMetadata: { contentType: "image/png" },
					})),
				} as any,
				PDF_PROCESSOR: {
					idFromName: vi.fn(() => "container-id"),
					get: vi.fn(() => ({
						startAndWaitForPorts: vi.fn(async () => {}),
						fetch: vi.fn(async () => {
							throw new Error("Container crashed");
						}),
					})),
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
						fetch: vi.fn(async () => Response.json({ success: true })),
					})),
				} as any,
			};

			const job: DocLayoutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
			};

			const message = {
				body: job,
				ack: vi.fn(),
				retry: vi.fn(),
			};
			const batch = {
				messages: [message],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			};

			await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

			expect(message.ack).toHaveBeenCalledTimes(1);
			expect(message.retry).not.toHaveBeenCalled();

			const layoutCall = coordinatorFetchCalls.find((c) =>
				c.url.includes("sheetLayoutDetected"),
			);
			expect(layoutCall).toBeDefined();
			expect(layoutCall!.body.sheetId).toBe("sheet-0");
		});
	});

	describe("Callout vs Layout Coordinator Interface Difference", () => {
		it("callout detection uses coordinator.sheetCalloutsDetected() method", async () => {
			const { mockEnv, coordinatorMethodCalls } = createMockEnv();

			const job: CalloutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
				validSheetNumbers: ["A1"],
			};

			const message = {
				body: job,
				ack: vi.fn(),
				retry: vi.fn(),
			};
			const batch = {
				messages: [message],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			};

			await handleCalloutDetectionQueue(batch, mockEnv as Env);

			expect(coordinatorMethodCalls).toHaveLength(1);
			expect(coordinatorMethodCalls[0].method).toBe(
				"sheetCalloutsDetected",
			);
		});

		it("layout detection uses coordinator.fetch('/sheetLayoutDetected') HTTP interface", async () => {
			const { mockEnv, coordinatorFetchCalls, coordinatorMethodCalls } =
				createMockEnv();

			const job: DocLayoutDetectionJob = {
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				sheetId: "sheet-0",
			};

			const message = {
				body: job,
				ack: vi.fn(),
				retry: vi.fn(),
			};
			const batch = {
				messages: [message],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			};

			await handleDocLayoutDetectionQueue(batch, mockEnv as Env);

			const layoutFetch = coordinatorFetchCalls.find((c) =>
				c.url.includes("sheetLayoutDetected"),
			);
			expect(layoutFetch).toBeDefined();
			expect(
				coordinatorMethodCalls.filter(
					(c) => c.method === "sheetLayoutDetected",
				),
			).toHaveLength(0);
		});
	});
});
