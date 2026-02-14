import { useLocalSearchParams } from "expo-router";
import { ChevronRight, Layers } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
	type LayoutRegion,
	type ScheduleEntry,
	usePlanInfo,
} from "@/hooks/use-plan-info";

interface PlanInfoViewProps {
	onRegionPress?: (region: LayoutRegion) => void;
}

export function PlanInfoView({ onRegionPress }: PlanInfoViewProps) {
	const { id: projectId } = useLocalSearchParams<{ id: string }>();
	const { schedules, notes, legends, scheduleEntriesByRegion, sheetNumberMap } =
		usePlanInfo(projectId!);

	const hasContent = schedules.length > 0 || notes.length > 0 || legends.length > 0;

	if (!hasContent) {
		return (
			<View className="flex-1 px-4 pt-8">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon as={Layers} className="text-muted-foreground size-5" />
						</EmptyMedia>
						<EmptyTitle>No plan intelligence detected yet</EmptyTitle>
						<EmptyDescription>
							Schedules, notes, and legends will appear here once plans are
							processed by SiteLink&apos;s AI
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</View>
		);
	}

	return (
		<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 pt-4">
			{schedules.length > 0 && (
				<PlanInfoSection
					title="SCHEDULES"
					count={schedules.length}
					regions={schedules}
					sheetNumberMap={sheetNumberMap}
					scheduleEntriesByRegion={scheduleEntriesByRegion}
					onRegionPress={onRegionPress}
				/>
			)}
			{notes.length > 0 && (
				<PlanInfoSection
					title="NOTES"
					count={notes.length}
					regions={notes}
					sheetNumberMap={sheetNumberMap}
					onRegionPress={onRegionPress}
				/>
			)}
			{legends.length > 0 && (
				<PlanInfoSection
					title="LEGENDS"
					count={legends.length}
					regions={legends}
					sheetNumberMap={sheetNumberMap}
					onRegionPress={onRegionPress}
				/>
			)}
		</ScrollView>
	);
}

interface PlanInfoSectionProps {
	title: string;
	count: number;
	regions: LayoutRegion[];
	sheetNumberMap: Map<string, string>;
	scheduleEntriesByRegion?: Map<string, ScheduleEntry[]>;
	onRegionPress?: (region: LayoutRegion) => void;
}

function PlanInfoSection({
	title,
	count,
	regions,
	sheetNumberMap,
	scheduleEntriesByRegion,
	onRegionPress,
}: PlanInfoSectionProps) {
	return (
		<View className="mb-6">
			<View className="mb-2 flex-row items-center gap-2 px-1">
				<Text className="text-muted-foreground text-xs font-semibold tracking-wider">
					{title}
				</Text>
				<Badge variant="secondary">
					<Text className="text-secondary-foreground text-[10px] font-semibold">
						{count}
					</Text>
				</Badge>
			</View>

			<View className="bg-muted/10 overflow-hidden rounded-xl">
				{regions.map((region, index) => {
					const sheetNumber = sheetNumberMap.get(region.sheetId) ?? "—";
					const entryCount = scheduleEntriesByRegion?.get(region.id)?.length;

					return (
						<Pressable
							key={region.id}
							className="active:bg-muted/20 flex-row items-center px-4 py-3"
							onPress={() => onRegionPress?.(region)}
						>
							<View className="flex-1">
								<Text className="text-foreground text-base font-medium">
									{region.regionTitle ?? region.regionClass}
								</Text>
								{entryCount != null && (
									<Text className="text-muted-foreground text-xs">
										{entryCount} {entryCount === 1 ? "entry" : "entries"}
									</Text>
								)}
							</View>
							<Text className="text-muted-foreground mr-2 text-sm">
								{sheetNumber}
							</Text>
							<Icon
								as={ChevronRight}
								className="text-muted-foreground size-4"
							/>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}
