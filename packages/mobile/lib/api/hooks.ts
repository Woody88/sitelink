/**
 * React hooks for API calls using Effect
 *
 * These hooks provide a React-friendly way to use the Effect-based API client
 */
import { useState, useCallback, useEffect } from "react"
import { Effect, Exit, Cause } from "effect"
import { ProjectsApi, PlansApi, SheetsApi, MarkersApi, MediaApi, ApiErrorType } from "./client"

interface UseApiState<T> {
	data: T | null
	error: ApiErrorType | null
	isLoading: boolean
}

/**
 * Generic hook for running Effect-based API calls
 */
function useEffectApi<T>(
	effectFn: () => Effect.Effect<T, ApiErrorType>,
	deps: unknown[] = []
): UseApiState<T> & { refetch: () => void } {
	const [state, setState] = useState<UseApiState<T>>({
		data: null,
		error: null,
		isLoading: true,
	})

	const execute = useCallback(async () => {
		setState((prev) => ({ ...prev, isLoading: true, error: null }))

		const exit = await Effect.runPromiseExit(effectFn())

		if (Exit.isSuccess(exit)) {
			setState({ data: exit.value, error: null, isLoading: false })
		} else {
			// Extract the failure from the cause
			const failure = Cause.failureOption(exit.cause)
			if (failure._tag === "Some") {
				setState({ data: null, error: failure.value, isLoading: false })
			} else {
				// Unexpected error - wrap in NetworkError
				setState({
					data: null,
					error: {
						_tag: "NetworkError",
						message: "Unexpected error occurred",
						endpoint: "",
					} as ApiErrorType,
					isLoading: false,
				})
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps)

	useEffect(() => {
		execute()
	}, [execute])

	return { ...state, refetch: execute }
}

/**
 * Hook for fetching projects list
 */
export function useProjects(organizationId: string | null) {
	return useEffectApi(
		() =>
			organizationId
				? ProjectsApi.list(organizationId)
				: Effect.succeed({ projects: [] as const }),
		[organizationId]
	)
}

/**
 * Hook for fetching a single project
 */
export function useProject(projectId: string | null) {
	return useEffectApi(
		() =>
			projectId
				? ProjectsApi.get(projectId)
				: Effect.succeed(null),
		[projectId]
	)
}

/**
 * Hook for fetching plans list
 */
export function usePlans(projectId: string | null) {
	return useEffectApi(
		() =>
			projectId
				? PlansApi.list(projectId)
				: Effect.succeed({ plans: [] as const }),
		[projectId]
	)
}

/**
 * Hook for fetching a single plan
 */
export function usePlan(planId: string | null) {
	return useEffectApi(
		() =>
			planId
				? PlansApi.get(planId)
				: Effect.succeed(null),
		[planId]
	)
}

/**
 * Hook for fetching sheets list
 */
export function useSheets(planId: string | null) {
	return useEffectApi(
		() =>
			planId
				? SheetsApi.list(planId)
				: Effect.succeed({ sheets: [] as const }),
		[planId]
	)
}

/**
 * Hook for fetching sheet markers
 */
export function useSheetMarkers(planId: string | null, sheetId: string | null) {
	return useEffectApi(
		() =>
			planId && sheetId
				? SheetsApi.getMarkers(planId, sheetId)
				: Effect.succeed({
						hyperlinks: [] as const,
						calloutsFound: 0,
						calloutsMatched: 0,
						confidenceStats: { averageConfidence: 0 },
						processingTimeMs: 0,
					}),
		[planId, sheetId]
	)
}

/**
 * Hook for fetching pending review markers
 */
export function usePendingReviewMarkers(planId: string | null) {
	return useEffectApi(
		() =>
			planId
				? MarkersApi.getPendingReview(planId)
				: Effect.succeed({ markers: [] as const, total: 0, confidenceThreshold: 0.7 }),
		[planId]
	)
}

/**
 * Hook for fetching media for a specific marker
 */
export function useMarkerMedia(markerId: string | null) {
	return useEffectApi(
		() =>
			markerId
				? MarkersApi.getMedia(markerId)
				: Effect.succeed({ media: [] as const }),
		[markerId]
	)
}

/**
 * Hook for mutations (create, update, delete)
 */
export function useMutation<TInput, TOutput>(
	mutationFn: (input: TInput) => Effect.Effect<TOutput, ApiErrorType>
) {
	const [state, setState] = useState<{
		data: TOutput | null
		error: ApiErrorType | null
		isLoading: boolean
	}>({
		data: null,
		error: null,
		isLoading: false,
	})

	const mutate = useCallback(
		async (input: TInput): Promise<TOutput | null> => {
			setState({ data: null, error: null, isLoading: true })

			const exit = await Effect.runPromiseExit(mutationFn(input))

			if (Exit.isSuccess(exit)) {
				setState({ data: exit.value, error: null, isLoading: false })
				return exit.value
			} else {
				const failure = Cause.failureOption(exit.cause)
				if (failure._tag === "Some") {
					setState({ data: null, error: failure.value, isLoading: false })
				} else {
					setState({
						data: null,
						error: {
							_tag: "NetworkError",
							message: "Unexpected error occurred",
							endpoint: "",
						} as ApiErrorType,
						isLoading: false,
					})
				}
				return null
			}
		},
		[mutationFn]
	)

	return { ...state, mutate }
}

/**
 * Mutation hooks for common operations
 */
export function useCreateProject() {
	return useMutation(ProjectsApi.create)
}

export function useUpdateProject(projectId: string) {
	return useMutation((data: { name?: string; description?: string }) =>
		ProjectsApi.update(projectId, data)
	)
}

export function useDeleteProject() {
	return useMutation(ProjectsApi.delete)
}

/**
 * Hook for reviewing a single marker
 */
export function useReviewMarker() {
	return useMutation(
		({ markerId, action, notes }: { markerId: string; action: "confirm" | "reject"; notes?: string }) =>
			MarkersApi.reviewMarker(markerId, action, notes)
	)
}

/**
 * Hook for bulk reviewing markers
 */
export function useBulkReviewMarkers() {
	return useMutation(
		({ markerIds, action, notes }: { markerIds: string[]; action: "confirm" | "reject"; notes?: string }) =>
			MarkersApi.bulkReviewMarkers(markerIds, action, notes)
	)
}

/**
 * Hook for fetching media list
 */
export function useMedia(projectId: string | null) {
	return useEffectApi(
		() =>
			projectId
				? MediaApi.list(projectId)
				: Effect.succeed({ media: [] as const }),
		[projectId]
	)
}

/**
 * Hook for uploading media
 */
export function useUploadMedia() {
	return useMutation(
		({
			projectId,
			file,
			mediaType,
			planId,
			markerId,
			status,
			description,
			coordinates,
		}: {
			projectId: string
			file: { uri: string; name: string; type: string }
			mediaType: "photo" | "video"
			planId?: string
			markerId?: string
			status?: "before" | "progress" | "complete" | "issue"
			description?: string
			coordinates?: { x: number; y: number }
		}) =>
			MediaApi.upload(projectId, file, mediaType, {
				planId,
				markerId,
				status,
				description,
				coordinates,
			})
	)
}

/**
 * Hook for deleting media
 */
export function useDeleteMedia() {
	return useMutation(MediaApi.delete)
}
