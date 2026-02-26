import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Check, Copy, Eye } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { LayoutRegion } from "@/hooks/use-plan-info";

interface NotesDetailScreenProps {
	region: LayoutRegion;
	sheetNumber: string;
	isExtracting?: boolean;
	onBack: () => void;
	onViewOnSheet: (
		sheetId: string,
		bbox: { x: number; y: number; width: number; height: number },
	) => void;
}

interface NoteItem {
	number: number;
	text: string;
	subItems?: { letter: string; text: string }[];
}

interface ParsedNotes {
	noteType: string;
	title: string;
	items: NoteItem[];
}

function parseNotesContent(content: string | null): ParsedNotes | null {
	if (!content) return null;
	try {
		const parsed = JSON.parse(content);
		if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
			return parsed as ParsedNotes;
		}
	} catch {
		// not JSON
	}
	return null;
}

function getPlainText(content: string | null): string {
	if (!content) return "";
	const parsed = parseNotesContent(content);
	if (!parsed) return content;

	const lines: string[] = [];
	if (parsed.title) lines.push(parsed.title, "");
	for (const item of parsed.items) {
		lines.push(`${item.number}. ${item.text}`);
		if (item.subItems) {
			for (const sub of item.subItems) {
				lines.push(`   ${sub.letter}. ${sub.text}`);
			}
		}
	}
	return lines.join("\n");
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

export function NotesDetailScreen({
	region,
	sheetNumber,
	isExtracting = false,
	onBack,
	onViewOnSheet,
}: NotesDetailScreenProps) {
	const insets = useSafeAreaInsets();
	const [copied, setCopied] = React.useState(false);

	const parsed = React.useMemo(
		() => parseNotesContent(region.extractedContent),
		[region.extractedContent],
	);

	const badge = getConfidenceBadge(region.confidence);
	const title = region.regionTitle ?? region.regionClass;

	const handleCopy = async () => {
		const text = getPlainText(region.extractedContent);
		await Clipboard.setStringAsync(text);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
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
					>
						<Icon as={ArrowLeft} className="text-foreground size-5" />
					</Pressable>
					<Text className="text-foreground text-lg font-bold flex-shrink" numberOfLines={1}>
						{title}
					</Text>
				</View>
				<Pressable
					onPress={handleCopy}
					className="active:bg-muted/50 -m-2 rounded-full p-2 ml-2"
					hitSlop={8}
				>
					<Icon
						as={copied ? Check : Copy}
						className={copied ? "text-green-600 size-5" : "text-muted-foreground size-5"}
					/>
				</Pressable>
			</View>

			{/* Subtitle: sheet number + confidence */}
			<View className="flex-row items-center gap-2 px-4 pb-3">
				<Text className="text-muted-foreground text-sm">
					Sheet {sheetNumber}
				</Text>
				<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
					<Text style={{ color: badge.color }} className="text-xs font-medium">
						{Math.round(region.confidence * 100)}% {badge.label}
					</Text>
				</View>
			</View>

			{/* Notes content */}
			{!region.extractedContent ? (
				<View className="flex-1 items-center justify-center px-8 gap-3">
					{isExtracting ? (
						<>
							<ActivityIndicator />
							<Text className="text-muted-foreground text-center text-sm">
								Extracting notes content…
							</Text>
						</>
					) : (
						<Text className="text-muted-foreground text-center text-sm">
							No notes content extracted yet
						</Text>
					)}
				</View>
			) : parsed ? (
				<ScrollView
					className="flex-1"
					contentContainerClassName="px-4 pb-8"
				>
					{parsed.items.map((item) => (
						<View key={item.number} className="mb-4">
							<View className="flex-row">
								<Text className="text-foreground text-sm font-semibold w-8">
									{item.number}.
								</Text>
								<Text className="text-foreground text-sm flex-1 leading-5">
									{item.text}
								</Text>
							</View>
							{item.subItems?.map((sub) => (
								<View key={sub.letter} className="flex-row ml-8 mt-1.5">
									<Text className="text-foreground text-sm w-6">
										{sub.letter}.
									</Text>
									<Text className="text-foreground text-sm flex-1 leading-5">
										{sub.text}
									</Text>
								</View>
							))}
						</View>
					))}
				</ScrollView>
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="px-4 pb-8"
				>
					<Text className="text-foreground text-sm leading-5">
						{region.extractedContent}
					</Text>
				</ScrollView>
			)}

			{/* Bottom action */}
			<View
				className="border-border/50 border-t px-4 py-3"
				style={{ paddingBottom: insets.bottom + 12 }}
			>
				<Button onPress={handleViewOnSheet} className="h-12">
					<Icon as={Eye} className="text-primary-foreground size-5" />
					<Text className="text-primary-foreground text-base font-semibold">
						View on Sheet
					</Text>
				</Button>
			</View>
		</View>
	);
}
