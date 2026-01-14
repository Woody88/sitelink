import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecordingState {
	isRecording: boolean;
	duration: number;
	uri: string | null;
	isTranscribing: boolean;
	transcript: string | null;
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

export function useAudioRecorder(): UseAudioRecorderReturn {
	const [isRecording, setIsRecording] = useState(false);
	const [duration, setDuration] = useState(0);
	const [uri, setUri] = useState<string | null>(null);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [transcript, setTranscript] = useState<string | null>(null);

	const recordingRef = useRef<Audio.Recording | null>(null);
	const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);

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
			const uri = recordingRef.current.getURI();

			setIsRecording(false);
			setUri(uri);

			if (durationIntervalRef.current) {
				clearInterval(durationIntervalRef.current);
				durationIntervalRef.current = null;
			}

			// Trigger transcription (mock for now)
			setIsTranscribing(true);
			// TODO: Integrate with Whisper API
			setTimeout(() => {
				setTranscript(
					"Mock transcription: Junction box needs to move about six inches to the left to clear the conduit run",
				);
				setIsTranscribing(false);
			}, 2000);

			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		} catch (error) {
			console.error("Error stopping recording:", error);
		}
	}, []);

	const deleteRecording = useCallback(() => {
		setUri(null);
		setDuration(0);
		setTranscript(null);
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
		async (audioUri: string): Promise<number[]> => {
			// Mock waveform data - in production, use a library like wavesurfer.js or similar
			// For now, generate random waveform bars for visualization
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
		},
		startRecording,
		stopRecording,
		deleteRecording,
		playRecording,
		generateWaveform,
	};
}
