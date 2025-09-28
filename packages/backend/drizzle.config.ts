import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "./drizzle",
	schema: "./src/core/database/schema.ts",
	dialect: "sqlite",
	...(process.env.NODE_ENV !== "production" // Use local SQLite file for development
		? {
				dbCredentials: {
					url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/466b4a89f8d1a8de474e8a13f8a6e15c3ae79660deea427e1d3beef0a6ab599a.sqlite",
				},
			}
		: {
				dbCredentials: {
					accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
					databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
					token: process.env.CLOUDFLARE_D1_TOKEN!,
				},
			}),
})
