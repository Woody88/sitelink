import { memo, useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_WIDTH = SCREEN_WIDTH / 3;
const INDICATOR_WIDTH = TAB_WIDTH * 0.4;

interface WorkspaceTabsProps {
	tabs: string[];
	activeTab: number;
	onTabChange: (index: number) => void;
}

export const WorkspaceTabs = memo(function WorkspaceTabs({
	tabs,
	activeTab,
	onTabChange,
}: WorkspaceTabsProps) {
	const indicatorPosition = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.spring(indicatorPosition, {
			toValue: activeTab * TAB_WIDTH + (TAB_WIDTH - INDICATOR_WIDTH) / 2,
			useNativeDriver: true,
			damping: 20,
			stiffness: 200,
		}).start();
	}, [activeTab, indicatorPosition]);

	return (
		<View className="bg-background border-border border-b">
			<View className="flex-row">
				{tabs.map((tab, index) => (
					<Pressable
						key={tab}
						onPress={() => onTabChange(index)}
						className="h-12 flex-1 items-center justify-center"
						style={{ minHeight: 48 }}
						role="button"
						accessibilityLabel={`${tab} tab`}
						accessibilityState={{ selected: activeTab === index }}
					>
						<Text
							className={cn(
								"text-base font-medium",
								activeTab === index
									? "text-foreground"
									: "text-muted-foreground",
							)}
						>
							{tab}
						</Text>
					</Pressable>
				))}
			</View>

			{/* Animated Indicator */}
			<Animated.View
				className="bg-primary absolute bottom-0 h-[3px] rounded-full"
				style={{
					width: INDICATOR_WIDTH,
					transform: [{ translateX: indicatorPosition }],
				}}
			/>
		</View>
	);
});
