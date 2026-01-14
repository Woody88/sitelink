import { format } from "date-fns";
import { Check, Copy, Edit, Mic, X } from "lucide-react-native";
import * as React from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

interface PhotoPreviewLayerProps {
	photoUri: string;
	markerLabel: string | null;
	capturedAt: number;
	ocrText: string | null;
	isOcrLoading: boolean;
	onRetake: () => void;
	onDone: () => void;
	onAddVoice: () => void;
	onCopyOcr: () => void;
	onEditOcr: () => void;
}

export const PhotoPreviewLayer = React.memo(function PhotoPreviewLayer({
	photoUri,
	markerLabel,
	capturedAt,
	ocrText,
	isOcrLoading,
	onRetake,
	onDone,
	onAddVoice,
	onCopyOcr,
	onEditOcr,
}: PhotoPreviewLayerProps) {
	const insets = useSafeAreaInsets();

	return (
		<Modal visible={true} transparent animationType="fade">
			<View className="flex-1 bg-black">
				<Image
					source={{ uri: photoUri }}
					className="flex-1"
					resizeMode="contain"
				/>

				{/* Top Bar */}
				<View
					className="absolute top-0 right-0 left-0 z-10 flex-row items-center justify-between px-4"
					style={{ paddingTop: insets.top + 8 }}
				>
					<Pressable
						onPress={onRetake}
						className="flex-row items-center gap-2 rounded-full bg-black/40 pr-4 active:opacity-70"
					>
						<View className="size-10 items-center justify-center">
							<Icon as={X} className="size-5 text-white" />
						</View>
						<Text className="text-base font-semibold text-white">Retake</Text>
					</Pressable>
				</View>

				{/* Bottom Info Panel */}
				<View
					className="absolute right-0 bottom-0 left-0 bg-black/80 backdrop-blur-md"
					style={{ paddingBottom: insets.bottom }}
				>
					<ScrollView
						className="max-h-96 px-4 pt-4"
						showsVerticalScrollIndicator={false}
					>
						{/* Save Confirmation */}
						<View className="mb-4 flex-row items-center gap-2">
							<Icon as={Check} className="size-4 text-green-500" />
							<Text className="text-sm font-medium text-white">
								Saved to {markerLabel || "General"}
							</Text>
						</View>

						{/* Timestamp */}
						<Text className="mb-4 text-xs text-white/60">
							📍 {format(new Date(capturedAt), "MMM d, yyyy h:mm a")}
						</Text>

						{/* OCR Text Detection */}
						{isOcrLoading && (
							<View className="mb-4">
								<Text className="mb-2 text-sm font-semibold text-white">
									📝 Text detected:
								</Text>
								<Text className="text-xs text-white/60">Processing...</Text>
							</View>
						)}

						{ocrText && !isOcrLoading && (
							<View className="mb-4">
								<Text className="mb-2 text-sm font-semibold text-white">
									📝 Text detected:
								</Text>
								<View className="mb-2 rounded-lg bg-white/10 p-3">
									<Text className="text-sm leading-relaxed text-white">
										{ocrText}
									</Text>
								</View>
								<View className="flex-row gap-2">
									<Pressable
										onPress={onCopyOcr}
										className="flex-row items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 active:opacity-70"
									>
										<Icon as={Copy} className="size-3.5 text-white" />
										<Text className="text-xs font-medium text-white">Copy</Text>
									</Pressable>
									<Pressable
										onPress={onEditOcr}
										className="flex-row items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 active:opacity-70"
									>
										<Icon as={Edit} className="size-3.5 text-white" />
										<Text className="text-xs font-medium text-white">Edit</Text>
									</Pressable>
								</View>
							</View>
						)}

						{/* Action Buttons */}
						<View className="mb-4 flex-row gap-3">
							<Button
								onPress={onAddVoice}
								variant="outline"
								className="flex-1 border-white/30"
							>
								<Icon as={Mic} className="mr-2 size-4 text-white" />
								<Text className="font-medium text-white">Add Voice</Text>
							</Button>
							<Button onPress={onDone} className="flex-1 bg-white">
								<Text className="font-semibold text-black">✓ Done</Text>
							</Button>
						</View>

						{/* Swipe Hint */}
						<Text className="mb-2 pb-2 text-center text-xs text-white/40">
							Swipe down to take another
						</Text>
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
});
