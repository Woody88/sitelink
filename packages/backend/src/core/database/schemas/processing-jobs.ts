import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { planUploads } from "./plan-uploads"
import { plans } from "./plans"
import { organizations } from "./_auth"
import { projects } from "./projects"

export const processingJobs = D.sqliteTable("processing_jobs", {
	id: D.text().primaryKey(),
	uploadId: D.text("upload_id")
		.notNull()
		.references(() => planUploads.uploadId, { onDelete: "cascade" }),
	planId: D.text("plan_id")
		.notNull()
		.references(() => plans.id, { onDelete: "cascade" }),
	organizationId: D.text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	pdfPath: D.text("pdf_path").notNull(), // R2 path to original PDF
	status: D.text()
		.notNull()
		.default("pending"), // pending|processing|complete|failed
	totalPages: D.integer("total_pages"),
	completedPages: D.integer("completed_pages").default(0),
	failedPages: D.text("failed_pages"), // JSON array
	progress: D.integer().default(0), // 0-100
	startedAt: D.integer("started_at", { mode: "timestamp_ms" }),
	completedAt: D.integer("completed_at", { mode: "timestamp_ms" }),
	lastError: D.text("last_error"),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertProcessingJob = createInsertSchema(processingJobs)
export const SelectProcessingJob = createSelectSchema(processingJobs)
