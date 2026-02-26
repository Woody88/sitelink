import { $ } from "bun"

const DB_NAME = "sitelink-db"
const wrangler = "./node_modules/.bin/wrangler"

const result = await $`${wrangler} d1 execute ${DB_NAME} --remote --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'"`.json()

const tables: string[] = result[0].results.map((r: { name: string }) => r.name)

if (tables.length === 0) {
	console.log("No tables to clear")
	process.exit(0)
}

const deleteStatements = tables.map((t) => `DELETE FROM "${t}";`).join(" ")
console.log(`Clearing ${tables.length} tables: ${tables.join(", ")}`)

await $`${wrangler} d1 execute ${DB_NAME} --remote --command ${deleteStatements}`

console.log("All tables cleared.")
