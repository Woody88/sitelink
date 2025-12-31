import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiSchema,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { MarkerMediaResponse } from "@sitelink/shared-types"
import { BaseApi } from "../../core/api"
import { Authorization, CurrentSession } from "../../core/middleware"
import { MarkerNotFoundError, MarkersService } from "./service"

/**
 * Request Schemas
 */
const UpdatePositionRequest = Schema.Struct({
	x: Schema.Number,
	y: Schema.Number,
})

const ReviewRequest = Schema.Struct({
	action: Schema.Literal("confirm", "reject"),
	notes: Schema.optional(Schema.String),
})

const BulkReviewRequest = Schema.Struct({
	markerIds: Schema.Array(Schema.String),
	action: Schema.Literal("confirm", "reject"),
	notes: Schema.optional(Schema.String),
})

/**
 * Response Schemas
 */
const SuccessResponse = Schema.Struct({
	success: Schema.Literal(true),
})

const ReviewResponse = Schema.Struct({
	success: Schema.Literal(true),
	reviewStatus: Schema.String,
})

const BulkReviewResponse = Schema.Struct({
	success: Schema.Literal(true),
	updated: Schema.Number,
	reviewStatus: Schema.String,
})

/**
 * URL Parameters
 */
const markerIdParam = HttpApiSchema.param("markerId", Schema.String)

/**
 * Markers API Endpoints
 */
export const MarkersAPI = HttpApiGroup.make("markers")
	.add(
		HttpApiEndpoint.patch("updatePosition")`/markers/${markerIdParam}/position`
			.setPayload(UpdatePositionRequest)
			.addSuccess(SuccessResponse)
			.addError(MarkerNotFoundError),
	)
	.add(
		HttpApiEndpoint.patch("reviewMarker")`/markers/${markerIdParam}/review`
			.setPayload(ReviewRequest)
			.addSuccess(ReviewResponse)
			.addError(MarkerNotFoundError),
	)
	.add(
		HttpApiEndpoint.post("bulkReview")`/markers/bulk-review`
			.setPayload(BulkReviewRequest)
			.addSuccess(BulkReviewResponse),
	)
	.add(
		HttpApiEndpoint.get("getMarkerMedia")`/markers/${markerIdParam}/media`
			.addSuccess(MarkerMediaResponse)
			.addError(MarkerNotFoundError),
	)
	.prefix("/api")
	.middleware(Authorization)

/**
 * HTTP Handler Layer
 */
export const MarkersAPILive = HttpApiBuilder.group(
	BaseApi.add(MarkersAPI),
	"markers",
	(handlers) =>
		Effect.gen(function* () {
			const markersService = yield* MarkersService

			return handlers
				.handle("updatePosition", ({ path, payload }) =>
					Effect.gen(function* () {
						const { user } = yield* CurrentSession

						// Update marker position
						yield* markersService.updatePosition({
							markerId: path.markerId,
							x: payload.x,
							y: payload.y,
							adjustedBy: user.id,
						})

						return { success: true as const }
					}),
				)
				.handle("reviewMarker", ({ path, payload }) =>
					Effect.gen(function* () {
						const { user } = yield* CurrentSession

						// Review marker
						const result = yield* markersService.review({
							markerId: path.markerId,
							action: payload.action,
							reviewedBy: user.id,
							notes: payload.notes,
						})

						return { success: true as const, reviewStatus: result.reviewStatus }
					}),
				)
				.handle("bulkReview", ({ payload }) =>
					Effect.gen(function* () {
						const { user } = yield* CurrentSession

						// Bulk review markers
						const result = yield* markersService.bulkReview({
							markerIds: payload.markerIds,
							action: payload.action,
							reviewedBy: user.id,
							notes: payload.notes,
						})

						return {
							success: true as const,
							updated: result.updated,
							reviewStatus: result.reviewStatus,
						}
					}),
				)
				.handle("getMarkerMedia", ({ path }) =>
					Effect.gen(function* () {
						const { media } = yield* markersService.getMedia({
							markerId: path.markerId,
						})

						return {
							media: media.map((m) => ({
								id: m.id,
								filePath: m.filePath,
								mediaType: m.mediaType,
								status: m.status as any,
								description: m.description,
								createdAt: m.createdAt.getTime(),
							})),
						}
					}),
				)
		}),
)
