import * as React from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { cn } from "@/lib/utils";

interface CameraShutterProps {
	onPress: () => void;
	isIssueMode: boolean;
	disabled?: boolean;
}

export const CameraShutter = React.memo(function CameraShutter({
	onPress,
	isIssueMode,
	disabled = false,
}: CameraShutterProps) {
	const scaleAnim = React.useRef(new Animated.Value(1)).current;

	const handlePressIn = React.useCallback(() => {
		Animated.spring(scaleAnim, {
			toValue: 0.9,
			useNativeDriver: true,
			damping: 15,
			stiffness: 300,
		}).start();
	}, [scaleAnim]);

	const handlePressOut = React.useCallback(() => {
		Animated.spring(scaleAnim, {
			toValue: 1,
			useNativeDriver: true,
			damping: 15,
			stiffness: 300,
		}).start();
	}, [scaleAnim]);

	return (
		<Animated.View
			style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
		>
			<Pressable
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				disabled={disabled}
				className={cn(
					"items-center justify-center rounded-full border-2",
					isIssueMode
						? "bg-destructive border-destructive"
						: "border-gray-300 bg-white",
				)}
				style={styles.button}
				accessibilityRole="button"
				accessibilityLabel={
					isIssueMode ? "Capture issue photo" : "Capture photo"
				}
			>
				<View
					className={cn(
						"rounded-full",
						isIssueMode ? "bg-destructive-foreground" : "bg-gray-200",
					)}
					style={styles.inner}
				/>
			</Pressable>
		</Animated.View>
	);
});

const styles = StyleSheet.create({
	container: {
		width: 72,
		height: 72,
	},
	button: {
		width: 72,
		height: 72,
	},
	inner: {
		width: 56,
		height: 56,
	},
});
