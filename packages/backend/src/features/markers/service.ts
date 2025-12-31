import { HttpApiSchema } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import * as schema from "../../core/database/schemas"

/**
 * Marker not found error
 */
export class MarkerNotFoundError extends Schema.TaggedError<MarkerNotFoundError>()(
	"MarkerNotFoundError",
	{
		markerId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Marker not found",
	}),
) {}

/**
 * Markers Service - Manages marker review workflow
 *
 * Handles position adjustments and review status updates for detected markers
 */
export class MarkersService extends Effect.Service<MarkersService>()("MarkersService", {
	dependencies: [Drizzle.Default],
	effect: Effect.gen(function* () {
		const db = yield* Drizzle

		/**
		 * Update marker position (from mobile app adjustment)
		 */
		const updatePosition = Effect.fn("Markers.updatePosition")(function* (params: {
			markerId: string
			x: number
			y: number
			adjustedBy: string
		}) {
			// Get current marker to backup original bbox
			const marker = yield* db
				.select()
				.from(schema.planMarkers)
				.where(eq(schema.planMarkers.id, params.markerId))
				.pipe(
					Effect.head,
					Effect.mapError(() => new MarkerNotFoundError({ markerId: params.markerId })),
				)

			// Parse current bbox
			let currentBbox: { x: number; y: number; w: number; h: number } | null = null
			if (marker.bbox) {
				if (typeof marker.bbox === "string") {
					try {
						currentBbox = JSON.parse(marker.bbox) as { x: number; y: number; w: number; h: number }
					} catch {
						currentBbox = null
					}
				} else if (typeof marker.bbox === "object") {
					currentBbox = marker.bbox as { x: number; y: number; w: number; h: number }
				}
			}

			// Build adjusted bbox (keep same width/height, update center)
			const adjustedBbox = {
				x: params.x,
				y: params.y,
				w: currentBbox?.w || 0.05,
				h: currentBbox?.h || 0.05,
			}

			// Backup original bbox if not already backed up
			const originalBbox = marker.originalBbox ? marker.originalBbox : currentBbox

			// Update marker with adjusted position
			yield* db
				.update(schema.planMarkers)
				.set({
					bbox: adjustedBbox as any, // Store as JSON
					adjustedBbox: adjustedBbox as any,
					originalBbox: originalBbox as any,
					adjustedBy: params.adjustedBy,
					adjustedAt: new Date(),
				})
				.where(eq(schema.planMarkers.id, params.markerId))

			return { success: true }
		})

		/**
		 * Review a marker (confirm or reject)
		 */
		const review = Effect.fn("Markers.review")(function* (params: {
			markerId: string
			action: "confirm" | "reject"
			reviewedBy: string
			notes?: string
		}) {
			// Verify marker exists
			const marker = yield* db
				.select()
				.from(schema.planMarkers)
				.where(eq(schema.planMarkers.id, params.markerId))
				.pipe(
					Effect.head,
					Effect.mapError(() => new MarkerNotFoundError({ markerId: params.markerId })),
				)

			// Update review status
			const reviewStatus = params.action === "confirm" ? "confirmed" : "rejected"
			yield* db
				.update(schema.planMarkers)
				.set({
					reviewStatus: reviewStatus as "pending" | "confirmed" | "rejected",
					adjustedBy: params.reviewedBy,
					adjustedAt: new Date(),
					reviewNotes: params.notes || null,
				})
				.where(eq(schema.planMarkers.id, params.markerId))

			return { success: true, reviewStatus }
		})

		/**
		 * Bulk review markers (for batch operations)
		 */
		const bulkReview = Effect.fn("Markers.bulkReview")(function* (params: {
			markerIds: string[]
			action: "confirm" | "reject"
			reviewedBy: string
			notes?: string
		}) {
			const reviewStatus = params.action === "confirm" ? "confirmed" : "rejected"
			const now = new Date()

			// Update all markers in bulk
			for (const markerId of params.markerIds) {
				// Verify each marker exists and update
				yield* db
					.update(schema.planMarkers)
					.set({
						reviewStatus: reviewStatus as "pending" | "confirmed" | "rejected",
						adjustedBy: params.reviewedBy,
						adjustedAt: now,
						reviewNotes: params.notes || null,
					})
					.where(eq(schema.planMarkers.id, markerId))
			}

			return { success: true, updated: params.markerIds.length, reviewStatus }
		})

		/**
		 * Get media for a marker
		 */
		const getMedia = Effect.fn("Markers.getMedia")(function* (params: {
			markerId: string
		}) {
			// Verify marker exists
			yield* db
				.select()
				.from(schema.planMarkers)
				.where(eq(schema.planMarkers.id, params.markerId))
				.pipe(
					Effect.head,
					Effect.mapError(() => new MarkerNotFoundError({ markerId: params.markerId })),
				)

			// Query media linked to this marker
			const results = yield* db
				.select()
				.from(schema.media)
				.where(eq(schema.media.markerId, params.markerId))
				.pipe(Effect.map((rows) => rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())))

			return { media: results }
		})

		return {
			updatePosition,
			review,
			bulkReview,
			getMedia,
		} as const
	}),
}) {}
