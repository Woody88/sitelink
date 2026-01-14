import { Check, Mic, Play, Trash2 } from "lucide-react-native";
import * as React from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Rect, Svg } from "react-native-svg";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

interface RecordingLayerProps {
	isRecording: boolean;
	duration: number;
	waveform: number[];
	transcript: string | null;
	isTranscribing: boolean;
	onStop: () => void;
	onPlay: () => void;
	onDelete: () => void;
	onDone: () => void;
}

export const RecordingLayer = React.memo(function RecordingLayer({
	isRecording,
	duration,
	waveform,
	transcript,
	isTranscribing,
	onStop,
	onPlay,
	onDelete,
	onDone,
}: RecordingLayerProps) {
	const insets = useSafeAreaInsets();
	const pulseAnim = React.useRef(new Animated.Value(1)).current;

	React.useEffect(() => {
		if (isRecording) {
			const pulse = Animated.loop(
				Animated.sequence([
					Animated.timing(pulseAnim, {
						toValue: 1.2,
						duration: 1000,
						useNativeDriver: true,
					}),
					Animated.timing(pulseAnim, {
						toValue: 1,
						duration: 1000,
						useNativeDriver: true,
					}),
				]),
			);
			pulse.start();
			return () => pulse.stop();
		}
	}, [isRecording, pulseAnim]);

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (isRecording) {
		return (
			<View className="absolute inset-0 z-20 items-center justify-center bg-black/70">
				<View className="bg-background/95 w-11/12 max-w-sm rounded-2xl p-8">
					<View className="mb-6 items-center">
						<Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
							<View className="bg-destructive size-16 items-center justify-center rounded-full">
								<Icon as={Mic} className="size-8 text-white" />
							</View>
						</Animated.View>
					</View>

					<Text className="text-foreground mb-2 text-center text-lg font-semibold">
						Recording...
					</Text>

					<Text className="text-foreground mb-6 text-center text-2xl font-bold">
						{formatDuration(duration)}
					</Text>

					{/* Waveform Visualization */}
					{waveform.length > 0 && (
						<View className="mb-6 h-12" style={{ width: "100%" }}>
							<Svg width="100%" height="48" viewBox="0 0 200 48">
								{waveform.map((height, index) => {
									const barWidth = 200 / waveform.length;
									const barHeight = height * 40;
									const x = (index * 200) / waveform.length;
									const y = 24 - barHeight / 2;
									return (
										<Rect
											key={index}
											x={x}
											y={y}
											width={barWidth * 0.8}
											height={barHeight}
											fill="hsl(var(--primary))"
											rx={2}
										/>
									);
								})}
							</Svg>
						</View>
					)}

					<Pressable
						onPress={onStop}
						className="bg-destructive rounded-full px-6 py-3 active:opacity-80"
					>
						<Text className="text-center text-base font-semibold text-white">
							Tap anywhere to stop
						</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	if (transcript !== null || isTranscribing) {
		return (
			<View
				className="bg-background/95 absolute right-0 bottom-0 left-0 z-20 backdrop-blur-md"
				style={{ paddingBottom: insets.bottom }}
			>
				<View className="px-4 pt-4 pb-2">
					<View className="mb-2 flex-row items-center gap-2">
						<Icon as={Check} className="size-4 text-green-500" />
						<Text className="text-foreground text-sm font-medium">
							Voice note saved ({formatDuration(duration)})
						</Text>
					</View>

					{isTranscribing && (
						<Text className="text-muted-foreground mb-4 text-xs">
							⏳ Transcribing...
						</Text>
					)}

					{transcript && !isTranscribing && (
						<View className="bg-muted/30 mb-4 rounded-lg p-3">
							<Text className="text-foreground text-sm leading-relaxed">
								{transcript}
							</Text>
						</View>
					)}

					<View className="flex-row gap-2">
						<Pressable
							onPress={onPlay}
							className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3 active:opacity-80"
						>
							<Icon as={Play} className="text-primary-foreground size-4" />
							<Text className="text-primary-foreground text-sm font-semibold">
								Play
							</Text>
						</Pressable>
						<Pressable
							onPress={onDelete}
							className="bg-muted/30 flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3 active:opacity-80"
						>
							<Icon as={Trash2} className="text-destructive size-4" />
							<Text className="text-destructive text-sm font-semibold">
								Delete
							</Text>
						</Pressable>
						<Pressable
							onPress={onDone}
							className="bg-foreground flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 py-3 active:opacity-80"
						>
							<Text className="text-background text-sm font-semibold">
								Done
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	}

	return null;
});
