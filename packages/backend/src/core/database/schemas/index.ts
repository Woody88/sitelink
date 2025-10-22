import * as D from "drizzle-orm/sqlite-core"
import { organizations, users } from "./_auth"

export * from "./_auth"

export const subscriptions = D.sqliteTable("subscriptions", {
	id: D.text().primaryKey(),
	polarSubscriptionId: D.text("polar_subscription_id").notNull().unique(), // Polar's external ID
	organizationId: D.text("organization_id") // Organizations have subscriptions, not users
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	plan: D.text().notNull(), // "free", "pro", "enterprise"
	seats: D.integer().notNull().default(1), // Number of allowed users
	status: D.text().notNull(), // "active", "past_due", "canceled"
	currentPeriodStart: D.integer("current_period_start", {
		mode: "timestamp_ms",
	}),
	currentPeriodEnd: D.integer("current_period_end", { mode: "timestamp_ms" }),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => new Date())
		.notNull(),
})

export const projects = D.sqliteTable("projects", {
	id: D.text().primaryKey(),
	organizationId: D.text("organization_id")
		.notNull()
		.references(() => organizations.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	name: D.text().notNull(),
	description: D.text(),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

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
	directoryPath: D.text("directory_path"),
	processingStatus: D.text("processing_status"),
	tileMetadata: D.text("tile_metadata"),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const medias = D.sqliteTable("medias", {
	id: D.text().primaryKey(),
	projectId: D.text("project_id")
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text("file_path").notNull(),
	mediaType: D.text("media_type"),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const files = D.sqliteTable("files", {
	id: D.text().primaryKey(),
	planId: D.text("plan_id")
		.notNull()
		.references(() => plans.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text("file_path"),
	fileType: D.text("file_type"),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const annotations = D.sqliteTable("annotations", {
	id: D.text().primaryKey(),
	fileId: D.text("file_id")
		.notNull()
		.references(() => files.id, { onDelete: "cascade" }),
	type: D.text().notNull(), // "text", "arrow", "circle", "rectangle"
	data: D.text().notNull(), // JSON data for annotation
	pageNumber: D.integer("page_number"),
	createdBy: D.text("created_by")
		.notNull()
		.references(() => users.id),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const usageEvents = D.sqliteTable("usage_events", {
	id: D.text().primaryKey(),
	organizationId: D.text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	userId: D.text("user_id")
		.notNull()
		.references(() => users.id),
	eventType: D.text("event_type").notNull(), // "file_upload", "annotation_created", etc.
	eventData: D.text("event_data"), // JSON metadata
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})
