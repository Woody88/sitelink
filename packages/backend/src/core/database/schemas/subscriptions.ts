import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { organizations } from "./_auth"

export const subscriptions = D.sqliteTable("subscriptions", {
	id: D.text().primaryKey(),
	polarSubscriptionId: D.text("polar_subscription_id").notNull().unique(),
	organizationId: D.text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	plan: D.text().notNull(), // "trial", "pro", "enterprise"
	status: D.text().notNull(), // "active", "canceled", "past_due"
	startDate: D.integer("start_date", { mode: "timestamp_ms" }),
	endDate: D.integer("end_date", { mode: "timestamp_ms" }),
	seats: D.integer().notNull().default(1),
	trialEndsAt: D.integer("trial_ends_at", { mode: "timestamp_ms" }),
	currentPeriodEndsAt: D.integer("current_period_ends_at", {
		mode: "timestamp_ms",
	}),
	createdAt: D.integer("created_at", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => new Date())
		.notNull(),
})

// Effect-TS schemas
export const InsertSubscription = createInsertSchema(subscriptions)
export const SelectSubscription = createSelectSchema(subscriptions)
