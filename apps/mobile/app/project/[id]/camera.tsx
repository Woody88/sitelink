import { nanoid, queryDb } from "@livestore/livestore";
import { useStore } from "@livestore/react";
import { events, tables } from "@sitelink/domain";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraLinkContext } from "@/components/camera/camera-link-context";
import { CameraModeToggle } from "@/components/camera/camera-mode-toggle";
import { CameraOverlayTop } from "@/components/camera/camera-overlay-top";
import { CameraShutter } from "@/components/camera/camera-shutter";
import { CameraViewfinder } from "@/components/camera/camera-viewfinder";
import { IssueModeBanner } from "@/components/camera/issue-mode-banner";
import { PhotoPreviewLayer } from "@/components/camera/photo-preview-layer";
import { RecordingLayer } from "@/components/camera/recording-layer";
import type { Plan } from "@/components/plans/plan-selector";
import { PlanSelector } from "@/components/plans/plan-selector";
import { Text } from "@/components/ui/text";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useCameraState } from "@/hooks/use-camera-state";
import { useSessionContext } from "@/lib/session-context";
import { createAppStoreOptions } from "@/lib/store-config";
import {
	ensureProjectDirectoriesExist,
	getMediaPath,
} from "@/utils/file-paths";
import { detectTextInPhoto } from "@/utils/ocr";

// Configure route options for Expo Router
export const options = {
	presentation: "fullScreenModal" as const,
	headerShown: false,
};

type CameraScreenState = "camera" | "preview" | "recording";

export default function CameraScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ id: string }>();
	const insets = useSafeAreaInsets();
	const [screenState, setScreenState] =
		React.useState<CameraScreenState>("camera");
	const [capturedPhotoUri, setCapturedPhotoUri] = React.useState<string | null>(
		null,
	);
	const [currentPhotoId, setCurrentPhotoId] = React.useState<string | null>(
		null,
	);
	const [ocrText, setOcrText] = React.useState<string | null>(null);
	const [isOcrLoading, setIsOcrLoading] = React.useState(false);
	const [markerLabel, setMarkerLabel] = React.useState<string | null>(null); // TODO: Get from route params or context
	const [waveform, setWaveform] = React.useState<number[]>([]);
	const [isPlanSelectorVisible, setIsPlanSelectorVisible] =
		React.useState(false);

	const camera = useCameraState();
	const { sessionToken, userId } = useSessionContext();
	const audio = useAudioRecorder({ sessionToken: sessionToken ?? undefined });

	const storeOptions = React.useMemo(
		() => createAppStoreOptions(sessionToken),
		[sessionToken],
	);

	const store = useStore(storeOptions);

	const projectQuery = React.useMemo(
		() => queryDb(tables.projects.where({ id: params.id })),
		[params.id],
	);
	const projectData = store.useQuery(projectQuery)?.[0];
	const organizationId = projectData?.organizationId;

	// Request permissions on mount
	const { requestPermissions } = camera;
	React.useEffect(() => {
		requestPermissions();
	}, [requestPermissions]);

	// Generate real-time waveform when recording
	React.useEffect(() => {
		if (audio.state.isRecording) {
			// Generate mock waveform bars that animate
			const bars = 20;
			const interval = setInterval(() => {
				setWaveform(
					Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2),
				);
			}, 150);
			return () => clearInterval(interval);
		} else {
			setWaveform([]);
		}
	}, [audio.state.isRecording]);

	const handleCapturePhoto = React.useCallback(async () => {
		if (!userId || !organizationId) {
			console.error(
				"[CAMERA] Cannot capture photo: user not authenticated or organizationId missing",
			);
			return;
		}

		const uri = await camera.capturePhoto();
		if (uri) {
			try {
				const projectId = params.id;

				await ensureProjectDirectoriesExist(organizationId, projectId);
				const mediaPath = getMediaPath(organizationId, projectId);

				const timestamp = Date.now();
				const fileName = `photo_${timestamp}.jpg`;
				const destinationPath = `${mediaPath}/${fileName}`;

				await FileSystem.copyAsync({
					from: uri,
					to: destinationPath,
				});

				const photoId = nanoid();
				setCurrentPhotoId(photoId);
				setCapturedPhotoUri(destinationPath);
				setScreenState("preview");
				setOcrText(null);
				setIsOcrLoading(true);

				if (store && storeOptions) {
					await store.commit(
						events.photoCaptured({
							id: photoId,
							projectId,
							markerId: markerLabel || undefined,
							localPath: destinationPath,
							isIssue: camera.state.isIssueMode,
							capturedAt: new Date(timestamp),
							capturedBy: userId,
						}),
					);
					console.log(
						"[CAMERA] Photo captured and saved to LiveStore:",
						photoId,
					);
				}

				detectTextInPhoto(destinationPath)
					.then((result) => {
						if (result && result.text.length > 10) {
							setOcrText(result.text);
						}
						setIsOcrLoading(false);
					})
					.catch(() => {
						setIsOcrLoading(false);
					});
			} catch (error) {
				console.error("[CAMERA] Error saving photo:", error);
			}
		}
	}, [
		camera.capturePhoto,
		camera.state.isIssueMode,
		userId,
		params.id,
		markerLabel,
		store,
		storeOptions,
	]);

	const handleRetake = React.useCallback(() => {
		setCapturedPhotoUri(null);
		setCurrentPhotoId(null);
		setOcrText(null);
		setIsOcrLoading(false);
		setScreenState("camera");
	}, []);

	const handleDone = React.useCallback(() => {
		setCapturedPhotoUri(null);
		setCurrentPhotoId(null);
		setOcrText(null);
		setIsOcrLoading(false);
		setScreenState("camera");
	}, []);

	const handleAddVoice = React.useCallback(async () => {
		setScreenState("recording");
		await audio.startRecording();
	}, [audio]);

	const handleStopRecording = React.useCallback(async () => {
		await audio.stopRecording();
		// Stay in recording state to show transcript
	}, [audio]);

	const handleDeleteRecording = React.useCallback(() => {
		audio.deleteRecording();
		setScreenState("preview");
	}, [audio]);

	const handleRecordingDone = React.useCallback(async () => {
		const recordingUri = audio.state.uri;

		if (!recordingUri) {
			audio.deleteRecording();
			setScreenState("preview");
			return;
		}

		if (!currentPhotoId) {
			console.error("[CAMERA] Cannot save voice note: no associated photo");
			audio.deleteRecording();
			setScreenState("preview");
			return;
		}

		try {
			const projectId = params.id;

			if (!organizationId) {
				throw new Error("organizationId is missing");
			}

			await ensureProjectDirectoriesExist(organizationId, projectId);
			const mediaPath = getMediaPath(organizationId, projectId);

			const timestamp = Date.now();
			const fileName = `voice_${timestamp}.m4a`;
			const destinationPath = `${mediaPath}/${fileName}`;

			await FileSystem.copyAsync({
				from: recordingUri,
				to: destinationPath,
			});

			console.log("[CAMERA] Voice recording saved to:", destinationPath);

			const voiceNoteId = nanoid();

			if (store && storeOptions) {
				await store.commit(
					events.voiceNoteRecorded({
						id: voiceNoteId,
						photoId: currentPhotoId,
						localPath: destinationPath,
						durationSeconds: Math.floor(audio.state.duration),
					}),
				);
				console.log("[CAMERA] Voice note metadata saved to LiveStore");

				if (audio.state.transcript) {
					await store.commit(
						events.voiceNoteTranscribed({
							voiceNoteId,
							transcription: audio.state.transcript,
						}),
					);
					console.log("[CAMERA] Voice note transcription saved to LiveStore");
				} else if (audio.state.transcriptionError) {
					await store.commit(
						events.voiceNoteTranscriptionFailed({
							voiceNoteId,
							error: audio.state.transcriptionError,
						}),
					);
					console.log("[CAMERA] Voice note transcription failure recorded");
				}

				// Upload audio to R2 in the background for persistent remote storage
				if (sessionToken) {
					const uploadVoiceNoteToR2 = async () => {
						try {
							const backendUrl = process.env.EXPO_PUBLIC_BETTER_AUTH_URL || "http://localhost:8787";
							const form = new FormData();
							form.append("file", {
								uri: destinationPath,
								name: fileName,
								type: "audio/m4a",
							} as unknown as Blob);
							form.append("voiceNoteId", voiceNoteId);

							const res = await fetch(`${backendUrl}/api/voice-notes/upload`, {
								method: "POST",
								headers: { Authorization: `Bearer ${sessionToken}` },
								body: form,
							});

							if (res.ok) {
								const { remotePath } = await res.json() as { remotePath: string };
								await store.commit(events.voiceNoteUploaded({ voiceNoteId, remotePath }));
								console.log("[CAMERA] Voice note uploaded to R2:", remotePath);
							} else {
								console.warn("[CAMERA] Voice note R2 upload failed:", res.status);
							}
						} catch (err) {
							console.warn("[CAMERA] Voice note R2 upload error:", err);
						}
					};
					uploadVoiceNoteToR2();
				}
			}
		} catch (error) {
			console.error("[CAMERA] Error saving voice recording:", error);
		}

		audio.deleteRecording();
		setScreenState("preview");
	}, [audio, params.id, currentPhotoId, store, storeOptions, sessionToken]);

	const handleLinkToPlan = React.useCallback(() => {
		setIsPlanSelectorVisible(true);
	}, []);

	const handleSelectPlan = React.useCallback((plan: Plan) => {
		setMarkerLabel(`${plan.code} - ${plan.title}`);
		setIsPlanSelectorVisible(false);
	}, []);

	const handleClose = React.useCallback(() => {
		router.back();
	}, [router]);

	// Don't render camera if no permission
	if (camera.state.hasPermission === false) {
		return (
			<View className="bg-background flex-1 items-center justify-center p-4">
				<Text className="text-foreground mb-2 text-center text-lg font-semibold">
					Camera Permission Required
				</Text>
				<Text className="text-muted-foreground mb-4 text-center">
					Please enable camera access in your device settings.
				</Text>
				<Pressable
					onPress={camera.requestPermissions}
					className="bg-primary rounded-full px-6 py-3"
				>
					<Text className="text-primary-foreground font-semibold">
						Grant Permission
					</Text>
				</Pressable>
			</View>
		);
	}

	if (camera.state.hasPermission === null) {
		return (
			<View className="bg-background flex-1 items-center justify-center">
				<Text className="text-muted-foreground">
					Requesting camera permission...
				</Text>
			</View>
		);
	}

	return (
		<View className="bg-background flex-1" style={styles.container}>
			{screenState === "camera" && (
				<>
					<CameraViewfinder
						cameraRef={camera.cameraRef}
						cameraType={camera.state.cameraType}
						flashMode={camera.state.flashMode}
					/>

					<CameraOverlayTop
						onClose={handleClose}
						onToggleFlash={camera.toggleFlash}
						onToggleCamera={camera.toggleCamera}
						flashMode={camera.state.flashMode}
					/>

					<IssueModeBanner visible={camera.state.isIssueMode} />

					<CameraLinkContext
						markerLabel={markerLabel}
						onLinkPress={handleLinkToPlan}
					/>

					<View
						className="absolute right-0 bottom-0 left-0"
						style={{ paddingBottom: Math.max(insets.bottom, 32) }}
					>
						<View className="flex-row items-center justify-center px-6">
							<View className="flex-1 items-start">
								<CameraModeToggle
									isIssueMode={camera.state.isIssueMode}
									onToggle={camera.toggleIssueMode}
								/>
							</View>

							<CameraShutter
								onPress={handleCapturePhoto}
								isIssueMode={camera.state.isIssueMode}
								disabled={camera.state.isCapturing}
							/>

							<View className="flex-1" />
						</View>
					</View>
				</>
			)}

			{screenState === "preview" && capturedPhotoUri && (
				<PhotoPreviewLayer
					photoUri={capturedPhotoUri}
					markerLabel={markerLabel}
					capturedAt={Date.now()}
					ocrText={ocrText}
					isOcrLoading={isOcrLoading}
					onRetake={handleRetake}
					onDone={handleDone}
					onAddVoice={handleAddVoice}
					onCopyOcr={() => {
						console.log("Copy OCR:", ocrText);
					}}
					onEditOcr={() => {
						console.log("Edit OCR:", ocrText);
					}}
				/>
			)}

			{screenState === "recording" && (
				<RecordingLayer
					isRecording={audio.state.isRecording}
					duration={audio.state.duration}
					waveform={waveform}
					transcript={audio.state.transcript}
					isTranscribing={audio.state.isTranscribing}
					onStop={handleStopRecording}
					onPlay={audio.playRecording}
					onDelete={handleDeleteRecording}
					onDone={handleRecordingDone}
				/>
			)}

			<Modal
				visible={isPlanSelectorVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsPlanSelectorVisible(false)}
			>
				<PlanSelector
					projectId={params.id}
					onSelect={handleSelectPlan}
					onClose={() => setIsPlanSelectorVisible(false)}
					showCloseButton
				/>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
