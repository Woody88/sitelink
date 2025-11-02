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
			setupFiles: ["./test/setup.ts"],
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
						},
					},
				},
			},
		},
	}
})
