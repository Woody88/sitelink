import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	parseR2EventPath,
	uploadPdfAndTriggerPipeline,
} from "../processing/r2-with-notifications";
import type { Env } from "../types/env";

describe("R2 Upload Functionality", () => {
	const testOrganizationId = "test-org-123";
	const testProjectId = "test-project-456";
	const testPlanId = "test-plan-789";
	let mockEnv: Partial<Env>;
	let uploadedObjects: Map<string, { data: ArrayBuffer; metadata: any }>;
	let queuedMessages: any[];

	beforeEach(() => {
		uploadedObjects = new Map();
		queuedMessages = [];

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

	it("should trigger IMAGE_GENERATION_QUEUE after upload", async () => {
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

		expect(mockEnv.IMAGE_GENERATION_QUEUE?.send).toHaveBeenCalledTimes(1);
		expect(queuedMessages).toHaveLength(1);
		expect(queuedMessages[0]).toEqual({
			planId: testPlanId,
			projectId: testProjectId,
			organizationId: testOrganizationId,
			pdfPath,
			totalPages: 5,
		});
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
