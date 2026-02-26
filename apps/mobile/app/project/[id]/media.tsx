import { useLocalSearchParams } from "expo-router";
import { Camera } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";
import { PhotoTimeline } from "@/components/activity/photo-timeline";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { usePhotosTimeline } from "@/hooks/use-photos-timeline";
import { useRetryTranscription } from "@/hooks/use-retry-transcription";

export default function MediaScreen() {
	const { id: projectId } = useLocalSearchParams<{ id: string }>();

	const sections = usePhotosTimeline(projectId);
	const { retryTranscription, retryingIds } = useRetryTranscription();

	const handlePhotoPress = React.useCallback((_photoId: string) => {
		// TODO: Navigate to full-screen photo viewer
	}, []);

	return (
		<View className="bg-background flex-1">
			{sections.length > 0 ? (
				<PhotoTimeline
					sections={sections}
					onPhotoPress={handlePhotoPress}
					onRetryTranscription={retryTranscription}
					retryingIds={retryingIds}
				/>
			) : (
				<Empty className="flex-1">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon as={Camera} className="text-muted-foreground size-8" />
						</EmptyMedia>
						<EmptyTitle>No Media Yet</EmptyTitle>
						<EmptyDescription>
							Photos and recordings from this project will appear here as they
							are captured.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</View>
	);
}
