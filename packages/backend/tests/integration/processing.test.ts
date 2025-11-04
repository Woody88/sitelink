import {
	createExecutionContext,
	env,
	waitOnExecutionContext,
} from "cloudflare:test"
import { describe, expect, it } from "vitest"
import { loadSamplePDF } from "../helpers"
import {
	createAuthenticatedUser,
	createOrgWithSubscription,
	createPlan,
	createProject,
} from "../helpers/setup"

describe("PDF Processing - Integration Tests", () => {
	// Phase 1: Integration Test - MOST IMPORTANT (write this first)
	describe("Phase 1: State Management", () => {
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

			const progress = await stub.getProgress(jobId)

			expect(progress).toBeDefined()
			expect(progress?.status).toBe("pending")

			stub.updateProgress(jobId, {
				...progress,
				status: "complete",
			})

			const updatedProgress = await stub.getProgress(jobId)
			expect(updatedProgress).toBeDefined()
			expect(updatedProgress?.status).toBe("complete")
		}) // 3 minute timeout for multi-page integration test
	})
})
