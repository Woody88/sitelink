import { ChevronRight } from "lucide-react-native";
import type * as React from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface SettingsItemProps {
	icon?: any;
	label: string;
	value?: string;
	onPress?: () => void;
	rightElement?: React.ReactNode;
	className?: string;
	destructive?: boolean;
}

export function SettingsItem({
	icon,
	label,
	value,
	onPress,
	rightElement,
	className,
	destructive,
}: SettingsItemProps) {
	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"flex-row items-center justify-between py-4 active:opacity-70",
				className,
			)}
		>
			<View className="flex-row items-center gap-3">
				{icon && (
					<View className="bg-muted size-8 items-center justify-center rounded-full">
						<Icon
							as={icon}
							className={cn(
								"text-foreground size-4",
								destructive && "text-destructive",
							)}
						/>
					</View>
				)}
				<Text
					className={cn(
						"text-base font-medium",
						destructive && "text-destructive",
					)}
				>
					{label}
				</Text>
			</View>

			<View className="flex-row items-center gap-2">
				{value && <Text className="text-muted-foreground">{value}</Text>}
				{rightElement}
				{!rightElement && onPress && (
					<Icon as={ChevronRight} className="text-muted-foreground size-5" />
				)}
			</View>
		</Pressable>
	);
}
