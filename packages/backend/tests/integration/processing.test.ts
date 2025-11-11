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

	// Job Status Endpoint Tests
	describe("GET /api/processing/jobs/:jobId", () => {
		it("should get job status for authenticated user with organization access", async () => {
			// Setup: Create user, org, project, and plan
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-status@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Job Status Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Job Status Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
			)
			formData.append("name", "Test Plan for Job")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId, jobId } = (await createResponse.json()) as {
				planId: string
				jobId: string
			}

			// Get upload ID from files table
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const { eq } = await import("drizzle-orm")
			const file = await db
				.select()
				.from(schema.files)
				.where(eq(schema.files.planId, planId))
				.then((rows) => rows[0])

			if (!file) throw new Error("File not found for plan")

			// Get project info for processing job
			const plan = await db
				.select()
				.from(schema.plans)
				.where(eq(schema.plans.id, planId))
				.then((rows) => rows[0])

			if (!plan) throw new Error("Plan not found")

			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, plan.projectId))
				.then((rows) => rows[0])

			if (!project) throw new Error("Project not found")

			// Insert processing job record
			const startedAt = new Date()

			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId: file.uploadId,
				planId,
				organizationId: project.organizationId,
				projectId: plan.projectId,
				pdfPath: file.filePath ?? "",
				status: "processing",
				progress: 0.45,
				totalPages: 10,
				completedPages: 4,
				failedPages: "6",
				startedAt,
				completedAt: null,
				lastError: null,
				createdAt: new Date(),
			})

			// Test: Get job status
			const statusResponse = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(statusResponse.status).toBe(200)
			const jobStatus = (await statusResponse.json()) as {
				id: string
				status: string
				progress: number
				totalPages: number
				completedPages: number
				failedPages: string
				startedAt: string
				completedAt: string | null
				lastError: string | null
				plan: {
					id: string
					name: string
				}
				projectId: string
				organizationId: string
			}

			// Verify job status data
			expect(jobStatus).toMatchObject({
				id: jobId,
				status: "processing",
				progress: 0.45,
				totalPages: 10,
				completedPages: 4,
				failedPages: "6",
				lastError: null,
				plan: {
					id: planId,
					name: "Test Plan for Job",
				},
				projectId,
				organizationId,
			})

			expect(jobStatus.startedAt).toBeTruthy()
			expect(jobStatus.completedAt).toBeNull()
		})

		it("should get completed job status", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-complete@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Complete Job Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Complete Job Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"plan.pdf",
			)
			formData.append("name", "Completed Plan")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId, jobId } = (await createResponse.json()) as {
				planId: string
				jobId: string
			}

			// Get upload ID and project info
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const { eq } = await import("drizzle-orm")
			const file = await db
				.select()
				.from(schema.files)
				.where(eq(schema.files.planId, planId))
				.then((rows) => rows[0])

			if (!file) throw new Error("File not found for plan")

			const plan = await db
				.select()
				.from(schema.plans)
				.where(eq(schema.plans.id, planId))
				.then((rows) => rows[0])

			if (!plan) throw new Error("Plan not found")

			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, plan.projectId))
				.then((rows) => rows[0])

			if (!project) throw new Error("Project not found")

			// Insert completed processing job
			const startedAt = new Date(Date.now() - 300000) // 5 minutes ago
			const completedAt = new Date()

			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId: file.uploadId,
				planId,
				organizationId: project.organizationId,
				projectId: plan.projectId,
				pdfPath: file.filePath ?? "",
				status: "completed",
				progress: 1.0,
				totalPages: 10,
				completedPages: 10,
				failedPages: null,
				startedAt,
				completedAt,
				lastError: null,
				createdAt: new Date(),
			})

			// Test: Get completed job status
			const statusResponse = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(statusResponse.status).toBe(200)
			const jobStatus = (await statusResponse.json()) as {
				status: string
				progress: number
				totalPages: number
				completedPages: number
				completedAt: string | null
			}

			expect(jobStatus.status).toBe("completed")
			expect(jobStatus.progress).toBe(1.0)
			expect(jobStatus.totalPages).toBe(10)
			expect(jobStatus.completedPages).toBe(10)
			expect(jobStatus.completedAt).toBeTruthy()
		})

		it("should get failed job status with error message", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-failed@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Failed Job Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Failed Job Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"plan.pdf",
			)
			formData.append("name", "Failed Plan")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId, jobId } = (await createResponse.json()) as {
				planId: string
				jobId: string
			}

			// Get upload ID and project info
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const { eq } = await import("drizzle-orm")
			const file = await db
				.select()
				.from(schema.files)
				.where(eq(schema.files.planId, planId))
				.then((rows) => rows[0])

			if (!file) throw new Error("File not found for plan")

			const plan = await db
				.select()
				.from(schema.plans)
				.where(eq(schema.plans.id, planId))
				.then((rows) => rows[0])

			if (!plan) throw new Error("Plan not found")

			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, plan.projectId))
				.then((rows) => rows[0])

			if (!project) throw new Error("Project not found")

			// Insert failed processing job
			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId: file.uploadId,
				planId,
				organizationId: project.organizationId,
				projectId: plan.projectId,
				pdfPath: file.filePath ?? "",
				status: "failed",
				progress: 0.3,
				totalPages: 10,
				completedPages: 3,
				failedPages: "4,5,6",
				startedAt: new Date(),
				completedAt: new Date(),
				lastError: "Failed to process PDF: Invalid page structure",
				createdAt: new Date(),
			})

			// Test: Get failed job status
			const statusResponse = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(statusResponse.status).toBe(200)
			const jobStatus = (await statusResponse.json()) as {
				status: string
				failedPages: string
				lastError: string
			}

			expect(jobStatus.status).toBe("failed")
			expect(jobStatus.failedPages).toBe("4,5,6")
			expect(jobStatus.lastError).toBe(
				"Failed to process PDF: Invalid page structure",
			)
		})

		it("should return 404 for non-existent job", async () => {
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-404@example.com",
			)
			await createOrgWithSubscription(authClient, "404 Job Org")

			const statusResponse = await wrappedFetch(
				"http://localhost/api/processing/jobs/00000000-0000-0000-0000-000000000000",
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(statusResponse.status).toBe(404)
		})

		it("should return 404 when user doesn't have access to job's organization", async () => {
			// Setup: Create first user with org
			const { sessionCookie: session1Cookie, authClient: authClient1 } =
				await createAuthenticatedUser("job-owner@example.com")
			const { organizationId: org1Id } = await createOrgWithSubscription(
				authClient1,
				"Owner Org",
			)
			await authClient1.organization.setActive({ organizationId: org1Id })

			// Create second user with different org
			const { sessionCookie: session2, authClient: authClient2 } =
				await createAuthenticatedUser("job-other-user@example.com")
			const { organizationId: org2Id } = await createOrgWithSubscription(
				authClient2,
				"Other Org",
			)
			await authClient2.organization.setActive({ organizationId: org2Id })

			const projectId = await createProject(
				session1Cookie,
				org1Id,
				"Test Project",
			)

			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"plan.pdf",
			)
			formData.append("name", "Test Plan")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: session1Cookie },
					body: formData,
				},
			)

			const { planId, jobId } = (await createResponse.json()) as {
				planId: string
				jobId: string
			}

			// Get upload ID and project info for org1
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const { eq } = await import("drizzle-orm")
			const file = await db
				.select()
				.from(schema.files)
				.where(eq(schema.files.planId, planId))
				.then((rows) => rows[0])

			if (!file) throw new Error("File not found for plan")

			const plan = await db
				.select()
				.from(schema.plans)
				.where(eq(schema.plans.id, planId))
				.then((rows) => rows[0])

			if (!plan) throw new Error("Plan not found")

			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, plan.projectId))
				.then((rows) => rows[0])

			if (!project) throw new Error("Project not found")

			// Insert processing job for org1
			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId: file.uploadId,
				planId,
				organizationId: project.organizationId,
				projectId: plan.projectId,
				pdfPath: file.filePath ?? "",
				status: "processing",
				progress: 0.5,
				totalPages: 10,
				completedPages: 5,
				failedPages: null,
				startedAt: new Date(),
				completedAt: null,
				lastError: null,
				createdAt: new Date(),
			})

			// Test: User 2 tries to access user 1's job
			const statusResponse = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: session2 },
				},
			)

			// Should return 404 (not 403) to avoid leaking job existence
			expect(statusResponse.status).toBe(404)
		})

		it("should require authentication", async () => {
			// Test: Try to get job status without authentication
			const statusResponse = await wrappedFetch(
				"http://localhost/api/processing/jobs/test-job-id",
				{
					method: "GET",
				},
			)

			expect(statusResponse.status).toBe(401)
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
