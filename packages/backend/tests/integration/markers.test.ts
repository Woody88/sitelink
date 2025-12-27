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

describe("Markers API Endpoints", () => {
	describe("GET /api/plans/:planId/sheets/:sheetId/markers", () => {
		it("should successfully retrieve markers for a sheet with markers", async () => {
			// Setup: Create user, org, project, and plan
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"markers-get@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Markers Test Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Markers Test Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
			)
			formData.append("name", "Test Plan with Markers")

			const createResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/plans`,
				{
					method: "POST",
					headers: { cookie: sessionCookie },
					body: formData,
				},
			)

			const { planId, uploadId } = (await createResponse.json()) as {
				planId: string
				uploadId: string
			}

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

			// Insert test markers
			const marker1Id = crypto.randomUUID()
			const marker2Id = crypto.randomUUID()
			const marker3Id = crypto.randomUUID()

			await db.insert(schema.planMarkers).values([
				{
					id: marker1Id,
					uploadId,
					planId,
					sheetNumber: 1,
					markerText: "3/A7",
					detail: "3",
					sheet: "A7",
					markerType: "circular",
					confidence: 0.95,
					isValid: true,
					fuzzyMatched: false,
					sourceTile: null,
					bbox: JSON.stringify({ x: 0.2, y: 0.3, w: 0.05, h: 0.05 }),
					createdAt: new Date(),
				},
				{
					id: marker2Id,
					uploadId,
					planId,
					sheetNumber: 1,
					markerText: "5/B2",
					detail: "5",
					sheet: "B2",
					markerType: "circular",
					confidence: 0.87,
					isValid: true,
					fuzzyMatched: false,
					sourceTile: null,
					bbox: JSON.stringify({ x: 0.6, y: 0.4, w: 0.05, h: 0.05 }),
					createdAt: new Date(),
				},
				{
					id: marker3Id,
					uploadId,
					planId,
					sheetNumber: 1,
					markerText: "2/C5",
					detail: "2",
					sheet: "C5",
					markerType: "triangular",
					confidence: 0.72,
					isValid: false, // Invalid marker
					fuzzyMatched: true,
					sourceTile: null,
					bbox: JSON.stringify({ x: 0.8, y: 0.7, w: 0.05, h: 0.05 }),
					createdAt: new Date(),
				},
			])

			// Test: Get markers
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/markers`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(200)
			const result = (await getResponse.json()) as {
				hyperlinks: Array<{
					calloutRef: string
					targetSheetRef: string
					x: number
					y: number
					confidence: number
				}>
				calloutsFound: number
				calloutsMatched: number
				confidenceStats: {
					averageConfidence: number
				}
				processingTimeMs: number
			}

			// Verify response structure
			expect(result).toHaveProperty("hyperlinks")
			expect(result).toHaveProperty("calloutsFound")
			expect(result).toHaveProperty("calloutsMatched")
			expect(result).toHaveProperty("confidenceStats")
			expect(result).toHaveProperty("processingTimeMs")

			// Verify stats
			expect(result.calloutsFound).toBe(3)
			expect(result.calloutsMatched).toBe(2) // Only 2 valid markers
			expect(result.confidenceStats.averageConfidence).toBeCloseTo(
				(0.95 + 0.87 + 0.72) / 3,
				2,
			)
			expect(result.processingTimeMs).toBe(0)

			// Verify hyperlinks
			expect(result.hyperlinks).toHaveLength(3)

			// Verify first marker (3/A7)
			const marker1 = result.hyperlinks.find((h) => h.calloutRef === "3/A7")
			expect(marker1).toBeDefined()
			if (marker1) {
				expect(marker1.targetSheetRef).toBe("A7")
				expect(marker1.confidence).toBe(0.95)
				// bbox center: x=0.2+0.05/2=0.225, y=0.3+0.05/2=0.325
				expect(marker1.x).toBeCloseTo(0.225, 3)
				expect(marker1.y).toBeCloseTo(0.325, 3)
			}

			// Verify second marker (5/B2)
			const marker2 = result.hyperlinks.find((h) => h.calloutRef === "5/B2")
			expect(marker2).toBeDefined()
			if (marker2) {
				expect(marker2.targetSheetRef).toBe("B2")
				expect(marker2.confidence).toBe(0.87)
				// bbox center: x=0.6+0.05/2=0.625, y=0.4+0.05/2=0.425
				expect(marker2.x).toBeCloseTo(0.625, 3)
				expect(marker2.y).toBeCloseTo(0.425, 3)
			}

			// Verify third marker (2/C5)
			const marker3 = result.hyperlinks.find((h) => h.calloutRef === "2/C5")
			expect(marker3).toBeDefined()
			if (marker3) {
				expect(marker3.targetSheetRef).toBe("C5")
				expect(marker3.confidence).toBe(0.72)
				// bbox center: x=0.8+0.05/2=0.825, y=0.7+0.05/2=0.725
				expect(marker3.x).toBeCloseTo(0.825, 3)
				expect(marker3.y).toBeCloseTo(0.725, 3)
			}
		})

		it("should return empty array for sheet with no markers", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"markers-empty@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Markers Empty Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Markers Empty Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
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

			// Insert test sheet (no markers)
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Empty Sheet",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/image.dzi`,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/tiles`,
				width: 10000,
				height: 8000,
				tileCount: 512,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Test: Get markers for sheet with no markers
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/markers`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(200)
			const result = (await getResponse.json()) as {
				hyperlinks: Array<unknown>
				calloutsFound: number
				calloutsMatched: number
				confidenceStats: {
					averageConfidence: number
				}
				processingTimeMs: number
			}

			// Verify empty response
			expect(result.hyperlinks).toHaveLength(0)
			expect(result.calloutsFound).toBe(0)
			expect(result.calloutsMatched).toBe(0)
			expect(result.confidenceStats.averageConfidence).toBe(0)
			expect(result.processingTimeMs).toBe(0)
		})

		it("should return 404 for non-existent sheet", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"markers-404-sheet@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Markers 404 Sheet Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Markers 404 Sheet Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
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

			// Test: Get markers for non-existent sheet
			const nonExistentSheetId = crypto.randomUUID()
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${nonExistentSheetId}/markers`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(404)
		})

		it("should return 404 for non-existent plan", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"markers-404-plan@example.com",
			)
			await createOrgWithSubscription(authClient, "Markers 404 Plan Org")
			await authClient.organization.setActive({
				organizationId: "test-org-id",
			})

			// Test: Get markers for non-existent plan
			const nonExistentPlanId = crypto.randomUUID()
			const nonExistentSheetId = crypto.randomUUID()
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${nonExistentPlanId}/sheets/${nonExistentSheetId}/markers`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(404)
		})

		it("should handle markers with null bbox", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"markers-null-bbox@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Markers Null Bbox Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Markers Null Bbox Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
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

			const { planId, uploadId } = (await createResponse.json()) as {
				planId: string
				uploadId: string
			}

			// Insert test sheet
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheetId = crypto.randomUUID()

			await db.insert(schema.sheets).values({
				id: sheetId,
				planId,
				pageNumber: 1,
				sheetName: "Test Sheet",
				dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/image.dzi`,
				tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/tiles`,
				width: 10000,
				height: 8000,
				tileCount: 512,
				processingStatus: "complete",
				createdAt: new Date(),
			})

			// Insert marker with null bbox
			const markerId = crypto.randomUUID()

			await db.insert(schema.planMarkers).values({
				id: markerId,
				uploadId,
				planId,
				sheetNumber: 1,
				markerText: "1/A1",
				detail: "1",
				sheet: "A1",
				markerType: "circular",
				confidence: 0.9,
				isValid: true,
				fuzzyMatched: false,
				sourceTile: null,
				bbox: null, // Null bbox
				createdAt: new Date(),
			})

			// Test: Get markers
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheetId}/markers`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(200)
			const result = (await getResponse.json()) as {
				hyperlinks: Array<{
					calloutRef: string
					targetSheetRef: string
					x: number
					y: number
					confidence: number
				}>
			}

			// Verify marker with null bbox defaults to center (0.5, 0.5)
			expect(result.hyperlinks).toHaveLength(1)
			const marker = result.hyperlinks[0]
			expect(marker.calloutRef).toBe("1/A1")
			expect(marker.x).toBe(0.5) // Default center when bbox is null
			expect(marker.y).toBe(0.5) // Default center when bbox is null
		})

		it("should only return markers for the specified sheet", async () => {
			// Setup
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"markers-filter-sheet@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Markers Filter Sheet Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Markers Filter Sheet Project",
			)

			// Create plan
			const formData = new FormData()
			formData.append(
				"file",
				new Blob([await loadSamplePDF()], { type: "application/pdf" }),
				"test-plan.pdf",
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

			const { planId, uploadId } = (await createResponse.json()) as {
				planId: string
				uploadId: string
			}

			// Insert two sheets
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const sheet1Id = crypto.randomUUID()
			const sheet2Id = crypto.randomUUID()

			await db.insert(schema.sheets).values([
				{
					id: sheet1Id,
					planId,
					pageNumber: 1,
					sheetName: "Sheet 1",
					dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/image.dzi`,
					tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-1/tiles`,
					width: 10000,
					height: 8000,
					tileCount: 512,
					processingStatus: "complete",
					createdAt: new Date(),
				},
				{
					id: sheet2Id,
					planId,
					pageNumber: 2,
					sheetName: "Sheet 2",
					dziPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-2/image.dzi`,
					tileDirectory: `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/page-2/tiles`,
					width: 10000,
					height: 8000,
					tileCount: 512,
					processingStatus: "complete",
					createdAt: new Date(),
				},
			])

			// Insert markers for both sheets
			await db.insert(schema.planMarkers).values([
				{
					id: crypto.randomUUID(),
					uploadId,
					planId,
					sheetNumber: 1, // Sheet 1
					markerText: "1/A1",
					detail: "1",
					sheet: "A1",
					markerType: "circular",
					confidence: 0.9,
					isValid: true,
					fuzzyMatched: false,
					sourceTile: null,
					bbox: JSON.stringify({ x: 0.2, y: 0.3, w: 0.05, h: 0.05 }),
					createdAt: new Date(),
				},
				{
					id: crypto.randomUUID(),
					uploadId,
					planId,
					sheetNumber: 1, // Sheet 1
					markerText: "2/A2",
					detail: "2",
					sheet: "A2",
					markerType: "circular",
					confidence: 0.85,
					isValid: true,
					fuzzyMatched: false,
					sourceTile: null,
					bbox: JSON.stringify({ x: 0.4, y: 0.5, w: 0.05, h: 0.05 }),
					createdAt: new Date(),
				},
				{
					id: crypto.randomUUID(),
					uploadId,
					planId,
					sheetNumber: 2, // Sheet 2
					markerText: "3/B1",
					detail: "3",
					sheet: "B1",
					markerType: "circular",
					confidence: 0.8,
					isValid: true,
					fuzzyMatched: false,
					sourceTile: null,
					bbox: JSON.stringify({ x: 0.6, y: 0.7, w: 0.05, h: 0.05 }),
					createdAt: new Date(),
				},
			])

			// Test: Get markers for sheet 1 only
			const getResponse = await wrappedFetch(
				`http://localhost/api/plans/${planId}/sheets/${sheet1Id}/markers`,
				{
					method: "GET",
					headers: { cookie: sessionCookie },
				},
			)

			expect(getResponse.status).toBe(200)
			const result = (await getResponse.json()) as {
				hyperlinks: Array<{
					calloutRef: string
				}>
				calloutsFound: number
			}

			// Verify only sheet 1 markers are returned
			expect(result.calloutsFound).toBe(2)
			expect(result.hyperlinks).toHaveLength(2)
			expect(result.hyperlinks.some((h) => h.calloutRef === "1/A1")).toBe(true)
			expect(result.hyperlinks.some((h) => h.calloutRef === "2/A2")).toBe(true)
			expect(result.hyperlinks.some((h) => h.calloutRef === "3/B1")).toBe(false) // Should not be in results
		})
	})
})

