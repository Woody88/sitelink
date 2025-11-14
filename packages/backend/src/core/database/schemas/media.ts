import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { projects } from "./projects"

export const media = D.sqliteTable("media", {
	id: D.text().primaryKey(),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text("file_path").notNull(),
	mediaType: D.text("media_type"), // photo|video|audio
	uploadedAt: D.integer("uploaded_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertMedia = createInsertSchema(media)
export const SelectMedia = createSelectSchema(media)
