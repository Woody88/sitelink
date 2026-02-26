import { useLocalSearchParams, useRouter } from "expo-router";
import { Download, type LucideIcon, Share2, UserPlus } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { DailySummaryBanner } from "@/components/activity/daily-summary-banner";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useDailySummary } from "@/hooks/use-daily-summary";
import { useMembers } from "@/hooks/use-members";
import { usePhotosTimeline } from "@/hooks/use-photos-timeline";
import { useSessionContext } from "@/lib/session-context";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import type { PhotoWithMarker } from "@/hooks/use-photos-timeline";

interface QuickActionButtonProps {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	disabled?: boolean;
}

const QuickActionButton = React.memo(function QuickActionButton({
	icon: IconComponent,
	label,
	onPress,
	disabled,
}: QuickActionButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			className="bg-muted/20 flex-1 items-center justify-center rounded-full px-3 py-2 active:opacity-70 disabled:opacity-40"
		>
			<Icon as={IconComponent} className="text-foreground mb-1 size-4" />
			<Text className="text-foreground text-center text-[11px] leading-tight font-medium">
				{label}
			</Text>
		</Pressable>
	);
});

interface ActivityItem {
	id: string;
	time: string;
	message: string;
}

function photoToActivity(photo: PhotoWithMarker): ActivityItem {
	const date = new Date(photo.capturedAt);
	let timeStr: string;
	if (isToday(date)) {
		timeStr = format(date, "h:mm a");
	} else if (isYesterday(date)) {
		timeStr = `Yesterday ${format(date, "h:mm a")}`;
	} else {
		timeStr = format(date, "MMM d h:mm a");
	}

	let message: string;
	if (photo.isIssue && photo.markerLabel) {
		message = `Issue flagged at ${photo.markerLabel}`;
	} else if (photo.markerLabel) {
		message = `Photo added at ${photo.markerLabel}`;
	} else {
		message = "Photo added";
	}

	return { id: photo.id, time: timeStr, message };
}

export default function ActivityScreen() {
	const router = useRouter();
	const { id: projectId } = useLocalSearchParams<{ id: string }>();
	const { userId } = useSessionContext();
	const {
		summary,
		isLoading: isSummaryLoading,
		generateSummary,
	} = useDailySummary(projectId);
	const timelineSections = usePhotosTimeline(projectId!);
	const members = useMembers(projectId!);

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
			});
		});

		return { photoCount, voiceNoteCount, issueCount };
	}, [timelineSections]);

	// Build activity feed from recent photos
	const recentActivity = React.useMemo(() => {
		const allPhotos = timelineSections.flatMap((section) =>
			section.data.flatMap((group) => group.photos),
		);
		// Sort by most recent, take last 10
		return allPhotos
			.sort((a, b) => b.capturedAt - a.capturedAt)
			.slice(0, 10)
			.map(photoToActivity);
	}, [timelineSections]);

	const handleShare = React.useCallback(async () => {
		try {
			await Share.share({
				message: summary
					? `Daily Summary\n\n${summary.text}`
					: "Check out our project on SiteLink!",
			});
		} catch {
			// User cancelled
		}
	}, [summary]);

	const handleInvite = React.useCallback(() => {
		router.push(`/project/${projectId}/members` as any);
	}, [router, projectId]);

	const displayedMembers = members.slice(0, 6);
	const hasMoreMembers = members.length > 6;
	const moreCount = members.length - 6;

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
							icon={UserPlus}
							label="Invite"
							onPress={handleInvite}
						/>
						<QuickActionButton
							icon={Download}
							label="Offline"
							onPress={() => {}}
							disabled
						/>
					</View>
				</View>

				{/* Team Members */}
				<View>
					<View className="mb-3 flex-row items-end justify-between">
						<Text className="text-foreground text-lg font-bold">
							Team Members
						</Text>
						<Pressable onPress={handleInvite}>
							<Text className="text-primary text-sm font-medium">Manage</Text>
						</Pressable>
					</View>

					{displayedMembers.length === 0 ? (
						<View className="py-4">
							<Text className="text-muted-foreground text-sm">
								No team members yet. Invite your team to collaborate.
							</Text>
						</View>
					) : (
						displayedMembers.map((member, index) => (
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
										{member.userId === userId && (
											<Text className="text-muted-foreground ml-2 text-xs">
												{" "}(you)
											</Text>
										)}
									</Text>
									<Text className="text-muted-foreground text-sm capitalize">
										{member.role}
									</Text>
								</View>
								{index < displayedMembers.length - 1 && (
									<Separator className="ml-11" />
								)}
							</React.Fragment>
						))
					)}

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

					{recentActivity.length === 0 ? (
						<View className="py-4">
							<Text className="text-muted-foreground text-sm">
								No activity yet. Photos and events will appear here.
							</Text>
						</View>
					) : (
						recentActivity.map((activity, index) => (
							<React.Fragment key={activity.id}>
								<View className="border-muted border-l-2 py-2.5 pl-4">
									<Text className="text-muted-foreground mb-0.5 text-xs">
										{activity.time}
									</Text>
									<Text className="text-foreground text-sm">
										{activity.message}
									</Text>
								</View>
								{index < recentActivity.length - 1 && (
									<View className="h-1" />
								)}
							</React.Fragment>
						))
					)}
				</View>
			</View>
		</ScrollView>
	);
}
