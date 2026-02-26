import { formatDistanceToNow } from "date-fns";
import {
	ChevronDown,
	ChevronUp,
	Edit3,
	ExternalLink,
	RefreshCcw,
	Sparkles,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { DailySummary } from "@/hooks/use-daily-summary";
import { cn } from "@/lib/utils";
import { PhotoThumbnail } from "./photo-thumbnail";

export interface SummaryPhotoDisplay {
	id: string;
	localPath: string;
	capturedAt: number;
	isIssue: boolean;
	voiceNoteDuration: number | null;
}

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
	photos?: SummaryPhotoDisplay[];
}

export const DailySummaryBanner = React.memo(function DailySummaryBanner({
	summary,
	isLoading,
	onGenerate,
	onShare,
	className,
	stats,
	photos,
}: DailySummaryBannerProps) {
	const [isCollapsed, setIsCollapsed] = React.useState(false);
	const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
	const [showEditDialog, setShowEditDialog] = React.useState(false);
	const [editText, setEditText] = React.useState("");
	const [editedSummaryText, setEditedSummaryText] = React.useState<string | null>(null);
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

	const baseText = summary?.text ?? buildDefaultSummary;
	const displayText = editedSummaryText ?? baseText;

	const lastGenerated = summary?.lastGenerated ?? new Date();

	// When a new summary is generated, clear any edited text
	React.useEffect(() => {
		if (summary) setEditedSummaryText(null);
	}, [summary]);

	const handleShare = React.useCallback(async () => {
		try {
			await Share.share({
				message: `Daily Summary\n\n${displayText}\n\n${!hasSummary ? "Default summary" : `Generated ${formatDistanceToNow(lastGenerated, { addSuffix: true })}`}`,
			});
			onShare?.();
		} catch (error) {
			console.error("Error sharing summary:", error);
		}
	}, [displayText, onShare, hasSummary, lastGenerated]);

	const handleGenerateClick = React.useCallback(() => {
		setShowConfirmDialog(true);
	}, []);

	const handleConfirmGenerate = React.useCallback(() => {
		setShowConfirmDialog(false);
		onGenerate();
	}, [onGenerate]);

	const handleEditOpen = React.useCallback(() => {
		setEditText(displayText);
		setShowEditDialog(true);
	}, [displayText]);

	const handleEditSave = React.useCallback(() => {
		setEditedSummaryText(editText.trim() || null);
		setShowEditDialog(false);
	}, [editText]);

	const hasPhotos = photos && photos.length > 0;

	return (
		<View
			className={cn(
				"border-border bg-muted/20 overflow-hidden rounded-none border",
				className,
			)}
		>
			{/* Title Bar */}
			<Pressable
				onPress={() => setIsCollapsed(!isCollapsed)}
				className="flex-row items-center justify-between p-4"
			>
				<View className="flex-1 flex-row items-center gap-2">
					<Icon as={Sparkles} className="text-foreground size-4" />
					<Text className="text-foreground text-base font-semibold">
						Today&apos;s Summary
					</Text>
					<Icon
						as={isCollapsed ? ChevronDown : ChevronUp}
						className="text-muted-foreground ml-1 size-4"
					/>
				</View>

				{!isCollapsed && hasSummary && (
					<View className="flex-row items-center gap-2">
						<Pressable
							onPress={handleEditOpen}
							className="bg-foreground/5 flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
							hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
						>
							<Icon as={Edit3} className="text-foreground size-4" />
							<Text className="text-foreground text-sm font-medium">Edit</Text>
						</Pressable>
						<Pressable
							onPress={handleShare}
							className="bg-foreground/5 flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
							hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
						>
							<Icon as={ExternalLink} className="text-foreground size-4" />
							<Text className="text-foreground text-sm font-medium">Share</Text>
						</Pressable>
					</View>
				)}
			</Pressable>

			{/* Content */}
			{!isCollapsed && (
				<View className="pb-4">
					<View className="bg-border mx-4 mb-4 h-px opacity-50" />
					{isLoading ? (
						<View className="gap-2 px-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-[90%]" />
							<Skeleton className="h-4 w-[95%]" />
							<Skeleton className="h-4 w-[60%]" />
						</View>
					) : (
						<View className="gap-3">
							{/* Photo Thumbnails Strip — shown only when AI summary exists */}
							{hasPhotos && hasSummary && (
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerClassName="px-4 gap-2 pb-1"
								>
									{photos.map((photo) => (
										<PhotoThumbnail
											key={photo.id}
											uri={photo.localPath}
											capturedAt={photo.capturedAt}
											isIssue={photo.isIssue}
											hasVoiceNote={photo.voiceNoteDuration !== null}
											className="h-16 w-16 rounded-md"
										/>
									))}
								</ScrollView>
							)}

							{/* Summary Text */}
							<View className="px-4">
								{!hasSummary ? (
									<View className="gap-2">
										{displayText.split("\n").map((line, index) => (
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
										{displayText}
									</Text>
								)}
								{editedSummaryText !== null && (
									<Text className="text-muted-foreground mt-1 text-xs">
										Edited
									</Text>
								)}
							</View>

							{/* Bottom Row: Timestamp + Generate/Regenerate */}
							<View className="mt-1 flex-row items-center justify-between px-4">
								{!hasSummary ? (
									<Text className="text-muted-foreground text-xs">
										Default summary
									</Text>
								) : (
									<Text className="text-muted-foreground text-xs">
										Generated{" "}
										{formatDistanceToNow(lastGenerated, {
											addSuffix: true,
										})}
									</Text>
								)}
								{hasSummary ? (
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
											Regenerate
										</Text>
									</Pressable>
								) : (
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
								)}
							</View>
						</View>
					)}
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
								{hasSummary ? "Regenerate Summary" : "Generate AI Summary"}
							</Text>
							<Pressable
								onPress={() => setShowConfirmDialog(false)}
								className="p-1"
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>
						<Text className="text-muted-foreground mb-6 text-sm leading-relaxed">
							{hasSummary
								? "Regenerate the AI summary from today's latest photos and voice notes. Your current edits will be reset."
								: "Generate a summary of today's progress and photos using AI."}
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
									{hasSummary ? "Regenerate" : "Generate"}
								</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			{/* Edit Summary Dialog */}
			<Modal
				visible={showEditDialog}
				transparent
				animationType="slide"
				onRequestClose={() => setShowEditDialog(false)}
			>
				<View className="flex-1 justify-end bg-black/50">
					<View className="bg-background border-border rounded-t-2xl border-t p-6">
						<View className="mb-4 flex-row items-center justify-between">
							<Text className="text-foreground text-lg font-bold">
								Edit Summary
							</Text>
							<Pressable
								onPress={() => setShowEditDialog(false)}
								className="p-1"
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>
						<TextInput
							value={editText}
							onChangeText={setEditText}
							multiline
							numberOfLines={10}
							className="border-border text-foreground mb-4 min-h-[200px] rounded-xl border p-3 text-sm leading-relaxed"
							style={{ textAlignVertical: "top" }}
							autoFocus
						/>
						<View className="flex-row gap-3">
							<Button
								variant="outline"
								onPress={() => setShowEditDialog(false)}
								className="flex-1"
							>
								<Text className="text-foreground font-medium">Cancel</Text>
							</Button>
							<Button onPress={handleEditSave} className="flex-1">
								<Text className="text-primary-foreground font-medium">
									Save
								</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
});
