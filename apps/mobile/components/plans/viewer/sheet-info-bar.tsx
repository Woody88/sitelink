import { ChevronDown, Layers, MapPin } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SheetInfoBarProps {
	sheetCode: string;
	sheetTitle: string;
	markerCount?: number;
	onSheetPress?: () => void;
	onMarkersPress?: () => void;
	className?: string;
}

/**
 * Sheet info bar displayed at the top of the plan viewer
 * Shows current sheet info and marker count
 * Wealthsimple-inspired: clean, minimal with glass effect
 */
export function SheetInfoBar({
	sheetCode,
	sheetTitle,
	markerCount = 0,
	onSheetPress,
	onMarkersPress,
	className,
}: SheetInfoBarProps) {
	return (
		<View className={cn("flex-row items-center gap-3 px-4 py-3", className)}>
			{/* Sheet selector pill */}
			<SheetPill code={sheetCode} title={sheetTitle} onPress={onSheetPress} />

			{/* Markers count pill */}
			{markerCount > 0 && (
				<MarkersPill count={markerCount} onPress={onMarkersPress} />
			)}
		</View>
	);
}

interface SheetPillProps {
	code: string;
	title: string;
	onPress?: () => void;
}

function SheetPill({ code, title, onPress }: SheetPillProps) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	const handlePressIn = () => {
		scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
	};

	const handlePressOut = () => {
		scale.value = withSpring(1, { damping: 15, stiffness: 300 });
	};

	return (
		<AnimatedPressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={animatedStyle}
			className="flex-1 flex-row items-center gap-3 rounded-xl bg-black/60 px-4 py-3 backdrop-blur-md active:bg-black/70"
			accessibilityRole="button"
			accessibilityLabel={`Current sheet: ${code} - ${title}. Tap to change sheet.`}
		>
			<Icon as={Layers} className="size-5 text-white/80" />
			<View className="flex-1">
				<Text className="text-base font-bold text-white" numberOfLines={1}>
					{code}
				</Text>
				<Text className="text-xs text-white/60" numberOfLines={1}>
					{title}
				</Text>
			</View>
			{onPress && <Icon as={ChevronDown} className="size-5 text-white/60" />}
		</AnimatedPressable>
	);
}

interface MarkersPillProps {
	count: number;
	onPress?: () => void;
}

function MarkersPill({ count, onPress }: MarkersPillProps) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	const handlePressIn = () => {
		scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
	};

	const handlePressOut = () => {
		scale.value = withSpring(1, { damping: 15, stiffness: 300 });
	};

	return (
		<AnimatedPressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={animatedStyle}
			className="bg-primary/20 active:bg-primary/30 flex-row items-center gap-2 rounded-xl px-3 py-3 backdrop-blur-md"
			accessibilityRole="button"
			accessibilityLabel={`${count} markers on this sheet. Tap to view markers.`}
		>
			<Icon as={MapPin} className="text-primary size-4" />
			<Text className="text-primary text-sm font-semibold">{count}</Text>
		</AnimatedPressable>
	);
}

/**
 * Compact version for full-screen mode
 */
interface CompactSheetInfoProps {
	sheetCode: string;
	onPress?: () => void;
	className?: string;
}

export function CompactSheetInfo({
	sheetCode,
	onPress,
	className,
}: CompactSheetInfoProps) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	const handlePressIn = () => {
		scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
	};

	const handlePressOut = () => {
		scale.value = withSpring(1, { damping: 15, stiffness: 300 });
	};

	return (
		<AnimatedPressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={animatedStyle}
			className={cn(
				"flex-row items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-md active:bg-black/70",
				className,
			)}
		>
			<Icon as={Layers} className="size-4 text-white/80" />
			<Text className="text-sm font-semibold text-white">{sheetCode}</Text>
			{onPress && <Icon as={ChevronDown} className="size-4 text-white/60" />}
		</AnimatedPressable>
	);
}
