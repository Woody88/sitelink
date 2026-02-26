import { format } from "date-fns";
import { Mic } from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface PhotoThumbnailProps {
	uri: string;
	capturedAt: number;
	isIssue?: boolean;
	hasVoiceNote?: boolean;
	onPress?: () => void;
	className?: string;
}

export const PhotoThumbnail = React.memo(function PhotoThumbnail({
	uri,
	capturedAt,
	isIssue,
	hasVoiceNote,
	onPress,
	className,
}: PhotoThumbnailProps) {
	// Use picsum as placeholder if needed, but adding random param to prevent caching same image
	const displayUri = uri.startsWith("http")
		? uri
		: `https://picsum.photos/seed/${capturedAt}/300/300`;

	return (
		<Pressable
			onPress={onPress}
			className={cn("bg-muted relative overflow-hidden rounded-xl", className)}
			style={{ width: 160, height: 160 }}
		>
			<Image
				source={{ uri: displayUri }}
				className="h-full w-full"
				resizeMode="cover"
			/>

			{/* Issue Badge (Top Right) */}
			{isIssue && (
				<View
					className="bg-destructive absolute top-2 right-2 items-center justify-center rounded-full shadow-md"
					style={{ width: 20, height: 20 }}
				>
					<Text className="text-destructive-foreground text-[12px] font-bold">
						!
					</Text>
				</View>
			)}

			{/* Voice Note Badge (Bottom Right) */}
			{hasVoiceNote && (
				<View
					className="absolute right-2 bottom-2 items-center justify-center rounded-full bg-blue-500 shadow-md"
					style={{ width: 20, height: 20 }}
				>
					<Icon as={Mic} className="size-3 text-white" />
				</View>
			)}

			{/* Timestamp (Bottom Left) */}
			<View className="absolute bottom-2 left-2">
				<View className="rounded bg-black/40 px-1.5 py-0.5">
					<Text className="text-[11px] font-medium text-white">
						{format(new Date(capturedAt), "h:mm a")}
					</Text>
				</View>
			</View>
		</Pressable>
	);
});
