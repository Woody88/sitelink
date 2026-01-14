import { ArrowLeft, Settings } from "lucide-react-native";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

export interface WorkspaceHeaderProps {
	onBack: () => void;
	onMenu: () => void;
	projectName: string;
	address?: string;
	children: React.ReactNode;
}

export const WorkspaceHeader = memo(function WorkspaceHeader({
	onBack,
	onMenu,
	projectName,
	address,
	children,
}: WorkspaceHeaderProps) {
	const insets = useSafeAreaInsets();

	return (
		<View className="bg-background" style={{ paddingTop: insets.top }}>
			{/* Row 1: Navigation & Info */}
			<View className="min-h-[56px] flex-row items-center justify-between px-0.5">
				{/* Back Button - Icon Only */}
				<Pressable
					onPress={onBack}
					className="-ml-1 items-center justify-center"
					style={{ width: 44, height: 44 }}
					role="button"
					accessibilityLabel="Back"
				>
					<Icon as={ArrowLeft} className="text-foreground size-6" />
				</Pressable>

				{/* Center: Project Info (Wrapped & Centered) */}
				<View className="flex-1 items-center justify-center px-2">
					<Text className="text-foreground text-center text-lg leading-tight font-bold">
						{projectName}
					</Text>
					{address && (
						<Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
							{address}
						</Text>
					)}
				</View>

				{/* Settings Button */}
				<Pressable
					onPress={onMenu}
					className="-mr-1 items-center justify-center"
					style={{ width: 44, height: 44 }}
					role="button"
					accessibilityLabel="Settings"
				>
					<Icon as={Settings} className="text-foreground size-5" />
				</Pressable>
			</View>

			{/* Row 2: Tabs (Centered) */}
			<View className="items-center pb-3">{children}</View>
		</View>
	);
});
