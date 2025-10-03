import * as D from "drizzle-orm/sqlite-core"
import { organizations, users } from "./_auth"

export * from "./_auth"

export const subscriptions = D.sqliteTable("subscriptions", {
	id: D.text().primaryKey(),
	polarSubscriptionId: D.text().notNull().unique(), // Polar's external ID
	organizationId: D.text() // Organizations have subscriptions, not users
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
	organizationId: D.text()
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
	projectId: D.text()
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	name: D.text().notNull(),
	description: D.text(),
	directoryPath: D.text(),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const medias = D.sqliteTable("medias", {
	id: D.text().primaryKey(),
	projectId: D.text()
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text().notNull(),
	mediaType: D.text(),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const files = D.sqliteTable("files", {
	id: D.text().primaryKey(),
	planId: D.text()
		.notNull()
		.references(() => plans.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	filePath: D.text(),
	fileType: D.text(),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const annotations = D.sqliteTable("annotations", {
	id: D.text().primaryKey(),
	fileId: D.text()
		.notNull()
		.references(() => files.id, { onDelete: "cascade" }),
	type: D.text().notNull(), // "text", "arrow", "circle", "rectangle"
	data: D.text().notNull(), // JSON data for annotation
	pageNumber: D.integer(),
	createdBy: D.text()
		.notNull()
		.references(() => users.id),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})

export const usageEvents = D.sqliteTable("usage_events", {
	id: D.text().primaryKey(),
	organizationId: D.text()
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	userId: D.text()
		.notNull()
		.references(() => users.id),
	eventType: D.text().notNull(), // "file_upload", "annotation_created", etc.
	eventData: D.text(), // JSON metadata
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
})
