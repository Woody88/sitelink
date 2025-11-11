import { env, SELF } from "cloudflare:test"
import { drizzle } from "drizzle-orm/d1"
import { createTestAuthClient } from "../../src/core/auth/client"
import * as schema from "../../src/core/database/schemas"

/**
 * Wrapped fetch that routes through the test worker
 */
export const wrappedFetch: typeof fetch = (input, init) =>
	SELF.fetch(input, init)

/**
 * Create and authenticate a user via magic link
 *
 * @param email - Email address for the user
 * @returns Authenticated client, user ID, and session cookie
 */
export async function createAuthenticatedUser(email: string) {
	const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })
	const authClient = createTestAuthClient("http://localhost", wrappedFetch)

	await authClient.signIn.magicLink({
		email,
		name: "Test User",
		callbackURL: "/",
		newUserCallbackURL: "/registration",
		errorCallbackURL: "/error",
	})

	const verifications = await db
		.select({ identifier: schema.verifications.identifier })
		.from(schema.verifications)
		.orderBy(schema.verifications.createdAt)
		.limit(1)

	if (verifications.length === 0) {
		throw new Error("No verification found")
	}

	const verification = verifications[0]
	if (!verification) {
		throw new Error("No verification found")
	}

	const magicLinkUrl = `http://localhost/api/auth/magic-link/verify?token=${verification.identifier}&callbackURL=/`
	const verifyResponse = await wrappedFetch(magicLinkUrl, {
		redirect: "manual",
	})

	if (verifyResponse.status !== 302) {
		throw new Error(`Magic link verification failed: ${verifyResponse.status}`)
	}

	const sessionCookie = verifyResponse.headers.get("set-cookie")
	if (!sessionCookie || !sessionCookie.includes("better-auth.session_token")) {
		throw new Error("No session cookie found")
	}

	const authenticatedClient = createTestAuthClient(
		"http://localhost",
		(input, init) => {
			const headers = new Headers(init?.headers)
			headers.set("cookie", sessionCookie)
			return SELF.fetch(input, { ...init, headers })
		},
	)

	const { data: sessionData } = await authenticatedClient.getSession()
	if (!sessionData?.user) {
		throw new Error("No user in session")
	}

	return {
		authClient: authenticatedClient,
		userId: sessionData.user.id,
		sessionCookie,
	}
}

/**
 * Create an organization with a subscription
 *
 * @param authClient - Authenticated auth client
 * @param orgName - Organization name
 * @returns Organization ID and slug
 */
export async function createOrgWithSubscription(
	authClient: ReturnType<typeof createTestAuthClient>,
	orgName: string,
) {
	const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

	const { data: orgData, error } = await authClient.organization.create({
		name: orgName,
		slug: orgName.toLowerCase().replace(/\s+/g, "-"),
	})

	if (error || !orgData) {
		throw new Error(`Failed to create organization: ${error}`)
	}

	await db.insert(schema.subscriptions).values({
		id: `sub-${Date.now()}`,
		polarSubscriptionId: `polar-${Date.now()}`,
		organizationId: orgData.id,
		plan: "pro",
		seats: 5,
		status: "active",
		currentPeriodStart: new Date(),
		currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return {
		organizationId: orgData.id as string,
		organizationSlug: orgData.slug as string,
	}
}

/**
 * Create a project within an organization
 *
 * @param sessionCookie - Session cookie for authenticated requests
 * @param organizationId - Organization ID (not currently used but kept for consistency)
 * @param projectName - Project name
 * @returns Project ID
 */
export async function createProject(
	sessionCookie: string,
	_organizationId: string,
	projectName: string,
) {
	const createResponse = await wrappedFetch("http://localhost/api/projects/", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			cookie: sessionCookie,
		},
		body: JSON.stringify({
			name: projectName,
			description: "Test project",
		}),
	})

	if (createResponse.status !== 200) {
		const errorText = await createResponse.text()
		throw new Error(
			`Failed to create project: ${createResponse.status} - ${errorText}`,
		)
	}

	const { projectId } = (await createResponse.json()) as { projectId: string }
	return projectId
}

/**
 * Complete setup: Create user, organization with subscription, and project
 *
 * @param email - Email for the user
 * @param orgName - Organization name
 * @param projectName - Project name
 * @returns All IDs and session information
 */
export async function setupUserOrgAndProject(
	email: string,
	orgName: string,
	projectName: string,
) {
	const { sessionCookie, authClient, userId } =
		await createAuthenticatedUser(email)

	const { organizationId, organizationSlug } = await createOrgWithSubscription(
		authClient,
		orgName,
	)

	await authClient.organization.setActive({ organizationId })

	const projectId = await createProject(
		sessionCookie,
		organizationId,
		projectName,
	)

	return {
		sessionCookie,
		authClient,
		userId,
		organizationId,
		organizationSlug,
		projectId,
	}
}

/**
 * Upload a PDF plan and trigger processing
 *
 * @param sessionCookie - Session cookie for authenticated requests
 * @param projectId - Project ID to upload to
 * @param pdfData - PDF file data
 * @param planName - Name for the plan
 * @returns Plan ID, upload ID, and job ID
 */
export async function createPlan(
	sessionCookie: string,
	projectId: string,
	pdfData: Uint8Array,
	planName: string,
) {
	const formData = new FormData()
	const pdfBlob = new Blob([pdfData], { type: "application/pdf" })
	formData.append("file", pdfBlob, `${planName}.pdf`)
	formData.append("projectId", projectId)
	formData.append("name", planName)

	const uploadResponse = await wrappedFetch(
		`http://localhost/api/projects/${projectId}/plans`,
		{
			method: "POST",
			headers: {
				cookie: sessionCookie,
			},
			body: formData,
		},
	)

	if (!uploadResponse.ok) {
		const errorText = await uploadResponse.text()
		throw new Error(
			`Failed to upload plan: ${uploadResponse.status} - ${errorText}`,
		)
	}

	const result = (await uploadResponse.json()) as {
		jobId: string
		planId: string
		uploadId: string
		fileId: string
	}

	return result
}

/**
 * Poll for a condition with timeout
 *
 * @param condition - Async function that returns true when condition is met
 * @param options - Timeout and polling interval options
 * @returns Resolves when condition is met
 * @throws Error if timeout is reached
 */
export async function waitFor(
	condition: () => Promise<boolean>,
	options: { timeout?: number; interval?: number } = {},
): Promise<void> {
	const { timeout = 30000, interval = 1000 } = options
	const startTime = Date.now()

	while (Date.now() - startTime < timeout) {
		try {
			if (await condition()) {
				return
			}
		} catch (error) {
			// Ignore errors during polling, they might be expected (e.g., 404 while resource is being created)
		}

		await new Promise((resolve) => setTimeout(resolve, interval))
	}

	throw new Error(`Timeout after ${timeout}ms waiting for condition`)
}

/**
 * Create a complete test environment with user, organization, project, and plan
 * This is useful for testing container-based PDF processing
 *
 * @param email - Email for the test user
 * @param orgName - Organization name
 * @param projectName - Project name
 * @param planName - Plan name
 * @param pdfData - PDF file data (optional, uses sample PDF if not provided)
 * @param baseUrl - Base URL for API requests (default: http://localhost, use http://localhost:8787 for dev server)
 * @returns Complete test context including IDs, session, and plan upload response
 */
export async function createCompleteTestEnvironment(options: {
	email: string
	orgName: string
	projectName: string
	planName: string
	pdfData?: Uint8Array
	baseUrl?: string
}) {
	const {
		email,
		orgName,
		projectName,
		planName,
		pdfData,
		baseUrl = "http://localhost",
	} = options

	// 1. Create authenticated user with session
	const { sessionCookie, authClient } = await createAuthenticatedUser(email)

	// 2. Create organization with subscription
	const { organizationId } = await createOrgWithSubscription(authClient, orgName)

	// 3. Set active organization (important for permissions)
	await authClient.organization.setActive({ organizationId })

	// 4. Create project
	const projectId = await createProject(sessionCookie, organizationId, projectName)

	// 5. Load PDF data if not provided
	const { loadSamplePDF } = await import("./fixtures")
	const pdfToUpload = pdfData ?? (await loadSamplePDF())

	// 6. Create plan with PDF upload - this triggers container processing
	const formData = new FormData()
	const pdfBlob = new Blob([pdfToUpload], { type: "application/pdf" })
	formData.append("file", pdfBlob, `${planName}.pdf`)
	formData.append("projectId", projectId)
	formData.append("name", planName)

	const uploadResponse = await fetch(
		`${baseUrl}/api/projects/${projectId}/plans`,
		{
			method: "POST",
			headers: {
				cookie: sessionCookie,
			},
			body: formData,
		},
	)

	if (!uploadResponse.ok) {
		const errorText = await uploadResponse.text()
		throw new Error(
			`Failed to upload plan: ${uploadResponse.status} - ${errorText}`,
		)
	}

	const planUploadResponse = (await uploadResponse.json()) as {
		jobId: string
		planId: string
		uploadId: string
		fileId: string
	}

	console.log("✅ Plan upload response:", JSON.stringify(planUploadResponse, null, 2))

	return {
		sessionCookie,
		authClient,
		organizationId,
		projectId,
		planId: planUploadResponse.planId,
		uploadId: planUploadResponse.uploadId,
		fileId: planUploadResponse.fileId,
		jobId: planUploadResponse.jobId,
		planUploadResponse,
	}
}
