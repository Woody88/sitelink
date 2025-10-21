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
 * Access control error
 */
export class ProjectAccessDeniedError extends Schema.TaggedError<ProjectAccessDeniedError>()(
	"ProjectAccessDeniedError",
	{
		projectId: Schema.String,
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
			.setPayload(HttpApiSchema.Multipart),
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
		HttpApiEndpoint.del("deleteMedia")`/media/${mediaIdParam}`
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
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
						// Verify access to project
						const { project, orgId } = yield* verifyProjectAccess(path.projectId)

						// Parse multipart stream to get media files
						const parts = yield* Stream.runCollect(payload)
						const uploadedMedia: Array<{
							mediaId: string
							fileName: string
							mediaType: string
						}> = []

						// Process each file part
						for (const part of parts) {
							if (Multipart.isFile(part)) {
								// Get file content as Uint8Array
								const mediaData = yield* part.contentEffect

								// Determine media type from content type
								const mediaType = getMediaType(part.contentType)

								// TODO: Parse coordinates and description from form fields
								// For now, coordinates are null (project-wide media)

								// Upload media to R2
								const { mediaId } = yield* mediaService.upload({
									projectId: project.id,
									orgId,
									mediaData,
									fileName: part.name,
									mediaType,
									contentType: part.contentType,
									// planId: undefined, // TODO: Get from form field
									// coordinates: undefined, // TODO: Get from form field
									// description: undefined, // TODO: Get from form field
								})

								uploadedMedia.push({
									mediaId,
									fileName: part.name,
									mediaType,
								})
							}
						}

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
				.handle("deleteMedia", ({ path }) =>
					Effect.gen(function* () {
						// Verify access
						yield* verifyMediaAccess(path.id)

						// Delete media
						yield* mediaService.delete(path.id)

						return { success: true as const }
					}),
				)
		}),
)
