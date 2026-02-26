import {
	AlertCircle,
	CheckCircle,
	Clock,
	FileText,
	ImageIcon,
	type LucideIcon,
	Map,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type ProcessingStage =
	| "waiting"
	| "images"
	| "metadata"
	| "callouts"
	| "tiles"
	| "review"
	| "completed";

interface StageConfig {
	label: string;
	icon: LucideIcon;
	color: string;
}

const STAGE_CONFIG: Record<ProcessingStage, StageConfig> = {
	waiting: {
		label: "Waiting for connection",
		icon: Clock,
		color: "text-blue-500",
	},
	images: {
		label: "Generating images",
		icon: ImageIcon,
		color: "text-blue-500",
	},
	metadata: {
		label: "Extracting metadata",
		icon: FileText,
		color: "text-purple-500",
	},
	callouts: {
		label: "Detecting callouts",
		icon: AlertCircle,
		color: "text-amber-500",
	},
	tiles: { label: "Creating tiles", icon: Map, color: "text-green-500" },
	review: {
		label: "Review needed",
		icon: AlertCircle,
		color: "text-orange-500",
	},
	completed: { label: "Ready", icon: CheckCircle, color: "text-green-500" },
};

const STAGE_ORDER: ProcessingStage[] = [
	"waiting",
	"images",
	"metadata",
	"callouts",
	"tiles",
];

interface PlanProcessingStatusProps {
	stage: ProcessingStage;
	progress?: number;
	calloutCount?: number;
	compact?: boolean;
	onPress?: () => void;
}

interface CircularProgressProps {
	progress: number;
	size: number;
	strokeWidth: number;
	color?: string;
}

function CircularProgress({
	progress,
	size,
	strokeWidth,
	color = "#3b82f6",
}: CircularProgressProps) {
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const offset = circumference - (progress / 100) * circumference;

	return (
		<Svg
			width={size}
			height={size}
			style={{ transform: [{ rotate: "-90deg" }] }}
		>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke="rgba(255, 255, 255, 0.1)"
				strokeWidth={strokeWidth}
				fill="none"
			/>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke={color}
				strokeWidth={strokeWidth}
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				strokeLinecap="round"
				fill="none"
			/>
		</Svg>
	);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlanProcessingStatus({
	stage,
	progress = 0,
	calloutCount = 0,
	compact = false,
	onPress,
}: PlanProcessingStatusProps) {
	const config = STAGE_CONFIG[stage];
	const scale = useSharedValue(1);
	const opacity = useSharedValue(1);

	React.useEffect(() => {
		if (stage === "completed") {
			scale.value = withSpring(1.1, { damping: 12, stiffness: 200 }, () => {
				scale.value = withSpring(1, { damping: 12, stiffness: 200 });
			});
		}
	}, [stage]);

	React.useEffect(() => {
		if (stage === "waiting") {
			opacity.value = withRepeat(withTiming(0.5, { duration: 1500 }), -1, true);
		} else {
			opacity.value = withTiming(1, { duration: 300 });
		}
	}, [stage]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
		opacity: opacity.value,
	}));

	const isProcessing =
		stage !== "waiting" && stage !== "completed" && stage !== "review";
	const showProgress = isProcessing && progress > 0;

	if (compact) {
		return (
			<AnimatedPressable
				onPress={onPress}
				disabled={!onPress}
				style={animatedStyle}
				className={cn(
					"size-5 items-center justify-center",
					onPress && "active:opacity-70",
				)}
			>
				{showProgress ? (
					<CircularProgress progress={progress} size={20} strokeWidth={2} />
				) : (
					<Icon as={config.icon} className={cn("size-5", config.color)} />
				)}
			</AnimatedPressable>
		);
	}

	return (
		<AnimatedPressable
			onPress={onPress}
			disabled={!onPress}
			entering={FadeIn}
			style={animatedStyle}
			className={cn(
				"bg-muted/10 flex-row items-center gap-3 rounded-xl px-4 py-3",
				onPress && "active:bg-muted/20",
			)}
		>
			<View className="relative">
				{showProgress ? (
					<CircularProgress progress={progress} size={24} strokeWidth={2.5} />
				) : (
					<Icon as={config.icon} className={cn("size-6", config.color)} />
				)}
			</View>
			<View className="flex-1">
				<Text className="text-foreground text-sm font-semibold">
					{config.label}
				</Text>
				{showProgress && (
					<Text className="text-muted-foreground text-xs">
						{Math.round(progress)}%
					</Text>
				)}
			</View>
			{stage === "review" && calloutCount > 0 && (
				<Badge
					variant="secondary"
					className="bg-orange-500/10 border-orange-500/20"
				>
					<Text className="text-xs font-bold text-orange-500">
						{calloutCount}
					</Text>
				</Badge>
			)}
		</AnimatedPressable>
	);
}

interface DetailedProcessingViewProps {
	stage: ProcessingStage;
	progress?: number;
	calloutCount?: number;
	onReviewCallouts?: () => void;
	onDismiss?: () => void;
}

export function DetailedProcessingView({
	stage,
	progress = 0,
	calloutCount = 0,
	onReviewCallouts,
	onDismiss,
}: DetailedProcessingViewProps) {
	const insets = useSafeAreaInsets();
	const config = STAGE_CONFIG[stage];
	const scale = useSharedValue(1);

	React.useEffect(() => {
		if (stage === "completed") {
			scale.value = withSpring(1.2, { damping: 12, stiffness: 200 }, () => {
				scale.value = withSpring(1, { damping: 12, stiffness: 200 });
			});
		}
	}, [stage]);

	const animatedIconStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	const currentStageIndex = STAGE_ORDER.indexOf(stage);

	const getStageStatus = (
		stageType: ProcessingStage,
	): "completed" | "active" | "pending" => {
		const stageIndex = STAGE_ORDER.indexOf(stageType);
		if (stageIndex < 0) return "pending";
		if (stage === "completed") return "completed";
		if (stageIndex < currentStageIndex) return "completed";
		if (stageIndex === currentStageIndex) return "active";
		return "pending";
	};

	return (
		<Modal
			animationType="slide"
			presentationStyle="pageSheet"
			visible
			transparent={false}
		>
			<View className="bg-background flex-1">
				<View className="border-border/10 flex-row items-center justify-between border-b px-6 py-4">
					<Text className="text-lg font-bold">Processing Plan</Text>
					{onDismiss && (
						<Pressable
							onPress={onDismiss}
							className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
						>
							<Icon as={X} className="text-foreground size-5" />
						</Pressable>
					)}
				</View>

				<View className="flex-1 items-center justify-center px-6">
					<Animated.View style={animatedIconStyle} className="mb-8">
						<View className="relative items-center justify-center">
							{stage !== "waiting" &&
							stage !== "completed" &&
							stage !== "review" &&
							progress > 0 ? (
								<CircularProgress
									progress={progress}
									size={80}
									strokeWidth={4}
								/>
							) : (
								<Icon
									as={config.icon}
									className={cn("size-20", config.color)}
								/>
							)}
						</View>
					</Animated.View>

					<Text className="text-foreground mb-2 text-2xl font-bold">
						{config.label}
					</Text>

					{stage !== "waiting" &&
						stage !== "completed" &&
						stage !== "review" &&
						progress > 0 && (
							<Text className="text-muted-foreground mb-8 text-lg">
								{Math.round(progress)}%
							</Text>
						)}

					{stage === "waiting" && (
						<Text className="text-muted-foreground mb-8 text-center">
							Processing will resume when you're back online
						</Text>
					)}

					{stage === "review" && (
						<View className="mb-8 items-center gap-2">
							<Text className="text-muted-foreground text-center">
								{calloutCount} callout{calloutCount !== 1 ? "s" : ""} detected
							</Text>
							{onReviewCallouts && (
								<Pressable
									onPress={onReviewCallouts}
									className="bg-orange-500 active:bg-orange-600 mt-2 rounded-full px-6 py-3"
								>
									<Text className="text-sm font-bold text-white">
										Review Callouts
									</Text>
								</Pressable>
							)}
						</View>
					)}

					{stage === "completed" && (
						<Text className="text-muted-foreground mb-8 text-center">
							Your plan is ready to view
						</Text>
					)}

					<View className="w-full gap-3">
						{STAGE_ORDER.map((stageType) => {
							const stageConfig = STAGE_CONFIG[stageType];
							const status = getStageStatus(stageType);

							return (
								<View
									key={stageType}
									className={cn(
										"flex-row items-center gap-3 rounded-lg px-4 py-3",
										status === "active" && "bg-muted/20",
										status === "completed" && "opacity-60",
									)}
								>
									<Icon
										as={status === "completed" ? CheckCircle : stageConfig.icon}
										className={cn(
											"size-5",
											status === "completed" && "text-green-500",
											status === "active" && stageConfig.color,
											status === "pending" && "text-muted-foreground",
										)}
									/>
									<Text
										className={cn(
											"flex-1 text-sm font-medium",
											status === "active" && "text-foreground",
											status === "completed" && "text-muted-foreground",
											status === "pending" && "text-muted-foreground",
										)}
									>
										{stageConfig.label}
									</Text>
									{status === "active" &&
										stageType !== "waiting" &&
										progress > 0 && (
											<Text className="text-muted-foreground text-xs tabular-nums">
												{Math.round(progress)}%
											</Text>
										)}
								</View>
							);
						})}
					</View>
				</View>

				<View
					className="items-center border-t border-border/10 p-6"
					style={{ paddingBottom: Math.max(insets.bottom, 24) }}
				>
					<Text className="text-muted-foreground text-center text-xs leading-relaxed">
						This process may take a few minutes depending on the size of your
						plan
					</Text>
				</View>
			</View>
		</Modal>
	);
}
