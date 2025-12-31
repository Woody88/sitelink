/**
 * Effect-based API Client for SiteLink Mobile
 *
 * Uses Effect for type-safe API calls with automatic error handling
 */
import { Effect, Schema, Data } from "effect"
import {
	ProjectListResponse,
	ProjectResponse,
	CreateProjectRequest,
	CreateProjectResponse,
	PlanListResponse,
	PlanResponse,
	CreatePlanResponse,
	SheetListResponse,
	SheetMarkersResponse,
	PendingReviewResponse,
	SuccessResponse,
	JobStatusResponse,
} from "@sitelink/shared-types"
import { getApiUrl } from "./config"

/**
 * API Error Types
 */
export class ApiError extends Data.TaggedError("ApiError")<{
	status: number
	message: string
	endpoint: string
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
	message: string
	endpoint: string
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
	message: string
}> {}

export type ApiErrorType = ApiError | NetworkError | UnauthorizedError

/**
 * Make an authenticated API request
 */
const request = <A, I>(
	endpoint: string,
	schema: Schema.Schema<A, I, never>,
	options: RequestInit = {}
): Effect.Effect<A, ApiErrorType> =>
	Effect.gen(function* () {
		const baseUrl = getApiUrl()
		const url = `${baseUrl}${endpoint}`

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch(url, {
					...options,
					credentials: "include", // Include cookies for auth
					headers: {
						"Content-Type": "application/json",
						...options.headers,
					},
				}),
			catch: (error) =>
				new NetworkError({
					message: error instanceof Error ? error.message : "Network error",
					endpoint,
				}),
		})

		if (response.status === 401) {
			return yield* new UnauthorizedError({
				message: "Authentication required",
			})
		}

		if (!response.ok) {
			const errorText = yield* Effect.tryPromise({
				try: () => response.text(),
				catch: () =>
					new ApiError({
						status: response.status,
						message: "Failed to read error response",
						endpoint,
					}),
			})
			return yield* new ApiError({
				status: response.status,
				message: typeof errorText === "string" ? errorText : "Unknown error",
				endpoint,
			})
		}

		const json = yield* Effect.tryPromise({
			try: () => response.json(),
			catch: () =>
				new ApiError({
					status: response.status,
					message: "Failed to parse response",
					endpoint,
				}),
		})

		// Decode with schema
		const decoded = yield* Schema.decodeUnknown(schema)(json).pipe(
			Effect.mapError(
				(error) =>
					new ApiError({
						status: response.status,
						message: `Schema validation failed: ${String(error)}`,
						endpoint,
					})
			)
		)

		return decoded
	})

/**
 * Projects API
 */
export const ProjectsApi = {
	list: (organizationId: string) =>
		request(
			`/api/projects/organizations/${organizationId}/projects`,
			ProjectListResponse
		),

	get: (projectId: string) =>
		request(`/api/projects/${projectId}`, ProjectResponse),

	create: (data: CreateProjectRequest) =>
		request(`/api/projects/`, CreateProjectResponse, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (projectId: string, data: { name?: string; description?: string }) =>
		request(`/api/projects/${projectId}`, SuccessResponse, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	delete: (projectId: string) =>
		request(`/api/projects/${projectId}`, SuccessResponse, {
			method: "DELETE",
		}),
}

/**
 * Plans API
 */
export const PlansApi = {
	list: (projectId: string) =>
		request(`/api/projects/${projectId}/plans`, PlanListResponse),

	get: (planId: string) => request(`/api/plans/${planId}`, PlanResponse),

	/**
	 * Upload a PDF plan file (multipart form data)
	 */
	upload: (
		projectId: string,
		file: { uri: string; name: string; type: string },
		options?: { name?: string; description?: string }
	): Effect.Effect<typeof CreatePlanResponse.Type, ApiErrorType> =>
		Effect.gen(function* () {
			const baseUrl = getApiUrl()
			const url = `${baseUrl}/api/projects/${projectId}/plans`

			// Create FormData for multipart upload
			const formData = new FormData()
			formData.append("file", {
				uri: file.uri,
				name: file.name,
				type: file.type,
			} as unknown as Blob)

			if (options?.name) formData.append("name", options.name)
			if (options?.description) formData.append("description", options.description)

			const response = yield* Effect.tryPromise({
				try: () =>
					fetch(url, {
						method: "POST",
						credentials: "include",
						body: formData,
						// Don't set Content-Type - let browser set it with boundary
					}),
				catch: (error) =>
					new NetworkError({
						message: error instanceof Error ? error.message : "Network error",
						endpoint: url,
					}),
			})

			if (response.status === 401) {
				return yield* new UnauthorizedError({
					message: "Authentication required",
				})
			}

			if (!response.ok) {
				const errorText = yield* Effect.tryPromise({
					try: () => response.text(),
					catch: () =>
						new ApiError({
							status: response.status,
							message: "Failed to read error response",
							endpoint: url,
						}),
				})
				return yield* new ApiError({
					status: response.status,
					message: typeof errorText === "string" ? errorText : "Upload failed",
					endpoint: url,
				})
			}

			const json = yield* Effect.tryPromise({
				try: () => response.json(),
				catch: () =>
					new ApiError({
						status: response.status,
						message: "Failed to parse response",
						endpoint: url,
					}),
			})

			const decoded = yield* Schema.decodeUnknown(CreatePlanResponse)(json).pipe(
				Effect.mapError(
					(error) =>
						new ApiError({
							status: response.status,
							message: `Schema validation failed: ${String(error)}`,
							endpoint: url,
						})
				)
			)

			return decoded
		}),

	update: (planId: string, data: { name?: string; description?: string }) =>
		request(`/api/plans/${planId}`, SuccessResponse, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	delete: (planId: string) =>
		request(`/api/plans/${planId}`, SuccessResponse, {
			method: "DELETE",
		}),
}

/**
 * Processing API - Job status and progress tracking
 */
export const ProcessingApi = {
	/**
	 * Get processing job status
	 */
	getJobStatus: (jobId: string) =>
		request(`/api/processing/jobs/${jobId}`, JobStatusResponse),
}

/**
 * DZI Metadata schema
 */
export const DziMetadataSchema = Schema.Struct({
	width: Schema.Number,
	height: Schema.Number,
	tileSize: Schema.Number,
	overlap: Schema.Number,
	format: Schema.String,
})

export type DziMetadata = Schema.Schema.Type<typeof DziMetadataSchema>

/**
 * Sheets API
 */
export const SheetsApi = {
	list: (planId: string) =>
		request(`/api/plans/${planId}/sheets`, SheetListResponse),

	getDziUrl: (planId: string, sheetId: string) => {
		const baseUrl = getApiUrl()
		return `${baseUrl}/api/plans/${planId}/sheets/${sheetId}/dzi`
	},

	getTileUrl: (planId: string, sheetId: string, level: number, tile: string) => {
		const baseUrl = getApiUrl()
		return `${baseUrl}/api/plans/${planId}/sheets/${sheetId}/tiles/${level}/${tile}`
	},

	/**
	 * Fetch DZI metadata from the backend (from React Native, not webview)
	 */
	getDziMetadata: (planId: string, sheetId: string): Effect.Effect<DziMetadata, ApiErrorType> =>
		Effect.gen(function* () {
			const baseUrl = getApiUrl()
			const url = `${baseUrl}/api/plans/${planId}/sheets/${sheetId}/dzi`

			const response = yield* Effect.tryPromise({
				try: () =>
					fetch(url, {
						credentials: "include",
					}),
				catch: (error) =>
					new NetworkError({
						message: error instanceof Error ? error.message : "Network error",
						endpoint: url,
					}),
			})

			if (response.status === 401) {
				return yield* new UnauthorizedError({
					message: "Authentication required",
				})
			}

			if (!response.ok) {
				return yield* new ApiError({
					status: response.status,
					message: `Failed to fetch DZI: ${response.statusText}`,
					endpoint: url,
				})
			}

			const xmlText = yield* Effect.tryPromise({
				try: () => response.text(),
				catch: () =>
					new ApiError({
						status: response.status,
						message: "Failed to read DZI response",
						endpoint: url,
					}),
			})

			// Parse DZI XML
			// Format: <Image TileSize="256" Overlap="1" Format="jpeg"><Size Width="1234" Height="5678"/></Image>
			const tileSize = parseInt(xmlText.match(/TileSize="(\d+)"/)?.[1] || "256", 10)
			const overlap = parseInt(xmlText.match(/Overlap="(\d+)"/)?.[1] || "0", 10)
			const format = xmlText.match(/Format="(\w+)"/)?.[1] || "jpeg"
			const width = parseInt(xmlText.match(/Width="(\d+)"/)?.[1] || "0", 10)
			const height = parseInt(xmlText.match(/Height="(\d+)"/)?.[1] || "0", 10)

			if (width === 0 || height === 0) {
				return yield* new ApiError({
					status: 500,
					message: "Invalid DZI metadata: missing dimensions",
					endpoint: url,
				})
			}

			return { width, height, tileSize, overlap, format }
		}),

	/**
	 * Fetch a tile as base64 (from React Native, for passing to webview)
	 */
	getTileBase64: (planId: string, sheetId: string, level: number, x: number, y: number, format: string): Effect.Effect<string, ApiErrorType> =>
		Effect.gen(function* () {
			const baseUrl = getApiUrl()
			const tile = `${x}_${y}.${format}`
			const url = `${baseUrl}/api/plans/${planId}/sheets/${sheetId}/tiles/${level}/${tile}`

			const response = yield* Effect.tryPromise({
				try: () =>
					fetch(url, {
						credentials: "include",
					}),
				catch: (error) =>
					new NetworkError({
						message: error instanceof Error ? error.message : "Network error",
						endpoint: url,
					}),
			})

			if (!response.ok) {
				return yield* new ApiError({
					status: response.status,
					message: `Failed to fetch tile: ${response.statusText}`,
					endpoint: url,
				})
			}

			const blob = yield* Effect.tryPromise({
				try: () => response.blob(),
				catch: () =>
					new ApiError({
						status: response.status,
						message: "Failed to read tile blob",
						endpoint: url,
					}),
			})

			// Convert to base64
			const base64 = yield* Effect.tryPromise({
				try: async () => {
					const reader = new FileReader()
					return new Promise<string>((resolve, reject) => {
						reader.onloadend = () => resolve(reader.result as string)
						reader.onerror = reject
						reader.readAsDataURL(blob)
					})
				},
				catch: () =>
					new ApiError({
						status: 500,
						message: "Failed to convert tile to base64",
						endpoint: url,
					}),
			})

			return base64
		}),

	getMarkers: (planId: string, sheetId: string) =>
		request(
			`/api/plans/${planId}/sheets/${sheetId}/markers`,
			SheetMarkersResponse
		),
}

/**
 * Markers API
 */
export const MarkersApi = {
	getPendingReview: (planId: string) =>
		request(`/api/plans/${planId}/markers/pending-review`, PendingReviewResponse),

	/**
	 * Update marker position (from mobile adjustment)
	 */
	updatePosition: (markerId: string, x: number, y: number) =>
		request(`/api/markers/${markerId}/position`, SuccessResponse, {
			method: "PATCH",
			body: JSON.stringify({ x, y }),
		}),

	/**
	 * Review a single marker (confirm or reject)
	 */
	reviewMarker: (markerId: string, action: "confirm" | "reject", notes?: string) =>
		request(`/api/markers/${markerId}/review`, SuccessResponse, {
			method: "PATCH",
			body: JSON.stringify({ action, notes }),
		}),

	/**
	 * Bulk review multiple markers
	 */
	bulkReviewMarkers: (markerIds: string[], action: "confirm" | "reject", notes?: string) =>
		request(`/api/markers/bulk-review`, SuccessResponse, {
			method: "POST",
			body: JSON.stringify({ markerIds, action, notes }),
		}),

	/**
	 * Get media for a marker
	 */
	getMedia: (markerId: string) =>
		request(`/api/markers/${markerId}/media`, MarkerMediaResponse),
}

/**
 * Media Response Schemas
 */
const PendingReviewResponse = Schema.Struct({
	markers: Schema.Array(PendingReviewMarker),
	total: Schema.Number,
})

const MarkerMediaItem = Schema.Struct({
	id: Schema.String,
	filePath: Schema.String,
	mediaType: Schema.NullOr(Schema.String),
	status: Schema.NullOr(Schema.Literal("before", "progress", "complete", "issue")),
	description: Schema.NullOr(Schema.String),
	createdAt: Schema.Number,
})

const MarkerMediaResponse = Schema.Struct({
	media: Schema.Array(MarkerMediaItem),
})

const SuccessResponse = Schema.Struct({
	success: Schema.Literal(true),
})

const MediaItem = Schema.Struct({
	id: Schema.String,
	filePath: Schema.NullOr(Schema.String),
	mediaType: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
})

const MediaListResponse = Schema.Struct({
	media: Schema.Array(MediaItem),
})

const MediaResponse = Schema.Struct({
	id: Schema.String,
	projectId: Schema.String,
	filePath: Schema.NullOr(Schema.String),
	mediaType: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
})

const UploadMediaResponse = Schema.Struct({
	media: Schema.Array(
		Schema.Struct({
			mediaId: Schema.String,
			fileName: Schema.String,
			mediaType: Schema.String,
		})
	),
})

export type MediaItemType = Schema.Schema.Type<typeof MediaItem>

/**
 * Media API - Site photos and videos
 */
export const MediaApi = {
	/**
	 * Upload media (photo or video) to a project
	 */
	upload: (
		projectId: string,
		file: { uri: string; name: string; type: string },
		mediaType: "photo" | "video",
		options?: {
			planId?: string
			markerId?: string
			status?: "before" | "progress" | "complete" | "issue"
			description?: string
			coordinates?: { x: number; y: number }
		}
	): Effect.Effect<typeof UploadMediaResponse.Type, ApiErrorType> =>
		Effect.gen(function* () {
			const baseUrl = getApiUrl()
			const url = `${baseUrl}/api/projects/${projectId}/media`

			// Create FormData for multipart upload
			const formData = new FormData()
			formData.append("file", {
				uri: file.uri,
				name: file.name,
				type: file.type,
			} as unknown as Blob)
			formData.append("mediaType", mediaType)

			if (options?.planId) formData.append("planId", options.planId)
			if (options?.markerId) formData.append("markerId", options.markerId)
			if (options?.status) formData.append("status", options.status)
			if (options?.description) formData.append("description", options.description)
			if (options?.coordinates)
				formData.append("coordinates", JSON.stringify(options.coordinates))

			const response = yield* Effect.tryPromise({
				try: () =>
					fetch(url, {
						method: "POST",
						credentials: "include",
						body: formData,
						// Don't set Content-Type - let browser set it with boundary
					}),
				catch: (error) =>
					new NetworkError({
						message: error instanceof Error ? error.message : "Network error",
						endpoint: url,
					}),
			})

			if (response.status === 401) {
				return yield* new UnauthorizedError({
					message: "Authentication required",
				})
			}

			if (!response.ok) {
				const errorText = yield* Effect.tryPromise({
					try: () => response.text(),
					catch: () =>
						new ApiError({
							status: response.status,
							message: "Failed to read error response",
							endpoint: url,
						}),
				})
				return yield* new ApiError({
					status: response.status,
					message: typeof errorText === "string" ? errorText : "Upload failed",
					endpoint: url,
				})
			}

			const json = yield* Effect.tryPromise({
				try: () => response.json(),
				catch: () =>
					new ApiError({
						status: response.status,
						message: "Failed to parse response",
						endpoint: url,
					}),
			})

			const decoded = yield* Schema.decodeUnknown(UploadMediaResponse)(json).pipe(
				Effect.mapError(
					(error) =>
						new ApiError({
							status: response.status,
							message: `Schema validation failed: ${String(error)}`,
							endpoint: url,
						})
				)
			)

			return decoded
		}),

	/**
	 * List all media for a project
	 */
	list: (projectId: string) =>
		request(`/api/projects/${projectId}/media`, MediaListResponse),

	/**
	 * Get single media item
	 */
	get: (mediaId: string) =>
		request(`/api/media/${mediaId}`, MediaResponse),

	/**
	 * Delete media
	 */
	delete: (mediaId: string) =>
		request(`/api/media/${mediaId}`, SuccessResponse, {
			method: "DELETE",
		}),

	/**
	 * Get download URL for media
	 */
	getDownloadUrl: (mediaId: string) => {
		const baseUrl = getApiUrl()
		return `${baseUrl}/api/media/${mediaId}/download`
	},
}
