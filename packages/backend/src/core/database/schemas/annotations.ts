import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { planUploads } from "./plan-uploads"
import { plans } from "./plans"
import { users } from "./_auth"

export const annotations = D.sqliteTable("annotations", {
	id: D.text().primaryKey(),
	uploadId: D.text("upload_id")
		.notNull()
		.references(() => planUploads.uploadId, { onDelete: "cascade" }), // Changed from fileId to uploadId
	planId: D.text("plan_id")
		.notNull()
		.references(() => plans.id, { onDelete: "cascade" }),
	sheetNumber: D.integer("sheet_number").notNull(), // 1-indexed sheet number
	userId: D.text("user_id")
		.notNull()
		.references(() => users.id),
	type: D.text().notNull(), // marker|polygon|line|text|measurement
	data: D.text().notNull(), // JSON: coordinates and properties
	content: D.text(), // Text content for text annotations
	color: D.text(),
	pageNumber: D.integer("page_number"), // Legacy field for backwards compatibility
	createdBy: D.text("created_by")
		.notNull()
		.references(() => users.id),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertAnnotation = createInsertSchema(annotations)
export const SelectAnnotation = createSelectSchema(annotations)
