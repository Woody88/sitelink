import { env, SELF } from "cloudflare:test"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { describe, expect, it } from "vitest"
import { createTestAuthClient } from "../../src/core/auth/client"
import * as schema from "../../src/core/database/schemas"

describe("Project Module", () => {
	const wrappedFetch: typeof fetch = (input, init) => SELF.fetch(input, init)

	/**
	 * Helper: Create and authenticate a user via magic link
	 * Returns an authenticated authClient that includes session cookie in all requests
	 */
	async function createAuthenticatedUser(email: string) {
		const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
		const authClient = createTestAuthClient("http://localhost", wrappedFetch)

		// Send magic link
		await authClient.signIn.magicLink({
			email,
			name: "Test User",
			callbackURL: "/",
			newUserCallbackURL: "/registration",
			errorCallbackURL: "/error",
		})

		// Get verification token from database
		const verifications = await db
			.select({
				identifier: schema.verifications.identifier,
			})
			.from(schema.verifications)
			.orderBy(schema.verifications.createdAt)
			.limit(1)

		expect(verifications).toHaveLength(1)
		const verification = verifications[0]
		if (!verification) throw new Error("No verification found")

		// Verify magic link
		const magicLinkUrl = `http://localhost/api/auth/magic-link/verify?token=${verification.identifier}&callbackURL=/`
		const verifyResponse = await wrappedFetch(magicLinkUrl, {
			redirect: "manual",
		})

		expect(verifyResponse.status).toBe(302)

		const sessionCookie = verifyResponse.headers.get("set-cookie")
		expect(sessionCookie).toContain("better-auth.session_token")

		if (!sessionCookie) throw new Error("No session cookie")

		// Create authenticated fetch that injects the session cookie
		const authenticatedFetch: typeof fetch = (input, init) => {
			const headers = new Headers(init?.headers)
			headers.set("cookie", sessionCookie)
			return SELF.fetch(input, { ...init, headers })
		}

		// Create new auth client with authenticated fetch
		const authenticatedClient = createTestAuthClient(
			"http://localhost",
			authenticatedFetch,
		)

		// Get userId from session using the authenticated client
		const { data: sessionData } = await authenticatedClient.getSession()
		expect(sessionData?.user).toBeDefined()
		if (!sessionData?.user) throw new Error("No user in session")

		return {
			authClient: authenticatedClient,
			userId: sessionData.user.id,
			sessionCookie: sessionCookie,
			authenticatedFetch,
		}
	}

	/**
	 * Helper: Create an organization with a subscription
	 */
	async function createOrgWithSubscription(
		authClient: ReturnType<typeof createTestAuthClient>,
		orgName: string,
		seats: number,
		subscriptionStatus: "active" | "past_due" | "canceled" = "active",
	) {
		const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

		// Create organization via Better-Auth client
		const { data: orgData, error } = await authClient.organization.create({
			name: orgName,
			slug: orgName.toLowerCase().replace(/\s+/g, "-"),
		})

		if (error) {
			console.error("Organization creation error:", error)
		}

		expect(error).toBeNull()
		expect(orgData).toBeDefined()
		if (!orgData) throw new Error("No organization data")

		// Insert subscription directly into database
		await db.insert(schema.subscriptions).values({
			id: `sub-${Date.now()}`,
			polarSubscriptionId: `polar-${Date.now()}`,
			organizationId: orgData.id,
			plan: seats === 1 ? "free" : "pro",
			seats,
			status: subscriptionStatus,
			currentPeriodStart: new Date(),
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		return {
			organizationId: orgData.id as string,
			organizationSlug: orgData.slug as string,
		}
	}

	describe("Project CRUD Operations", () => {
		it("should create a project in an active organization", async () => {
			// Setup: Create authenticated user with organization
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-create@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Project Test Org",
				5,
			)

			// Switch to active organization
			await authClient.organization.setActive({ organizationId })

			// Create project
			const createResponse = await wrappedFetch(
				"http://localhost/projects/",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						cookie: sessionCookie,
					},
					body: JSON.stringify({
						name: "Test Project",
						description: "A test construction project",
					}),
				},
			)

			expect(createResponse.status).toBe(200)
			const data = (await createResponse.json()) as { projectId: string }
			expect(data.projectId).toBeDefined()
			expect(typeof data.projectId).toBe("string")
		})

		it("should get a project by ID", async () => {
			// Setup: Create authenticated user with organization and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-get@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Get Project Org",
				5,
			)

			await authClient.organization.setActive({ organizationId })

			// Create project
			const createResponse = await wrappedFetch(
				"http://localhost/projects/",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						cookie: sessionCookie,
					},
					body: JSON.stringify({
						name: "Get Test Project",
						description: "Project to retrieve",
					}),
				},
			)

			const { projectId } = (await createResponse.json()) as {
				projectId: string
			}

			// Get project
			const getResponse = await wrappedFetch(
				`http://localhost/projects/${projectId}`,
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(getResponse.status).toBe(200)
			const project = (await getResponse.json()) as {
				id: string
				name: string
				description: string
				organizationId: string
				createdAt: string
			}
			expect(project).toMatchObject({
				id: projectId,
				name: "Get Test Project",
				description: "Project to retrieve",
				organizationId,
			})
			expect(project.createdAt).toBeDefined()
		})

		it("should list all projects for an organization", async () => {
			// Setup: Create authenticated user with organization
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-list@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"List Projects Org",
				5,
			)

			await authClient.organization.setActive({ organizationId })

			// Create multiple projects
			await wrappedFetch("http://localhost/projects/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: sessionCookie,
				},
				body: JSON.stringify({
					name: "Project Alpha",
					description: "First project",
				}),
			})

			await wrappedFetch("http://localhost/projects/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					cookie: sessionCookie,
				},
				body: JSON.stringify({
					name: "Project Beta",
					description: "Second project",
				}),
			})

			// List projects
			const listResponse = await wrappedFetch(
				`http://localhost/projects/organizations/${organizationId}/projects`,
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(listResponse.status).toBe(200)
			const data = (await listResponse.json()) as {
				projects: Array<{
					id: string
					name: string
					description: string | null
					createdAt: string
				}>
			}

			expect(data.projects).toHaveLength(2)
			expect(data.projects.map((p) => p.name)).toContain("Project Alpha")
			expect(data.projects.map((p) => p.name)).toContain("Project Beta")
		})

		it("should update a project", async () => {
			// Setup: Create authenticated user with organization and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-update@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Update Project Org",
				5,
			)

			await authClient.organization.setActive({ organizationId })

			// Create project
			const createResponse = await wrappedFetch(
				"http://localhost/projects/",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						cookie: sessionCookie,
					},
					body: JSON.stringify({
						name: "Original Name",
						description: "Original description",
					}),
				},
			)

			const { projectId } = (await createResponse.json()) as {
				projectId: string
			}

			// Update project
			const updateResponse = await wrappedFetch(
				`http://localhost/projects/${projectId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						cookie: sessionCookie,
					},
					body: JSON.stringify({
						name: "Updated Name",
						description: "Updated description",
					}),
				},
			)

			expect(updateResponse.status).toBe(200)
			const updateData = await updateResponse.json()
			expect(updateData).toEqual({ success: true })

			// Verify update
			const getResponse = await wrappedFetch(
				`http://localhost/projects/${projectId}`,
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			const project = (await getResponse.json()) as {
				name: string
				description: string
			}
			expect(project.name).toBe("Updated Name")
			expect(project.description).toBe("Updated description")
		})

		it("should delete a project", async () => {
			// Setup: Create authenticated user with organization and project
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-delete@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Delete Project Org",
				5,
			)

			await authClient.organization.setActive({ organizationId })

			// Create project
			const createResponse = await wrappedFetch(
				"http://localhost/projects/",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						cookie: sessionCookie,
					},
					body: JSON.stringify({
						name: "To Be Deleted",
						description: "This project will be deleted",
					}),
				},
			)

			const { projectId } = (await createResponse.json()) as {
				projectId: string
			}

			// Delete project
			const deleteResponse = await wrappedFetch(
				`http://localhost/projects/${projectId}`,
				{
					method: "DELETE",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(deleteResponse.status).toBe(200)
			const deleteData = await deleteResponse.json()
			expect(deleteData).toEqual({ success: true })

			// Verify project is deleted (should return 404)
			const getResponse = await wrappedFetch(
				`http://localhost/projects/${projectId}`,
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(getResponse.status).toBe(404)
		})
	})

	describe("Project Business Rules", () => {
		it("should block project creation in soft-deleted organization", async () => {
			const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

			// Setup: Create authenticated user with organization
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-deleted-org@example.com",
			)
			const { organizationId } = await createOrgWithSubscription(
				authClient,
				"Soon Deleted Org",
				5,
			)

			await authClient.organization.setActive({ organizationId })

			// Soft-delete the organization directly in database
			await db
				.update(schema.organizations)
				.set({ deletedAt: new Date() })
				.where(eq(schema.organizations.id, organizationId))

			// Try to create project in deleted organization
			const createResponse = await wrappedFetch(
				"http://localhost/projects/",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						cookie: sessionCookie,
					},
					body: JSON.stringify({
						name: "Should Fail",
						description: "This should not be created",
					}),
				},
			)

			expect(createResponse.status).toBe(404)
		})

		it("should return 404 for non-existent project", async () => {
			// Setup: Create authenticated user
			const { sessionCookie, authClient } = await createAuthenticatedUser(
				"project-404@example.com",
			)
			await createOrgWithSubscription(authClient, "404 Test Org", 5)

			// Try to get non-existent project
			const getResponse = await wrappedFetch(
				"http://localhost/projects/00000000-0000-0000-0000-000000000000",
				{
					method: "GET",
					headers: {
						cookie: sessionCookie,
					},
				},
			)

			expect(getResponse.status).toBe(404)
		})

		it("should require authentication for all project endpoints", async () => {
			// Try to create project without authentication
			const createResponse = await wrappedFetch(
				"http://localhost/projects/",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: "Should Fail",
						description: "No auth",
					}),
				},
			)

			expect(createResponse.status).toBe(401)

			// Try to get project without authentication
			const getResponse = await wrappedFetch(
				"http://localhost/projects/some-id",
				{
					method: "GET",
				},
			)

			expect(getResponse.status).toBe(401)
		})
	})
})
