import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { organizations, users } from "./_auth"

export const usageEvents = D.sqliteTable("usage_events", {
	id: D.text().primaryKey(),
	organizationId: D.text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	userId: D.text("user_id")
		.notNull()
		.references(() => users.id),
	eventType: D.text("event_type").notNull(), // file_upload|annotation_created|etc
	eventData: D.text("event_data"), // JSON metadata
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertUsageEvent = createInsertSchema(usageEvents)
export const SelectUsageEvent = createSelectSchema(usageEvents)
