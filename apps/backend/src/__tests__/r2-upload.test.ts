import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	handleR2NotificationQueue,
	parseR2EventPath,
	type R2EventNotification,
	simulateR2Notification,
	uploadPdfAndTriggerPipeline,
} from "../processing/r2-with-notifications";
import type { Env } from "../types/env";

interface MockMessage<T> {
	body: T;
	ack: () => void;
	retry: () => void;
}

describe("R2 Upload Functionality", () => {
	const testOrganizationId = "test-org-123";
	const testProjectId = "test-project-456";
	const testPlanId = "test-plan-789";
	let mockEnv: Partial<Env>;
	let uploadedObjects: Map<string, { data: ArrayBuffer; metadata: any }>;
	let queuedMessages: any[];
	let r2NotificationMessages: any[];

	beforeEach(() => {
		uploadedObjects = new Map();
		queuedMessages = [];
		r2NotificationMessages = [];

		mockEnv = {
			R2_BUCKET: {
				put: vi.fn(async (key: string, data: ArrayBuffer, options?: any) => {
					uploadedObjects.set(key, { data, metadata: options });
					return {};
				}),
				get: vi.fn(async (key: string) => {
					const obj = uploadedObjects.get(key);
					if (!obj) return null;
					return {
						arrayBuffer: async () => obj.data,
						text: async () => new TextDecoder().decode(obj.data),
						httpMetadata: obj.metadata?.httpMetadata,
						customMetadata: obj.metadata?.customMetadata,
					};
				}),
				delete: vi.fn(async () => {}),
				list: vi.fn(async () => ({
					objects: Array.from(uploadedObjects.keys()).map((key) => ({ key })),
				})),
			} as any,
			IMAGE_GENERATION_QUEUE: {
				send: vi.fn(async (message: any) => {
					queuedMessages.push(message);
				}),
			} as any,
			R2_NOTIFICATION_QUEUE: {
				send: vi.fn(async (message: any) => {
					r2NotificationMessages.push(message);
				}),
			} as any,
		};
	});

	it("should upload PDF to R2 bucket with correct metadata", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const pdfData = new TextEncoder().encode("fake pdf content");

		await uploadPdfAndTriggerPipeline(
			mockEnv as Env,
			pdfPath,
			pdfData.buffer as ArrayBuffer,
			{
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				totalPages: 5,
			},
		);

		expect(mockEnv.R2_BUCKET?.put).toHaveBeenCalled();
		const uploadedFile = uploadedObjects.get(pdfPath);
		expect(uploadedFile).toBeTruthy();
		expect(uploadedFile?.metadata?.httpMetadata?.contentType).toBe(
			"application/pdf",
		);
		expect(uploadedFile?.metadata?.customMetadata?.planId).toBe(testPlanId);
		expect(uploadedFile?.metadata?.customMetadata?.projectId).toBe(
			testProjectId,
		);
		expect(uploadedFile?.metadata?.customMetadata?.organizationId).toBe(
			testOrganizationId,
		);
	});

	it("should verify uploaded file content matches input", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const testContent = "test pdf binary data";
		const pdfData = new TextEncoder().encode(testContent);

		await uploadPdfAndTriggerPipeline(
			mockEnv as Env,
			pdfPath,
			pdfData.buffer as ArrayBuffer,
			{
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				totalPages: 3,
			},
		);

		const retrieved = await mockEnv.R2_BUCKET?.get(pdfPath);
		const retrievedText = await retrieved?.text();
		expect(retrievedText).toBe(testContent);
	});

	it("should trigger R2_NOTIFICATION_QUEUE after upload", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const pdfData = new TextEncoder().encode("fake pdf content");

		await uploadPdfAndTriggerPipeline(
			mockEnv as Env,
			pdfPath,
			pdfData.buffer as ArrayBuffer,
			{
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				totalPages: 5,
			},
		);

		expect(mockEnv.R2_NOTIFICATION_QUEUE?.send).toHaveBeenCalledTimes(1);
		expect(r2NotificationMessages).toHaveLength(1);
		expect(r2NotificationMessages[0]).toMatchObject({
			account: "simulated",
			bucket: "sitelink-files",
			object: {
				key: pdfPath,
			},
			action: "PutObject",
		});
		expect(r2NotificationMessages[0].eventTime).toBeDefined();
	});
});

describe("R2 Path Parser", () => {
	it("should correctly parse valid R2 event path", () => {
		const result = parseR2EventPath(
			"organizations/org-123/projects/proj-456/plans/plan-789/source.pdf",
		);

		expect(result).not.toBeNull();
		expect(result?.organizationId).toBe("org-123");
		expect(result?.projectId).toBe("proj-456");
		expect(result?.planId).toBe("plan-789");
	});

	it("should return null for invalid path format", () => {
		expect(parseR2EventPath("invalid/path.pdf")).toBeNull();
		expect(parseR2EventPath("organizations/org/source.pdf")).toBeNull();
		expect(parseR2EventPath("")).toBeNull();
	});

	it("should handle paths with special characters in IDs", () => {
		const result = parseR2EventPath(
			"organizations/org_123-abc/projects/proj_456-def/plans/plan_789-ghi/source.pdf",
		);

		expect(result).not.toBeNull();
		expect(result?.organizationId).toBe("org_123-abc");
		expect(result?.projectId).toBe("proj_456-def");
		expect(result?.planId).toBe("plan_789-ghi");
	});
});

describe("R2 Notification Queue", () => {
	const testOrganizationId = "test-org-123";
	const testProjectId = "test-project-456";
	const testPlanId = "test-plan-789";
	let mockEnv: Partial<Env>;
	let r2NotificationMessages: any[];

	beforeEach(() => {
		r2NotificationMessages = [];

		mockEnv = {
			R2_BUCKET: {
				put: vi.fn(async () => ({})),
			} as any,
			R2_NOTIFICATION_QUEUE: {
				send: vi.fn(async (message: any) => {
					r2NotificationMessages.push(message);
				}),
			} as any,
		};
	});

	it("should send R2 notification to R2_NOTIFICATION_QUEUE on upload", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const pdfData = new TextEncoder().encode("fake pdf content");

		await uploadPdfAndTriggerPipeline(
			mockEnv as Env,
			pdfPath,
			pdfData.buffer as ArrayBuffer,
			{
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				totalPages: 5,
			},
		);

		expect(mockEnv.R2_NOTIFICATION_QUEUE?.send).toHaveBeenCalledTimes(1);
		expect(r2NotificationMessages).toHaveLength(1);
	});

	it("should format R2 notification correctly", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const pdfData = new TextEncoder().encode("fake pdf content");

		await uploadPdfAndTriggerPipeline(
			mockEnv as Env,
			pdfPath,
			pdfData.buffer as ArrayBuffer,
			{
				planId: testPlanId,
				projectId: testProjectId,
				organizationId: testOrganizationId,
				totalPages: 5,
			},
		);

		const notification = r2NotificationMessages[0];
		expect(notification).toHaveProperty("account");
		expect(notification).toHaveProperty("bucket");
		expect(notification).toHaveProperty("object");
		expect(notification).toHaveProperty("action");
		expect(notification).toHaveProperty("eventTime");

		expect(notification.object).toHaveProperty("key", pdfPath);
		expect(notification.object).toHaveProperty("size", pdfData.byteLength);
		expect(notification.object).toHaveProperty("eTag");
		expect(notification.action).toBe("PutObject");
	});
});

describe("simulateR2Notification", () => {
	let mockEnv: Partial<Env>;
	let r2NotificationMessages: any[];

	beforeEach(() => {
		r2NotificationMessages = [];

		mockEnv = {
			R2_NOTIFICATION_QUEUE: {
				send: vi.fn(async (message: any) => {
					r2NotificationMessages.push(message);
				}),
			} as any,
		};
	});

	it("should create valid R2 notification event", async () => {
		const pdfPath = "organizations/org-123/projects/proj-456/plans/plan-789/source.pdf";
		const fileSize = 1024;

		await simulateR2Notification(mockEnv as Env, pdfPath, fileSize);

		expect(mockEnv.R2_NOTIFICATION_QUEUE?.send).toHaveBeenCalledTimes(1);
		expect(r2NotificationMessages).toHaveLength(1);

		const notification = r2NotificationMessages[0] as R2EventNotification;
		expect(notification.account).toBe("simulated");
		expect(notification.bucket).toBe("sitelink-files");
		expect(notification.object.key).toBe(pdfPath);
		expect(notification.object.size).toBe(fileSize);
		expect(notification.action).toBe("PutObject");
		expect(notification.eventTime).toBeDefined();
		expect(() => new Date(notification.eventTime)).not.toThrow();
	});
});

describe("handleR2NotificationQueue", () => {
	const testOrganizationId = "test-org-123";
	const testProjectId = "test-project-456";
	const testPlanId = "test-plan-789";
	let mockEnv: Partial<Env>;
	let queuedMessages: any[];
	let liveStoreRequests: any[];

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
			queue: "r2-notification-queue",
			ackAll: vi.fn(),
			retryAll: vi.fn(),
		};
	}

	beforeEach(() => {
		queuedMessages = [];
		liveStoreRequests = [];

		mockEnv = {
			IMAGE_GENERATION_QUEUE: {
				send: vi.fn(async (message: any) => {
					queuedMessages.push(message);
				}),
			} as any,
			LIVESTORE_CLIENT_DO: {
				idFromName: vi.fn((name: string) => ({ name })),
				get: vi.fn(() => ({
					fetch: vi.fn(async (url: string, options: any) => {
						liveStoreRequests.push({ url, options });
						return new Response(JSON.stringify({ success: true }), {
							status: 200,
						});
					}),
				})),
			} as any,
		};
	});

	it("should parse PDF path and trigger IMAGE_GENERATION_QUEUE", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const notification: R2EventNotification = {
			account: "test-account",
			bucket: "sitelink-files",
			object: {
				key: pdfPath,
				size: 1024,
				eTag: "test-etag",
			},
			action: "PutObject",
			eventTime: new Date().toISOString(),
		};

		const message = createMockMessage(notification);
		const batch = createMockBatch([message]);

		await handleR2NotificationQueue(batch, mockEnv as Env);

		expect(mockEnv.IMAGE_GENERATION_QUEUE?.send).toHaveBeenCalledTimes(1);
		expect(queuedMessages).toHaveLength(1);
		expect(queuedMessages[0]).toMatchObject({
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			pdfPath,
		});
		expect(message.ack).toHaveBeenCalled();
	});

	it("should ignore non-PDF uploads", async () => {
		const testCases = [
			`organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/image.png`,
			`organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/document.txt`,
			`organizations/${testOrganizationId}/projects/${testProjectId}/tiles/0/0/0.webp`,
		];

		for (const path of testCases) {
			const notification: R2EventNotification = {
				account: "test-account",
				bucket: "sitelink-files",
				object: {
					key: path,
					size: 1024,
					eTag: "test-etag",
				},
				action: "PutObject",
				eventTime: new Date().toISOString(),
			};

			const message = createMockMessage(notification);
			const batch = createMockBatch([message]);

			await handleR2NotificationQueue(batch, mockEnv as Env);

			expect(message.ack).toHaveBeenCalled();
		}

		expect(mockEnv.IMAGE_GENERATION_QUEUE?.send).not.toHaveBeenCalled();
		expect(queuedMessages).toHaveLength(0);
	});

	it("should ignore DeleteObject actions", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const notification: R2EventNotification = {
			account: "test-account",
			bucket: "sitelink-files",
			object: {
				key: pdfPath,
				size: 1024,
				eTag: "test-etag",
			},
			action: "DeleteObject",
			eventTime: new Date().toISOString(),
		};

		const message = createMockMessage(notification);
		const batch = createMockBatch([message]);

		await handleR2NotificationQueue(batch, mockEnv as Env);

		expect(mockEnv.IMAGE_GENERATION_QUEUE?.send).not.toHaveBeenCalled();
		expect(queuedMessages).toHaveLength(0);
		expect(message.ack).toHaveBeenCalled();
	});

	it("should handle CompleteMultipartUpload action", async () => {
		const pdfPath = `organizations/${testOrganizationId}/projects/${testProjectId}/plans/${testPlanId}/source.pdf`;
		const notification: R2EventNotification = {
			account: "test-account",
			bucket: "sitelink-files",
			object: {
				key: pdfPath,
				size: 1024,
				eTag: "test-etag",
			},
			action: "CompleteMultipartUpload",
			eventTime: new Date().toISOString(),
		};

		const message = createMockMessage(notification);
		const batch = createMockBatch([message]);

		await handleR2NotificationQueue(batch, mockEnv as Env);

		expect(mockEnv.IMAGE_GENERATION_QUEUE?.send).toHaveBeenCalledTimes(1);
		expect(queuedMessages).toHaveLength(1);
		expect(queuedMessages[0]).toMatchObject({
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			pdfPath,
		});
		expect(message.ack).toHaveBeenCalled();
	});
});
