import { events } from "@sitelink/domain";
import { useCallback, useState } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

const BACKEND_URL =
	process.env.EXPO_PUBLIC_BETTER_AUTH_URL || "http://localhost:8787";

export function useRetryTranscription() {
	const { sessionToken, organizationId, sessionId } = useSessionContext();
	const store = useAppStore(organizationId!, sessionToken, sessionId);
	const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

	const retryTranscription = useCallback(
		async (voiceNoteId: string, localPath: string) => {
			if (!sessionToken || !store) return;

			setRetryingIds((prev) => new Set(prev).add(voiceNoteId));
			try {
				const formData = new FormData();
				formData.append("file", {
					uri: localPath,
					name: "recording.m4a",
					type: "audio/m4a",
				} as unknown as Blob);

				const response = await fetch(
					`${BACKEND_URL}/api/voice-notes/transcribe`,
					{
						method: "POST",
						headers: { Authorization: `Bearer ${sessionToken}` },
						body: formData,
					},
				);

				if (!response.ok) {
					const body = (await response.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(
						body?.error ?? `Transcription failed (${response.status})`,
					);
				}

				const data = (await response.json()) as { transcription: string };
				await store.commit(
					events.voiceNoteTranscribed({
						voiceNoteId,
						transcription: data.transcription,
					}),
				);
			} catch (err) {
				console.error("[RetryTranscription] Failed:", err);
				await store.commit(
					events.voiceNoteTranscriptionFailed({
						voiceNoteId,
						error: err instanceof Error ? err.message : "Transcription failed",
					}),
				);
			} finally {
				setRetryingIds((prev) => {
					const next = new Set(prev);
					next.delete(voiceNoteId);
					return next;
				});
			}
		},
		[sessionToken, store],
	);

	return { retryTranscription, retryingIds };
}
