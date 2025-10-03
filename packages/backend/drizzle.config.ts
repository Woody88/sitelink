import { defineConfig } from "drizzle-kit"

export default defineConfig({
	out: "./drizzle",
	schema: "./src/core/database/schemas",
	dialect: "sqlite",
	...(process.env.NODE_ENV !== "production" // Use local SQLite file for development
		? {
				dbCredentials: {
					url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/1bfa5e8ee82606601526f90ef320195702c729e781f59e4dd2577221ec89c2e9.sqlite",
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
