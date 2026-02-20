import {
	ArrowRight,
	Camera,
	ExternalLink,
	Layers,
	MapPin,
	X,
} from "lucide-react-native";
import * as React from "react";
import { BackHandler, Pressable, View } from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	SlideInDown,
	SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { CalloutMarker } from "@/hooks/use-plan-viewer";
import { cn } from "@/lib/utils";

// Discipline labels and colors
const DISCIPLINE_CONFIG: Record<
	string,
	{ label: string; color: string; bgColor: string }
> = {
	arch: {
		label: "Architectural",
		color: "#2563eb",
		bgColor: "rgba(37, 99, 235, 0.15)",
	},
	struct: {
		label: "Structural",
		color: "#a855f7",
		bgColor: "rgba(168, 85, 247, 0.15)",
	},
	elec: {
		label: "Electrical",
		color: "#eab308",
		bgColor: "rgba(234, 179, 8, 0.15)",
	},
	mech: {
		label: "Mechanical",
		color: "#22c55e",
		bgColor: "rgba(34, 197, 94, 0.15)",
	},
	plumb: {
		label: "Plumbing",
		color: "#3b82f6",
		bgColor: "rgba(59, 130, 246, 0.15)",
	},
};

const TYPE_LABELS: Record<string, string> = {
	detail: "Detail Callout",
	section: "Section Callout",
	elevation: "Elevation",
	note: "Note",
};

interface MarkerDetailSheetProps {
	marker: CalloutMarker | null;
	visible: boolean;
	onClose: () => void;
	onNavigateToSheet?: (sheetRef: string) => void;
	onTakePhoto?: (marker: CalloutMarker) => void;
}

/**
 * Bottom sheet showing marker details
 * Appears when a user taps a callout marker on the plan
 * Wealthsimple-inspired: clean, professional with clear CTAs
 */
export function MarkerDetailSheet({
	marker,
	visible,
	onClose,
	onNavigateToSheet,
	onTakePhoto,
}: MarkerDetailSheetProps) {
	const insets = useSafeAreaInsets();

	React.useEffect(() => {
		if (!visible) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			onClose();
			return true;
		});
		return () => sub.remove();
	}, [visible, onClose]);

	if (!visible || !marker) return null;

	const discipline = DISCIPLINE_CONFIG[marker.discipline || ""] || {
		label: "General",
		color: "#6b7280",
		bgColor: "rgba(107, 114, 128, 0.15)",
	};

	const typeLabel = TYPE_LABELS[marker.type] || "Marker";

	return (
		<Animated.View
			entering={FadeIn.duration(200)}
			exiting={FadeOut.duration(150)}
			className="absolute inset-0"
			pointerEvents="box-none"
		>
			<Pressable className="flex-1 bg-black/20" onPress={onClose}>
				<View className="flex-1" />

				{/* Sheet content */}
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
						<View className="flex-row items-start justify-between px-6 pb-4">
							<View className="flex-1">
								<View className="mb-1 flex-row items-center gap-2">
									<View
										className="rounded-md px-2 py-0.5"
										style={{ backgroundColor: discipline.bgColor }}
									>
										<Text
											style={{ color: discipline.color }}
											className="text-xs font-semibold"
										>
											{discipline.label}
										</Text>
									</View>
									<Text className="text-muted-foreground text-xs">
										{typeLabel}
									</Text>
								</View>
								<Text className="text-foreground text-2xl font-bold">
									{marker.label}
								</Text>
							</View>

							<Pressable
								onPress={onClose}
								className="active:bg-muted/50 -m-2 rounded-full p-2"
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>

						{/* Location info */}
						<View className="flex-row items-center gap-2 px-6 pb-4">
							<Icon as={MapPin} className="text-muted-foreground size-4" />
							<Text className="text-muted-foreground text-sm">
								Position: {Math.round(marker.x * 100)}%,{" "}
								{Math.round(marker.y * 100)}%
							</Text>
						</View>

						{/* Actions */}
						<View className="gap-3 px-6">
							{/* Navigate to target sheet */}
							{marker.targetSheetRef && onNavigateToSheet && (
								<Button
									onPress={() => {
										onNavigateToSheet(marker.targetSheetRef!);
										onClose();
									}}
									className="bg-primary h-14 flex-row items-center justify-between"
								>
									<View className="flex-row items-center gap-3">
										<Icon
											as={Layers}
											className="text-primary-foreground size-5"
										/>
										<View>
											<Text className="text-primary-foreground text-base font-semibold">
												Go to Sheet
											</Text>
											<Text className="text-primary-foreground/70 text-xs">
												{marker.targetSheetRef}
											</Text>
										</View>
									</View>
									<Icon
										as={ArrowRight}
										className="text-primary-foreground size-5"
									/>
								</Button>
							)}

							{/* Take photo at this location */}
							{onTakePhoto && (
								<Button
									variant="outline"
									onPress={() => {
										onTakePhoto(marker);
										onClose();
									}}
									className="h-14 flex-row items-center justify-between"
								>
									<View className="flex-row items-center gap-3">
										<Icon as={Camera} className="text-foreground size-5" />
										<Text className="text-foreground text-base font-semibold">
											Take Photo Here
										</Text>
									</View>
									<Icon
										as={ExternalLink}
										className="text-muted-foreground size-5"
									/>
								</Button>
							)}
						</View>
					</Pressable>
				</Animated.View>
			</Pressable>
		</Animated.View>
	);
}

/**
 * Inline marker info card for showing in a list
 */
interface MarkerInfoCardProps {
	marker: CalloutMarker;
	onPress?: () => void;
	className?: string;
}

export function MarkerInfoCard({
	marker,
	onPress,
	className,
}: MarkerInfoCardProps) {
	const discipline = DISCIPLINE_CONFIG[marker.discipline || ""] || {
		label: "General",
		color: "#6b7280",
		bgColor: "rgba(107, 114, 128, 0.15)",
	};

	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"bg-card border-border/50 active:bg-muted/50 flex-row items-center gap-3 rounded-xl border p-4",
				className,
			)}
		>
			{/* Marker indicator */}
			<View
				className="h-10 w-10 items-center justify-center rounded-full"
				style={{ backgroundColor: discipline.bgColor }}
			>
				<Text style={{ color: discipline.color }} className="text-sm font-bold">
					{marker.label.slice(0, 3)}
				</Text>
			</View>

			{/* Info */}
			<View className="flex-1">
				<Text className="text-foreground font-semibold">{marker.label}</Text>
				<Text className="text-muted-foreground text-xs">
					{discipline.label}
				</Text>
			</View>

			{/* Arrow */}
			{marker.targetSheetRef && (
				<View className="flex-row items-center gap-1">
					<Icon as={ArrowRight} className="text-muted-foreground size-4" />
					<Text className="text-muted-foreground text-xs">
						{marker.targetSheetRef}
					</Text>
				</View>
			)}
		</Pressable>
	);
}
