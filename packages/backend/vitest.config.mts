import { readFileSync } from "node:fs"
import path from "node:path"
import {
	defineWorkersProject,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config"

export default defineWorkersProject(async () => {
	const migrationsPath = path.join(__dirname, "drizzle")
	const migrations = await readD1Migrations(migrationsPath)

	return {
		test: {
			setupFiles: ["./tests/setup.ts"],
			poolOptions: {
				workers: {
					wrangler: { configPath: "./wrangler.jsonc" },
					miniflare: {
						bindings: { TEST_MIGRATIONS: migrations },
						serviceBindings: {
							// Service binding to read fixture files from Node.js context
							async FIXTURE_LOADER(request: Request) {
								const url = new URL(request.url)
								const filePath = url.pathname.slice(1) // Remove leading slash
								try {
									const content = readFileSync(filePath)
									return await new Response(content, {
										headers: { "Content-Type": "application/pdf" },
									})
								} catch (error) {
									console.error("Fixture file not found:", error)
									return await new Response(`File not found: ${filePath}`, {
										status: 404,
									})
								}
							},
							// Service binding to proxy requests to Docker container on localhost:3001
							async PDF_CONTAINER_PROXY(request: Request) {
								const CONTAINER_PORT = 3001
								const url = new URL(request.url)
								const localUrl = `http://localhost:${CONTAINER_PORT}${url.pathname}`

								try {
									// With wrangler 4.50.0, Miniflare's duplex: "half" bug is fixed (PR #5114)
									// We can now stream request bodies directly without buffering
									return await fetch(localUrl, {
										method: request.method,
										headers: request.headers,
										body: request.body,
										duplex: "half",
									} as RequestInit)
								} catch (error) {
									console.error("Failed to reach Docker container:", error)
									return new Response(`Container unavailable: ${error}`, {
										status: 503,
									})
								}
							},
						},
					},
				},
			},
		},
	}
})
