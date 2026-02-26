import { MapPin } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

interface LinkToPlanContextProps {
	markerLabel: string | null;
	onLinkPress: () => void;
}

export const CameraLinkContext = React.memo(function CameraLinkContext({
	markerLabel,
	onLinkPress,
}: LinkToPlanContextProps) {
	const insets = useSafeAreaInsets();
	const topPosition = insets.top + 120;

	if (markerLabel) {
		return (
			<View
				className="absolute right-4 left-4 z-10"
				style={{ top: topPosition }}
			>
				<View className="flex-row items-center justify-between rounded-full bg-black/60 px-4 py-3 backdrop-blur-sm">
					<View className="flex-1 flex-row items-center gap-2">
						<Icon as={MapPin} className="size-4 text-white" />
						<Text
							className="flex-1 text-sm font-medium text-white"
							numberOfLines={1}
						>
							Linked to: {markerLabel}
						</Text>
					</View>
					<Pressable onPress={onLinkPress} className="ml-2">
						<Text className="text-sm font-semibold text-white">Change</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	return (
		<View className="absolute right-4 left-4 z-10" style={{ top: topPosition }}>
			<Pressable
				onPress={onLinkPress}
				className="flex-row items-center justify-between rounded-full bg-black/60 px-4 py-3 backdrop-blur-sm active:opacity-80"
			>
				<View className="flex-1 flex-row items-center gap-2">
					<Icon as={MapPin} className="size-4 text-white/60" />
					<Text className="text-sm font-medium text-white/80">
						Not linked to a callout
					</Text>
				</View>
				<Text className="text-sm font-semibold text-white">Link to Plan</Text>
			</Pressable>
		</View>
	);
});
