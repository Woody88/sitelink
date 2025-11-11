import { env } from "cloudflare:test"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { describe, expect, it } from "vitest"
import * as schema from "../../src/core/database/schemas"
import {
	createAuthenticatedUser,
	createOrgWithSubscription,
	createProject,
	loadSamplePDF,
	wrappedFetch,
} from "../helpers"

describe("Sheets API Endpoints", () => {
	describe("GET /api/plans/:planId/sheets", () => {
		it("should list all sheets for a plan ordered by page number", async () => {
			// Setup: Create user, org, project, and plan
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"sheets-list@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Sheets List Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Sheets List Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
			)
			formData.append("name", "Test Plan with Sheets")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId } = (await createResponse.json()) as { planId: string }

			// Manually insert test sheets into database
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

			const sheet1Id = crypto.randomUUID()
			const sheet2Id = crypto.randomUUID()
			const sheet3Id = crypto.randomUUID()

			await db.insert(schema.sheets).values([
				{
					id: sheet1Id,
					planId,
					pageNumber: 1,
					sheetName: "Floor Plan - Level 1",
					dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/image.dzi`,
					tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/tiles`,
					width: 8000,
					height: 6000,
					tileCount: 256,
					processingStatus: "complete",
					createdAt: new Date(),
				},
				{
					id: sheet2Id,
					planId,
					pageNumber: 2,
					sheetName: "Floor Plan - Level 2",
					dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-2/image.dzi`,
					tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-2/tiles`,
					width: 8000,
					height: 6000,
					tileCount: 256,
					processingStatus: "complete",
					createdAt: new Date(),
				},
				{
					id: sheet3Id,
					planId,
					pageNumber: 3,
					sheetName: "Electrical Layout",
					dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-3/image.dzi`,
					tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-3/tiles`,
					width: 8000,
					height: 6000,
					tileCount: 256,
					processingStatus: "processing",
					createdAt: new Date(),
				},
			])

			// Test: List sheets
			const listResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(listResponse.status).toBe(200)
			const data = (await listResponse.json()) as {
				sheets: Array<{
					id: string
					planId: string
					pageNumber: number
					sheetName: string | null
					dziPath: string
					tileDirectory: string
					width: number | null
					height: number | null
					tileCount: number | null
					processingStatus: string
				}>
			}

			// Verify response
			expect(data.sheets).toHaveLength(3)

			// Verify ordering by page number
			expect(data.sheets[0].pageNumber).toBe(1)
			expect(data.sheets[1].pageNumber).toBe(2)
			expect(data.sheets[2].pageNumber).toBe(3)

			// Verify sheet data
			expect(data.sheets[0]).toMatchObject({
				id: sheet1Id,
				planId,
				pageNumber: 1,
				sheetName: "Floor Plan - Level 1",
				width: 8000,
				height: 6000,
				tileCount: 256,
				processingStatus: "complete",
			})
		})

		it("should return empty array for plan with no sheets", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"sheets-empty@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Empty Sheets Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Empty Sheets Project",
			)

			// Create plan without sheets
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"plan.pdf",
			)
			formData.append("name", "Plan Without Sheets")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId } = (await createResponse.json()) as { planId: string }

			// Test: List sheets
			const listResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(listResponse.status).toBe(200)
			const data = (await listResponse.json()) as { sheets: Array<unknown> }
			expect(data.sheets).toHaveLength(0)
		})

		it("should return 404 for non-existent plan", async () => {
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"sheets-404@example.com",
			)
			await createOrgWithSubscription(authClient, "404 Sheets Org")

			const listResponse = await wrappedFetch(
				"http://localhost/api/plans/00000000-0000-0000-0000-000000000000/sheets",
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(listResponse.status).toBe(404)
		})
	})

	describe("GET /api/plans/:planId/sheets/:sheetId", () => {
		it("should get a single sheet by ID", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"sheet-get@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Get Sheet Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Get Sheet Project",
			)

			// Create plan
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
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId } = (await createResponse.json()) as { planId: string }

			// Insert test sheet
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Site Plan",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/image.dzi`,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/tiles`,
				width: 10000,
				height: 8000,
				tileCount: 512,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Test: Get sheet
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(200)
			const sheet = (await getResponse.json()) as {
				id: string
				planId: string
				pageNumber: number
				sheetName: string | null
				dziPath: string
				tileDirectory: string
				width: number | null
				height: number | null
				tileCount: number | null
				processingStatus: string
			}

			// Verify sheet data
			expect(sheet).toMatchObject({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Site Plan",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/image.dzi`,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/tiles`,
				width: 10000,
				height: 8000,
				tileCount: 512,
				processingStatus: "complete",
			})
		})

		it("should return 404 for non-existent sheet", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"sheet-404@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Sheet 404 Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Sheet 404 Project",
			)

			// Create plan
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
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId } = (await createResponse.json()) as { planId: string }

			// Test: Get non-existent sheet
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/00000000-0000-0000-0000-000000000000`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(404)
		})
	})
})
