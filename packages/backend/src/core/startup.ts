/**
 * Startup tasks that run once when the worker initializes
 */

import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import * as schema from "./database/schemas"

const SYSTEM_PDF_PROCESSOR_EMAIL = "system-pdf-processor@sitelink.com"

/**
 * Ensure the system PDF processor user exists
 * This runs on worker startup to guarantee the user is available for processing
 */
export async function ensureSystemPdfProcessorUser(db: D1Database) {
	const drizzleDb = drizzle(db, { schema, casing: "snake_case" })

	// Check if system user already exists
	const existingUsers = await drizzleDb
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.email, SYSTEM_PDF_PROCESSOR_EMAIL))

	// If user exists, we're done
	if (existingUsers.length > 0) {
		return { created: false, userId: existingUsers[0].id }
	}

	// Create system user
	const userId = crypto.randomUUID()
	const now = new Date()

	await drizzleDb.insert(schema.users).values({
		id: userId,
		email: SYSTEM_PDF_PROCESSOR_EMAIL,
		name: "System PDF Processor",
		emailVerified: true,
		createdAt: now,
		updatedAt: now,
	})

	console.log(`✅ Created system PDF processor user: ${userId}`)

	return { created: true, userId }
}
