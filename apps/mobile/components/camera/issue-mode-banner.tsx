import { AlertTriangle } from "lucide-react-native";
import * as React from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

interface IssueModeBannerProps {
	visible: boolean;
}

export const IssueModeBanner = React.memo(function IssueModeBanner({
	visible,
}: IssueModeBannerProps) {
	const insets = useSafeAreaInsets();
	const opacityAnim = React.useRef(new Animated.Value(0)).current;
	const translateYAnim = React.useRef(new Animated.Value(-20)).current;

	React.useEffect(() => {
		if (visible) {
			Animated.parallel([
				Animated.spring(opacityAnim, {
					toValue: 1,
					useNativeDriver: true,
					damping: 20,
					stiffness: 200,
				}),
				Animated.spring(translateYAnim, {
					toValue: 0,
					useNativeDriver: true,
					damping: 20,
					stiffness: 200,
				}),
			]).start();
		} else {
			Animated.parallel([
				Animated.timing(opacityAnim, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(translateYAnim, {
					toValue: -20,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [visible, opacityAnim, translateYAnim]);

	if (!visible) return null;

	return (
		<Animated.View
			className="absolute right-0 left-0 z-10 items-center"
			style={{
				top: insets.top + 60,
				opacity: opacityAnim,
				transform: [{ translateY: translateYAnim }],
			}}
		>
			<View className="bg-destructive flex-row items-center gap-2 rounded-full px-6 py-3 shadow-lg">
				<Icon
					as={AlertTriangle}
					className="text-destructive-foreground size-5"
				/>
				<Text className="text-destructive-foreground text-base font-bold">
					ISSUE MODE
				</Text>
			</View>
		</Animated.View>
	);
});
