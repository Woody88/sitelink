// apps/mobile/components/plans/callout-edit-sheet.tsx
import { X } from "lucide-react-native"
import * as React from "react"
import { BackHandler, Pressable, View } from "react-native"
import Animated, {
	FadeIn,
	FadeOut,
	SlideInDown,
	SlideOutDown,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Text } from "@/components/ui/text"
import type { ReviewMarker } from "@/hooks/use-callout-review"

interface CalloutEditSheetProps {
	marker: ReviewMarker | null
	visible: boolean
	onClose: () => void
	onSave: (
		markerId: string,
		originalLabel: string,
		correctedLabel: string,
		correctedTargetSheetId?: string,
	) => Promise<void>
}

export function CalloutEditSheet({
	marker,
	visible,
	onClose,
	onSave,
}: CalloutEditSheetProps) {
	const insets = useSafeAreaInsets()
	const [label, setLabel] = React.useState("")
	const [targetSheetId, setTargetSheetId] = React.useState("")
	const [isSaving, setIsSaving] = React.useState(false)

	// Sync state when marker changes
	React.useEffect(() => {
		if (marker) {
			setLabel(marker.label)
			setTargetSheetId(marker.targetSheetId ?? "")
		}
	}, [marker])

	React.useEffect(() => {
		if (!visible) return
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			onClose()
			return true
		})
		return () => sub.remove()
	}, [visible, onClose])

	if (!visible || !marker) return null

	async function handleSave() {
		if (!marker || !label.trim() || isSaving) return
		setIsSaving(true)
		try {
			await onSave(
				marker.id,
				marker.label,
				label.trim(),
				targetSheetId.trim() || undefined,
			)
			onClose()
		} finally {
			setIsSaving(false)
		}
	}

	const hasChanges =
		label.trim() !== marker.label ||
		(targetSheetId.trim() || undefined) !== (marker.targetSheetId ?? undefined)

	return (
		<Animated.View
			entering={FadeIn.duration(200)}
			exiting={FadeOut.duration(150)}
			className="absolute inset-0"
			pointerEvents="box-none"
		>
			<Pressable className="flex-1 bg-black/30" onPress={onClose}>
				<View className="flex-1" />

				<Animated.View
					entering={SlideInDown.springify().damping(20).stiffness(200)}
					exiting={SlideOutDown.springify().damping(20).stiffness(200)}
					className="bg-card rounded-t-3xl"
					style={{ paddingBottom: insets.bottom + 16 }}
				>
					<Pressable>
						{/* Handle */}
						<View className="items-center py-3">
							<View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
						</View>

						{/* Header */}
						<View className="flex-row items-center justify-between px-6 pb-5">
							<Text variant="h3">Edit Callout</Text>
							<Pressable
								onPress={onClose}
								className="active:bg-muted/50 -m-2 rounded-full p-2"
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>

						{/* Form */}
						<View className="gap-4 px-6">
							<View className="gap-2">
								<Label nativeID="label-input">
									<Text>Callout Label</Text>
								</Label>
								<Input
									nativeID="label-input"
									placeholder="e.g. A-101, S/1, 3/A4.1"
									value={label}
									onChangeText={setLabel}
									autoCapitalize="characters"
									editable={!isSaving}
								/>
							</View>

							<View className="gap-2">
								<Label nativeID="target-input">
									<Text>
										Target Sheet{" "}
										<Text className="text-muted-foreground text-sm">(optional)</Text>
									</Text>
								</Label>
								<Input
									nativeID="target-input"
									placeholder="e.g. A4.1"
									value={targetSheetId}
									onChangeText={setTargetSheetId}
									autoCapitalize="characters"
									editable={!isSaving}
								/>
								<Text className="text-muted-foreground text-xs">
									The sheet this callout references
								</Text>
							</View>

							<Button
								onPress={handleSave}
								disabled={!hasChanges || !label.trim() || isSaving}
								className="mt-2"
							>
								<Text>Save Correction</Text>
							</Button>
						</View>
					</Pressable>
				</Animated.View>
			</Pressable>
		</Animated.View>
	)
}
