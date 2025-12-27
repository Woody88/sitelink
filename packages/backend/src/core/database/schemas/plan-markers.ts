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

		// Review workflow (for mobile app position adjustment)
		reviewStatus: D.text("review_status", { enum: ["pending", "confirmed", "rejected"] })
			.notNull()
			.default("pending"),
		adjustedBbox: D.text("adjusted_bbox", { mode: "json" }), // JSON: { x, y, w, h } - user-corrected position
		originalBbox: D.text("original_bbox", { mode: "json" }), // JSON: backup of original bbox before adjustment
		adjustedBy: D.text("adjusted_by"), // User ID who made the adjustment
		adjustedAt: D.integer("adjusted_at", { mode: "timestamp_ms" }), // When adjustment was made
		reviewNotes: D.text("review_notes"), // Optional notes from reviewer

		createdAt: D.integer("created_at", { mode: "timestamp_ms" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		uploadIdIdx: D.index("idx_markers_upload").on(table.uploadId),
		planIdIdx: D.index("idx_markers_plan").on(table.planId),
		sheetIdx: D.index("idx_markers_sheet").on(table.planId, table.sheetNumber),
		// Index for mobile review queries (filter by confidence and review status)
		reviewIdx: D.index("idx_markers_review").on(table.planId, table.reviewStatus, table.confidence),
	}),
)

// Effect-TS schemas
export const InsertPlanMarker = createInsertSchema(planMarkers)
export const SelectPlanMarker = createSelectSchema(planMarkers)
