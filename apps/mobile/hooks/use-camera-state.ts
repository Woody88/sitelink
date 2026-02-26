import { type CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";

export type FlashMode = "off" | "on" | "auto";
export type CameraType = "front" | "back";

export interface CameraState {
	flashMode: FlashMode;
	cameraType: CameraType;
	isIssueMode: boolean;
	hasPermission: boolean | null;
	isCapturing: boolean;
}

export interface UseCameraStateReturn {
	state: CameraState;
	cameraRef: React.RefObject<CameraView | null>;
	toggleFlash: () => void;
	toggleCamera: () => void;
	toggleIssueMode: () => void;
	capturePhoto: () => Promise<string | null>;
	requestPermissions: () => Promise<boolean>;
}

export function useCameraState(): UseCameraStateReturn {
	const [permission, requestPermission] = useCameraPermissions();
	const [flashMode, setFlashMode] = useState<FlashMode>("off");
	const [cameraType, setCameraType] = useState<CameraType>("back");
	const [isIssueMode, setIsIssueMode] = useState(false);
	const [isCapturing, setIsCapturing] = useState(false);
	const cameraRef = useRef<CameraView>(null);

	const toggleFlash = useCallback(() => {
		setFlashMode((prev) => {
			const modes: FlashMode[] = ["off", "on", "auto"];
			const currentIndex = modes.indexOf(prev);
			const nextIndex = (currentIndex + 1) % modes.length;
			return modes[nextIndex];
		});
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
	}, []);

	const toggleCamera = useCallback(() => {
		setCameraType((prev) => (prev === "back" ? "front" : "back"));
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
	}, []);

	const toggleIssueMode = useCallback(() => {
		setIsIssueMode((prev) => !prev);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
	}, []);

	const capturePhoto = useCallback(async (): Promise<string | null> => {
		if (!cameraRef.current || isCapturing) return null;

		setIsCapturing(true);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

		try {
			const photo = await cameraRef.current.takePictureAsync({
				quality: 0.9,
				base64: false,
			});

			// Auto-reset issue mode after capture
			setIsIssueMode(false);

			return photo?.uri || null;
		} catch (error) {
			console.error("Error capturing photo:", error);
			return null;
		} finally {
			setIsCapturing(false);
		}
	}, [isCapturing]);

	const requestPermissions = useCallback(async (): Promise<boolean> => {
		if (permission?.granted) return true;
		const result = await requestPermission();
		return result.granted;
	}, [permission, requestPermission]);

	return {
		state: {
			flashMode,
			cameraType,
			isIssueMode,
			hasPermission: permission?.granted ?? null,
			isCapturing,
		},
		cameraRef,
		toggleFlash,
		toggleCamera,
		toggleIssueMode,
		capturePhoto,
		requestPermissions,
	};
}
