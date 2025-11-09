import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test"
import { drizzle } from "drizzle-orm/d1"
import { beforeAll, describe, expect, it } from "vitest"
import * as schema from "../../src/core/database/schemas"
import {
	createApiKeyForUser,
	createSystemPdfProcessorUser,
} from "../helpers/api-keys"
import {
	createAuthenticatedUser,
	createOrgWithSubscription,
	createPlan,
	createProject,
	wrappedFetch,
} from "../helpers/setup"
import { loadSamplePDF } from "../helpers"

describe("PDF Processing - Integration Tests", () => {
	// API Key Authentication Tests
	describe("API Key Authentication", () => {
		let systemUserId: string

		beforeAll(async () => {
			// Create system PDF processor user once for all tests
			systemUserId = await createSystemPdfProcessorUser()
		})

		it("should reject requests without API key", async () => {
			// Make request without apiKey header
			const response = await wrappedFetch(
				"http://localhost/api/processing/progressUpdate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						id: "job-test-123",
						status: "processing",
						completedPages: 5,
						failedPages: "1,3",
						startedAt: Date.now(),
					}),
				},
			)

			expect(response.status).toBe(401)
		})

		it("should return 200 with valid API key", async () => {
			// Create authenticated user with org and project using helper functions
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"progress-test@example.com",
			)

			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Progress Test Org",
			)

			await authClient.organization.setActive({ organizationId })

			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Progress Test Project",
			)

			// Create minimal test data manually (avoiding createPlan to skip container initialization)
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const timestamp = Date.now()
			const planId = `test-plan-${timestamp}`
			const uploadId = `test-upload-${timestamp}`
			const jobId = `test-job-${timestamp}`

			// Create plan first (required by file FK)
			await db.insert(schema.plans).values({
				id: planId,
				projectId,
				name: "Test Plan",
				directoryPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}`,
				createdAt: new Date(),
			})

			// Create file second (required by processing job FK)
			await db.insert(schema.files).values({
				id: `test-file-${timestamp}`,
				uploadId,
				planId,
				filePath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				fileType: "application/pdf",
				isActive: true,
				createdAt: new Date(),
			})

			// Create processing job last (depends on uploadId, planId, etc.)
			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId,
				planId,
				organizationId,
				projectId,
				pdfPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				status: "pending",
				completedPages: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			})

			// Create API key for system user
			const apiKey = await createApiKeyForUser(
				systemUserId,
				"test-processing-api-key",
			)

			// Make request with valid apiKey header to update the processing job
			const response = await wrappedFetch(
				"http://localhost/api/processing/progressUpdate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						apiKey: apiKey,
					},
					body: JSON.stringify({
						id: jobId,
						status: "processing",
						completedPages: 5,
						failedPages: "1,3",
						startedAt: Date.now(),
					}),
				},
			)

			expect(response.status).toBe(200)

			// Verify the database was updated
			const { eq } = await import("drizzle-orm")
			const updatedJob = await db
				.select()
				.from(schema.processingJobs)
				.where(eq(schema.processingJobs.id, jobId))
				.then((rows) => rows[0])

			expect(updatedJob?.status).toBe("processing")
			expect(updatedJob?.completedPages).toBe(5)
			expect(updatedJob?.failedPages).toBe("1,3")
		})
	})

	// Phase 1: Integration Test - MOST IMPORTANT (write this first)
	describe.skip("Phase 1: State Management", () => {
		it("should process a multi-page PDF end-to-end in Cloudflare runtime", async () => {
			// 1. Create authenticated user with session
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"pdf-processing-test@example.com",
			)

			// 2. Create organization with subscription
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Processing Test Org",
			)

			// 3. Set active organization (important for permissions)
			await authClient.organization.setActive({ organizationId })

			// 4. Create project
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Processing Test Project",
			)

			// 5. Create plan with real multi-page PDF - this triggers processing
			const plan = await createPlan(
				sessionCookie,
				projectId,
				await loadSamplePDF(), // Real 3-5 page PDF
				"Integration Test Plan",
			)

			// 6. Verify job was initialized in Durable Object
			const jobId = plan.jobId
			const stub = env.SITELINK_PDF_PROCESSOR.get(
				env.SITELINK_PDF_PROCESSOR.idFromName(jobId),
			)
		})
	})
})
