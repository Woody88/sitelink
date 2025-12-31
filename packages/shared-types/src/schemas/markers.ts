import { Schema } from "effect"

/**
 * Marker/Hyperlink Schemas
 */
export const HyperlinkSchema = Schema.Struct({
	id: Schema.String,
	calloutRef: Schema.String,
	targetSheetRef: Schema.String,
	x: Schema.Number,
	y: Schema.Number,
	confidence: Schema.Number,
})
export type Hyperlink = typeof HyperlinkSchema.Type

export const SheetMarkersResponse = Schema.Struct({
	hyperlinks: Schema.Array(HyperlinkSchema),
	calloutsFound: Schema.Number,
	calloutsMatched: Schema.Number,
	confidenceStats: Schema.Struct({
		averageConfidence: Schema.Number,
	}),
	processingTimeMs: Schema.Number,
})
export type SheetMarkersResponse = typeof SheetMarkersResponse.Type

/**
 * Pending Review Marker Schema (for mobile review workflow)
 */
export const PendingReviewMarkerSchema = Schema.Struct({
	id: Schema.String,
	calloutRef: Schema.String,
	targetSheetRef: Schema.String,
	sheetNumber: Schema.Number,
	markerType: Schema.String,
	x: Schema.Number,
	y: Schema.Number,
	confidence: Schema.Number,
	reviewStatus: Schema.String,
})
export type PendingReviewMarker = typeof PendingReviewMarkerSchema.Type

export const PendingReviewResponse = Schema.Struct({
	markers: Schema.Array(PendingReviewMarkerSchema),
	total: Schema.Number,
	confidenceThreshold: Schema.Number,
})
export type PendingReviewResponse = typeof PendingReviewResponse.Type
