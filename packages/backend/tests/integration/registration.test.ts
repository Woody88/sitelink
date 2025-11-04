import { env, SELF } from "cloudflare:test"
import { drizzle } from "drizzle-orm/d1"
import { describe, expect, it } from "vitest"
import { createTestAuthClient } from "../../src/core/auth/client"
import * as schema from "../../src/core/database/schemas"

describe("Registration Endpoints", () => {
	it("should send magic link email for new user", async () => {
		// Verify environment is configured
		console.log("Environment check:", {
			hasResendKey: !!env.RESEND_API_KEY,
			hasEmailAddress: !!env.EMAIL_ADDRESS,
			hasDB: !!env.SitelinkDB,
		})

		const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

		// Wrap SELF.fetch to preserve context
		const wrappedFetch: typeof fetch = (input, init) => SELF.fetch(input, init)

		const authclient = createTestAuthClient("http://localhost", wrappedFetch)
		const email = "delivered@resend.dev"

		// Call magic link endpoint
		const response = await authclient.signIn.magicLink({
			email,
			name: "Test User",
			callbackURL: "/",
			newUserCallbackURL: "/registration",
			errorCallbackURL: "/error",
		})

		// Check if the response indicates success
		expect(response).toBeDefined()

		const verifications = schema.verifications
		const result = await db
			.select({
				identifier: verifications.identifier,
				value: verifications.value,
			})
			.from(verifications)
			.limit(1)

		expect(result).toHaveLength(1)
		expect(result[0]).toBeDefined()

		const token = result[0]!

		console.log("token", token)

		const magiclLinkUrl = `http://localhost/api/auth/magic-link/verify?token=${token.identifier}&callbackURL=/registration`

		// Use redirect: "manual" to prevent fetch from following the redirect
		const verifyResponse = await wrappedFetch(magiclLinkUrl, {
			redirect: "manual",
		})

		expect(verifyResponse.status).toBe(302)

		// Extract the session cookie and location from the redirect response
		const location = verifyResponse.headers.get("location")
		const sessionCookie = verifyResponse.headers.get("set-cookie")

		expect(location).toBe("http://localhost/registration")
		expect(sessionCookie).toContain("better-auth.session_token")

		// Now make a POST request to the registration endpoint with the session cookie
		const registrationResponse = await wrappedFetch(
			"http://localhost/registration?name=Test%20User&organizationName=Test%20Org",
			{
				method: "POST",
				headers: {
					cookie: sessionCookie!,
				},
			},
		)

		console.log("Registration response:", registrationResponse.status)

		if (registrationResponse.status !== 201) {
			const errorText = await registrationResponse.text()
			console.log("Registration error:", errorText)
		}

		expect(registrationResponse.status).toBe(201)

		const registrationData = await registrationResponse.json()
		console.log("Registration data:", registrationData)

		expect(registrationData).toHaveProperty("organizationId")
	})
})
