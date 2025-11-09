/**
 * Standalone test helper for manual testing with dev server
 * Uses magic link authentication like the regular test helper
 */

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { createTestAuthClient } from "../../src/core/auth/client"
import * as schema from "../../src/core/database/schemas"

/**
 * Get local D1 database connection
 * Accesses the local dev database directly
 */
function getLocalDb() {
	const dbPath =
		".wrangler/state/v3/d1/miniflare-D1DatabaseObject/1bfa5e8ee82606601526f90ef320195702c729e781f59e4dd2577221ec89c2e9.sqlite"

	const client = createClient({
		url: `file:${dbPath}`,
	})

	return drizzle(client, { schema, casing: "snake_case" })
}

/**
 * Create authenticated user for standalone testing
 * Uses magic link authentication and queries local database for verification token
 */
async function createAuthenticatedUser(email: string, baseUrl: string) {
	const db = getLocalDb()
	const authClient = createTestAuthClient(baseUrl)

	// Request magic link
	await authClient.signIn.magicLink({
		email,
		name: "Test User",
		callbackURL: "/",
		newUserCallbackURL: "/registration",
		errorCallbackURL: "/error",
	})

	// Query local database for verification token
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

	// Verify magic link to get session
	const magicLinkUrl = `${baseUrl}/api/auth/magic-link/verify?token=${verification.identifier}&callbackURL=/`
	const verifyResponse = await fetch(magicLinkUrl, {
		redirect: "manual",
	})

	if (verifyResponse.status !== 302) {
		throw new Error(`Magic link verification failed: ${verifyResponse.status}`)
	}

	const sessionCookie = verifyResponse.headers.get("set-cookie")
	if (!sessionCookie || !sessionCookie.includes("better-auth.session_token")) {
		throw new Error("No session cookie found")
	}

	// Create authenticated client with session cookie
	const authenticatedClient = createTestAuthClient(baseUrl, (input, init) => {
		const headers = new Headers(init?.headers)
		headers.set("cookie", sessionCookie)
		return fetch(input, { ...init, headers })
	})

	const { data: sessionData } = await authenticatedClient.getSession()
	if (!sessionData?.user) {
		throw new Error("No user in session")
	}

	return {
		sessionCookie,
		authClient: authenticatedClient,
		userId: sessionData.user.id,
	}
}

/**
 * Create organization with subscription
 */
async function createOrgWithSubscription(
	authClient: ReturnType<typeof createTestAuthClient>,
	orgName: string,
) {
	const orgResponse = await authClient.organization.create({
		name: orgName,
		slug: `${orgName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
	})

	if (!orgResponse.data) {
		throw new Error("Failed to create organization")
	}

	return {
		organizationId: orgResponse.data.id,
	}
}

/**
 * Create project
 * Note: organizationId comes from session.activeOrganizationId, not from payload
 */
async function createProject(
	sessionCookie: string,
	organizationId: string,
	projectName: string,
	baseUrl: string,
) {
	const response = await fetch(`${baseUrl}/api/projects`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			cookie: sessionCookie,
		},
		body: JSON.stringify({
			name: projectName,
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Failed to create project: ${response.status} - ${errorText}`)
	}

	const result = (await response.json()) as { projectId: string }
	return result.projectId
}

/**
 * Load sample PDF from fixtures
 */
async function loadSamplePDF(): Promise<Uint8Array> {
	const fs = await import("node:fs/promises")
	const path = await import("node:path")

	const pdfPath = path.join(
		process.cwd(),
		"tests",
		"fixtures",
		"sample-plan.pdf",
	)
	const buffer = await fs.readFile(pdfPath)
	return new Uint8Array(buffer)
}

/**
 * Create a complete test environment with user, organization, project, and plan
 * This standalone version works with the dev server
 *
 * @param email - Email for the test user
 * @param orgName - Organization name
 * @param projectName - Project name
 * @param planName - Plan name
 * @param baseUrl - Base URL for API requests (e.g., http://localhost:8787)
 * @param pdfData - PDF file data (optional, uses sample PDF if not provided)
 * @returns Complete test context including IDs, session, and plan upload response
 */
export async function createCompleteTestEnvironment(options: {
	email: string
	orgName: string
	projectName: string
	planName: string
	baseUrl: string
	pdfData?: Uint8Array
}) {
	const { email, orgName, projectName, planName, baseUrl, pdfData } = options

	console.log("🚀 Creating complete test environment...")

	// 1. Create authenticated user with session
	console.log("1️⃣  Creating authenticated user...")
	const { sessionCookie, authClient, userId } = await createAuthenticatedUser(
		email,
		baseUrl,
	)
	console.log(`   ✅ User created: ${userId}`)

	// 2. Create organization with subscription
	console.log("2️⃣  Creating organization...")
	const { organizationId } = await createOrgWithSubscription(authClient, orgName)
	console.log(`   ✅ Organization created: ${organizationId}`)

	// 3. Set active organization (important for permissions)
	console.log("3️⃣  Setting active organization...")
	await authClient.organization.setActive({ organizationId })
	console.log(`   ✅ Active organization set`)

	// 4. Create project
	console.log("4️⃣  Creating project...")
	const projectId = await createProject(
		sessionCookie,
		organizationId,
		projectName,
		baseUrl,
	)
	console.log(`   ✅ Project created: ${projectId}`)

	// 5. Load PDF data if not provided
	console.log("5️⃣  Loading PDF data...")
	const pdfToUpload = pdfData ?? (await loadSamplePDF())
	console.log(`   ✅ PDF loaded (${pdfToUpload.length} bytes)`)

	// 6. Create plan with PDF upload - this triggers container processing
	console.log("6️⃣  Uploading plan (this triggers container processing)...")
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

	console.log(
		"   ✅ Plan uploaded successfully:",
		JSON.stringify(planUploadResponse, null, 2),
	)

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
