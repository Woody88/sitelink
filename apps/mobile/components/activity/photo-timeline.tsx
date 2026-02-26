import { FileText, MapPin, Mic, Play } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, SectionList, View } from "react-native";
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
}

const CalloutGroup = React.memo(function CalloutGroup({
	group,
	onPhotoPress,
}: {
	group: CalloutGroupType;
	onPhotoPress?: (photoId: string) => void;
}) {
	const hasIssues = group.photos.some((photo) => photo.isIssue);
	const hasVoiceNotes = group.photos.some(
		(photo) => (photo as any).hasVoiceNote,
	);

	const handleGenerateRFI = React.useCallback(() => {
		// TODO: Implement RFI generation
		console.log("Generate RFI for", group.markerLabel);
	}, [group.markerLabel]);

	// Mock voice note data - in real app, this would come from the photo data
	const mockVoiceNote = hasVoiceNotes
		? {
				transcript:
					"Junction box needs to move about six inches to the left to clear the conduit run",
				duration: "0:15",
			}
		: null;

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
						hasVoiceNote={(photo as any).hasVoiceNote || photo.id === "p2"}
						onPress={() => onPhotoPress?.(photo.id)}
					/>
				))}
			</ScrollView>

			{/* Voice Note Display */}
			{mockVoiceNote && (
				<View className="mt-3 px-4">
					<View className="bg-muted/20 flex-row items-start gap-2 rounded-lg p-3">
						<Icon as={Mic} className="text-primary mt-0.5 size-4" />
						<View className="flex-1">
							<Text className="text-muted-foreground mb-1 text-xs">
								{mockVoiceNote.duration}
							</Text>
							<Text className="text-foreground text-sm leading-relaxed">
								&ldquo;{mockVoiceNote.transcript}&rdquo;
							</Text>
						</View>
						<Pressable className="p-1">
							<Icon as={Play} className="text-primary size-4" />
						</Pressable>
					</View>
				</View>
			)}
		</View>
	);
});

export const PhotoTimeline = React.memo(function PhotoTimeline({
	sections,
	onPhotoPress,
	ListHeaderComponent,
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
				<CalloutGroup group={item} onPhotoPress={onPhotoPress} />
			)}
			ItemSeparatorComponent={() => <Separator className="ml-4" />}
			contentContainerClassName="pb-12"
		/>
	);
});
