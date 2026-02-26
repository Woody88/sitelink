import * as Haptics from "expo-haptics";
import { ArrowLeft, Eye } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { LayoutRegion, ScheduleEntry } from "@/hooks/use-plan-info";
import { cn } from "@/lib/utils";
import { ScheduleRowDetail } from "./schedule-row-detail";

interface ScheduleDetailScreenProps {
	region: LayoutRegion;
	entries: ScheduleEntry[];
	sheetNumber: string;
	isExtracting?: boolean;
	onBack: () => void;
	onViewOnSheet: (
		sheetId: string,
		bbox: { x: number; y: number; width: number; height: number },
	) => void;
}

function parseProperties(json: string): Record<string, string> {
	try {
		const parsed = JSON.parse(json);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const result: Record<string, string> = {};
			for (const [key, value] of Object.entries(parsed)) {
				result[key] = value != null ? String(value) : "";
			}
			return result;
		}
	} catch {
		// ignore parse errors
	}
	return {};
}

function collectColumns(entries: ScheduleEntry[]): string[] {
	const keySet = new Set<string>();
	for (const entry of entries) {
		const props = parseProperties(entry.properties);
		for (const key of Object.keys(props)) {
			keySet.add(key);
		}
	}
	return Array.from(keySet);
}

function getConfidenceBadge(confidence: number) {
	if (confidence >= 0.9) {
		return { label: "High confidence", color: "#16a34a", bg: "rgba(22, 163, 74, 0.15)" };
	}
	if (confidence >= 0.8) {
		return { label: "Medium confidence", color: "#ca8a04", bg: "rgba(202, 138, 4, 0.15)" };
	}
	return { label: "Review recommended", color: "#ea580c", bg: "rgba(234, 88, 12, 0.15)" };
}

function formatColumnHeader(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/[_-]/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

export function ScheduleDetailScreen({
	region,
	entries,
	sheetNumber,
	isExtracting = false,
	onBack,
	onViewOnSheet,
}: ScheduleDetailScreenProps) {
	const insets = useSafeAreaInsets();
	const [selectedEntry, setSelectedEntry] = React.useState<ScheduleEntry | null>(null);

	const propertyColumns = React.useMemo(() => collectColumns(entries), [entries]);
	const allColumns = React.useMemo(() => ["Mark", ...propertyColumns], [propertyColumns]);

	const parsedRows = React.useMemo(
		() => entries.map((entry) => ({ entry, props: parseProperties(entry.properties) })),
		[entries],
	);

	const avgConfidence = React.useMemo(() => {
		if (entries.length === 0) return region.confidence;
		const sum = entries.reduce((acc, e) => acc + e.confidence, 0);
		return sum / entries.length;
	}, [entries, region.confidence]);

	const badge = getConfidenceBadge(avgConfidence);
	const title = region.regionTitle ?? region.regionClass;

	const handleRowPress = (entry: ScheduleEntry) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setSelectedEntry(entry);
	};

	const handleViewOnSheet = () => {
		onViewOnSheet(region.sheetId, {
			x: region.x,
			y: region.y,
			width: region.width,
			height: region.height,
		});
	};

	return (
		<View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
			{/* Header */}
			<View className="flex-row items-center justify-between px-4 py-3">
				<View className="flex-row items-center gap-3 flex-1">
					<Pressable
						onPress={onBack}
						className="active:bg-muted/50 -m-2 rounded-full p-2"
						hitSlop={8}
						accessibilityLabel="Go back"
						accessibilityRole="button"
					>
						<Icon as={ArrowLeft} className="text-foreground size-5" />
					</Pressable>
					<Text className="text-foreground text-lg font-bold" numberOfLines={1}>
						{title}
					</Text>
				</View>
				<Button
					variant="ghost"
					size="sm"
					onPress={handleViewOnSheet}
					accessibilityLabel={`View ${title} on sheet`}
				>
					<Icon as={Eye} className="text-primary size-4" />
					<Text className="text-primary text-sm font-medium">View on Sheet</Text>
				</Button>
			</View>

			{/* Subtitle: sheet number + confidence */}
			<View className="flex-row items-center gap-2 px-4 pb-3">
				<Text className="text-muted-foreground text-sm">
					Sheet {sheetNumber}
				</Text>
				<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
					<Text style={{ color: badge.color }} className="text-xs font-medium">
						{Math.round(avgConfidence * 100)}% {badge.label}
					</Text>
				</View>
			</View>

			{/* Table */}
			{entries.length === 0 ? (
				<View className="flex-1 items-center justify-center px-8 gap-3">
					{isExtracting ? (
						<>
							<ActivityIndicator />
							<Text className="text-muted-foreground text-center text-sm">
								Extracting schedule data…
							</Text>
						</>
					) : (
						<Text className="text-muted-foreground text-center text-sm">
							No entries extracted for this schedule yet
						</Text>
					)}
				</View>
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="pb-8"
				>
					<ScrollView horizontal showsHorizontalScrollIndicator>
						<View className="min-w-full">
							{/* Header row */}
							<View className="bg-muted/30 flex-row border-b border-border">
								{allColumns.map((col) => (
									<View key={col} className="w-36 px-3 py-3">
										<Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
											{formatColumnHeader(col)}
										</Text>
									</View>
								))}
							</View>

							{/* Data rows */}
							{parsedRows.map(({ entry, props }, rowIndex) => (
								<Pressable
									key={entry.id}
									className={cn(
										"flex-row border-b border-border/50 active:bg-muted/30",
										rowIndex % 2 === 1 && "bg-muted/10",
									)}
									style={{ minHeight: 48 }}
									accessibilityRole="button"
									accessibilityLabel={`Schedule entry ${entry.mark}, tap for details`}
									onPress={() => handleRowPress(entry)}
								>
									{allColumns.map((col) => {
										const value =
											col === "Mark" ? entry.mark : (props[col] ?? "");
										return (
											<View key={col} className="w-36 justify-center px-3 py-3">
												<Text
													className={cn(
														"text-sm",
														col === "Mark"
															? "text-foreground font-semibold"
															: "text-foreground",
													)}
													numberOfLines={3}
												>
													{value || "\u2014"}
												</Text>
											</View>
										);
									})}
								</Pressable>
							))}
						</View>
					</ScrollView>

					{/* Hint */}
					<View className="items-center py-4">
						<Text className="text-muted-foreground text-xs">
							Tap a row for full details
						</Text>
					</View>
				</ScrollView>
			)}

			{/* Bottom action */}
			<View
				className="border-border/50 border-t px-4 py-3"
				style={{ paddingBottom: insets.bottom + 12 }}
			>
				<Button onPress={handleViewOnSheet} className="h-12" accessibilityLabel="View schedule on sheet">
					<Icon as={Eye} className="text-primary-foreground size-5" />
					<Text className="text-primary-foreground text-base font-semibold">
						View on Sheet
					</Text>
				</Button>
			</View>

			{/* Row detail bottom sheet */}
			<ScheduleRowDetail
				entry={selectedEntry}
				visible={selectedEntry != null}
				scheduleName={title}
				sheetNumber={sheetNumber}
				onClose={() => setSelectedEntry(null)}
				onViewOnSheet={handleViewOnSheet}
			/>
		</View>
	);
}
