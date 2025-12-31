import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiSchema,
	Multipart,
} from "@effect/platform"
import { Effect, Schema, Stream } from "effect"
import { BaseApi } from "../../core/api"
import { Authorization, CurrentSession } from "../../core/middleware"
import { ProjectService } from "../projects/service"
import { MediaNotFoundError, MediaService } from "./service"

/**
 * Response Schemas
 */
const MediaResponse = Schema.Struct({
	id: Schema.String,
	projectId: Schema.String,
	filePath: Schema.NullOr(Schema.String),
	mediaType: Schema.NullOr(Schema.String),
	status: Schema.NullOr(Schema.Literal("before", "progress", "complete", "issue")),
	description: Schema.NullOr(Schema.String),
	createdAt: Schema.Date,
})

const MediaListResponse = Schema.Struct({
	media: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			filePath: Schema.NullOr(Schema.String),
			mediaType: Schema.NullOr(Schema.String),
			createdAt: Schema.Date,
		}),
	),
})

const UploadMediaResponse = Schema.Struct({
	media: Schema.Array(
		Schema.Struct({
			mediaId: Schema.String,
			fileName: Schema.String,
			mediaType: Schema.String,
		}),
	),
})

/**
 * URL Parameters
 */
const mediaIdParam = HttpApiSchema.param("id", Schema.String)
const projectIdParam = HttpApiSchema.param("projectId", Schema.String)

/**
 * Request Schemas
 */
const UpdateStatusRequest = Schema.Struct({
	status: Schema.Literal("before", "progress", "complete", "issue"),
})

const UpdateDescriptionRequest = Schema.Struct({
	description: Schema.optional(Schema.String),
})

/**
 * Search Query Parameters
 */
const MediaSearchQuery = Schema.Struct({
	q: Schema.optional(Schema.String),
	status: Schema.optional(Schema.Literal("before", "progress", "complete", "issue")),
	planId: Schema.optional(Schema.String),
	markerId: Schema.optional(Schema.String),
	dateFrom: Schema.optional(Schema.DateFromString),
	dateTo: Schema.optional(Schema.DateFromString),
	limit: Schema.optional(Schema.NumberFromString),
	offset: Schema.optional(Schema.NumberFromString),
})

const MediaSearchResponse = Schema.Struct({
	media: Schema.Array(MediaResponse),
	total: Schema.Number,
	limit: Schema.Number,
	offset: Schema.Number,
})

/**
 * Access control errors
 */
export class ProjectAccessDeniedError extends Schema.TaggedError<ProjectAccessDeniedError>()(
	"ProjectAccessDeniedError",
	{
		projectId: Schema.String,
		message: Schema.String,
	},
) {}

export class InvalidStatusError extends Schema.TaggedError<InvalidStatusError>()(
	"InvalidStatusError",
	{
		status: Schema.String,
		message: Schema.String,
	},
) {}

/**
 * Media API Endpoints
 */
export const MediaAPI = HttpApiGroup.make("media")
	.add(
		HttpApiEndpoint.post("uploadMedia")`/projects/${projectIdParam}/media`
			.addSuccess(UploadMediaResponse)
			.addError(ProjectAccessDeniedError)
			.addError(Multipart.MultipartError)
			.setPayload(HttpApiSchema.MultipartStream(Schema.Struct({}))),
	)
	.add(
		HttpApiEndpoint.get("getMedia")`/media/${mediaIdParam}`
			.addSuccess(MediaResponse)
			.addError(MediaNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.get("downloadMedia")`/media/${mediaIdParam}/download`
			.addSuccess(Schema.Uint8Array)
			.addError(MediaNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.get("listProjectMedia")`/projects/${projectIdParam}/media`
			.addSuccess(MediaListResponse)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.get("searchProjectMedia")`/projects/${projectIdParam}/media/search`
			.addSuccess(MediaSearchResponse)
			.addError(ProjectAccessDeniedError)
			.setUrlParams(MediaSearchQuery),
	)
	.add(
		HttpApiEndpoint.del("deleteMedia")`/media/${mediaIdParam}`
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(MediaNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.patch("updateMediaStatus")`/media/${mediaIdParam}/status`
			.setPayload(UpdateStatusRequest)
			.addSuccess(MediaResponse)
			.addError(MediaNotFoundError)
			.addError(ProjectAccessDeniedError)
			.addError(InvalidStatusError),
	)
	.add(
		HttpApiEndpoint.patch("updateMedia")`/media/${mediaIdParam}`
			.setPayload(UpdateDescriptionRequest)
			.addSuccess(MediaResponse)
			.addError(MediaNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.prefix("/api")
	.middleware(Authorization)

/**
 * HTTP Handler Layer
 */
export const MediaAPILive = HttpApiBuilder.group(
	BaseApi.add(MediaAPI),
	"media",
	(handlers) =>
		Effect.gen(function* () {
			const mediaService = yield* MediaService
			const projectService = yield* ProjectService

			/**
			 * Helper: Verify project belongs to user's active organization
			 */
			const verifyProjectAccess = Effect.fn("verifyProjectAccess")(function* (
				projectId: string,
			) {
				const session = yield* CurrentSession
				const activeOrgId = session.session.activeOrganizationId

				if (!activeOrgId) {
					return yield* new ProjectAccessDeniedError({
						projectId,
						message: "No active organization in session",
					})
				}

				// Get project to verify it belongs to organization
				const project = yield* projectService.get(projectId)

				if (project.organizationId !== activeOrgId) {
					return yield* new ProjectAccessDeniedError({
						projectId,
						message: "Project does not belong to active organization",
					})
				}

				return { project, orgId: activeOrgId }
			})

			/**
			 * Helper: Verify media's project belongs to user's active organization
			 */
			const verifyMediaAccess = Effect.fn("verifyMediaAccess")(function* (
				mediaId: string,
			) {
				const media = yield* mediaService.get(mediaId)
				const { project, orgId } = yield* verifyProjectAccess(media.projectId)
				return { media, project, orgId }
			})

			/**
			 * Determine media type from content type
			 */
			const getMediaType = (contentType: string): "photo" | "video" => {
				if (contentType.startsWith("image/")) return "photo"
				if (contentType.startsWith("video/")) return "video"
				return "photo" // Default to photo
			}

			return handlers
				.handle("uploadMedia", ({ path, payload }) =>
					Effect.gen(function* () {
						console.log("MediaAPI.uploadMedia: Starting upload for project", path.projectId)

						// Verify access to project
						const { project, orgId } = yield* verifyProjectAccess(path.projectId)
						const { user } = yield* CurrentSession

						console.log("MediaAPI.uploadMedia: Access verified for org", orgId, "user", user.id)

						// Parse multipart stream to get media files and fields
						const parts = yield* Stream.runCollect(payload)
						console.log("MediaAPI.uploadMedia: Received", parts.length, "parts")

						// Collect form fields and process files in a SINGLE iteration
						const fields: Record<string, string> = {}
						const uploadedMedia: Array<{
							mediaId: string
							fileName: string
							mediaType: string
						}> = []

						// Process each part (fields first, then files)
						for (const part of parts) {
							if (Multipart.isField(part)) {
								fields[part.name] = part.value
								console.log("MediaAPI.uploadMedia: Field", part.name, "=", part.value)
							} else if (Multipart.isFile(part)) {
								console.log("MediaAPI.uploadMedia: Processing file", part.name, "type", part.contentType)
								// Get file content as Uint8Array - MUST be consumed immediately
								const mediaData = yield* part.contentEffect

								// Determine media type from content type
								const mediaType = getMediaType(part.contentType)

								// Parse coordinates if provided
								let coordinates: { x: number; y: number } | undefined = undefined
								if (fields.coordinates) {
									try {
										coordinates = JSON.parse(fields.coordinates)
									} catch {
										// Ignore invalid coordinates
									}
								}

								// Upload media to R2
								console.log("MediaAPI.uploadMedia: Uploading to R2, size:", mediaData.byteLength, "bytes")
								const { mediaId } = yield* mediaService.upload({
									projectId: project.id,
									orgId,
									mediaData,
									fileName: part.name,
									mediaType,
									contentType: part.contentType,
									planId: fields.planId,
									markerId: fields.markerId,
									annotationId: fields.annotationId,
									status: fields.status as any,
									description: fields.description,
									coordinates,
									capturedBy: user.id,
								})

								console.log("MediaAPI.uploadMedia: Upload successful, mediaId:", mediaId)

								uploadedMedia.push({
									mediaId,
									fileName: part.name,
									mediaType,
								})
							}
						}

						console.log("MediaAPI.uploadMedia: Returning", uploadedMedia.length, "uploaded media items")
						return { media: uploadedMedia }
					}),
				)
				.handle("getMedia", ({ path }) =>
					Effect.gen(function* () {
						// Verify access and return media metadata
						const { media } = yield* verifyMediaAccess(path.id)
						return media
					}),
				)
				.handle("downloadMedia", ({ path }) =>
					Effect.gen(function* () {
						// Verify access
						yield* verifyMediaAccess(path.id)

						// Download media data
						const { data } = yield* mediaService.download(path.id)

						// Return as Uint8Array
						return new Uint8Array(data)
					}),
				)
				.handle("listProjectMedia", ({ path }) =>
					Effect.gen(function* () {
						// Verify access to project
						yield* verifyProjectAccess(path.projectId)

						// List all media for project
						const mediaList = yield* mediaService.listByProject(path.projectId)

						return { media: mediaList }
					}),
				)
				.handle("searchProjectMedia", ({ path, urlParams }) =>
					Effect.gen(function* () {
						// Verify access to project
						yield* verifyProjectAccess(path.projectId)

						// Search media with filters
						const result = yield* mediaService.search({
							projectId: path.projectId,
							q: urlParams.q,
							status: urlParams.status,
							planId: urlParams.planId,
							markerId: urlParams.markerId,
							dateFrom: urlParams.dateFrom,
							dateTo: urlParams.dateTo,
							limit: urlParams.limit,
							offset: urlParams.offset,
						})

						return result
					}),
				)
				.handle("deleteMedia", ({ path }) =>
					Effect.gen(function* () {
						// Verify access
						yield* verifyMediaAccess(path.id)

						// Delete media
						yield* mediaService.delete(path.id)

						return { success: true as const }
					}),
				)
				.handle("updateMediaStatus", ({ path, payload }) =>
					Effect.gen(function* () {
						// Verify access to media
						yield* verifyMediaAccess(path.id)

						// Update media status
						const updatedMedia = yield* mediaService.updateStatus({
							mediaId: path.id,
							status: payload.status,
						})

						return updatedMedia
					}),
				)
				.handle("updateMedia", ({ path, payload }) =>
					Effect.gen(function* () {
						// Verify access to media
						yield* verifyMediaAccess(path.id)

						// Update media description
						const updatedMedia = yield* mediaService.update({
							mediaId: path.id,
							description: payload.description,
						})

						return updatedMedia
					}),
				)
		}),
)
