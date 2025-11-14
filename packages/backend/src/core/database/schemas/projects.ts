import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { organizations } from "./_auth"

export const projects = D.sqliteTable("projects", {
	id: D.text().primaryKey(),
	name: D.text().notNull(),
	description: D.text(),
	organizationId: D.text("organization_id")
		.notNull()
		.references(() => organizations.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertProject = createInsertSchema(projects)
export const SelectProject = createSelectSchema(projects)
