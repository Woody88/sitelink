import * as Haptics from "expo-haptics";
import { ChevronRight, Eye } from "lucide-react-native";
import * as React from "react";
import { LayoutAnimation, Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type { ScheduleEntry } from "@/hooks/use-plan-info";
import { cn } from "@/lib/utils";

interface ScheduleRowProps {
	entry: ScheduleEntry;
	index: number;
	regionSheetId: string;
	regionBbox: { x: number; y: number; width: number; height: number };
	onViewOnSheet: (
		sheetId: string,
		bbox: { x: number; y: number; width: number; height: number },
	) => void;
	isExpanded?: boolean;
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

function formatLabel(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/[_-]/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

function getConfidenceBadge(confidence: number) {
	if (confidence >= 0.9) {
		return { label: "High", color: "#16a34a", bg: "rgba(22, 163, 74, 0.15)" };
	}
	if (confidence >= 0.8) {
		return { label: "Medium", color: "#ca8a04", bg: "rgba(202, 138, 4, 0.15)" };
	}
	return { label: "Review", color: "#ea580c", bg: "rgba(234, 88, 12, 0.15)" };
}

function getSummary(props: Record<string, string>): string {
	const values = Object.values(props).filter(Boolean);
	return values.slice(0, 2).join("  ");
}

export function ScheduleRow({
	entry,
	index,
	regionSheetId,
	regionBbox,
	onViewOnSheet,
	isExpanded: controlledExpanded,
}: ScheduleRowProps) {
	const [expanded, setExpanded] = React.useState(controlledExpanded ?? false);
	const props = React.useMemo(() => parseProperties(entry.properties), [entry.properties]);
	const summary = React.useMemo(() => getSummary(props), [props]);
	const badge = React.useMemo(() => getConfidenceBadge(entry.confidence), [entry.confidence]);

	React.useEffect(() => {
		if (controlledExpanded !== undefined) {
			setExpanded(controlledExpanded);
		}
	}, [controlledExpanded]);

	const handlePress = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpanded((prev) => !prev);
	}, []);

	const handleViewOnSheet = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		onViewOnSheet(regionSheetId, regionBbox);
	}, [onViewOnSheet, regionSheetId, regionBbox]);

	return (
		<View>
			<Pressable
				onPress={handlePress}
				className={cn(
					"flex-row items-center px-4 py-3 active:bg-muted/30",
					index % 2 === 1 && "bg-muted/10",
				)}
				style={{ minHeight: 48 }}
				accessibilityRole="button"
				accessibilityLabel={`${entry.mark} schedule entry`}
			>
				<Text className="w-14 text-base font-semibold text-foreground">
					{entry.mark}
				</Text>
				<Text
					className="flex-1 text-sm text-foreground"
					numberOfLines={1}
				>
					{summary || "\u2014"}
				</Text>
				<View
					className={cn(
						"ml-2 transition-transform",
						expanded && "rotate-90",
					)}
				>
					<Icon as={ChevronRight} className="size-4 text-muted-foreground" />
				</View>
			</Pressable>

			{expanded && (
				<View className={cn("px-4 pb-4", index % 2 === 1 && "bg-muted/10")}>
					<Separator className="mb-3" />

					<View className="gap-3 px-2">
						{Object.entries(props).map(([key, value]) => (
							<View key={key}>
								<Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									{formatLabel(key)}
								</Text>
								<Text className="mt-0.5 text-base text-foreground">
									{value || "\u2014"}
								</Text>
							</View>
						))}
					</View>

					<Separator className="my-3" />

					<View className="flex-row items-center justify-between px-2">
						<View className="flex-row items-center gap-1.5">
							<Text className="text-sm text-muted-foreground">Confidence:</Text>
							<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
								<Text style={{ color: badge.color }} className="text-xs font-semibold">
									{Math.round(entry.confidence * 100)}% {badge.label}
								</Text>
							</View>
						</View>
					</View>

					<View className="mt-3 px-2">
						<Button onPress={handleViewOnSheet} className="h-12">
							<Icon as={Eye} className="size-5 text-primary-foreground" />
							<Text className="text-base font-semibold text-primary-foreground">
								View on Sheet
							</Text>
						</Button>
					</View>
				</View>
			)}
		</View>
	);
}
