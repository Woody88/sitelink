import { Image } from "expo-image";
import { ArrowLeft, Eye, ImageOff } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { LayoutRegion } from "@/hooks/use-plan-info";

interface LegendDetailScreenProps {
	region: LayoutRegion;
	sheetNumber: string;
	isExtracting?: boolean;
	onBack: () => void;
	onViewOnSheet: (
		sheetId: string,
		bbox: { x: number; y: number; width: number; height: number },
	) => void;
}

function getConfidenceBadge(confidence: number) {
	if (confidence >= 0.9) {
		return { label: "High confidence", color: "#16a34a", bg: "rgba(22, 163, 74, 0.15)" };
	}
	if (confidence >= 0.8) {
		return { label: "Medium confidence", color: "#ca8a04", bg: "rgba(202, 138, 4, 0.15)" };
	}
	return { label: "Review recommended", color: "#ea580c", bg: "rgba(234, 88, 12, 0.15)" };
}

export function LegendDetailScreen({
	region,
	sheetNumber,
	isExtracting = false,
	onBack,
	onViewOnSheet,
}: LegendDetailScreenProps) {
	const insets = useSafeAreaInsets();
	const [imageLoaded, setImageLoaded] = React.useState(false);
	const [imageError, setImageError] = React.useState(false);
	const screenWidth = Dimensions.get("window").width;

	const badge = getConfidenceBadge(region.confidence);
	const title = region.regionTitle ?? "Legend";

	const handleViewOnSheet = () => {
		onViewOnSheet(region.sheetId, {
			x: region.x,
			y: region.y,
			width: region.width,
			height: region.height,
		});
	};

	const hasImage = region.cropImageUrl != null && !imageError;

	return (
		<View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
			{/* Header */}
			<View className="flex-row items-center justify-between px-4 py-3">
				<View className="flex-row items-center gap-3 flex-1">
					<Pressable
						onPress={onBack}
						className="active:bg-muted/50 -m-2 rounded-full p-2"
						hitSlop={8}
						accessibilityLabel="Go back"
						accessibilityRole="button"
					>
						<Icon as={ArrowLeft} className="text-foreground size-5" />
					</Pressable>
					<Text className="text-foreground text-lg font-bold" numberOfLines={1}>
						{title}
					</Text>
				</View>
				<Button
					variant="ghost"
					size="sm"
					onPress={handleViewOnSheet}
					accessibilityLabel={`View ${title} on sheet`}
				>
					<Icon as={Eye} className="text-primary size-4" />
					<Text className="text-primary text-sm font-medium">View on Sheet</Text>
				</Button>
			</View>

			{/* Subtitle: sheet number + confidence */}
			<View className="flex-row items-center gap-2 px-4 pb-3">
				<Text className="text-muted-foreground text-sm">
					Sheet {sheetNumber}
				</Text>
				<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
					<Text style={{ color: badge.color }} className="text-xs font-medium">
						{Math.round(region.confidence * 100)}% {badge.label}
					</Text>
				</View>
			</View>

			{/* Image viewer */}
			{hasImage ? (
				<ScrollView
					className="flex-1"
					maximumZoomScale={4}
					minimumZoomScale={1}
					showsHorizontalScrollIndicator={false}
					showsVerticalScrollIndicator={false}
					bouncesZoom
					contentContainerStyle={{ flexGrow: 1 }}
				>
					{!imageLoaded && (
						<View className="absolute inset-0 items-center justify-center p-4">
							<Skeleton className="h-64 w-full rounded-xl" />
						</View>
					)}
					<Image
						source={{ uri: region.cropImageUrl! }}
						style={{ width: screenWidth, flex: 1 }}
						contentFit="contain"
						cachePolicy="disk"
						onLoad={() => setImageLoaded(true)}
						onError={() => setImageError(true)}
						transition={200}
						accessibilityLabel={`Legend image: ${title}`}
					/>
				</ScrollView>
			) : (
				<View className="flex-1 items-center justify-center px-8 gap-3">
					{isExtracting ? (
						<>
							<ActivityIndicator />
							<Text className="text-muted-foreground text-center text-sm">
								Extracting legend image…
							</Text>
						</>
					) : (
						<>
							<Icon as={ImageOff} className="text-muted-foreground mb-3 size-12" />
							<Text className="text-muted-foreground text-center text-sm">
								Legend image not available
							</Text>
						</>
					)}
				</View>
			)}

			{/* Pinch hint */}
			{hasImage && imageLoaded && (
				<View className="items-center py-2">
					<Text className="text-muted-foreground text-xs">
						Pinch to zoom
					</Text>
				</View>
			)}

			{/* Bottom action */}
			<View
				className="border-border/50 border-t px-4 py-3"
				style={{ paddingBottom: insets.bottom + 12 }}
			>
				<Button
					onPress={handleViewOnSheet}
					className="h-12"
					accessibilityLabel={`View ${title} on sheet`}
				>
					<Icon as={Eye} className="text-primary-foreground size-5" />
					<Text className="text-primary-foreground text-base font-semibold">
						View on Sheet
					</Text>
				</Button>
			</View>
		</View>
	);
}
