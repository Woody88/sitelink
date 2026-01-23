import { type AudioSource, useAudioPlayer } from "expo-audio";
import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

interface AudioPlayerProps {
	source: AudioSource;
}

export function AudioPlayer({ source }: AudioPlayerProps) {
	const player = useAudioPlayer(source);

	const handlePlayPause = () => {
		if (player.playing) {
			player.pause();
		} else {
			player.play();
		}
	};

	const handleReplay = () => {
		player.seekTo(0);
		player.play();
	};

	const handleSeekForward = () => {
		const newTime = player.currentTime + 10;
		player.seekTo(Math.min(newTime, player.duration));
	};

	const handleSeekBackward = () => {
		const newTime = player.currentTime - 10;
		player.seekTo(Math.max(newTime, 0));
	};

	return (
		<View style={styles.container}>
			<Text style={styles.status}>{player.playing ? "Playing" : "Paused"}</Text>
			<View style={styles.controls}>
				<Button title="-10s" onPress={handleSeekBackward} />
				<Button
					title={player.playing ? "Pause" : "Play"}
					onPress={handlePlayPause}
				/>
				<Button title="+10s" onPress={handleSeekForward} />
			</View>
			<Button title="Replay" onPress={handleReplay} />
		</View>
	);
}

// Audio player with progress tracking
export function AudioPlayerWithProgress({ source }: AudioPlayerProps) {
	const player = useAudioPlayer(source);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			if (player.duration > 0) {
				setProgress((player.currentTime / player.duration) * 100);
			}
		}, 100);

		return () => clearInterval(interval);
	}, [player]);

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const seekToPercent = (percent: number) => {
		const time = (percent / 100) * player.duration;
		player.seekTo(time);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.time}>
				{formatTime(player.currentTime)} / {formatTime(player.duration)}
			</Text>
			<View style={styles.progressBar}>
				<View style={[styles.progressFill, { width: `${progress}%` }]} />
			</View>
			<View style={styles.controls}>
				<Button title="0%" onPress={() => seekToPercent(0)} />
				<Button title="25%" onPress={() => seekToPercent(25)} />
				<Button title="50%" onPress={() => seekToPercent(50)} />
				<Button title="75%" onPress={() => seekToPercent(75)} />
			</View>
			<Button
				title={player.playing ? "Pause" : "Play"}
				onPress={() => (player.playing ? player.pause() : player.play())}
			/>
		</View>
	);
}

// Volume control example
export function AudioPlayerWithVolume({ source }: AudioPlayerProps) {
	const player = useAudioPlayer(source);
	const [volume, setVolumeState] = useState(1);

	const setVolume = (newVolume: number) => {
		const clampedVolume = Math.max(0, Math.min(1, newVolume));
		player.volume = clampedVolume;
		setVolumeState(clampedVolume);
	};

	return (
		<View style={styles.container}>
			<Text>Volume: {Math.round(volume * 100)}%</Text>
			<View style={styles.controls}>
				<Button title="Mute" onPress={() => setVolume(0)} />
				<Button title="25%" onPress={() => setVolume(0.25)} />
				<Button title="50%" onPress={() => setVolume(0.5)} />
				<Button title="75%" onPress={() => setVolume(0.75)} />
				<Button title="100%" onPress={() => setVolume(1)} />
			</View>
			<Button
				title={player.playing ? "Pause" : "Play"}
				onPress={() => (player.playing ? player.pause() : player.play())}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
		alignItems: "center",
	},
	status: {
		fontSize: 18,
		marginBottom: 10,
	},
	time: {
		fontSize: 16,
		marginBottom: 10,
	},
	controls: {
		flexDirection: "row",
		justifyContent: "space-around",
		width: "100%",
		marginVertical: 10,
	},
	progressBar: {
		width: "100%",
		height: 10,
		backgroundColor: "#ddd",
		borderRadius: 5,
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
		backgroundColor: "#007AFF",
	},
});
