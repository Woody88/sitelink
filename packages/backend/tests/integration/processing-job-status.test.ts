import { env } from "cloudflare:test"
import { drizzle } from "drizzle-orm/d1"
import { describe, expect, it } from "vitest"
import * as schema from "../../src/core/database/schemas"
import {
	createAuthenticatedUser,
	createOrgWithSubscription,
	createProject,
	wrappedFetch,
} from "../helpers"

describe("Processing Job Status - GET /api/processing/jobs/:jobId", () => {
	describe("Authentication and Authorization", () => {
		it("should return 401 when not authenticated", async () => {
			const response = await wrappedFetch(
				"http://localhost/api/processing/jobs/test-job-id",
				{
					method: "GET",
				},
			)

			expect(response.status).toBe(401)
		})

		it("should return job status for authenticated user in same organization", async () => {
			// Setup: Create authenticated user, organization, and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-status-test@example.com",
			)

			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Job Status Test Org",
			)

			await authClient.organization.setActive({ organizationId })

			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Job Status Test Project",
			)

			// Create test data
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const timestamp = Date.now()
			const planId = `test-plan-${timestamp}`
			const uploadId = `test-upload-${timestamp}`
			const jobId = `test-job-${timestamp}`

			// Create plan
			await db.insert(schema.plans).values({
				id: planId,
				projectId,
				name: "Test Plan for Job Status",
				directoryPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}`,
				createdAt: new Date(),
			})

			// Create file
			await db.insert(schema.files).values({
				id: `test-file-${timestamp}`,
				uploadId,
				planId,
				filePath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				fileType: "application/pdf",
				isActive: true,
				createdAt: new Date(),
			})

			// Create processing job
			const startedAt = new Date()
			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId,
				planId,
				organizationId,
				projectId,
				pdfPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				status: "processing",
				totalPages: 10,
				completedPages: 5,
				failedPages: null,
				progress: 50,
				startedAt,
				completedAt: null,
				lastError: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			})

			// Get job status
			const response = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data).toMatchObject({
				id: jobId,
				status: "processing",
				progress: 50,
				totalPages: 10,
				completedPages: 5,
				failedPages: null,
				lastError: null,
				plan: {
					id: planId,
					name: "Test Plan for Job Status",
				},
				projectId: projectId,
				organizationId: organizationId,
			})
			expect(data.startedAt).toBeDefined()
			expect(data.completedAt).toBeNull()
		})

		it("should return 404 when user tries to access job from different organization", async () => {
			// Setup: Create two users in two different organizations
			const { sessionCookie: cookie1, authClient: auth1 } =
				await createAuthenticatedUser("job-org1@example.com")
			const { organizationId: org1 } = await createOrgWithSubscription(
				auth1,
				"Job Org 1",
			)
			await auth1.organization.setActive({ organizationId: org1 })
			const project1 = await createProject(cookie1, org1, "Job Org 1 Project")

			const { sessionCookie: cookie2, authClient: auth2 } =
				await createAuthenticatedUser("job-org2@example.com")
			const { organizationId: org2 } = await createOrgWithSubscription(
				auth2,
				"Job Org 2",
			)
			await auth2.organization.setActive({ organizationId: org2 })

			// User 1 creates a job
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const timestamp = Date.now()
			const planId = `test-plan-${timestamp}`
			const uploadId = `test-upload-${timestamp}`
			const jobId = `test-job-${timestamp}`

			// Create plan
			await db.insert(schema.plans).values({
				id: planId,
				projectId: project1,
				name: "Org 1 Plan",
				directoryPath: `organizations/${org1}/projects/${project1}/plans/${planId}`,
				createdAt: new Date(),
			})

			// Create file
			await db.insert(schema.files).values({
				id: `test-file-${timestamp}`,
				uploadId,
				planId,
				filePath: `organizations/${org1}/projects/${project1}/plans/${planId}/file.pdf`,
				fileType: "application/pdf",
				isActive: true,
				createdAt: new Date(),
			})

			// Create processing job
			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId,
				planId,
				organizationId: org1,
				projectId: project1,
				pdfPath: `organizations/${org1}/projects/${project1}/plans/${planId}/file.pdf`,
				status: "pending",
				completedPages: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			})

			// User 2 tries to access User 1's job
			const response = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: {
						cookie: cookie2,
					},
				},
			)

			// Should return 404 because user 2 is not in org1
			expect(response.status).toBe(404)
		})

		it("should return 404 for non-existent job", async () => {
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-404@example.com",
			)
			await createOrgWithSubscription(authClient, "404 Job Org")

			const response = await wrappedFetch(
				"http://localhost/api/processing/jobs/non-existent-job-id",
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(response.status).toBe(404)
		})
	})

	describe("Job Status Response", () => {
		it("should return correct status for pending job", async () => {
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"job-pending@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Pending Job Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Pending Job Project",
			)

			// Create test data
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const timestamp = Date.now()
			const planId = `test-plan-${timestamp}`
			const uploadId = `test-upload-${timestamp}`
			const jobId = `test-job-${timestamp}`

			await db.insert(schema.plans).values({
				id: planId,
				projectId,
				name: "Pending Plan",
				directoryPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}`,
				createdAt: new Date(),
			})

			await db.insert(schema.files).values({
				id: `test-file-${timestamp}`,
				uploadId,
				planId,
				filePath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				fileType: "application/pdf",
				isActive: true,
				createdAt: new Date(),
			})

			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId,
				planId,
				organizationId,
				projectId,
				pdfPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				status: "pending",
				totalPages: null,
				completedPages: 0,
				progress: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			})

			const response = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.status).toBe("pending")
			expect(data.progress).toBe(0)
			expect(data.completedPages).toBe(0)
			expect(data.totalPages).toBeNull()
		})

		it("should return correct status for complete job", async () => {
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

			// Create test data
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const timestamp = Date.now()
			const planId = `test-plan-${timestamp}`
			const uploadId = `test-upload-${timestamp}`
			const jobId = `test-job-${timestamp}`

			await db.insert(schema.plans).values({
				id: planId,
				projectId,
				name: "Complete Plan",
				directoryPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}`,
				createdAt: new Date(),
			})

			await db.insert(schema.files).values({
				id: `test-file-${timestamp}`,
				uploadId,
				planId,
				filePath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				fileType: "application/pdf",
				isActive: true,
				createdAt: new Date(),
			})

			const completedAt = new Date()
			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId,
				planId,
				organizationId,
				projectId,
				pdfPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				status: "complete",
				totalPages: 20,
				completedPages: 20,
				progress: 100,
				startedAt: new Date(Date.now() - 60000), // 1 minute ago
				completedAt,
				createdAt: new Date(),
				updatedAt: new Date(),
			})

			const response = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.status).toBe("complete")
			expect(data.progress).toBe(100)
			expect(data.completedPages).toBe(20)
			expect(data.totalPages).toBe(20)
			expect(data.completedAt).toBeDefined()
		})

		it("should return correct status for failed job with error", async () => {
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

			// Create test data
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const timestamp = Date.now()
			const planId = `test-plan-${timestamp}`
			const uploadId = `test-upload-${timestamp}`
			const jobId = `test-job-${timestamp}`

			await db.insert(schema.plans).values({
				id: planId,
				projectId,
				name: "Failed Plan",
				directoryPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}`,
				createdAt: new Date(),
			})

			await db.insert(schema.files).values({
				id: `test-file-${timestamp}`,
				uploadId,
				planId,
				filePath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				fileType: "application/pdf",
				isActive: true,
				createdAt: new Date(),
			})

			await db.insert(schema.processingJobs).values({
				id: jobId,
				uploadId,
				planId,
				organizationId,
				projectId,
				pdfPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/file.pdf`,
				status: "failed",
				totalPages: 15,
				completedPages: 7,
				failedPages: JSON.stringify([8, 9, 10]),
				progress: 46,
				startedAt: new Date(Date.now() - 60000),
				lastError: "Processing error: Page 8 corrupt",
				createdAt: new Date(),
				updatedAt: new Date(),
			})

			const response = await wrappedFetch(
				`http://localhost/api/processing/jobs/${jobId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.status).toBe("failed")
			expect(data.progress).toBe(46)
			expect(data.completedPages).toBe(7)
			expect(data.totalPages).toBe(15)
			expect(data.failedPages).toBe('[8,9,10]')
			expect(data.lastError).toBe("Processing error: Page 8 corrupt")
		})
	})
})
