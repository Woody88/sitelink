import {
	createExecutionContext,
	env,
	SELF,
	waitOnExecutionContext,
} from "cloudflare:test"
import { describe, expect, it } from "vitest"
import worker from "../src/index"

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

describe("Hello World worker", () => {
	it("responds with Hello World! (unit style)", async () => {
		const request = new IncomingRequest("http://example.com")
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext()
		const response = await worker.fetch(request, env, ctx)
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx)
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`)
	})

	it("responds with Hello World! (integration style)", async () => {
		const response = await SELF.fetch("https://example.com")
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`)
	})

	it("connect to the database", async () => {
		const response = await SELF.fetch("https://example.com/api/health/db")
		const data = (await response.json()) as {
			database: string
			query?: Record<string, unknown>
			error?: string
		}

		expect(response.status).toBe(200)
		expect(data.database).toBe("connected")
	})
})
