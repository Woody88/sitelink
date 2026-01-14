import { RotateCcw, X, Zap, ZapOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface CameraOverlayTopProps {
	onClose: () => void;
	onToggleFlash: () => void;
	onToggleCamera: () => void;
	flashMode: "off" | "on" | "auto";
}

export const CameraOverlayTop = React.memo(function CameraOverlayTop({
	onClose,
	onToggleFlash,
	onToggleCamera,
	flashMode,
}: CameraOverlayTopProps) {
	const insets = useSafeAreaInsets();

	return (
		<View
			className="absolute top-0 right-0 left-0 z-10 flex-row items-center justify-between px-4"
			style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
		>
			<Pressable
				onPress={onClose}
				className="size-10 items-center justify-center rounded-full bg-black/40 active:opacity-70"
				accessibilityRole="button"
				accessibilityLabel="Close camera"
			>
				<Icon as={X} className="size-5 text-white" />
			</Pressable>

			<View className="flex-row gap-3">
				<Pressable
					onPress={onToggleFlash}
					className="size-10 items-center justify-center rounded-full bg-black/40 active:opacity-70"
					accessibilityRole="button"
					accessibilityLabel={`Flash ${flashMode}`}
				>
					<Icon
						as={flashMode === "off" ? ZapOff : Zap}
						className={cn(
							"size-5",
							flashMode === "off" ? "text-white/60" : "text-white",
						)}
					/>
				</Pressable>

				<Pressable
					onPress={onToggleCamera}
					className="size-10 items-center justify-center rounded-full bg-black/40 active:opacity-70"
					accessibilityRole="button"
					accessibilityLabel="Flip camera"
				>
					<Icon as={RotateCcw} className="size-5 text-white" />
				</Pressable>
			</View>
		</View>
	);
});
