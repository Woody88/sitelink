import { env } from "cloudflare:test"
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

describe("Tile API Endpoints", () => {
	describe("GET /api/plans/:planId/sheets/:sheetId/dzi", () => {
		it("should get DZI XML metadata for a sheet", async () => {
			// Setup: Create user, org, project, and plan
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"dzi-get@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"DZI Test Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"DZI Test Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
			)
			formData.append("name", "Test Plan with DZI")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId } = (await createResponse.json()) as { planId: string }

			// Create test sheet
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()
			const dziPath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles/${sheetId}.dzi`

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Floor Plan",
				dziPath,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles/${sheetId}_files`,
				width: 8000,
				height: 6000,
				tileCount: 256,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Upload mock DZI XML to R2
			const dziXml = `<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008" Format="jpeg" Overlap="1" TileSize="254">
  <Size Width="8000" Height="6000"/>
</Image>`

			await env.SitelinkStorage.put(dziPath, dziXml, {
				httpMetadata: { contentType: "application/xml" },
			})

			// Test: Get DZI file
			const dziResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/dzi`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(dziResponse.status).toBe(200)
			expect(dziResponse.headers.get("content-type")).toContain(
				"application/xml",
			)

			const dziContent = await dziResponse.text()
			expect(dziContent).toContain('<?xml version="1.0"')
			expect(dziContent).toContain("<Image")
			expect(dziContent).toContain('Width="8000"')
			expect(dziContent).toContain('Height="6000"')
		})

		it("should return 404 for non-existent sheet", async () => {
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"dzi-404-sheet@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"DZI 404 Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"DZI 404 Project",
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

			// Test: Get DZI for non-existent sheet
			const dziResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/00000000-0000-0000-0000-000000000000/dzi`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(dziResponse.status).toBe(404)
		})

		it("should return 404 when DZI file doesn't exist in R2", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"dzi-404-file@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"DZI Missing File Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"DZI Missing File Project",
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

			// Create sheet but don't upload DZI file to R2
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Test Sheet",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/missing.dzi`,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles`,
				width: 8000,
				height: 6000,
				tileCount: 256,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Test: Get DZI when file doesn't exist in R2
			const dziResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/dzi`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(dziResponse.status).toBe(404)
		})
	})

	describe("GET /api/plans/:planId/sheets/:sheetId/tiles/:level/:tile", () => {
		it("should get a tile image for authenticated client", async () => {
			// Setup: Create user, org, project, and plan
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"tile-get@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Tile Test Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Tile Test Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
			)
			formData.append("name", "Test Plan with Tiles")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId } = (await createResponse.json()) as { planId: string }

			// Create test sheet
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()
			const tileDirectory = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles/${sheetId}_files`

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Floor Plan",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles/${sheetId}.dzi`,
				tileDirectory,
				width: 8000,
				height: 6000,
				tileCount: 256,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Upload mock tile image to R2
			const tilePath = `${tileDirectory}/12/0_0.jpeg`
			const mockTileData = new Uint8Array([
				0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
			]) // JPEG header

			await env.SitelinkStorage.put(tilePath, mockTileData, {
				httpMetadata: { contentType: "image/jpeg" },
			})

			// Test: Get tile image
			const tileResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/tiles/12/0_0.jpeg`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(tileResponse.status).toBe(200)
			expect(tileResponse.headers.get("content-type")).toContain("image/jpeg")

			const tileData = new Uint8Array(await tileResponse.arrayBuffer())
			expect(tileData.length).toBeGreaterThan(0)
			// Verify JPEG magic number
			expect(tileData[0]).toBe(0xff)
			expect(tileData[1]).toBe(0xd8)
		})

		it("should return 404 for non-existent sheet", async () => {
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"tile-404-sheet@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Tile 404 Sheet Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Tile 404 Project",
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

			// Test: Get tile for non-existent sheet
			const tileResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/00000000-0000-0000-0000-000000000000/tiles/12/0_0.jpeg`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(tileResponse.status).toBe(404)
		})

		it("should return 404 when tile file doesn't exist in R2", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"tile-404-file@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Tile Missing File Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Tile Missing File Project",
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

			// Create sheet but don't upload tile file to R2
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Test Sheet",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles.dzi`,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles`,
				width: 8000,
				height: 6000,
				tileCount: 256,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Test: Get tile when file doesn't exist in R2
			const tileResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/tiles/12/0_0.jpeg`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(tileResponse.status).toBe(404)
		})

		it("should require authentication", async () => {
			// Test: Try to get tile without authentication
			const tileResponse = await wrappedFetch(
				"http://localhost/api/plans/test-plan-id/sheets/test-sheet-id/tiles/12/0_0.jpeg",
				{
					method: "GET",
				},
			)

			expect(tileResponse.status).toBe(401)
		})
	})
})
