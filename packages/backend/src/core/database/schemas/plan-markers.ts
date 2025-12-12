import * as D from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-effect"
import { planUploads } from "./plan-uploads"
import { plans } from "./plans"

export const planMarkers = D.sqliteTable(
	"plan_markers",
	{
		id: D.text().primaryKey(),
		uploadId: D.text("upload_id")
			.notNull()
			.references(() => planUploads.uploadId, { onDelete: "cascade" }),
		planId: D.text("plan_id")
			.notNull()
			.references(() => plans.id, { onDelete: "cascade" }),
		sheetNumber: D.integer("sheet_number").notNull(), // Which sheet this marker appears on (1-indexed)

		// Marker content
		markerText: D.text("marker_text").notNull(), // Full text (e.g., "3/A7")
		detail: D.text("detail").notNull(), // Detail number (e.g., "3")
		sheet: D.text("sheet").notNull(), // Referenced sheet (e.g., "A7")
		markerType: D.text("marker_type").notNull(), // "circular" | "triangular"

		// Validation metadata
		confidence: D.real("confidence").notNull(), // 0.0-1.0
		isValid: D.integer("is_valid", { mode: "boolean" }).notNull(), // LLM validation result
		fuzzyMatched: D.integer("fuzzy_matched", { mode: "boolean" })
			.notNull()
			.default(false), // If sheet was fuzzy matched

		// Location metadata
		sourceTile: D.text("source_tile"), // Tile filename where marker was found
		bbox: D.text("bbox", { mode: "json" }), // JSON: { x, y, w, h }

		createdAt: D.integer("created_at", { mode: "timestamp_ms" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		uploadIdIdx: D.index("idx_markers_upload").on(table.uploadId),
		planIdIdx: D.index("idx_markers_plan").on(table.planId),
		sheetIdx: D.index("idx_markers_sheet").on(table.planId, table.sheetNumber),
	}),
)

// Effect-TS schemas
export const InsertPlanMarker = createInsertSchema(planMarkers)
export const SelectPlanMarker = createSelectSchema(planMarkers)
