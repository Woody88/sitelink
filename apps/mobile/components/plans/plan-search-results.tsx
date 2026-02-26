import * as Haptics from "expo-haptics";
import {
	ChevronRight,
	FileText,
	Mic,
	StickyNote,
	Table2,
} from "lucide-react-native";
import { FlatList, Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { LayoutRegion, ScheduleEntry } from "@/hooks/use-plan-info";
import type { Sheet } from "@/hooks/use-sheets";
import type {
	PlanSearchResult,
	SearchResultType,
} from "@/hooks/use-plan-search";

interface PlanSearchResultsProps {
	results: PlanSearchResult[];
	query: string;
	onSheetPress: (sheet: Sheet) => void;
	onSchedulePress: (
		region: LayoutRegion,
		entries: ScheduleEntry[],
		sheetNumber: string,
	) => void;
	onNotesPress: (region: LayoutRegion, sheetNumber: string) => void;
}

const typeConfig: Record<
	SearchResultType,
	{
		icon: typeof FileText;
		label: string;
		iconClass: string;
		labelColor: string;
		bg: string;
	}
> = {
	sheet: {
		icon: FileText,
		label: "Sheet",
		iconClass: "text-gray-500 size-5",
		labelColor: "#6b7280",
		bg: "rgba(107, 114, 128, 0.15)",
	},
	schedule: {
		icon: Table2,
		label: "Schedule",
		iconClass: "text-blue-600 size-5",
		labelColor: "#2563eb",
		bg: "rgba(37, 99, 235, 0.15)",
	},
	notes: {
		icon: StickyNote,
		label: "Notes",
		iconClass: "text-purple-600 size-5",
		labelColor: "#9333ea",
		bg: "rgba(147, 51, 234, 0.15)",
	},
	voice: {
		icon: Mic,
		label: "Voice",
		iconClass: "text-green-600 size-5",
		labelColor: "#16a34a",
		bg: "rgba(22, 163, 74, 0.15)",
	},
};

function SearchResultRow({
	item,
	onPress,
}: {
	item: PlanSearchResult;
	onPress: () => void;
}) {
	const config = typeConfig[item.type];
	return (
		<Pressable
			className="active:bg-muted/10 flex-row items-center gap-3 rounded-lg px-2 py-3"
			onPress={onPress}
		>
			<View
				className="size-10 items-center justify-center rounded-lg"
				style={{ backgroundColor: config.bg }}
			>
				<Icon as={config.icon} className={config.iconClass} />
			</View>
			<View className="flex-1">
				<View className="flex-row items-center gap-2">
					<Text
						className="text-foreground shrink text-base font-bold"
						numberOfLines={1}
					>
						{item.title}
					</Text>
					<View
						className="rounded-full px-2 py-0.5"
						style={{ backgroundColor: config.bg }}
					>
						<Text
							className="text-xs font-medium"
							style={{ color: config.labelColor }}
						>
							{config.label}
						</Text>
					</View>
				</View>
				<Text
					className="text-muted-foreground text-sm"
					numberOfLines={1}
				>
					{item.subtitle}
				</Text>
			</View>
			<Icon as={ChevronRight} className="text-muted-foreground size-4" />
		</Pressable>
	);
}

export function PlanSearchResults({
	results,
	query,
	onSheetPress,
	onSchedulePress,
	onNotesPress,
}: PlanSearchResultsProps) {
	if (results.length === 0 && query.length >= 2) {
		return (
			<View className="flex-1 items-center justify-center py-20">
				<Text className="text-muted-foreground text-sm">
					No results for &quot;{query}&quot;
				</Text>
			</View>
		);
	}

	const handlePress = (item: PlanSearchResult) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		switch (item.type) {
			case "sheet":
				if (item.sheet) onSheetPress(item.sheet);
				break;
			case "schedule":
				if (item.region && item.entries)
					onSchedulePress(
						item.region,
						item.entries,
						item.sheetNumber,
					);
				break;
			case "notes":
				if (item.region)
					onNotesPress(item.region, item.sheetNumber);
				break;
		}
	};

	return (
		<FlatList
			data={results}
			keyExtractor={(item) => item.id}
			contentContainerClassName="px-4 pb-8"
			renderItem={({ item }) => (
				<SearchResultRow
					item={item}
					onPress={() => handlePress(item)}
				/>
			)}
		/>
	);
}
