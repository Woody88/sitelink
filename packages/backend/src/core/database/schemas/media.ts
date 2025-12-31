import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { projects } from "./projects"
import { plans } from "./plans"
import { planMarkers } from "./plan-markers"
import { annotations } from "./annotations"
import { users } from "./_auth"

export const media = D.sqliteTable("media", {
	id: D.text().primaryKey(),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	planId: D.text("plan_id")
		.references(() => plans.id, {
			onDelete: "set null",
		}),
	markerId: D.text("marker_id")
		.references(() => planMarkers.id, {
			onDelete: "set null",
		}),
	annotationId: D.text("annotation_id")
		.references(() => annotations.id, {
			onDelete: "set null",
		}),
	filePath: D.text("file_path").notNull(),
	mediaType: D.text("media_type"), // photo|video|audio
	status: D.text("status", { enum: ["before", "progress", "complete", "issue"] }),
	description: D.text("description"),
	coordinates: D.text("coordinates", { mode: "json" }), // { x, y }
	capturedBy: D.text("captured_by")
		.references(() => users.id, {
			onDelete: "set null",
		}),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertMedia = createInsertSchema(media)
export const SelectMedia = createSelectSchema(media)
