import { Stack } from "expo-router";
import { AlertTriangle, CheckCircle, Info } from "lucide-react-native";
import * as React from "react";
import { Pressable, SectionList, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const NOTIFICATIONS_DATA = [
	{
		title: "This Week",
		data: [
			{
				id: "1",
				title: "Plan Processing Complete",
				body: "Riverside Apartments plans are ready to view.",
				time: "2h ago",
				type: "success",
			},
			{
				id: "2",
				title: "New Issue Flagged",
				body: "Mike flagged an issue at 5/A7.",
				time: "5h ago",
				type: "alert",
			},
			{
				id: "3",
				title: "Trial Ending Soon",
				body: "Your Pro trial ends in 3 days.",
				time: "2 days ago",
				type: "info",
			},
			{
				id: "4",
				title: "Sheet Updated",
				body: "Floor 2 Electrical has been updated.",
				time: "3 days ago",
				type: "info",
			},
		],
	},
];

export default function NotificationsScreen() {
	const getIcon = (type: string) => {
		switch (type) {
			case "success":
				return CheckCircle;
			case "alert":
				return AlertTriangle;
			default:
				return Info;
		}
	};

	const getColor = (type: string) => {
		switch (type) {
			case "success":
				return "text-green-500";
			case "alert":
				return "text-amber-500";
			default:
				return "text-blue-500";
		}
	};

	return (
		<View className="bg-background flex-1">
			<Stack.Screen
				options={{
					headerTitle: () => (
						<Text className="text-foreground text-lg font-bold">
							Notifications
						</Text>
					),
					headerShown: true,
					headerShadowVisible: false,
					headerTitleAlign: "center",
				}}
			/>

			<SectionList
				sections={NOTIFICATIONS_DATA}
				contentContainerClassName="pb-12"
				keyExtractor={(item) => item.id}
				renderSectionHeader={({ section: { title } }) => (
					<View className="px-4 py-4">
						<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
							{title}
						</Text>
					</View>
				)}
				renderItem={({ item }) => (
					<Pressable className="active:bg-muted/30 flex-row gap-4 px-4 py-4">
						<View className="bg-muted/20 size-8 items-center justify-center rounded-full">
							<Icon
								as={getIcon(item.type)}
								className={`size-4 ${getColor(item.type)}`}
							/>
						</View>
						<View className="flex-1 gap-0.5">
							<View className="flex-row items-start justify-between">
								<Text className="flex-1 pr-2 text-base leading-tight font-semibold">
									{item.title}
								</Text>
								<Text className="text-muted-foreground mt-0.5 text-xs">
									{item.time}
								</Text>
							</View>
							<Text className="text-muted-foreground text-sm leading-snug">
								{item.body}
							</Text>
						</View>
					</Pressable>
				)}
			/>
		</View>
	);
}
