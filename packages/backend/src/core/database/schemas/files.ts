import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { projects } from "./projects"
import { users } from "./_auth"

export const files = D.sqliteTable("files", {
	id: D.text().primaryKey(),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text("file_path").notNull(), // R2 path
	fileName: D.text("file_name").notNull(), // Original filename
	fileType: D.text("file_type"), // MIME type or category (rfi|report|etc)
	fileSize: D.integer("file_size"),
	uploadedBy: D.text("uploaded_by")
		.notNull()
		.references(() => users.id),
	uploadedAt: D.integer("uploaded_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertFile = createInsertSchema(files)
export const SelectFile = createSelectSchema(files)
