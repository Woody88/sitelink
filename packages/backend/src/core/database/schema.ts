import * as D from "drizzle-orm/sqlite-core"

export const users = D.sqliteTable("users", {
	id: D.text().primaryKey(),
	email: D.text().notNull(),
	name: D.text().notNull(),
})

export const organizations = D.sqliteTable("organizations", {
	id: D.text().primaryKey(),
	name: D.text().notNull(),
	clerkOrganizationId: D.text().notNull().unique(),
})

export const subscriptions = D.sqliteTable("subscriptions", {
	id: D.text().primaryKey(),
	userId: D.text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
	plan: D.text(),
	startDate: D.text(),
	endDate: D.text(),
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
	createdAt: D.text().notNull(),
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
	createdAt: D.text().notNull(),
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
	createdAt: D.text().notNull(),
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
	createdAt: D.text().notNull(),
})
