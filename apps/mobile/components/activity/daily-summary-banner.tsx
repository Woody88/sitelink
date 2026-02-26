import { formatDistanceToNow } from "date-fns";
import {
	ChevronDown,
	ChevronUp,
	ExternalLink,
	RefreshCcw,
	Sparkles,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, Share, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { DailySummary } from "@/hooks/use-daily-summary";
import { cn } from "@/lib/utils";

interface DailySummaryBannerProps {
	summary: DailySummary | null;
	isLoading: boolean;
	onGenerate: () => void;
	onShare?: () => void;
	className?: string;
	stats?: {
		photoCount: number;
		voiceNoteCount: number;
		issueCount: number;
	};
}

export const DailySummaryBanner = React.memo(function DailySummaryBanner({
	summary,
	isLoading,
	onGenerate,
	onShare,
	className,
	stats,
}: DailySummaryBannerProps) {
	const [isCollapsed, setIsCollapsed] = React.useState(false);
	const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
	const hasSummary = !!summary;

	// Build default summary from stats - always show counts, even if zero
	const buildDefaultSummary = React.useMemo(() => {
		const photoCount = stats?.photoCount ?? 0;
		const voiceNoteCount = stats?.voiceNoteCount ?? 0;
		const issueCount = stats?.issueCount ?? 0;

		const lines = [
			`📷 ${photoCount} photo${photoCount !== 1 ? "s" : ""} captured`,
			`🎤 ${voiceNoteCount} voice note${voiceNoteCount !== 1 ? "s" : ""}`,
			`⚠️ ${issueCount} issue${issueCount !== 1 ? "s" : ""} flagged`,
		];
		return lines.join("\n");
	}, [stats]);

	const displaySummary = summary || {
		text: buildDefaultSummary,
		lastGenerated: new Date(),
	};

	const handleShare = React.useCallback(async () => {
		if (!displaySummary) return;

		try {
			await Share.share({
				message: `Daily Summary\n\n${displaySummary.text}\n\n${!hasSummary ? "Default summary" : `Generated ${formatDistanceToNow(displaySummary.lastGenerated, { addSuffix: true })}`}`,
			});
			onShare?.();
		} catch (error) {
			console.error("Error sharing summary:", error);
		}
	}, [displaySummary, onShare, hasSummary]);

	const handleGenerateClick = React.useCallback(() => {
		setShowConfirmDialog(true);
	}, []);

	const handleConfirmGenerate = React.useCallback(() => {
		setShowConfirmDialog(false);
		onGenerate();
	}, [onGenerate]);

	return (
		<View
			className={cn(
				"border-border bg-muted/20 overflow-hidden rounded-none border",
				className,
			)}
		>
			{/* Title Bar */}
			<Pressable
				onPress={() => displaySummary && setIsCollapsed(!isCollapsed)}
				className="flex-row items-center justify-between p-4"
				disabled={!displaySummary}
			>
				<View className="flex-1 flex-row items-center gap-2">
					<Icon as={Sparkles} className="text-foreground size-4" />
					<Text className="text-foreground text-base font-semibold">
						Today&apos;s Summary
					</Text>
					{displaySummary && (
						<Icon
							as={isCollapsed ? ChevronDown : ChevronUp}
							className="text-muted-foreground ml-1 size-4"
						/>
					)}
				</View>

				{displaySummary && !isCollapsed && hasSummary && (
					<Pressable
						onPress={handleShare}
						className="bg-foreground/5 flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
						hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
					>
						<Icon as={ExternalLink} className="text-foreground size-4" />
						<Text className="text-foreground text-sm font-medium">Share</Text>
					</Pressable>
				)}
			</Pressable>

			{/* Content */}
			{!isCollapsed && (
				<View className="px-4 pb-4">
					<View className="bg-border mb-4 h-px opacity-50" />
					{isLoading ? (
						<View className="gap-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-[90%]" />
							<Skeleton className="h-4 w-[95%]" />
							<Skeleton className="h-4 w-[60%]" />
						</View>
					) : displaySummary ? (
						<View className="gap-3">
							{!hasSummary && buildDefaultSummary ? (
								<View className="gap-2">
									{displaySummary.text.split("\n").map((line, index) => (
										<Text
											key={index}
											className="text-foreground text-sm leading-relaxed"
										>
											{line}
										</Text>
									))}
								</View>
							) : (
								<Text className="text-foreground text-sm leading-relaxed">
									{displaySummary.text}
								</Text>
							)}
							<View className="mt-1 flex-row items-center justify-between">
								{!hasSummary ? (
									<Text className="text-muted-foreground text-xs">
										Default summary
									</Text>
								) : (
									<Text className="text-muted-foreground text-xs">
										Generated{" "}
										{formatDistanceToNow(displaySummary.lastGenerated, {
											addSuffix: true,
										})}
									</Text>
								)}
								{hasSummary && (
									<Pressable
										onPress={handleGenerateClick}
										disabled={isLoading}
										className="flex-row items-center gap-1.5 p-1 active:opacity-70"
										hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
									>
										<Icon
											as={RefreshCcw}
											className={cn(
												"text-muted-foreground size-3.5",
												isLoading && "animate-spin",
											)}
										/>
										<Text className="text-muted-foreground text-xs">
											Refresh
										</Text>
									</Pressable>
								)}
							</View>
							{!hasSummary && (
								<View className="mt-2 flex-row justify-end">
									<Pressable
										onPress={handleGenerateClick}
										disabled={isLoading}
										className="bg-foreground flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80"
									>
										<Icon
											as={Sparkles}
											className={cn(
												"text-background size-4",
												isLoading && "animate-spin",
											)}
										/>
										<Text className="text-background text-sm font-semibold">
											Generate Summary
										</Text>
									</Pressable>
								</View>
							)}
						</View>
					) : null}
				</View>
			)}

			{/* Confirmation Dialog */}
			<Modal
				visible={showConfirmDialog}
				transparent
				animationType="fade"
				onRequestClose={() => setShowConfirmDialog(false)}
			>
				<View className="flex-1 items-center justify-center bg-black/50 p-4">
					<View className="bg-background border-border w-full max-w-sm rounded-xl border p-6">
						<View className="mb-4 flex-row items-center justify-between">
							<Text className="text-foreground text-lg font-bold">
								Generate AI Summary
							</Text>
							<Pressable
								onPress={() => setShowConfirmDialog(false)}
								className="p-1"
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>
						<Text className="text-muted-foreground mb-6 text-sm leading-relaxed">
							Generate a summary of today&apos;s progress and photos using AI.
						</Text>
						<View className="flex-row gap-3">
							<Button
								variant="outline"
								onPress={() => setShowConfirmDialog(false)}
								className="flex-1"
							>
								<Text className="text-foreground font-medium">Cancel</Text>
							</Button>
							<Button
								onPress={handleConfirmGenerate}
								disabled={isLoading}
								className="flex-1"
							>
								<Text className="text-primary-foreground font-medium">
									Generate
								</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
});
