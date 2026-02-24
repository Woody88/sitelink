import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronRight, TableProperties, X } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ScheduleDrawerGroup } from "@/hooks/use-schedule-drawer";
import { ScheduleRow } from "./schedule-row";

interface ScheduleDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	groups: ScheduleDrawerGroup[];
	onViewOnSheet: (
		sheetId: string,
		bbox: { x: number; y: number; width: number; height: number },
	) => void;
	scrollToMark?: string;
}

export function ScheduleDrawer({
	isOpen,
	onClose,
	groups,
	onViewOnSheet,
	scrollToMark,
}: ScheduleDrawerProps) {
	const insets = useSafeAreaInsets();
	const scrollViewRef = React.useRef<ScrollView>(null);

	const totalEntries = React.useMemo(
		() => groups.reduce((sum, g) => sum + g.entries.length, 0),
		[groups],
	);

	const handleClose = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		onClose();
	}, [onClose]);

	// Phase 2: scrollToMark support
	React.useEffect(() => {
		if (scrollToMark && groups.length > 0) {
			// Future: find matching entry and scroll to it
		}
	}, [scrollToMark, groups]);

	if (!isOpen) return null;

	return (
		<Modal
			visible={isOpen}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<Pressable className="flex-1 bg-black/50" onPress={handleClose}>
				{/* Spacer to push sheet to ~60% height */}
				<View className="flex-[0.35]" />

				<Animated.View
					entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
					className="flex-[0.65] rounded-t-3xl bg-card"
					style={{ paddingBottom: insets.bottom + 16 }}
				>
					<Pressable className="flex-1">
						{/* Handle */}
						<View className="items-center py-3">
							<View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
						</View>

						{/* Header */}
						<View className="flex-row items-start justify-between px-6 pb-3">
							<View className="flex-1">
								<Text className="text-2xl font-bold text-foreground">
									Schedules
								</Text>
								<Text className="text-sm text-muted-foreground">
									{groups.length} {groups.length === 1 ? "schedule" : "schedules"} · {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
								</Text>
							</View>
							<Pressable
								onPress={handleClose}
								className="-m-2 rounded-full p-2 active:bg-muted/50"
								style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
								accessibilityLabel="Close schedules"
								accessibilityRole="button"
							>
								<Icon as={X} className="size-5 text-muted-foreground" />
							</Pressable>
						</View>

						{/* Content */}
						{groups.length === 0 ? (
							<View className="flex-1 px-6 pt-8">
								<Empty className="border-0">
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<Icon as={TableProperties} className="size-5 text-muted-foreground" />
										</EmptyMedia>
										<EmptyTitle>No schedules detected</EmptyTitle>
										<EmptyDescription>
											Schedule data will appear here once plans are processed by SiteLink&apos;s AI
										</EmptyDescription>
									</EmptyHeader>
								</Empty>
							</View>
						) : (
							<ScrollView
								ref={scrollViewRef}
								className="flex-1"
								contentContainerClassName="pb-4"
								showsVerticalScrollIndicator
							>
								{groups.map((group) => (
									<ScheduleGroupSection
										key={group.region.id}
										group={group}
										onViewOnSheet={onViewOnSheet}
									/>
								))}
							</ScrollView>
						)}
					</Pressable>
				</Animated.View>
			</Pressable>
		</Modal>
	);
}

interface ScheduleGroupSectionProps {
	group: ScheduleDrawerGroup;
	onViewOnSheet: (
		sheetId: string,
		bbox: { x: number; y: number; width: number; height: number },
	) => void;
}

function ScheduleGroupSection({ group, onViewOnSheet }: ScheduleGroupSectionProps) {
	const [isOpen, setIsOpen] = React.useState(true);

	const handleOpenChange = React.useCallback((open: boolean) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setIsOpen(open);
	}, []);

	const title = group.region.regionTitle ?? "Schedule";
	const regionBbox = React.useMemo(
		() => ({
			x: group.region.x,
			y: group.region.y,
			width: group.region.width,
			height: group.region.height,
		}),
		[group.region],
	);

	return (
		<Collapsible open={isOpen} onOpenChange={handleOpenChange}>
			<CollapsibleTrigger asChild>
				<Pressable
					className="flex-row items-center border-b border-border bg-muted/30 px-4 py-3 active:bg-muted/50"
					style={{ minHeight: 48 }}
					accessibilityRole="button"
					accessibilityLabel={`${title}, ${group.entries.length} entries`}
				>
					<View className="mr-2">
						<Icon
							as={isOpen ? ChevronDown : ChevronRight}
							className="size-4 text-muted-foreground"
						/>
					</View>
					<Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
						{title}
					</Text>
					<View className="rounded-full bg-secondary px-2 py-0.5">
						<Text className="text-xs font-semibold text-secondary-foreground">
							{group.entries.length}
						</Text>
					</View>
					<Text className="ml-3 text-sm text-muted-foreground">
						{group.sheetNumber}
					</Text>
				</Pressable>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{group.entries.map((entry, index) => (
					<ScheduleRow
						key={entry.id}
						entry={entry}
						index={index}
						regionSheetId={group.region.sheetId}
						regionBbox={regionBbox}
						onViewOnSheet={onViewOnSheet}
					/>
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}
