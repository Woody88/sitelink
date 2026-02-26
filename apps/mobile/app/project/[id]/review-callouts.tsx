// apps/mobile/app/project/[id]/review-callouts.tsx
import { queryDb } from "@livestore/livestore"
import { tables } from "@sitelink/domain"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { ArrowLeft, CheckCircle } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CalloutEditSheet } from "@/components/plans/callout-edit-sheet"
import { CalloutReviewCard } from "@/components/plans/callout-review-card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import {
	type ReviewMarker,
	useCalloutReview,
} from "@/hooks/use-callout-review"
import { useSessionContext } from "@/lib/session-context"
import { useAppStore } from "@/livestore/store"

export default function ReviewCalloutsScreen() {
	const router = useRouter()
	const { id: projectId } = useLocalSearchParams<{ id: string }>()
	const insets = useSafeAreaInsets()
	const { sessionToken, organizationId, sessionId } = useSessionContext()
	const store = useAppStore(organizationId!, sessionToken, sessionId)

	const { markers, pendingCount, acceptMarker, rejectMarker, correctMarker } =
		useCalloutReview(projectId!)

	// Map sheetId → sheet number for display
	const sheets = store.useQuery(
		queryDb(tables.sheets.where({ projectId: projectId! })),
	)
	const sheetNumberMap = React.useMemo(() => {
		const arr = Array.isArray(sheets) ? sheets : []
		return new Map(arr.map((s) => [s.id, s.number || s.title || "?"]))
	}, [sheets])

	// Edit sheet state
	const [editMarker, setEditMarker] = React.useState<ReviewMarker | null>(null)
	const [isEditSheetVisible, setIsEditSheetVisible] = React.useState(false)

	function handleCorrect(marker: ReviewMarker) {
		setEditMarker(marker)
		setIsEditSheetVisible(true)
	}

	async function handleSaveCorrection(
		markerId: string,
		originalLabel: string,
		correctedLabel: string,
		correctedTargetSheetId?: string,
	) {
		await correctMarker(
			markerId,
			originalLabel,
			correctedLabel,
			correctedTargetSheetId,
		)
	}

	const totalMarkers = markers.length
	const reviewedCount = totalMarkers - pendingCount
	const allDone = totalMarkers > 0 && pendingCount === 0

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View
				className="bg-background flex-1"
				style={{ paddingTop: insets.top }}
			>
				{/* Header */}
				<View className="flex-row items-center gap-3 px-4 py-3">
					<Pressable
						onPress={() => router.back()}
						className="active:bg-muted/50 -ml-1 rounded-xl p-2"
					>
						<Icon as={ArrowLeft} className="text-foreground size-6" />
					</Pressable>
					<View className="flex-1">
						<Text variant="h3">Review Callouts</Text>
						{totalMarkers > 0 && (
							<Text className="text-muted-foreground text-sm">
								{pendingCount > 0
									? `${pendingCount} of ${totalMarkers} remaining`
									: `${totalMarkers} reviewed`}
							</Text>
						)}
					</View>
				</View>

				{/* Progress bar */}
				{totalMarkers > 0 && (
					<View className="bg-muted mx-4 mb-2 h-1.5 overflow-hidden rounded-full">
						<View
							className="bg-primary h-full rounded-full"
							style={{
								width: `${(reviewedCount / totalMarkers) * 100}%`,
							}}
						/>
					</View>
				)}

				{/* Content */}
				{totalMarkers === 0 ? (
					<View className="flex-1 items-center justify-center gap-4 px-6">
						<View className="bg-green-500/10 rounded-full p-6">
							<Icon as={CheckCircle} className="text-green-500 size-12" />
						</View>
						<Text variant="h3" className="text-center">
							No callouts to review
						</Text>
						<Text className="text-muted-foreground text-center">
							AI-detected callouts with low confidence will appear here for
							review.
						</Text>
					</View>
				) : allDone ? (
					<View className="flex-1 items-center justify-center gap-4 px-6">
						<View className="bg-green-500/10 rounded-full p-6">
							<Icon as={CheckCircle} className="text-green-500 size-12" />
						</View>
						<Text variant="h3" className="text-center">
							All done!
						</Text>
						<Text className="text-muted-foreground text-center">
							You've reviewed all {totalMarkers} callout
							{totalMarkers !== 1 ? "s" : ""}. Great work.
						</Text>
					</View>
				) : (
					<ScrollView
						contentContainerStyle={{
							padding: 16,
							paddingBottom: insets.bottom + 16,
						}}
						showsVerticalScrollIndicator={false}
					>
						<Text className="text-muted-foreground mb-4 text-sm">
							These callouts were detected with low confidence. Accept, reject,
							or edit each one.
						</Text>
						{markers
							.filter(
								(m) => m.reviewStatus === "pending" || m.reviewStatus == null,
							)
							.map((marker) => (
								<CalloutReviewCard
									key={marker.id}
									marker={marker}
									sheetNumber={sheetNumberMap.get(marker.sheetId) ?? "—"}
									onAccept={acceptMarker}
									onReject={rejectMarker}
									onCorrect={handleCorrect}
								/>
							))}
					</ScrollView>
				)}
			</View>

			{/* Edit sheet */}
			<CalloutEditSheet
				marker={editMarker}
				visible={isEditSheetVisible}
				onClose={() => setIsEditSheetVisible(false)}
				onSave={handleSaveCorrection}
			/>
		</>
	)
}
