import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "./drizzle",
	schema: "./src/core/database/schemas",
	dialect: "sqlite",
	casing: "snake_case",
	...(process.env.NODE_ENV !== "production" // Use local SQLite file for development
		? {
				dbCredentials: {
					url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/5d577ff376ae589839259f8ed23cb8161029aef16cf19587c4ee2d55e16cbcc1.sqlite",
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
