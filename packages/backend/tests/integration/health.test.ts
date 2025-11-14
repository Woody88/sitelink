import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import type { SystemHealth } from "../../src/features/health/service"

describe("Health Endpoints", () => {
	it("return system health with healthy database check", async () => {
		const response = await SELF.fetch("https://example.com/health")
		const data = (await response.json()) as SystemHealth

		expect(response.status).toBe(200)
		expect(data.database.status).toBe("healthy")
	})
})
