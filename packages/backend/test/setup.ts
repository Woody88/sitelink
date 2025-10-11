import { applyD1Migrations, env } from "cloudflare:test"
import { beforeAll } from "vitest"

/**
 * Setup test environment by applying database migrations
 * Migrations are read in vitest.config.mts and passed via TEST_MIGRATIONS binding
 */
beforeAll(async () => {
	await applyD1Migrations(env.SitelinkDB, env.TEST_MIGRATIONS)
	console.log("✅ Test database migrations applied successfully")
})
