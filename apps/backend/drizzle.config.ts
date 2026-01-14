import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/auth-schema.ts",
	out: "./migrations",
	dialect: "sqlite",
	driver: "d1-http",
	dbCredentials: {
		wranglerConfigPath: "./wrangler.json",
		dbName: "sitelink-db",
	},
});
