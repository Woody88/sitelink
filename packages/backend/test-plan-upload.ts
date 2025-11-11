#!/usr/bin/env bun

/**
 * Test plan upload endpoint from outside the worker
 * Run with: bun run test-plan-upload.ts
 */

import { $ } from "bun"
import { readFileSync } from "fs"
import { resolve } from "path"
import { createTestAuthClient } from "./src/core/auth/client"

const BASE_URL = "http://localhost:8787"
const PDF_PATH = resolve(__dirname, "tests/fixtures/sample-plan.pdf")
const TEST_EMAIL = "test@example.com"
const REMOTE = process.env["REMOTE"]

async function testPlanUpload() {
	console.log("🚀 Testing plan upload endpoint...")
	console.log("")

	try {
		// Step 1: Call test setup to create user, org, project (no session)
		console.log("1️⃣ Setting up test environment (user, org, project)...")
		const setupResponse = await fetch(`${BASE_URL}/api/test/setup`)

		if (!setupResponse.ok) {
			throw new Error(
				`Setup failed: ${setupResponse.status} ${await setupResponse.text()}`,
			)
		}

		const setupData = (await setupResponse.json()) as {
			success: boolean
			data?: {
				userId: string
				organizationId: string
				projectId: string
			}
			error?: string
		}

		if (!setupData.success || !setupData.data) {
			throw new Error(`Setup failed: ${setupData.error}`)
		}

		console.log("✅ Test environment ready")
		console.log("   User ID:", setupData.data.userId)
		console.log("   Organization ID:", setupData.data.organizationId)
		console.log("   Project ID:", setupData.data.projectId)
		console.log("")

		// Step 2: Create auth client and send magic link
		console.log("2️⃣ Creating auth client and sending magic link...")
		const authClient = createTestAuthClient(BASE_URL)

		const magicLinkResult = await authClient.signIn.magicLink({
			email: TEST_EMAIL,
			callbackURL: `${BASE_URL}/auth/verify`,
		})

		if (magicLinkResult.error) {
			throw new Error(
				`Magic link send failed: ${JSON.stringify(magicLinkResult.error)}`,
			)
		}

		console.log("✅ Magic link sent")
		console.log("")

		// Step 3: Query database to get verification token
		console.log("3️⃣ Querying database for verification token...")
		const dbQuery = `SELECT identifier FROM verifications WHERE value LIKE '%${TEST_EMAIL}%' ORDER BY created_at DESC LIMIT 1`

		const queryResult = REMOTE === "true"
			? await $`bun wrangler d1 execute sitelink-db --remote --preview --command ${dbQuery} --json`.text()
			: await $`bun wrangler d1 execute sitelink-db --local --command ${dbQuery} --json`.text()

		// Parse JSON output from wrangler
		const jsonMatch = queryResult.match(/\[[\s\S]*\]/)
		if (!jsonMatch) {
			throw new Error("Could not parse database query result")
		}

		const dbResults = JSON.parse(jsonMatch[0])
		if (
			!dbResults[0] ||
			!dbResults[0].results ||
			dbResults[0].results.length === 0
		) {
			throw new Error("No verification token found in database")
		}

		const token = dbResults[0].results[0].identifier

		console.log("✅ Found verification token:", token)
		console.log("")

		// Step 4: Verify magic link to create session
		console.log("4️⃣ Verifying magic link to create session...")
		const verifyResponse = await fetch(
			`${BASE_URL}/api/auth/magic-link/verify?token=${token}`,
			{
				method: "GET",
				redirect: "manual", // Don't follow redirects - we need to extract the cookie
			},
		)

		// Verification endpoint returns a redirect (302) with Set-Cookie header
		if (verifyResponse.status !== 302 && !verifyResponse.ok) {
			const errorText = await verifyResponse.text()
			throw new Error(
				`Magic link verify failed: ${verifyResponse.status} ${errorText}`,
			)
		}

		// Extract session cookie from Set-Cookie header
		const setCookieHeader = verifyResponse.headers.get("set-cookie")
		if (!setCookieHeader) {
			throw new Error("No session cookie received from verify endpoint")
		}

		// Parse the session token from the cookie
		const sessionTokenMatch = setCookieHeader.match(
			/better-auth\.session_token=([^;]+)/,
		)
		if (!sessionTokenMatch) {
			throw new Error("Could not extract session token from cookie")
		}

		const sessionToken = sessionTokenMatch[1]
		console.log("✅ Session created")
		console.log("   Session Token:", sessionToken)
		console.log("")

		// Step 5: Set active organization using auth client
		console.log("5️⃣ Setting active organization...")
		// Create authenticated client with the session cookie
		const authenticatedClient = createTestAuthClient(
			BASE_URL,
			(input, init) => {
				const headers = new Headers(init?.headers)
				headers.set("cookie", `better-auth.session_token=${sessionToken}`)
				return fetch(input, { ...init, headers })
			},
		)

		const setActiveResult = await authenticatedClient.organization.setActive({
			organizationId: setupData.data.organizationId,
		})

		if (setActiveResult.error) {
			throw new Error(
				`Set active organization failed: ${JSON.stringify(setActiveResult.error)}`,
			)
		}

		console.log("✅ Active organization set")
		console.log("")

		// Step 6: Upload plan with the session token
		console.log("6️⃣ Uploading plan...")
		const pdfData = readFileSync(PDF_PATH)
		const formData = new FormData()
		formData.append(
			"file",
			new Blob([pdfData], { type: "application/pdf" }),
			"sample-plan.pdf",
		)
		formData.append("name", `Test Plan ${Date.now()}`)
		formData.append("description", "Test plan uploaded from external script")

		const uploadResponse = await fetch(
			`${BASE_URL}/api/projects/${setupData.data.projectId}/plans`,
			{
				method: "POST",
				headers: {
					cookie: `better-auth.session_token=${sessionToken}`,
				},
				body: formData,
			},
		)

		if (!uploadResponse.ok) {
			const errorText = await uploadResponse.text()
			throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`)
		}

		const uploadData = (await uploadResponse.json()) as {
			planId: string
			fileId: string
			uploadId: string
			jobId: string
		}
		console.log("✅ Plan uploaded successfully!")
		console.log("   Plan ID:", uploadData.planId)
		console.log("   File ID:", uploadData.fileId)
		console.log("   Upload ID:", uploadData.uploadId)
		console.log("   Job ID:", uploadData.jobId)
	} catch (error) {
		console.error("❌ Test failed:", error)
		process.exit(1)
	}
}

testPlanUpload()
