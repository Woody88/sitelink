import { Audio } from "expo-av";
import { AlertCircle, FileText, MapPin, Mic, Pause, Play, RefreshCw } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type {
	CalloutGroup as CalloutGroupType,
	TimelineSection,
} from "@/hooks/use-photos-timeline";
import { PhotoThumbnail } from "./photo-thumbnail";

interface PhotoTimelineProps {
	sections: TimelineSection[];
	onPhotoPress?: (photoId: string) => void;
	ListHeaderComponent?: React.ReactElement;
	onRetryTranscription?: (voiceNoteId: string, localPath: string) => void;
	retryingIds?: Set<string>;
}

const CalloutGroup = React.memo(function CalloutGroup({
	group,
	onPhotoPress,
	onRetryTranscription,
	retryingIds,
}: {
	group: CalloutGroupType;
	onPhotoPress?: (photoId: string) => void;
	onRetryTranscription?: (voiceNoteId: string, localPath: string) => void;
	retryingIds?: Set<string>;
}) {
	const hasIssues = group.photos.some((photo) => photo.isIssue);

	// Find the first voice note (with transcription or failed) across all photos in this group
	const groupVoiceNote = React.useMemo(() => {
		for (const photo of group.photos) {
			if (photo.voiceNoteDuration !== null) {
				const dur = photo.voiceNoteDuration ?? 0;
				const mins = Math.floor(dur / 60);
				const secs = dur % 60;
				return {
					voiceNoteId: photo.voiceNoteId,
					transcript: photo.voiceNoteTranscription,
					transcriptionStatus: photo.voiceNoteTranscriptionStatus,
					duration: `${mins}:${String(secs).padStart(2, "0")}`,
					audioUri: photo.voiceNoteAudioUri ?? photo.voiceNoteLocalPath,
					localPath: photo.voiceNoteLocalPath,
				};
			}
		}
		return null;
	}, [group.photos]);

	const [isPlaying, setIsPlaying] = React.useState(false);
	const soundRef = React.useRef<Audio.Sound | null>(null);

	React.useEffect(() => {
		return () => {
			soundRef.current?.unloadAsync();
		};
	}, []);

	const handlePlayPause = React.useCallback(async () => {
		if (!groupVoiceNote?.audioUri) return;
		if (isPlaying) {
			await soundRef.current?.pauseAsync();
			setIsPlaying(false);
			return;
		}
		try {
			if (!soundRef.current) {
				const { sound } = await Audio.Sound.createAsync(
					{ uri: groupVoiceNote.audioUri },
					{ shouldPlay: true },
				);
				soundRef.current = sound;
				sound.setOnPlaybackStatusUpdate((status) => {
					if (status.isLoaded && status.didJustFinish) {
						setIsPlaying(false);
						soundRef.current = null;
					}
				});
			} else {
				await soundRef.current.playAsync();
			}
			setIsPlaying(true);
		} catch (err) {
			console.error("[PhotoTimeline] Audio playback error:", err);
		}
	}, [groupVoiceNote?.audioUri, isPlaying]);

	const handleGenerateRFI = React.useCallback(() => {
		// TODO: Implement RFI generation
		console.log("Generate RFI for", group.markerLabel);
	}, [group.markerLabel]);

	return (
		<View className="py-4">
			<View className="mb-3 px-4">
				<View className="mb-2 flex-row items-center gap-2">
					<Icon as={MapPin} className="text-muted-foreground size-4" />
					<Text className="text-foreground text-sm font-semibold">
						{group.markerLabel}
					</Text>
					<Text className="text-muted-foreground text-xs">
						({group.photos.length} photos)
					</Text>
				</View>
				{hasIssues && (
					<Pressable
						onPress={handleGenerateRFI}
						className="bg-primary/10 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 active:opacity-70"
					>
						<Icon as={FileText} className="text-primary size-3.5" />
						<Text className="text-primary text-xs font-medium">
							Generate RFI
						</Text>
					</Pressable>
				)}
			</View>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="px-4 gap-3"
			>
				{group.photos.map((photo) => (
					<PhotoThumbnail
						key={photo.id}
						uri={photo.localPath}
						capturedAt={photo.capturedAt}
						isIssue={photo.isIssue}
						hasVoiceNote={photo.voiceNoteDuration !== null}
						onPress={() => onPhotoPress?.(photo.id)}
					/>
				))}
			</ScrollView>

			{/* Voice Note Display */}
			{groupVoiceNote && (
				<View className="mt-3 px-4">
					{groupVoiceNote.transcriptionStatus === "failed" ? (
						<View className="border-destructive/30 bg-destructive/10 flex-row items-center gap-2 rounded-lg border p-3">
							<Icon as={AlertCircle} className="text-destructive mt-0.5 size-4" />
							<View className="flex-1">
								<Text className="text-muted-foreground text-xs">
									{groupVoiceNote.duration} · Transcription failed
								</Text>
							</View>
							{groupVoiceNote.voiceNoteId && groupVoiceNote.localPath && onRetryTranscription && (
								<Pressable
									onPress={() =>
										onRetryTranscription(
											groupVoiceNote.voiceNoteId!,
											groupVoiceNote.localPath!,
										)
									}
									disabled={retryingIds?.has(groupVoiceNote.voiceNoteId!)}
									className="p-1 active:opacity-70 disabled:opacity-40"
								>
									{retryingIds?.has(groupVoiceNote.voiceNoteId!) ? (
										<ActivityIndicator size="small" />
									) : (
										<Icon as={RefreshCw} className="text-destructive size-4" />
									)}
								</Pressable>
							)}
						</View>
					) : groupVoiceNote.transcript ? (
						<View className="bg-muted/20 flex-row items-start gap-2 rounded-lg p-3">
							<Icon as={Mic} className="text-primary mt-0.5 size-4" />
							<View className="flex-1">
								<Text className="text-muted-foreground mb-1 text-xs">
									{groupVoiceNote.duration}
								</Text>
								<Text className="text-foreground text-sm leading-relaxed">
									&ldquo;{groupVoiceNote.transcript}&rdquo;
								</Text>
							</View>
							<Pressable
								onPress={groupVoiceNote.localPath ? handlePlayPause : undefined}
								disabled={!groupVoiceNote.localPath}
								className="p-1 active:opacity-70 disabled:opacity-40"
							>
								<Icon
									as={isPlaying ? Pause : Play}
									className="text-primary size-4"
								/>
							</Pressable>
						</View>
					) : null}
				</View>
			)}
		</View>
	);
});

export const PhotoTimeline = React.memo(function PhotoTimeline({
	sections,
	onPhotoPress,
	ListHeaderComponent,
	onRetryTranscription,
	retryingIds,
}: PhotoTimelineProps) {
	return (
		<SectionList
			sections={sections}
			stickySectionHeadersEnabled={false}
			ListHeaderComponent={ListHeaderComponent}
			keyExtractor={(item, index) => item.markerId + index}
			renderSectionHeader={({ section: { title } }) => (
				<View className="bg-background px-4 pt-6 pb-2">
					<Text className="text-foreground text-base font-bold">{title}</Text>
				</View>
			)}
			renderItem={({ item }) => (
				<CalloutGroup
					group={item}
					onPhotoPress={onPhotoPress}
					onRetryTranscription={onRetryTranscription}
					retryingIds={retryingIds}
				/>
			)}
			ItemSeparatorComponent={() => <Separator className="ml-4" />}
			contentContainerClassName="pb-12"
		/>
	);
});
