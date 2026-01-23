import {
	RecordingPresets,
	setAudioModeAsync,
	useAudioPlayer,
	useAudioRecorder,
} from "expo-audio";
import React, { useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";

export function AudioRecorder() {
	const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
	const [recordingUri, setRecordingUri] = useState<string | null>(null);

	const startRecording = async () => {
		try {
			await setAudioModeAsync({
				allowsRecording: true,
				playsInSilentMode: true,
			});

			await recorder.prepareToRecordAsync();
			recorder.record();
		} catch (error) {
			console.error("Failed to start recording:", error);
			Alert.alert("Error", "Failed to start recording");
		}
	};

	const stopRecording = async () => {
		try {
			await recorder.stop();
			const uri = recorder.uri;
			if (uri) {
				setRecordingUri(uri);
				console.log("Recording saved to:", uri);
			}
		} catch (error) {
			console.error("Failed to stop recording:", error);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.status}>
				{recorder.isRecording ? "Recording..." : "Ready"}
			</Text>

			<Button
				title={recorder.isRecording ? "Stop Recording" : "Start Recording"}
				onPress={recorder.isRecording ? stopRecording : startRecording}
			/>

			{recordingUri && (
				<View style={styles.playbackSection}>
					<Text>Recording saved!</Text>
					<RecordingPlayback uri={recordingUri} />
				</View>
			)}
		</View>
	);
}

// Separate component for playback
function RecordingPlayback({ uri }: { uri: string }) {
	const player = useAudioPlayer(uri);

	const handlePlay = () => {
		player.seekTo(0);
		player.play();
	};

	return (
		<Button
			title={player.playing ? "Playing..." : "Play Recording"}
			onPress={handlePlay}
			disabled={player.playing}
		/>
	);
}

// Recording with duration display
export function AudioRecorderWithDuration() {
	const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
	const [duration, setDuration] = useState(0);
	const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

	const startRecording = async () => {
		await setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
		});

		await recorder.prepareToRecordAsync();
		recorder.record();

		const id = setInterval(() => {
			setDuration((prev) => prev + 1);
		}, 1000);
		setIntervalId(id);
	};

	const stopRecording = async () => {
		await recorder.stop();
		if (intervalId) {
			clearInterval(intervalId);
			setIntervalId(null);
		}
	};

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const reset = () => {
		setDuration(0);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.duration}>{formatDuration(duration)}</Text>

			<View style={styles.controls}>
				<Button
					title={recorder.isRecording ? "Stop" : "Record"}
					onPress={recorder.isRecording ? stopRecording : startRecording}
				/>
				<Button title="Reset" onPress={reset} disabled={recorder.isRecording} />
			</View>

			{recorder.uri && !recorder.isRecording && (
				<Text style={styles.uri}>Saved to: {recorder.uri}</Text>
			)}
		</View>
	);
}

// Low quality recording for voice memos
export function VoiceMemoRecorder() {
	const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
	const [memos, setMemos] = useState<string[]>([]);

	const startRecording = async () => {
		await setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
		});
		await recorder.prepareToRecordAsync();
		recorder.record();
	};

	const stopRecording = async () => {
		await recorder.stop();
		if (recorder.uri) {
			setMemos((prev) => [...prev, recorder.uri!]);
		}
	};

	return (
		<View style={styles.container}>
			<Button
				title={recorder.isRecording ? "Stop" : "New Memo"}
				onPress={recorder.isRecording ? stopRecording : startRecording}
			/>

			<Text style={styles.memoCount}>{memos.length} memos recorded</Text>

			{memos.map((uri, index) => (
				<View key={index} style={styles.memoItem}>
					<Text>Memo {index + 1}</Text>
					<MemoPlayer uri={uri} />
				</View>
			))}
		</View>
	);
}

function MemoPlayer({ uri }: { uri: string }) {
	const player = useAudioPlayer(uri);

	return (
		<Button
			title={player.playing ? "Playing" : "Play"}
			onPress={() => {
				player.seekTo(0);
				player.play();
			}}
		/>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
		alignItems: "center",
	},
	status: {
		fontSize: 18,
		marginBottom: 20,
	},
	duration: {
		fontSize: 48,
		fontVariant: ["tabular-nums"],
		marginBottom: 20,
	},
	controls: {
		flexDirection: "row",
		gap: 10,
	},
	playbackSection: {
		marginTop: 20,
		alignItems: "center",
	},
	uri: {
		fontSize: 12,
		color: "#666",
		marginTop: 10,
	},
	memoCount: {
		marginVertical: 10,
	},
	memoItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		marginVertical: 5,
	},
});
