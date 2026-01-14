import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig(async () => {
	const migrations = await readD1Migrations("./migrations");

	return {
		test: {
			globals: true,
			setupFiles: ["./tests/setup.ts"],
			poolOptions: {
				workers: {
					singleWorker: true,
					isolatedStorage: false,
					wrangler: {
						configPath: "./vitest.wrangler.json",
					},
					miniflare: {
						bindings: {
							TEST_MIGRATIONS: migrations,
						},
						serviceBindings: {
							FIXTURE_LOADER: async (request: Request) => {
								const url = new URL(request.url);
								const fixturePath = join(
									__dirname,
									"tests/fixtures",
									url.pathname,
								);
								try {
									const content = readFileSync(fixturePath);
									const contentType = url.pathname.endsWith(".pdf")
										? "application/pdf"
										: "application/octet-stream";
									return new Response(content, {
										headers: { "Content-Type": contentType },
									});
								} catch {
									return new Response(`Fixture not found: ${url.pathname}`, {
										status: 404,
									});
								}
							},
							PDF_CONTAINER_PROXY: async (request: Request) => {
								const url = new URL(request.url);
								url.protocol = "http:";
								url.host = "localhost:3001";
								try {
									return await fetch(url.toString(), {
										method: request.method,
										headers: request.headers,
										body: request.body,
										// @ts-expect-error duplex is required for streaming request bodies
										duplex: "half",
									});
								} catch (error) {
									return new Response(
										JSON.stringify({
											error: "Container not available",
											details: String(error),
										}),
										{
											status: 503,
											headers: { "Content-Type": "application/json" },
										},
									);
								}
							},
						},
					},
				},
			},
			coverage: {
				provider: "v8",
				reporter: ["text", "json", "html"],
				exclude: [
					"node_modules/",
					"dist/",
					"**/*.test.ts",
					"**/*.spec.ts",
					"migrations/",
					"worker-configuration.d.ts",
				],
			},
			include: ["src/__tests__/**/*.test.ts", "tests/integration/**/*.test.ts"],
		},
		resolve: {
			alias: {
				"@": "/src",
			},
		},
		build: {
			rollupOptions: {
				external: [
					"@opentelemetry/resources",
					"@opentelemetry/sdk-node",
					"@opentelemetry/api",
				],
			},
		},
	};
});
