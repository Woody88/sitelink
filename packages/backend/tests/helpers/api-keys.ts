import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey } from "better-auth/plugins"
import { env } from "cloudflare:test"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "../../src/core/database/schemas"

/**
 * System PDF processor user email constant
 * Must match the constant in src/features/processing/service.ts
 */
export const SYSTEM_PDF_PROCESSOR_EMAIL = "system-pdf-processor@sitelink.com"

/**
 * Create the system PDF processor user in the database
 * This user is used by the PDF processing service to authenticate container requests
 *
 * @returns User ID of the created system user
 */
export async function createSystemPdfProcessorUser(): Promise<string> {
	const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

	const userId = `system-pdf-processor-${Date.now()}`

	await db.insert(schema.users).values({
		id: userId,
		name: "System PDF Processor",
		email: SYSTEM_PDF_PROCESSOR_EMAIL,
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return userId
}

/**
 * Create an API key for a user using Better Auth
 *
 * @param userId - The user ID to create the API key for
 * @param name - Optional name for the API key (defaults to "test-api-key")
 * @param expiresIn - Optional expiration time in seconds (defaults to 86400 = 24 hours)
 * @returns The created API key string
 */
export async function createApiKeyForUser(
	userId: string,
	name = "test-api-key",
	expiresIn = 86400,
): Promise<string> {
	const db = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

	// Create a properly configured betterAuth instance with the test database
	const auth = betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			usePlural: true,
			camelCase: false,
		}),
		emailAndPassword: {
			enabled: false,
		},
		plugins: [apiKey()],
	})

	const result = await auth.api.createApiKey({
		body: {
			userId,
			name,
			expiresIn,
		},
	})

	return result.key
}
