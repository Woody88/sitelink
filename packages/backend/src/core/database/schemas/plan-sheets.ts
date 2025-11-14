import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { planUploads } from "./plan-uploads"
import { plans } from "./plans"

export const planSheets = D.sqliteTable(
	"plan_sheets",
	{
		id: D.text().primaryKey(),
		uploadId: D.text("upload_id")
			.notNull()
			.references(() => planUploads.uploadId, { onDelete: "cascade" }),
		planId: D.text("plan_id")
			.notNull()
			.references(() => plans.id, { onDelete: "cascade" }),
		sheetNumber: D.integer("sheet_number").notNull(), // 0-indexed (renamed from pageNumber)
		sheetKey: D.text("sheet_key").notNull(), // R2 path to sheet PDF (renamed from dziPath)
		sheetSize: D.integer("sheet_size"),
		status: D.text()
			.notNull()
			.default("pending"), // pending|processing|ready|failed (renamed from processingStatus)
		tileCount: D.integer("tile_count"),
		processingStartedAt: D.integer("processing_started_at", {
			mode: "timestamp_ms",
		}),
		processingCompletedAt: D.integer("processing_completed_at", {
			mode: "timestamp_ms",
		}),
		errorMessage: D.text("error_message"),
		createdAt: D.integer("created_at", { mode: "timestamp_ms" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		uploadSheetUnique: D.unique("plan_sheets_upload_sheet_unique").on(
			table.uploadId,
			table.sheetNumber,
		),
	}),
)

// Effect-TS schemas
export const InsertPlanSheet = createInsertSchema(planSheets)
export const SelectPlanSheet = createSelectSchema(planSheets)
