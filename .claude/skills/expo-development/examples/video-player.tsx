import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

interface VideoPlayerProps {
	source: string;
	autoPlay?: boolean;
	loop?: boolean;
}

export function VideoPlayer({
	source,
	autoPlay = false,
	loop = false,
}: VideoPlayerProps) {
	const player = useVideoPlayer(source, (player) => {
		player.loop = loop;
		if (autoPlay) {
			player.play();
		}
	});

	const { isPlaying } = useEvent(player, "playingChange", {
		isPlaying: player.playing,
	});

	const handlePlayPause = () => {
		if (isPlaying) {
			player.pause();
		} else {
			player.play();
		}
	};

	const handleSeekForward = () => {
		player.seekBy(10);
	};

	const handleSeekBackward = () => {
		player.seekBy(-10);
	};

	const handleRestart = () => {
		player.currentTime = 0;
		player.play();
	};

	return (
		<View style={styles.container}>
			<VideoView
				style={styles.video}
				player={player}
				allowsFullscreen
				allowsPictureInPicture
			/>
			<View style={styles.controls}>
				<Button title="-10s" onPress={handleSeekBackward} />
				<Button
					title={isPlaying ? "Pause" : "Play"}
					onPress={handlePlayPause}
				/>
				<Button title="+10s" onPress={handleSeekForward} />
				<Button title="Restart" onPress={handleRestart} />
			</View>
		</View>
	);
}

// Advanced video player with more controls
export function AdvancedVideoPlayer({ source }: { source: string }) {
	const player = useVideoPlayer(source);

	const { status } = useEvent(player, "statusChange", {
		status: player.status,
	});

	const setVolume = (volume: number) => {
		player.volume = Math.max(0, Math.min(1, volume));
	};

	const setPlaybackRate = (rate: number) => {
		player.playbackRate = rate;
	};

	const toggleLoop = () => {
		player.loop = !player.loop;
	};

	return (
		<View style={styles.container}>
			<VideoView style={styles.video} player={player} allowsFullscreen />
			<Text>Status: {status}</Text>
			<View style={styles.controls}>
				<Button title="0.5x" onPress={() => setPlaybackRate(0.5)} />
				<Button title="1x" onPress={() => setPlaybackRate(1)} />
				<Button title="1.5x" onPress={() => setPlaybackRate(1.5)} />
				<Button title="2x" onPress={() => setPlaybackRate(2)} />
			</View>
			<View style={styles.controls}>
				<Button title="Mute" onPress={() => setVolume(0)} />
				<Button title="50%" onPress={() => setVolume(0.5)} />
				<Button title="100%" onPress={() => setVolume(1)} />
				<Button title="Toggle Loop" onPress={toggleLoop} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	video: {
		width: "100%",
		height: 300,
	},
	controls: {
		flexDirection: "row",
		justifyContent: "space-around",
		width: "100%",
		marginTop: 10,
	},
});
