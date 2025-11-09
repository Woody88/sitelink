/**
 * Test environment setup endpoint
 * Finds/creates test resources and ALWAYS uploads a new plan
 * Only available in development mode
 */

import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "../../core/database/schemas"
import type { D1Database, R2Bucket } from "@cloudflare/workers-types"

interface Env {
	SitelinkDB: D1Database
	SitelinkStorage: R2Bucket
	BETTER_AUTH_SECRET: string
	RESEND_API_KEY: string
	EMAIL_ADDRESS: string
	R2_URL: string
	R2_ACCOUNT_ID: string
	R2_ACCESS_KEY_ID: string
	R2_SECRET_ACCESS_KEY: string
	R2_TOKEN: string
	ENVIRONMENT?: string
}

/**
 * Get or create test user
 */
async function getOrCreateUser(
	db: ReturnType<typeof drizzle>,
	email: string,
) {
	const crypto = globalThis.crypto
	const now = Date.now()

	// Check if user exists
	const existingUsers = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, email))
		.limit(1)

	if (existingUsers.length > 0 && existingUsers[0]) {
		console.log("✅ Found existing user:", existingUsers[0].id)
		return existingUsers[0].id
	}

	// Create new user
	const userId = crypto.randomUUID()
	console.log("Creating new user:", email)
	await db.insert(schema.users).values({
		id: userId,
		name: "Test User",
		email,
		emailVerified: true,
		createdAt: new Date(now),
		updatedAt: new Date(now),
	})
	console.log("✅ User created:", userId)

	return userId
}

/**
 * Create authenticated session by directly creating session in database
 */
async function createAuthenticatedSession(
	db: ReturnType<typeof drizzle>,
	userId: string,
) {
	const crypto = globalThis.crypto
	const now = Date.now()

	console.log("Creating authenticated session for user:", userId)

	// Create session token
	const sessionToken = crypto.randomUUID()
	const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000) // 30 days from now

	// Insert session into database
	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt,
		ipAddress: "127.0.0.1",
		userAgent: "Test",
		createdAt: new Date(now),
		updatedAt: new Date(now),
	})

	console.log("✅ Session created in database")

	// Return session cookie in the format better-auth expects
	const sessionCookie = `better-auth.session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`

	return sessionCookie
}

/**
 * Get or create test organization
 */
async function getOrCreateOrganization(
	db: ReturnType<typeof drizzle>,
	userId: string,
	orgName: string,
) {
	const crypto = globalThis.crypto
	const now = Date.now()

	// Check if org exists
	const existingOrgs = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.name, orgName))
		.limit(1)

	if (existingOrgs.length > 0 && existingOrgs[0]) {
		console.log("✅ Found existing organization - REUSING:", existingOrgs[0].id)

		// Make sure user is a member
		const members = await db
			.select()
			.from(schema.members)
			.where(
				and(
					eq(schema.members.organizationId, existingOrgs[0].id),
					eq(schema.members.userId, userId),
				),
			)
			.limit(1)

		if (members.length === 0) {
			// Add user as member
			await db.insert(schema.members).values({
				id: crypto.randomUUID(),
				organizationId: existingOrgs[0].id,
				userId,
				role: "owner",
				createdAt: new Date(now),
			})
			console.log("✅ Added user as organization member")
		}

		return existingOrgs[0].id
	}

	// Only create if doesn't exist
	const orgId = crypto.randomUUID()
	const slug = `${orgName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`

	await db.insert(schema.organizations).values({
		id: orgId,
		name: orgName,
		slug,
		createdAt: new Date(now),
	})

	// Add user as owner
	await db.insert(schema.members).values({
		id: crypto.randomUUID(),
		organizationId: orgId,
		userId,
		role: "owner",
		createdAt: new Date(now),
	})

	console.log("✅ New organization created:", orgId)

	return orgId
}

/**
 * Get or create test project
 */
async function getOrCreateProject(
	db: ReturnType<typeof drizzle>,
	organizationId: string,
	projectName: string,
) {
	const crypto = globalThis.crypto
	const now = Date.now()

	// Check if project exists
	const existingProjects = await db
		.select()
		.from(schema.projects)
		.where(
			and(
				eq(schema.projects.organizationId, organizationId),
				eq(schema.projects.name, projectName),
			),
		)
		.limit(1)

	if (existingProjects.length > 0 && existingProjects[0]) {
		console.log("✅ Found existing project - REUSING:", existingProjects[0].id)
		return existingProjects[0].id
	}

	// Only create if doesn't exist
	const projectId = crypto.randomUUID()

	await db.insert(schema.projects).values({
		id: projectId,
		organizationId,
		name: projectName,
		createdAt: new Date(now),
	})

	console.log("✅ New project created:", projectId)

	return projectId
}

/**
 * Create a minimal valid PDF for testing
 */
function createTestPDF(): Uint8Array {
	const minimalPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
410
%%EOF`

	const encoder = new TextEncoder()
	return encoder.encode(minimalPDF)
}

/**
 * Update session to set active organization
 */
async function setActiveOrganization(
	db: ReturnType<typeof drizzle>,
	userId: string,
	organizationId: string,
) {
	// Update all sessions for this user to set active org
	await db
		.update(schema.sessions)
		.set({ activeOrganizationId: organizationId })
		.where(eq(schema.sessions.userId, userId))

	console.log("✅ Active organization set in sessions")
}

/**
 * Main handler for test environment setup
 */
export async function handleTestSetup(
	request: Request,
	env: Env,
): Promise<Response> {
	// Only allow in development mode
	const isDev = env.ENVIRONMENT === "development" || !env.ENVIRONMENT
	if (!isDev) {
		return new Response(
			JSON.stringify({
				error: "Test endpoint only available in development mode",
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } },
		)
	}

	try {
		const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

		// Always use the request URL origin since we're making calls from within the worker
		const url = new URL(request.url)
		const baseUrl = `${url.protocol}//${url.host}`

		console.log("Using baseURL:", baseUrl)
		console.log("🚀 Creating test environment...")

		const email = "test@example.com"
		const orgName = "Test Org"
		const projectName = "Test Project"
		const planName = `Test Plan ${Date.now()}`

		// 1. Get or create user
		console.log("1️⃣ Getting/creating user...")
		const userId = await getOrCreateUser(db, email)

		// 2. Get or create organization
		console.log("2️⃣ Getting/creating organization...")
		const organizationId = await getOrCreateOrganization(db, userId, orgName)

		// 3. Set active organization
		console.log("3️⃣ Setting active organization...")
		await setActiveOrganization(db, userId, organizationId)

		// 4. Get or create project
		console.log("4️⃣ Getting/creating project...")
		const projectId = await getOrCreateProject(db, organizationId, projectName)

		// 5. Create authenticated session
		console.log("5️⃣ Creating authenticated session...")
		const sessionCookie = await createAuthenticatedSession(db, userId)

		// 6. Upload plan (ALWAYS creates new plan)
		console.log("6️⃣ Uploading NEW plan...")
		const pdfData = createTestPDF()
		const formData = new FormData()
		const pdfBlob = new Blob([pdfData], { type: "application/pdf" })
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
			console.error("Failed to upload plan:", errorText)
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

		console.log("✅ Plan uploaded successfully!")

		return new Response(
			JSON.stringify(
				{
					success: true,
					message: "Test environment created and NEW plan uploaded",
					data: {
						userId,
						organizationId,
						projectId,
						planId: planUploadResponse.planId,
						uploadId: planUploadResponse.uploadId,
						fileId: planUploadResponse.fileId,
						jobId: planUploadResponse.jobId,
						planName,
					},
				},
				null,
				2,
			),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		)
	} catch (error) {
		console.error("❌ Test setup failed:", error)
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		)
	}
}
