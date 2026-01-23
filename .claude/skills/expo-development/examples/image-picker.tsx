import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
	Alert,
	Button,
	Image,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

// Basic image picker
export function BasicImagePicker() {
	const [imageUri, setImageUri] = useState<string | null>(null);

	const pickImage = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [4, 3],
			quality: 1,
		});

		if (!result.canceled) {
			setImageUri(result.assets[0].uri);
		}
	};

	return (
		<View style={styles.container}>
			<Button title="Pick an image" onPress={pickImage} />
			{imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
		</View>
	);
}

// Video picker
export function VideoPicker() {
	const [videoUri, setVideoUri] = useState<string | null>(null);
	const [duration, setDuration] = useState<number | null>(null);

	const pickVideo = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["videos"],
			videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
		});

		if (!result.canceled) {
			setVideoUri(result.assets[0].uri);
			setDuration(result.assets[0].duration ?? null);
		}
	};

	return (
		<View style={styles.container}>
			<Button title="Pick a video" onPress={pickVideo} />
			{videoUri && (
				<View>
					<Text>Video selected!</Text>
					{duration && <Text>Duration: {Math.round(duration / 1000)}s</Text>}
				</View>
			)}
		</View>
	);
}

// Multiple selection
export function MultipleImagePicker() {
	const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

	const pickImages = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images", "videos"],
			allowsMultipleSelection: true,
			selectionLimit: 0, // 0 = unlimited
		});

		if (!result.canceled) {
			setImages(result.assets);
		}
	};

	return (
		<View style={styles.container}>
			<Button title="Pick multiple" onPress={pickImages} />
			<Text>{images.length} items selected</Text>
			<ScrollView horizontal style={styles.imageRow}>
				{images.map((asset, index) => (
					<Image
						key={index}
						source={{ uri: asset.uri }}
						style={styles.thumbnail}
					/>
				))}
			</ScrollView>
		</View>
	);
}

// Camera capture
export function CameraCapture() {
	const [imageUri, setImageUri] = useState<string | null>(null);

	const takePhoto = async () => {
		const { status } = await ImagePicker.requestCameraPermissionsAsync();
		if (status !== "granted") {
			Alert.alert("Permission required", "Camera permission is needed");
			return;
		}

		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			quality: 0.8,
		});

		if (!result.canceled) {
			setImageUri(result.assets[0].uri);
		}
	};

	const recordVideo = async () => {
		const { status } = await ImagePicker.requestCameraPermissionsAsync();
		if (status !== "granted") {
			Alert.alert("Permission required", "Camera permission is needed");
			return;
		}

		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: ["videos"],
			videoMaxDuration: 60, // 60 seconds max
		});

		if (!result.canceled) {
			console.log("Video recorded:", result.assets[0].uri);
		}
	};

	return (
		<View style={styles.container}>
			<Button title="Take Photo" onPress={takePhoto} />
			<Button title="Record Video" onPress={recordVideo} />
			{imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
		</View>
	);
}

// With permissions check
export function ImagePickerWithPermissions() {
	const [imageUri, setImageUri] = useState<string | null>(null);

	const requestPermission = async (): Promise<boolean> => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			Alert.alert(
				"Permission Required",
				"Please grant media library access to pick images",
			);
			return false;
		}
		return true;
	};

	const pickImage = async () => {
		const hasPermission = await requestPermission();
		if (!hasPermission) return;

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 1,
		});

		if (!result.canceled) {
			setImageUri(result.assets[0].uri);
		}
	};

	return (
		<View style={styles.container}>
			<Button title="Pick Image" onPress={pickImage} />
			{imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
		</View>
	);
}

// Get image dimensions and EXIF
export function ImagePickerWithMetadata() {
	const [metadata, setMetadata] = useState<{
		width: number;
		height: number;
		fileSize?: number;
		exif?: Record<string, unknown>;
	} | null>(null);

	const pickImage = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			exif: true,
		});

		if (!result.canceled) {
			const asset = result.assets[0];
			setMetadata({
				width: asset.width,
				height: asset.height,
				fileSize: asset.fileSize,
				exif: asset.exif,
			});
		}
	};

	return (
		<View style={styles.container}>
			<Button title="Pick Image" onPress={pickImage} />
			{metadata && (
				<View>
					<Text>
						Dimensions: {metadata.width} x {metadata.height}
					</Text>
					{metadata.fileSize && (
						<Text>Size: {Math.round(metadata.fileSize / 1024)} KB</Text>
					)}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
		alignItems: "center",
	},
	image: {
		width: 200,
		height: 200,
		marginTop: 20,
	},
	thumbnail: {
		width: 80,
		height: 80,
		marginRight: 10,
	},
	imageRow: {
		marginTop: 10,
	},
});
