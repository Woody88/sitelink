// apps/mobile/hooks/use-callout-review.ts
import { queryDb } from "@livestore/livestore"
import { events, tables } from "@sitelink/domain"
import { useCallback, useMemo } from "react"
import { useSessionContext } from "@/lib/session-context"
import { useAppStore } from "@/livestore/store"

export interface ReviewMarker {
	id: string
	sheetId: string
	label: string
	targetSheetId: string | null
	x: number
	y: number
	width: number | null
	height: number | null
	confidence: number | null
	reviewStatus: string | null // 'pending' | 'accepted' | 'rejected' | 'corrected'
	originalLabel: string | null
}

export function useCalloutReview(projectId: string) {
	const { sessionToken, organizationId, sessionId, userId } = useSessionContext()
	const store = useAppStore(organizationId!, sessionToken, sessionId)

	// Query all sheets for this project to get sheetIds
	const sheets = store.useQuery(
		queryDb(tables.sheets.where({ projectId }).orderBy("sortOrder", "asc")),
	)

	// Query markers that need review across all sheets in this project
	// We query all markers with needsReview=true; LiveStore filters in SQLite
	const pendingMarkers = store.useQuery(
		queryDb(
			tables.markers
				.where({ needsReview: true })
				.orderBy("sheetId", "asc"),
		),
	)

	// Filter to only markers belonging to sheets in this project
	const projectSheetIds = useMemo(() => {
		const arr = Array.isArray(sheets) ? sheets : []
		return new Set(arr.map((s) => s.id))
	}, [sheets])

	const markers = useMemo((): ReviewMarker[] => {
		const arr = Array.isArray(pendingMarkers) ? pendingMarkers : []
		return arr.filter((m) => projectSheetIds.has(m.sheetId))
	}, [pendingMarkers, projectSheetIds])

	const pendingCount = markers.filter(
		(m) => m.reviewStatus === "pending" || m.reviewStatus == null,
	).length

	const acceptMarker = useCallback(
		async (markerId: string) => {
			if (!userId) return
			await store.commit(
				events.markerReviewed({
					markerId,
					action: "accepted",
					reviewedBy: userId,
					reviewedAt: Date.now(),
				}),
			)
		},
		[store, userId],
	)

	const rejectMarker = useCallback(
		async (markerId: string) => {
			if (!userId) return
			await store.commit(
				events.markerReviewed({
					markerId,
					action: "rejected",
					reviewedBy: userId,
					reviewedAt: Date.now(),
				}),
			)
		},
		[store, userId],
	)

	const correctMarker = useCallback(
		async (
			markerId: string,
			originalLabel: string,
			correctedLabel: string,
			correctedTargetSheetId?: string,
		) => {
			if (!userId) return
			await store.commit(
				events.markerCorrected({
					markerId,
					originalLabel,
					correctedLabel,
					correctedTargetSheetId,
					correctedBy: userId,
					correctedAt: Date.now(),
				}),
			)
		},
		[store, userId],
	)

	return {
		markers,
		pendingCount,
		acceptMarker,
		rejectMarker,
		correctMarker,
	}
}
