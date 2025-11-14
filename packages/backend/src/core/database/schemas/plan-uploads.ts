import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { plans } from "./plans"
import { users } from "./_auth"

export const planUploads = D.sqliteTable("plan_uploads", {
	id: D.text().primaryKey(),
	uploadId: D.text("upload_id").notNull().unique(), // Unique per upload for versioning
	planId: D.text("plan_id")
		.notNull()
		.references(() => plans.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text("file_path").notNull(), // R2 path: organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/original.pdf
	fileType: D.text("file_type"), // pdf|dwg|etc
	fileSize: D.integer("file_size"),
	isActive: D.integer("is_active", { mode: "boolean" })
		.notNull()
		.default(true), // Which version is active
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
export const InsertPlanUpload = createInsertSchema(planUploads)
export const SelectPlanUpload = createSelectSchema(planUploads)
