import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { format, isToday, isYesterday } from "date-fns";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL || "http://localhost:8787";

export interface PhotoWithMarker {
	id: string;
	projectId: string;
	markerId: string | null;
	markerLabel: string | null;
	localPath: string;
	remotePath: string | null;
	isIssue: boolean;
	capturedAt: number;
	capturedBy: string;
	voiceNoteTranscription: string | null;
	voiceNoteDuration: number | null;
	voiceNoteLocalPath: string | null;
	/** Best available URI for audio playback: remote R2 URL if available, local path otherwise */
	voiceNoteAudioUri: string | null;
}

export interface TimelineSection {
	title: string;
	data: CalloutGroup[];
}

export interface CalloutGroup {
	markerId: string | "unlinked";
	markerLabel: string;
	photos: PhotoWithMarker[];
}

export function usePhotosTimeline(projectId: string) {
	const { sessionToken, organizationId, sessionId } = useSessionContext();

	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const photos = store.useQuery(
		queryDb(tables.photos.where({ projectId }).orderBy("capturedAt", "desc")),
	);

	const markers = store.useQuery(queryDb(tables.markers));

	const voiceNotes = store.useQuery(queryDb(tables.voiceNotes));

	return useMemo(() => {
		const token = sessionToken;
		// Ensure we have an array to work with
		const photosArray = Array.isArray(photos) ? photos : [];
		const markersArray = Array.isArray(markers) ? markers : [];
		const voiceNotesArray = Array.isArray(voiceNotes) ? voiceNotes : [];

		// Map markers for quick lookup
		const markerMap = new Map(markersArray.map((m) => [m.id, m.label]));

		// Map photoId → voice note for quick lookup (first voice note per photo)
		const voiceNoteMap = new Map<
			string,
			{
				transcription: string | null;
				durationSeconds: number;
				localPath: string;
				remotePath: string | null;
				audioUri: string;
			}
		>();
		voiceNotesArray.forEach((vn) => {
			if (!voiceNoteMap.has(vn.photoId)) {
				// Build best audio URI: prefer remote R2 URL with auth token, fall back to local
				const audioUri = vn.remotePath && token
					? `${BACKEND_URL}/api/r2/${vn.remotePath}?st=${token}`
					: vn.localPath;
				voiceNoteMap.set(vn.photoId, {
					transcription: vn.transcription ?? null,
					durationSeconds: vn.durationSeconds,
					localPath: vn.localPath,
					remotePath: vn.remotePath ?? null,
					audioUri,
				});
			}
		});

		// Group by date primary
		const groupedByDate: Record<string, PhotoWithMarker[]> = {};

		photosArray.forEach((photo) => {
			const date = new Date(photo.capturedAt);
			let dateKey = format(date, "yyyy-MM-dd");

			if (isToday(date)) dateKey = "Today";
			else if (isYesterday(date)) dateKey = "Yesterday";
			else dateKey = format(date, "MMMM d, yyyy");

			if (!groupedByDate[dateKey]) {
				groupedByDate[dateKey] = [];
			}

			const voiceNote = voiceNoteMap.get(photo.id);
			groupedByDate[dateKey].push({
				...photo,
				markerLabel: photo.markerId
					? (markerMap.get(photo.markerId) ?? "Unknown Callout")
					: null,
				voiceNoteTranscription: voiceNote?.transcription ?? null,
				voiceNoteDuration: voiceNote?.durationSeconds ?? null,
				voiceNoteLocalPath: voiceNote?.localPath ?? null,
				voiceNoteAudioUri: voiceNote?.audioUri ?? null,
			});
		});

		// Group by callout secondary within each date
		const sections: TimelineSection[] = Object.entries(groupedByDate).map(
			([dateTitle, datePhotos]) => {
				const groupedByCallout: Record<string, CalloutGroup> = {};

				datePhotos.forEach((photo) => {
					const markerId = photo.markerId ?? "unlinked";
					const markerLabel = photo.markerLabel ?? "General / Unlinked";

					if (!groupedByCallout[markerId]) {
						groupedByCallout[markerId] = {
							markerId,
							markerLabel,
							photos: [],
						};
					}
					groupedByCallout[markerId].photos.push(photo);
				});

				return {
					title: dateTitle,
					data: Object.values(groupedByCallout),
				};
			},
		);

		return sections;
	}, [photos, markers, voiceNotes, sessionToken]);
}
