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
	SheetListResponse,
	SheetMarkersResponse,
	PendingReviewResponse,
	SuccessResponse,
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
}
