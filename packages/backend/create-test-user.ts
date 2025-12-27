/**
 * Create a test user with password, organization, and project
 * 
 * Usage: bun run create-test-user.ts
 * 
 * This script:
 * 1. Signs up a user with email/password
 * 2. Creates an organization
 * 3. Sets the active organization
 * 4. Creates a project
 * 5. Prints all credentials and IDs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:8787"
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com"
const TEST_PASSWORD = process.env.TEST_PASSWORD || "password123"
const TEST_NAME = process.env.TEST_NAME || "Test User"
const ORG_NAME = process.env.ORG_NAME || "Test Organization"
const PROJECT_NAME = process.env.PROJECT_NAME || "Test Project"

interface TestUserResult {
	email: string
	password: string
	userId: string
	organizationId: string
	projectId: string
	sessionCookie?: string
}

async function signUpUser(
	email: string,
	password: string,
	name: string,
): Promise<{ userId: string; sessionCookie: string }> {
	console.log(`📝 Signing up user: ${email}...`)

	const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Origin": BASE_URL,
		},
		body: JSON.stringify({
			email,
			password,
			name,
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		// If user already exists, try to sign in instead
		if (response.status === 400 || response.status === 409) {
			console.log(`⚠️  User already exists, signing in instead...`)
			return signInUser(email, password)
		}
		throw new Error(`Failed to sign up: ${response.status} - ${errorText}`)
	}

	// Get session cookie from response
	const setCookie = response.headers.get("set-cookie")
	if (!setCookie) {
		throw new Error("No session cookie received from sign-up")
	}

	// Extract session token from cookie
	const sessionMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
	if (!sessionMatch) {
		throw new Error("Could not extract session token from cookie")
	}

	// Get user ID from session
	const sessionResponse = await fetch(`${BASE_URL}/api/auth/get-session`, {
		headers: {
			cookie: setCookie,
			"Origin": BASE_URL,
		},
	})

	if (!sessionResponse.ok) {
		throw new Error("Failed to get session after sign-up")
	}

	const sessionData = await sessionResponse.json()
	if (!sessionData?.user?.id) {
		throw new Error("No user ID in session")
	}

	console.log(`✅ User signed up: ${sessionData.user.id}`)
	return {
		userId: sessionData.user.id,
		sessionCookie: setCookie,
	}
}

async function signInUser(
	email: string,
	password: string,
): Promise<{ userId: string; sessionCookie: string }> {
	console.log(`🔐 Signing in user: ${email}...`)

	const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Origin": BASE_URL,
		},
		body: JSON.stringify({
			email,
			password,
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Failed to sign in: ${response.status} - ${errorText}`)
	}

	const setCookie = response.headers.get("set-cookie")
	if (!setCookie) {
		throw new Error("No session cookie received from sign-in")
	}

	// Get user ID from session
	const sessionResponse = await fetch(`${BASE_URL}/api/auth/get-session`, {
		headers: {
			cookie: setCookie,
			"Origin": BASE_URL,
		},
	})

	if (!sessionResponse.ok) {
		throw new Error("Failed to get session after sign-in")
	}

	const sessionData = await sessionResponse.json()
	if (!sessionData?.user?.id) {
		throw new Error("No user ID in session")
	}

	console.log(`✅ User signed in: ${sessionData.user.id}`)
	return {
		userId: sessionData.user.id,
		sessionCookie: setCookie,
	}
}

async function createOrganization(
	sessionCookie: string,
	orgName: string,
): Promise<string> {
	console.log(`🏢 Creating organization: ${orgName}...`)

	// First, check if user already has organizations
	const orgListResponse = await fetch(`${BASE_URL}/api/auth/organization/list`, {
		headers: {
			cookie: sessionCookie,
			"Origin": BASE_URL,
		},
	})

	if (orgListResponse.ok) {
		const orgs = (await orgListResponse.json()) as Array<{ id: string; name: string }>
		const existingOrg = orgs.find((org) => org.name === orgName)
		if (existingOrg) {
			console.log(`✅ Found existing organization: ${existingOrg.id}`)
			return existingOrg.id
		}
	}

	// Create new organization
	const response = await fetch(`${BASE_URL}/api/auth/organization/create`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			cookie: sessionCookie,
			"Origin": BASE_URL,
		},
		body: JSON.stringify({
			name: orgName,
			slug: orgName.toLowerCase().replace(/\s+/g, "-"),
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Failed to create organization: ${response.status} - ${errorText}`)
	}

	const result = (await response.json()) as { id: string }
	console.log(`✅ Organization created: ${result.id}`)
	return result.id
}

async function setActiveOrganization(
	sessionCookie: string,
	organizationId: string,
): Promise<void> {
	console.log(`🔄 Setting active organization: ${organizationId}...`)

	const response = await fetch(`${BASE_URL}/api/auth/organization/set-active`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			cookie: sessionCookie,
			"Origin": BASE_URL,
		},
		body: JSON.stringify({
			organizationId,
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(
			`Failed to set active organization: ${response.status} - ${errorText}`,
		)
	}

	console.log(`✅ Active organization set`)
}

async function createProject(
	sessionCookie: string,
	projectName: string,
): Promise<string> {
	console.log(`📁 Creating project: ${projectName}...`)

	// First, check if project already exists
	const sessionResponse = await fetch(`${BASE_URL}/api/auth/get-session`, {
		headers: {
			cookie: sessionCookie,
			"Origin": BASE_URL,
		},
	})

	if (!sessionResponse.ok) {
		throw new Error("Failed to get session for project creation")
	}

	const sessionData = await sessionResponse.json()
	const activeOrgId = sessionData?.session?.activeOrganizationId

	if (!activeOrgId) {
		throw new Error("No active organization in session")
	}

	// List existing projects
	const listResponse = await fetch(
		`${BASE_URL}/api/projects/organizations/${activeOrgId}/projects`,
		{
			headers: {
				cookie: sessionCookie,
				"Origin": BASE_URL,
			},
		},
	)

	if (listResponse.ok) {
		const projects = (await listResponse.json()) as {
			projects: Array<{ id: string; name: string }>
		}
		const existingProject = projects.projects.find((p) => p.name === projectName)
		if (existingProject) {
			console.log(`✅ Found existing project: ${existingProject.id}`)
			return existingProject.id
		}
	}

	// Create new project
	const response = await fetch(`${BASE_URL}/api/projects`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			cookie: sessionCookie,
			"Origin": BASE_URL,
		},
		body: JSON.stringify({
			name: projectName,
			description: "Test project created by create-test-user script",
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Failed to create project: ${response.status} - ${errorText}`)
	}

	const result = (await response.json()) as { projectId: string }
	console.log(`✅ Project created: ${result.projectId}`)
	return result.projectId
}

async function createTestUser(): Promise<TestUserResult> {
	console.log("🚀 Creating test user environment...")
	console.log(`   Base URL: ${BASE_URL}`)
	console.log(`   Email: ${TEST_EMAIL}`)
	console.log(`   Password: ${TEST_PASSWORD}`)
	console.log("")

	// 1. Sign up or sign in user
	const { userId, sessionCookie } = await signUpUser(
		TEST_EMAIL,
		TEST_PASSWORD,
		TEST_NAME,
	)

	// 2. Create organization
	const organizationId = await createOrganization(sessionCookie, ORG_NAME)

	// 3. Set active organization
	await setActiveOrganization(sessionCookie, organizationId)

	// 4. Create project
	const projectId = await createProject(sessionCookie, PROJECT_NAME)

	console.log("")
	console.log("✅ Test user environment created successfully!")
	console.log("")

	return {
		email: TEST_EMAIL,
		password: TEST_PASSWORD,
		userId,
		organizationId,
		projectId,
		sessionCookie,
	}
}

// Main execution
createTestUser()
	.then((result) => {
		console.log("=".repeat(60))
		console.log("TEST USER CREDENTIALS")
		console.log("=".repeat(60))
		console.log("")
		console.log("Email:", result.email)
		console.log("Password:", result.password)
		console.log("")
		console.log("User ID:", result.userId)
		console.log("Organization ID:", result.organizationId)
		console.log("Project ID:", result.projectId)
		console.log("")
		console.log("=".repeat(60))
		console.log("")
		console.log("You can now use these credentials to sign in at:")
		console.log(`  ${BASE_URL}`)
		console.log("")
		console.log("Or use in your frontend:")
		console.log(`  Email: ${result.email}`)
		console.log(`  Password: ${result.password}`)
		console.log("")
		console.log("Organization and Project IDs for API calls:")
		console.log(`  Organization: ${result.organizationId}`)
		console.log(`  Project: ${result.projectId}`)
		console.log("")
	})
	.catch((error) => {
		console.error("❌ Failed to create test user:", error)
		process.exit(1)
	})

