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
									// Buffer the request body to avoid ReadableStream issues in miniflare
									// Miniflare's fetch() has a bug with duplex: "half" that causes hangs
									// Production Cloudflare Workers handle streaming correctly, but for tests we buffer
									let body: BodyInit | null = null
									if (request.method !== 'GET' && request.method !== 'HEAD') {
										body = await request.arrayBuffer()
									}

									return await fetch(localUrl, {
										method: request.method,
										headers: request.headers,
										body,
										// Note: removed duplex: "half" since we're using buffered body
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
