import { Eye, X } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type { ScheduleEntry } from "@/hooks/use-plan-info";

interface ScheduleRowDetailProps {
	entry: ScheduleEntry | null;
	visible: boolean;
	scheduleName: string;
	sheetNumber: string;
	onClose: () => void;
	onViewOnSheet: () => void;
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

function getConfidenceColor(confidence: number) {
	if (confidence >= 0.9) return "#16a34a";
	if (confidence >= 0.8) return "#ca8a04";
	return "#ea580c";
}

export function ScheduleRowDetail({
	entry,
	visible,
	scheduleName,
	sheetNumber,
	onClose,
	onViewOnSheet,
}: ScheduleRowDetailProps) {
	const insets = useSafeAreaInsets();

	if (!entry) return null;

	const props = parseProperties(entry.properties);
	const confidenceColor = getConfidenceColor(entry.confidence);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<Pressable className="flex-1 bg-black/50" onPress={onClose}>
				<View className="flex-1" />

				<Animated.View
					entering={SlideInDown.springify().damping(20).stiffness(200)}
					className="bg-card rounded-t-3xl"
					style={{ paddingBottom: insets.bottom + 16 }}
				>
					<Pressable>
						{/* Handle */}
						<View className="items-center py-3">
							<View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
						</View>

						{/* Header */}
						<View className="flex-row items-start justify-between px-6 pb-4">
							<View className="flex-1">
								<Text className="text-foreground text-2xl font-bold">
									{entry.mark}
								</Text>
								<Text className="text-muted-foreground text-sm">
									{scheduleName}
								</Text>
							</View>
							<Pressable
								onPress={onClose}
								className="active:bg-muted/50 -m-2 rounded-full p-2"
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>

						<Separator className="mx-6 mb-4" />

						{/* Properties */}
						<View className="gap-3 px-6 pb-4">
							{Object.entries(props).map(([key, value]) => (
								<View key={key}>
									<Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
										{formatLabel(key)}
									</Text>
									<Text className="text-foreground mt-0.5 text-base">
										{value || "\u2014"}
									</Text>
								</View>
							))}
						</View>

						<Separator className="mx-6 mb-4" />

						{/* Source info */}
						<View className="gap-1.5 px-6 pb-6">
							<Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
								Source
							</Text>
							<Text className="text-foreground text-sm">
								{scheduleName}, Sheet {sheetNumber}
							</Text>
							<View className="flex-row items-center gap-1.5">
								<Text className="text-muted-foreground text-sm">Confidence:</Text>
								<Text style={{ color: confidenceColor }} className="text-sm font-semibold">
									{Math.round(entry.confidence * 100)}%
								</Text>
							</View>
						</View>

						{/* View on Sheet button */}
						<View className="px-6">
							<Button
								onPress={() => {
									onViewOnSheet();
									onClose();
								}}
								className="h-12"
							>
								<Icon as={Eye} className="text-primary-foreground size-5" />
								<Text className="text-primary-foreground text-base font-semibold">
									View on Sheet
								</Text>
							</Button>
						</View>
					</Pressable>
				</Animated.View>
			</Pressable>
		</Modal>
	);
}
