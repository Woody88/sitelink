// apps/mobile/components/plans/callout-review-card.tsx
import * as Haptics from "expo-haptics"
import { Check, Edit3, MapPin, X } from "lucide-react-native"
import * as React from "react"
import { Pressable, View } from "react-native"
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import type { ReviewMarker } from "@/hooks/use-callout-review"

interface CalloutReviewCardProps {
	marker: ReviewMarker
	sheetNumber: string
	onAccept: (markerId: string) => Promise<void>
	onReject: (markerId: string) => Promise<void>
	onCorrect: (marker: ReviewMarker) => void
}

export function CalloutReviewCard({
	marker,
	sheetNumber,
	onAccept,
	onReject,
	onCorrect,
}: CalloutReviewCardProps) {
	const [isActing, setIsActing] = React.useState(false)

	const confidence = marker.confidence != null ? Math.round(marker.confidence * 100) : null
	const confidenceColor =
		confidence == null
			? "text-muted-foreground"
			: confidence >= 80
				? "text-green-500"
				: confidence >= 60
					? "text-amber-500"
					: "text-red-500"

	async function handleAccept() {
		if (isActing) return
		setIsActing(true)
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
		await onAccept(marker.id)
		setIsActing(false)
	}

	async function handleReject() {
		if (isActing) return
		setIsActing(true)
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
		await onReject(marker.id)
		setIsActing(false)
	}

	function handleCorrect() {
		Haptics.selectionAsync()
		onCorrect(marker)
	}

	return (
		<Animated.View
			entering={FadeIn.duration(200)}
			exiting={FadeOut.duration(150)}
			layout={Layout.springify()}
			className="bg-card border-border/50 mb-3 overflow-hidden rounded-2xl border"
		>
			{/* Header */}
			<View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
				{/* Marker badge */}
				<View className="bg-amber-500/15 h-11 w-11 items-center justify-center rounded-xl">
					<Text className="text-amber-600 text-sm font-bold" numberOfLines={1}>
						{marker.label.length > 4 ? marker.label.slice(0, 4) : marker.label}
					</Text>
				</View>

				<View className="flex-1">
					<Text className="text-foreground text-base font-semibold">
						{marker.label}
					</Text>
					<View className="mt-0.5 flex-row items-center gap-2">
						<View className="flex-row items-center gap-1">
							<Icon as={MapPin} className="text-muted-foreground size-3" />
							<Text className="text-muted-foreground text-xs">{sheetNumber}</Text>
						</View>
						{confidence != null && (
							<>
								<Text className="text-muted-foreground text-xs">·</Text>
								<Text className={`text-xs font-medium ${confidenceColor}`}>
									{confidence}% confidence
								</Text>
							</>
						)}
					</View>
				</View>
			</View>

			{/* Target sheet if present */}
			{marker.targetSheetId && (
				<View className="bg-muted/40 mx-4 mb-3 flex-row items-center gap-2 rounded-lg px-3 py-2">
					<Text className="text-muted-foreground text-xs">References sheet</Text>
					<Text className="text-foreground text-xs font-medium">
						{marker.targetSheetId}
					</Text>
				</View>
			)}

			{/* Actions */}
			<View className="flex-row gap-2 px-4 pb-4">
				<Button
					variant="outline"
					onPress={handleReject}
					disabled={isActing}
					className="border-destructive/50 flex-1 flex-row items-center justify-center gap-2"
				>
					<Icon as={X} className="text-destructive size-4" />
					<Text className="text-destructive font-medium">Reject</Text>
				</Button>

				<Pressable
					onPress={handleCorrect}
					disabled={isActing}
					className="active:bg-muted/60 border-border flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-2.5"
				>
					<Icon as={Edit3} className="text-foreground size-4" />
					<Text className="text-foreground font-medium">Edit</Text>
				</Pressable>

				<Button
					onPress={handleAccept}
					disabled={isActing}
					className="bg-green-600 active:bg-green-700 flex-1 flex-row items-center justify-center gap-2"
				>
					<Icon as={Check} className="text-white size-4" />
					<Text className="text-white font-medium">Accept</Text>
				</Button>
			</View>
		</Animated.View>
	)
}
