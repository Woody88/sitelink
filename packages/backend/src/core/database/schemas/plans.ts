import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { projects } from "./projects"

export const plans = D.sqliteTable("plans", {
	id: D.text().primaryKey(),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	name: D.text().notNull(),
	description: D.text(),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertPlan = createInsertSchema(plans)
export const SelectPlan = createSelectSchema(plans)
