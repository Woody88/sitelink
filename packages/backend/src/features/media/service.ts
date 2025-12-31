import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import { StorageService } from "../../core/storage"
import * as schema from "../../core/database/schemas"
/**
 * Media not found error
 */
export class MediaNotFoundError extends Schema.TaggedError<MediaNotFoundError>()(
	"MediaNotFoundError",
	{
		mediaId: Schema.String,
	},
) {}

/**
 * Coordinates for linking media to specific plan locations
 */
export interface MediaCoordinates {
	x: number
	y: number
}

/**
 * Media Service - Manages site photos/videos with optional plan coordinates
 *
 * Two-tier pattern: D1 metadata + R2 storage
 * Key feature: Optional coordinates link media to specific plan locations
 */
export class MediaService extends Effect.Service<MediaService>()(
	"MediaService",
	{
		dependencies: [Drizzle.Default, StorageService.Default],
		effect: Effect.gen(function* () {
			const db = yield* Drizzle
			const storage = yield* StorageService

			/**
			 * Build R2 storage path for media file
			 */
			const buildMediaPath = (params: {
				orgId: string
				projectId: string
				mediaType: "photo" | "video"
				mediaId: string
				ext: string
			}) => {
				const folder = params.mediaType === "photo" ? "photos" : "videos"
				return `/orgs/${params.orgId}/projects/${params.projectId}/media/${folder}/${params.mediaId}.${params.ext}`
			}

			/**
			 * Upload media (photo or video) to a project
			 *
			 * @param coordinates - Optional (x, y) coordinates on a plan
			 * @param planId - Optional plan ID if media is linked to a specific plan
			 * @param markerId - Optional marker ID (callout)
			 * @param annotationId - Optional annotation ID
			 * @param status - Optional status (before, progress, complete, issue)
			 */
			const upload = Effect.fn("Media.upload")(function* (params: {
				projectId: string
				orgId: string
				mediaData: Uint8Array | ArrayBuffer
				fileName: string
				mediaType: "photo" | "video"
				contentType: string
				planId?: string
				markerId?: string
				annotationId?: string
				status?: "before" | "progress" | "complete" | "issue"
				coordinates?: MediaCoordinates
				description?: string
				capturedBy?: string
			}) {
				// Generate media ID
				const mediaId = crypto.randomUUID()

				// Determine file extension
				const ext = params.fileName.split(".").pop() || "jpg"

				// Build storage path
				const filePath = buildMediaPath({
					orgId: params.orgId,
					projectId: params.projectId,
					mediaType: params.mediaType,
					mediaId,
					ext,
				})

				// Upload to R2 using StorageService
				yield* storage.use((r2) => r2.put(filePath, params.mediaData, {
					httpMetadata: { contentType: params.contentType },
				}))

				// TODO: Generate thumbnail using Sharp
				// For photos: Resize to 300x300 thumbnail
				// For videos: Extract first frame as thumbnail
				// Store thumbnail at: `${filePath}_thumb.jpg`

				// Create D1 metadata record
				yield* db.insert(schema.media).values({
					id: mediaId,
					projectId: params.projectId,
					planId: params.planId || null,
					markerId: params.markerId || null,
					annotationId: params.annotationId || null,
					filePath,
					mediaType: params.mediaType,
					status: params.status || null,
					description: params.description || null,
					coordinates: params.coordinates ? JSON.stringify(params.coordinates) : null,
					capturedBy: params.capturedBy || null,
					createdAt: new Date(),
					updatedAt: new Date(),
				})

				return { mediaId, filePath }
			})

			/**
			 * Get media metadata by ID
			 */
			const get = Effect.fn("Media.get")(function* (mediaId: string) {
				return yield* db
					.select()
					.from(schema.media)
					.where(eq(schema.media.id, mediaId))
					.pipe(
						Effect.head,
						Effect.mapError(() => new MediaNotFoundError({ mediaId })),
					)
			})

			/**
			 * Download media data from R2
			 */
			const download = Effect.fn("Media.download")(function* (
				mediaId: string,
			) {
				// Get media metadata to find R2 path
				const media = yield* get(mediaId)

				if (!media.filePath) {
					return yield* Effect.fail(
						new Error(`Media ${mediaId} has no storage path`),
					)
				}

				// Download from R2 using StorageService
				const object = yield* storage.use((r2) => r2.get(media.filePath))

				if (!object) {
					return yield* Effect.fail(
						new Error(`Media not found in storage: ${media.filePath}`),
					)
				}

				const arrayBuffer = yield* Effect.promise(() => object.arrayBuffer())
				return {
					data: arrayBuffer,
					contentType: media.mediaType === "photo" ? "image/jpeg" : "video/mp4",
				}
			})

			/**
			 * List all media for a project
			 */
			const listByProject = Effect.fn("Media.listByProject")(function* (
				projectId: string,
			) {
				return yield* db
					.select()
					.from(schema.media)
					.where(eq(schema.media.projectId, projectId))
			})

			/**
			 * Update media status
			 */
			const updateStatus = Effect.fn("Media.updateStatus")(function* (params: {
				mediaId: string
				status: "before" | "progress" | "complete" | "issue"
			}) {
				// Verify media exists first
				yield* get(params.mediaId)

				// Update the status in database
				yield* db
					.update(schema.media)
					.set({
						status: params.status,
						updatedAt: new Date(),
					})
					.where(eq(schema.media.id, params.mediaId))

				// Return updated media
				return yield* get(params.mediaId)
			})

			/**
			 * Delete media (from both D1 and R2)
			 */
			const deleteMedia = Effect.fn("Media.delete")(function* (
				mediaId: string,
			) {
				// Get media to verify it exists and get R2 path
				const media = yield* get(mediaId)

				// Delete from R2 if path exists
				if (media.filePath) {
					// TODO: Also delete thumbnail when implemented
					// const thumbPath = `${media.filePath}_thumb.jpg`
					yield* storage.use((r2) => r2.batchDelete([media.filePath]))
				}

				// Delete from D1
				yield* db.delete(schema.media).where(eq(schema.media.id, mediaId))
			})

			return {
				upload,
				get,
				download,
				listByProject,
				updateStatus,
				delete: deleteMedia,
			} as const
		}),
	},
) {}
