import { env } from "cloudflare:test"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { describe, expect, it } from "vitest"
import * as schema from "../../src/core/database/schemas"
import {
	createAuthenticatedUser,
	createOrgWithSubscription,
	createProject,
	wrappedFetch,
} from "../helpers"

describe("Media Module", () => {
	describe("Media Upload", () => {
		it("should upload a single photo successfully", async () => {
			// Setup: Create authenticated user, organization, and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"media-upload-single@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Media Test Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Media Project",
			)

			// Create multipart form data with a photo
			const photoData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) // Minimal JPEG header
			const formData = new FormData()
			formData.append(
				"photo",
				new Blob([photoData], { type: "image/jpeg" }),
				"test-photo.jpg",
			)
			formData.append("description", "Test photo description")
			formData.append("status", "complete")

			// Upload media
			const uploadResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/media`,
				{
					method: "POST",
					headers: {
						cookie: sessionCookie,
					},
					body: formData,
				},
			)

			expect(uploadResponse.status).toBe(200)
			const data = (await uploadResponse.json()) as {
				media: Array<{ mediaId: string; fileName: string; mediaType: string }>
			}
			expect(data.media).toHaveLength(1)
			expect(data.media[0].mediaId).toBeDefined()
			expect(data.media[0].fileName).toBe("photo")
			expect(data.media[0].mediaType).toBe("photo")

			// Verify database entry
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const mediaRecords = await db
				.select()
				.from(schema.media)
				.where(eq(schema.media.id, data.media[0].mediaId))
			expect(mediaRecords).toHaveLength(1)
			expect(mediaRecords[0]).toMatchObject({
				id: data.media[0].mediaId,
				projectId,
				mediaType: "photo",
				status: "complete",
				description: "Test photo description",
			})
		})

		it("should upload two photos in sequence without crashing", async () => {
			// Setup: Create authenticated user, organization, and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"media-upload-sequential@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Media Sequential Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Sequential Media Project",
			)

			// Create first photo
			const photoData1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) // Minimal JPEG header
			const formData1 = new FormData()
			formData1.append(
				"photo1",
				new Blob([photoData1], { type: "image/jpeg" }),
				"photo-1.jpg",
			)
			formData1.append("description", "First photo")

			// Upload first photo
			const upload1Response = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/media`,
				{
					method: "POST",
					headers: {
						cookie: sessionCookie,
					},
					body: formData1,
				},
			)

			expect(upload1Response.status).toBe(200)
			const data1 = (await upload1Response.json()) as {
				media: Array<{ mediaId: string; fileName: string; mediaType: string }>
			}
			expect(data1.media).toHaveLength(1)

			// Create second photo
			const photoData2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe1]) // Different JPEG data
			const formData2 = new FormData()
			formData2.append(
				"photo2",
				new Blob([photoData2], { type: "image/jpeg" }),
				"photo-2.jpg",
			)
			formData2.append("description", "Second photo")

			// Upload second photo - THIS WAS CRASHING BEFORE THE FIX
			const upload2Response = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/media`,
				{
					method: "POST",
					headers: {
						cookie: sessionCookie,
					},
					body: formData2,
				},
			)

			expect(upload2Response.status).toBe(200)
			const data2 = (await upload2Response.json()) as {
				media: Array<{ mediaId: string; fileName: string; mediaType: string }>
			}
			expect(data2.media).toHaveLength(1)
			expect(data2.media[0].mediaId).not.toBe(data1.media[0].mediaId)

			// Verify both photos are in database
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const mediaRecords = await db
				.select()
				.from(schema.media)
				.where(eq(schema.media.projectId, projectId))
			expect(mediaRecords).toHaveLength(2)
		})

		it("should upload multiple photos in a single request", async () => {
			// Setup: Create authenticated user, organization, and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"media-upload-multiple@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Media Multiple Org",
			)
			await authClient.organization.setActive({ organizationId })
			const projectId = await createProject(
				sessionCookie,
				organizationId,
				"Multiple Media Project",
			)

			// Create multipart form data with multiple photos
			const photoData1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
			const photoData2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe1])
			const formData = new FormData()
			formData.append(
				"photo1",
				new Blob([photoData1], { type: "image/jpeg" }),
				"batch-photo-1.jpg",
			)
			formData.append(
				"photo2",
				new Blob([photoData2], { type: "image/jpeg" }),
				"batch-photo-2.jpg",
			)
			formData.append("description", "Batch upload")

			// Upload both photos
			const uploadResponse = await wrappedFetch(
				`http://localhost/api/projects/${projectId}/media`,
				{
					method: "POST",
					headers: {
						cookie: sessionCookie,
					},
					body: formData,
				},
			)

			expect(uploadResponse.status).toBe(200)
			const data = (await uploadResponse.json()) as {
				media: Array<{ mediaId: string; fileName: string; mediaType: string }>
			}
			expect(data.media).toHaveLength(2)
			expect(data.media[0].mediaId).toBeDefined()
			expect(data.media[1].mediaId).toBeDefined()
			expect(data.media[0].mediaId).not.toBe(data.media[1].mediaId)

			// Verify both photos are in database
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
			const mediaRecords = await db
				.select()
				.from(schema.media)
				.where(eq(schema.media.projectId, projectId))
			expect(mediaRecords).toHaveLength(2)
		})
	})
})
