import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecordingState {
	isRecording: boolean;
	duration: number;
	uri: string | null;
	isTranscribing: boolean;
	transcript: string | null;
	transcriptionError: string | null;
}

export interface UseAudioRecorderReturn {
	state: AudioRecordingState;
	startRecording: () => Promise<void>;
	stopRecording: () => Promise<void>;
	deleteRecording: () => void;
	playRecording: () => Promise<void>;
	generateWaveform: (audioUri: string) => Promise<number[]>;
}

const MAX_RECORDING_DURATION = 60; // seconds
const BACKEND_URL =
	process.env.EXPO_PUBLIC_BETTER_AUTH_URL || "http://localhost:8787";

async function transcribeAudio(
	audioUri: string,
	sessionToken: string,
): Promise<string> {
	const formData = new FormData();
	formData.append("file", {
		uri: audioUri,
		name: "recording.m4a",
		type: "audio/m4a",
	} as unknown as Blob);

	const response = await fetch(`${BACKEND_URL}/api/voice-notes/transcribe`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${sessionToken}`,
		},
		body: formData,
	});

	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(
			body?.error ?? `Transcription failed (${response.status})`,
		);
	}

	const data = (await response.json()) as { transcription: string };
	return data.transcription;
}

export function useAudioRecorder(options?: {
	sessionToken?: string;
}): UseAudioRecorderReturn {
	const [isRecording, setIsRecording] = useState(false);
	const [duration, setDuration] = useState(0);
	const [uri, setUri] = useState<string | null>(null);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [transcript, setTranscript] = useState<string | null>(null);
	const [transcriptionError, setTranscriptionError] = useState<string | null>(
		null,
	);

	const recordingRef = useRef<Audio.Recording | null>(null);
	const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const sessionTokenRef = useRef(options?.sessionToken);
	sessionTokenRef.current = options?.sessionToken;

	useEffect(() => {
		return () => {
			if (durationIntervalRef.current) {
				clearInterval(durationIntervalRef.current);
			}
		};
	}, []);

	const startRecording = useCallback(async () => {
		try {
			await Audio.requestPermissionsAsync();
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: true,
				playsInSilentModeIOS: true,
			});

			const { recording } = await Audio.Recording.createAsync(
				Audio.RecordingOptionsPresets.HIGH_QUALITY,
			);

			recordingRef.current = recording;
			setIsRecording(true);
			setDuration(0);
			setUri(null);
			setTranscript(null);
			setTranscriptionError(null);

			// Start duration timer
			durationIntervalRef.current = setInterval(() => {
				setDuration((prev) => {
					const next = prev + 0.1;
					if (next >= MAX_RECORDING_DURATION) {
						stopRecording();
						return MAX_RECORDING_DURATION;
					}
					return next;
				});
			}, 100);

			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		} catch (error) {
			console.error("Error starting recording:", error);
		}
	}, []);

	const stopRecording = useCallback(async () => {
		if (!recordingRef.current) return;

		try {
			await recordingRef.current.stopAndUnloadAsync();
			const recordingUri = recordingRef.current.getURI();

			setIsRecording(false);
			setUri(recordingUri);

			if (durationIntervalRef.current) {
				clearInterval(durationIntervalRef.current);
				durationIntervalRef.current = null;
			}

			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

			// Transcribe via backend if session token is available
			const token = sessionTokenRef.current;
			if (recordingUri && token) {
				setIsTranscribing(true);
				setTranscriptionError(null);
				try {
					const text = await transcribeAudio(recordingUri, token);
					setTranscript(text);
				} catch (err) {
					console.error("[AudioRecorder] Transcription error:", err);
					setTranscriptionError(
						err instanceof Error ? err.message : "Transcription failed",
					);
				} finally {
					setIsTranscribing(false);
				}
			}
		} catch (error) {
			console.error("Error stopping recording:", error);
		}
	}, []);

	const deleteRecording = useCallback(() => {
		setUri(null);
		setDuration(0);
		setTranscript(null);
		setTranscriptionError(null);
		setIsTranscribing(false);
		if (recordingRef.current) {
			recordingRef.current = null;
		}
	}, []);

	const playRecording = useCallback(async () => {
		if (!uri) return;

		try {
			const { sound } = await Audio.Sound.createAsync({ uri });
			await sound.playAsync();

			sound.setOnPlaybackStatusUpdate((status) => {
				if (status.isLoaded && status.didJustFinish) {
					sound.unloadAsync();
				}
			});
		} catch (error) {
			console.error("Error playing recording:", error);
		}
	}, [uri]);

	const generateWaveform = useCallback(
		async (_audioUri: string): Promise<number[]> => {
			const bars = 20;
			return Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2);
		},
		[],
	);

	return {
		state: {
			isRecording,
			duration,
			uri,
			isTranscribing,
			transcript,
			transcriptionError,
		},
		startRecording,
		stopRecording,
		deleteRecording,
		playRecording,
		generateWaveform,
	};
}
