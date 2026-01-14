import { useLocalSearchParams } from "expo-router";
import { Download, type LucideIcon, Share2 } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { DailySummaryBanner } from "@/components/activity/daily-summary-banner";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useDailySummary } from "@/hooks/use-daily-summary";
import { usePhotosTimeline } from "@/hooks/use-photos-timeline";

// Mock data for dashboard
const MOCK_MEMBERS = [
	{ id: "1", name: "John Smith", role: "Owner" },
	{ id: "2", name: "Mike Chen", role: "Member" },
	{ id: "3", name: "Sarah Johnson", role: "Member" },
	{ id: "4", name: "David Lee", role: "Member" },
	{ id: "5", name: "Emily Brown", role: "Member" },
	{ id: "6", name: "Tom Wilson", role: "Member" },
	{ id: "7", name: "Lisa Anderson", role: "Member" },
];

const MOCK_ACTIVITY = [
	{ id: "1", time: "2:47 PM", message: "Mike flagged issue at 5/A7" },
	{ id: "2", time: "11:30 AM", message: "Sarah added 3 photos to 3/A2" },
	{ id: "3", time: "9:15 AM", message: "John added photo to 5/A7" },
	{
		id: "4",
		time: "Yesterday 4:20 PM",
		message: "David uploaded new plan sheet",
	},
	{
		id: "5",
		time: "Yesterday 2:10 PM",
		message: "Emily shared project with client",
	},
];

interface QuickActionButtonProps {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
}

const QuickActionButton = React.memo(function QuickActionButton({
	icon: IconComponent,
	label,
	onPress,
}: QuickActionButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			className="bg-muted/20 flex-1 items-center justify-center rounded-full px-3 py-2 active:opacity-70"
		>
			<Icon as={IconComponent} className="text-foreground mb-1 size-4" />
			<Text className="text-foreground text-center text-[11px] leading-tight font-medium">
				{label}
			</Text>
		</Pressable>
	);
});

export default function ActivityScreen() {
	const { id: projectId } = useLocalSearchParams<{ id: string }>();
	const {
		summary,
		isLoading: isSummaryLoading,
		generateSummary,
	} = useDailySummary(projectId);
	const timelineSections = usePhotosTimeline(projectId);

	// Calculate today's stats
	const todayStats = React.useMemo(() => {
		const todaySection = timelineSections.find(
			(section) => section.title === "Today",
		);
		if (!todaySection) {
			return { photoCount: 0, voiceNoteCount: 0, issueCount: 0 };
		}

		let photoCount = 0;
		let voiceNoteCount = 0;
		let issueCount = 0;

		todaySection.data.forEach((group) => {
			group.photos.forEach((photo) => {
				photoCount++;
				if (photo.isIssue) issueCount++;
				// Check if photo has voice note (mock data has hasVoiceNote property)
				if ((photo as any).hasVoiceNote) voiceNoteCount++;
			});
		});

		return { photoCount, voiceNoteCount, issueCount };
	}, [timelineSections]);

	const handleShare = React.useCallback(() => {
		console.log("Share project");
	}, []);

	const handleOffline = React.useCallback(() => {
		console.log("Offline mode");
	}, []);

	const displayedMembers = MOCK_MEMBERS.slice(0, 6);
	const hasMoreMembers = MOCK_MEMBERS.length > 6;
	const moreCount = MOCK_MEMBERS.length - 6;

	return (
		<ScrollView
			className="bg-background flex-1"
			showsVerticalScrollIndicator={false}
		>
			<View className="gap-6 p-4">
				{/* Daily Summary Banner */}
				<DailySummaryBanner
					summary={summary}
					isLoading={isSummaryLoading}
					onGenerate={generateSummary}
					stats={todayStats}
				/>

				{/* Quick Actions */}
				<View>
					<Text className="text-foreground mb-3 text-lg font-bold">
						Quick Actions
					</Text>
					<View className="flex-row gap-2">
						<QuickActionButton
							icon={Share2}
							label="Share"
							onPress={handleShare}
						/>
						<QuickActionButton
							icon={Download}
							label="Offline"
							onPress={handleOffline}
						/>
					</View>
				</View>

				{/* Team Members */}
				<View>
					<View className="mb-3 flex-row items-end justify-between">
						<Text className="text-foreground text-lg font-bold">
							Team Members
						</Text>
						<Pressable onPress={() => console.log("Manage members")}>
							<Text className="text-primary text-sm font-medium">Manage</Text>
						</Pressable>
					</View>
					{displayedMembers.map((member, index) => (
						<React.Fragment key={member.id}>
							<View className="flex-row items-center py-2.5">
								<View className="bg-primary/20 mr-3 size-8 items-center justify-center rounded-full">
									<Text className="text-primary text-xs font-semibold">
										{member.name
											.split(" ")
											.map((n) => n[0])
											.join("")}
									</Text>
								</View>
								<Text className="text-foreground flex-1 text-base font-medium">
									{member.name}
									{member.role === "Owner" && (
										<Text className="text-muted-foreground ml-2 text-xs">
											(you)
										</Text>
									)}
								</Text>
								<Text className="text-muted-foreground text-sm">
									{member.role}
								</Text>
							</View>
							{index < displayedMembers.length - 1 && (
								<Separator className="ml-11" />
							)}
						</React.Fragment>
					))}
					{hasMoreMembers && (
						<View className="mt-2">
							<Text className="text-muted-foreground text-center text-sm">
								+{moreCount} more
							</Text>
						</View>
					)}
				</View>

				{/* Recent Activity */}
				<View>
					<Text className="text-foreground mb-3 text-lg font-bold">
						Recent Activity
					</Text>
					{MOCK_ACTIVITY.map((activity, index) => (
						<React.Fragment key={activity.id}>
							<View className="border-muted border-l-2 py-2.5 pl-4">
								<Text className="text-muted-foreground mb-0.5 text-xs">
									{activity.time}
								</Text>
								<Text className="text-foreground text-sm">
									{activity.message}
								</Text>
							</View>
							{index < MOCK_ACTIVITY.length - 1 && <View className="h-1" />}
						</React.Fragment>
					))}
				</View>
			</View>
		</ScrollView>
	);
}
