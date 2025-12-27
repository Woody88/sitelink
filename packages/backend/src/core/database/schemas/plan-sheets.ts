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
		sheetNumber: D.integer("sheet_number").notNull(), // 1-indexed (matches file naming: sheet-1.pdf, sheet-2.pdf, etc.)
		sheetKey: D.text("sheet_key").notNull(), // R2 path to sheet PDF (renamed from dziPath)
		sheetSize: D.integer("sheet_size"),

		// NEW: Metadata extraction columns
		sheetName: D.text("sheet_name"), // Extracted sheet identifier (e.g., "A5", "A-007")
		metadataStatus: D.text("metadata_status")
			.notNull()
			.default("pending"), // pending|extracting|extracted|failed
		metadata: D.text("metadata", { mode: "json" }), // JSON: { title_block_location, extracted_text, confidence, method }
		metadataExtractedAt: D.integer("metadata_extracted_at", {
			mode: "timestamp_ms",
		}),

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
