import { nanoid } from "@livestore/livestore";
import { useStore } from "@livestore/react";
import { events } from "@sitelink/domain";
import * as Haptics from "expo-haptics";
import { AlertCircle, Download, Plus, RefreshCw, TableProperties, X } from "lucide-react-native";
import * as React from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	StatusBar,
	View,
} from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useLayoutRegions } from "@/hooks/use-layout-regions";
import { useMarkers } from "@/hooks/use-markers";
import { useScheduleDrawerData } from "@/hooks/use-schedule-drawer";
import {
	type CalloutMarker,
	usePlanViewer,
	type ViewerState,
} from "@/hooks/use-plan-viewer";
import { fetchImageAsBase64 } from "@/lib/image-utils";
import { useSessionContext } from "@/lib/session-context";
import { createAppStoreOptions } from "@/lib/store-config";
import { useSheetPmtilesSync } from "@/services/file-sync-service";
import { MarkerDetailSheet } from "./marker-detail-sheet";
import { ScheduleDrawer } from "./schedule-drawer";
import OpenSeadragonViewer from "./openseadragon-viewer";
import PMTilesViewer, { type LayoutRegionOverlay } from "./pmtiles-viewer";
import { SheetInfoBar } from "./sheet-info-bar";
import { ViewerControls } from "./viewer-controls";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PlanViewerProps {
	sheetId: string;
	projectId: string;
	planId: string;
	planCode: string;
	planTitle: string;
	imageUrl: string;
	imageWidth: number;
	imageHeight: number;
	onClose: () => void;
	onSheetChange?: (sheetRef: string) => void;
	onTakePhoto?: (marker: CalloutMarker) => void;
	processingStage?: string | null;
	remotePmtilesPath?: string | null;
}

/**
 * Full-screen plan viewer with OpenSeadragon integration
 *
 * Features:
 * - Deep zoom with pinch/pan gestures
 * - Callout marker overlays
 * - Sheet navigation
 * - Professional Wealthsimple-inspired UI
 */
export function PlanViewer({
	sheetId,
	projectId,
	planId,
	planCode,
	planTitle,
	imageUrl,
	imageWidth,
	imageHeight,
	onClose,
	onSheetChange,
	onTakePhoto,
	processingStage,
	remotePmtilesPath,
}: PlanViewerProps) {
	const insets = useSafeAreaInsets();
	const {
		viewerState,
		setViewerState,
		zoomIn,
		zoomOut,
		zoomToFit,
		markers: internalMarkers,
		selectedMarkerId,
		setSelectedMarkerId,
		isLoading,
		setIsLoading,
		error,
		setError,
		// viewerRef - for future use with viewer commands
	} = usePlanViewer({
		onNavigateToSheet: onSheetChange,
	});

	// Download PMTiles to local storage if needed
	const {
		localPmtilesPath,
		isDownloading: isPmtilesDownloading,
		error: pmtilesError,
	} = useSheetPmtilesSync(sheetId, projectId, planId, remotePmtilesPath);

	// Query markers from LiveStore for the current sheet
	const liveMarkers = useMarkers(sheetId);

	// Query layout regions for the current sheet
	const layoutRegions = useLayoutRegions(sheetId);

	// Schedule drawer data
	const scheduleGroups = useScheduleDrawerData(projectId);

	// Use LiveStore markers, falling back to internal markers state
	const markers = liveMarkers.length > 0 ? liveMarkers : internalMarkers;

	console.log(`[PlanViewer] sheetId=${sheetId}, liveMarkers=${liveMarkers.length}, internalMarkers=${internalMarkers.length}, using=${markers.length}`);

	// UI state
	const [showMarkerSheet, setShowMarkerSheet] = React.useState(false);
	const [selectedMarker, setSelectedMarker] =
		React.useState<CalloutMarker | null>(null);
	const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);
	const [retryCount, setRetryCount] = React.useState(0);
	const [showRegions, setShowRegions] = React.useState(true);
	const [showScheduleDrawer, setShowScheduleDrawer] = React.useState(false);
	const controlsOpacity = useSharedValue(1);

	const { sessionToken, userId } = useSessionContext();

	const storeOptions = React.useMemo(
		() => createAppStoreOptions(sessionToken),
		[sessionToken],
	);

	const store = useStore(storeOptions);

	// Prefer local PMTiles file, fall back to remote URL
	const usePMTiles =
		processingStage === "tiles_generated" &&
		(localPmtilesPath || remotePmtilesPath);

	// For now, always use backend proxy URL for WebView since WebViews can't fetch file:// URLs
	// The local file download is for future offline support (when we implement a local HTTP server)
	// Convert R2 URL to backend proxy URL for WebView access, appending session token as ?st= param
	// since WebView-based PMTiles library cannot set Authorization headers on range requests.
	const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL;
	const pmtilesUrl = usePMTiles && remotePmtilesPath && sessionToken
		? (() => {
			const baseUrl = remotePmtilesPath.startsWith("https://r2.sitelink.dev/")
				? `${BACKEND_URL}/api/r2/${remotePmtilesPath.slice("https://r2.sitelink.dev/".length)}`
				: remotePmtilesPath.startsWith("/api/r2/")
					? `${BACKEND_URL}${remotePmtilesPath}`
					: remotePmtilesPath
			// Append session token for WebView authentication (PMTiles range requests can't use headers)
			return baseUrl.includes("/api/r2/") ? `${baseUrl}?st=${sessionToken}` : baseUrl
		})()
		: null;

	console.log(`[PlanViewer] PMTiles config:`, {
		usePMTiles,
		imageWidth,
		imageHeight,
		localPmtilesPath: localPmtilesPath?.slice(0, 50),
		pmtilesUrl: pmtilesUrl?.slice(0, 80),
	});

	// Fetch image and convert to base64 to bypass WebView CORS restrictions (only for non-PMTiles)
	React.useEffect(() => {
		if (usePMTiles) {
			setImageDataUrl(null);
			return;
		}

		let cancelled = false;

		async function loadImage() {
			try {
				setIsLoading(true);
				setError(null);
				console.log("[PlanViewer] Fetching image:", imageUrl);
				const dataUrl = await fetchImageAsBase64(imageUrl);
				if (!cancelled) {
					console.log(
						"[PlanViewer] Image converted to base64, length:",
						dataUrl.length,
					);
					setImageDataUrl(dataUrl);
				}
			} catch (err) {
				if (!cancelled) {
					const message =
						err instanceof Error ? err.message : "Failed to load image";
					console.error("[PlanViewer] Image fetch error:", message);
					setError(message);
					setIsLoading(false);
				}
			}
		}

		loadImage();
		return () => {
			cancelled = true;
		};
	}, [imageUrl, retryCount, usePMTiles, setIsLoading, setError]);

	// Handle viewer ready - must be async for DOM bridge
	const handleViewerReady = React.useCallback(async () => {
		console.log("[Native] Plan viewer ready signal received");
		setIsLoading(false);
	}, [setIsLoading]);

	// Handle viewer error - must be async for DOM bridge
	const handleViewerError = React.useCallback(
		async (errorMessage: string) => {
			setIsLoading(false);
			setError(errorMessage);
		},
		[setIsLoading, setError],
	);

	// Handle viewer state change - must be async for DOM bridge
	const handleViewerStateChange = React.useCallback(
		async (state: ViewerState) => {
			setViewerState(state);
		},
		[setViewerState],
	);

	// Handle marker press - must be async for DOM bridge
	const handleMarkerPress = React.useCallback(
		async (marker: CalloutMarker) => {
			await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			setSelectedMarker(marker);
			setSelectedMarkerId(marker.id);
			setShowMarkerSheet(true);
		},
		[setSelectedMarkerId],
	);

	// Handle close marker sheet
	const handleCloseMarkerSheet = React.useCallback(() => {
		setShowMarkerSheet(false);
		setSelectedMarkerId(null);
	}, [setSelectedMarkerId]);

	// Handle navigate to sheet
	const handleNavigateToSheet = React.useCallback(
		(sheetRef: string) => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
			onSheetChange?.(sheetRef);
		},
		[onSheetChange],
	);

	// Handle take photo
	const handleTakePhoto = React.useCallback(
		(marker: CalloutMarker) => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
			onTakePhoto?.(marker);
		},
		[onTakePhoto],
	);

	// Zoom controls
	const handleZoomIn = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		zoomIn();
	}, [zoomIn]);

	const handleZoomOut = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		zoomOut();
	}, [zoomOut]);

	const handleZoomToFit = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		zoomToFit();
	}, [zoomToFit]);

	// Close button handler
	const handleClose = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		onClose();
	}, [onClose]);

	// Retry on error - increment retry count to trigger new fetch
	const handleRetry = React.useCallback(() => {
		setError(null);
		setImageDataUrl(null);
		setRetryCount((c) => c + 1);
	}, [setError]);

	// Handle add marker button
	const handleAddMarkerPress = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		Alert.prompt(
			"Add Marker",
			"Enter a label for the marker:",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Add",
					onPress: async (label: string | undefined) => {
						if (!label?.trim() || !userId || !store) {
							return;
						}

						const markerId = nanoid();
						const centerX = 0.5;
						const centerY = 0.5;

						await store.commit(
							events.markerCreated({
								id: markerId,
								sheetId: sheetId,
								label: label.trim(),
								x: centerX,
								y: centerY,
								createdBy: userId,
								createdAt: Date.now(),
							}),
						);
						console.log("[PLAN_VIEWER] Marker created:", markerId);
						Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
					},
				},
			],
			"plain-text",
		);
	}, [userId, store, sheetId]);

	const handleRegionPress = React.useCallback(
		async (region: LayoutRegionOverlay) => {
			await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			const regionLabel =
				region.regionClass === "schedule"
					? "Schedule"
					: region.regionClass === "notes"
						? "Notes"
						: "Legend";
			Alert.alert(
				regionLabel,
				region.regionTitle
					? `${region.regionTitle}\n\nDetail screen coming soon.`
					: `Detected ${regionLabel.toLowerCase()} region.\n\nDetail screen coming soon.`,
			);
		},
		[],
	);

	const handleToggleRegions = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setShowRegions((prev) => !prev);
	}, []);

	const handleOpenSchedules = React.useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setShowScheduleDrawer(true);
	}, []);

	const handleScheduleViewOnSheet = React.useCallback(
		(targetSheetId: string, _bbox: { x: number; y: number; width: number; height: number }) => {
			setShowScheduleDrawer(false);
			if (targetSheetId !== sheetId) {
				onSheetChange?.(targetSheetId);
			}
		},
		[sheetId, onSheetChange],
	);

	const controlsAnimatedStyle = useAnimatedStyle(() => ({
		opacity: controlsOpacity.value,
		pointerEvents: controlsOpacity.value > 0.5 ? "auto" : "none",
	}));

	return (
		<View className="bg-background flex-1">
			<StatusBar
				barStyle="light-content"
				backgroundColor="transparent"
				translucent
			/>

			{/* Viewer - PMTiles or OpenSeadragon based on processing stage */}
			<View className="flex-1">
				{usePMTiles && pmtilesUrl ? (
					<PMTilesViewer
						pmtilesUrl={pmtilesUrl}
						imageWidth={imageWidth}
						imageHeight={imageHeight}
						markers={markers}
						selectedMarkerId={selectedMarkerId}
						onMarkerPress={handleMarkerPress}
						onViewerStateChange={handleViewerStateChange}
						onReady={handleViewerReady}
						onError={handleViewerError}
						regions={layoutRegions}
						showRegions={showRegions}
						onRegionPress={handleRegionPress}
					/>
				) : (
					imageDataUrl && (
						<OpenSeadragonViewer
							imageUrl={imageDataUrl}
							imageWidth={imageWidth}
							imageHeight={imageHeight}
							markers={markers}
							selectedMarkerId={selectedMarkerId}
							onMarkerPress={handleMarkerPress}
							onViewerStateChange={handleViewerStateChange}
							onReady={handleViewerReady}
							onError={handleViewerError}
						/>
					)
				)}
			</View>

			{/* Loading overlay */}
			{isLoading && (
				<Animated.View
					entering={FadeIn}
					exiting={FadeOut}
					className="absolute inset-0 items-center justify-center bg-black/80"
				>
					<ActivityIndicator size="large" color="#fff" />
					<Text className="mt-4 text-white">Loading plan...</Text>
				</Animated.View>
			)}

			{/* PMTiles downloading overlay */}
			{isPmtilesDownloading && !isLoading && (
				<Animated.View
					entering={FadeIn}
					exiting={FadeOut}
					className="absolute inset-0 items-center justify-center bg-black/80"
				>
					<Icon as={Download} className="mb-4 size-12 text-white" />
					<ActivityIndicator size="large" color="#fff" />
					<Text className="mt-4 text-white">Downloading tiles...</Text>
					<Text className="mt-2 text-sm text-white/60">
						This happens once per sheet
					</Text>
				</Animated.View>
			)}

			{/* Error overlay */}
			{(error || pmtilesError) && (
				<Animated.View
					entering={FadeIn}
					className="absolute inset-0 items-center justify-center bg-black/90 px-8"
				>
					<Icon as={AlertCircle} className="text-destructive mb-4 size-16" />
					<Text className="mb-2 text-center text-lg font-semibold text-white">
						{pmtilesError ? "Failed to download tiles" : "Failed to load plan"}
					</Text>
					<Text className="mb-6 text-center text-sm text-white/60">
						{pmtilesError || error}
					</Text>
					<Pressable
						onPress={handleRetry}
						className="flex-row items-center gap-2 rounded-full bg-white/10 px-6 py-3 active:bg-white/20"
					>
						<Icon as={RefreshCw} className="size-5 text-white" />
						<Text className="font-semibold text-white">Try Again</Text>
					</Pressable>
				</Animated.View>
			)}

			{/* Controls overlay */}
			<Animated.View
				style={[controlsAnimatedStyle]}
				className="absolute inset-0"
				pointerEvents="box-none"
			>
				{/* Top bar */}
				<View
					className="absolute right-0 left-0"
					style={{ top: insets.top }}
					pointerEvents="box-none"
				>
					<View
						className="flex-row items-start justify-between px-4 py-2"
						pointerEvents="box-none"
					>
						{/* Close button */}
						<CloseButton onPress={handleClose} />

						{/* Spacer for balance */}
						<View className="w-12" />
					</View>
				</View>

				{/* Bottom info bar */}
				<View
					className="absolute right-0 left-0"
					style={{ bottom: insets.bottom + 8 }}
					pointerEvents="box-none"
				>
					<SheetInfoBar
						sheetCode={planCode}
						sheetTitle={planTitle}
						markerCount={markers.length}
						onSheetPress={() => {
							// TODO: Open sheet selector
							Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
						}}
						onMarkersPress={() => {
							// TODO: Open markers list
							Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
						}}
					/>
				</View>

				{/* Right-side zoom controls */}
				<View
					className="absolute right-4"
					style={{ top: insets.top + 80 }}
					pointerEvents="box-none"
				>
					<ViewerControls
						zoom={viewerState.zoom}
						minZoom={viewerState.minZoom}
						maxZoom={viewerState.maxZoom}
						onZoomIn={handleZoomIn}
						onZoomOut={handleZoomOut}
						onZoomToFit={handleZoomToFit}
						showRegions={showRegions}
						onToggleRegions={handleToggleRegions}
					/>

					{/* Add marker button */}
					<Pressable
						onPress={handleAddMarkerPress}
						className="mt-4 h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md active:bg-black/70"
						accessibilityLabel="Add marker"
						accessibilityRole="button"
					>
						<Icon as={Plus} className="size-6 text-white" />
					</Pressable>

					{/* Schedule drawer button — only show when there are schedules for this project */}
					{scheduleGroups.length > 0 && (
						<Pressable
							onPress={handleOpenSchedules}
							className="mt-2 h-12 w-12 items-center justify-center rounded-2xl bg-black/60 backdrop-blur-md active:bg-black/70"
							accessibilityLabel="View schedules"
							accessibilityRole="button"
						>
							<Icon as={TableProperties} className="size-5 text-white" />
						</Pressable>
					)}
				</View>
			</Animated.View>

			{/* Marker detail sheet */}
			<MarkerDetailSheet
				marker={selectedMarker}
				visible={showMarkerSheet}
				onClose={handleCloseMarkerSheet}
				onNavigateToSheet={handleNavigateToSheet}
				onTakePhoto={handleTakePhoto}
			/>

			{/* Schedule drawer */}
			<ScheduleDrawer
				isOpen={showScheduleDrawer}
				onClose={() => setShowScheduleDrawer(false)}
				groups={scheduleGroups}
				onViewOnSheet={handleScheduleViewOnSheet}
			/>
		</View>
	);
}

/**
 * Close button with glass effect
 */
function CloseButton({ onPress }: { onPress: () => void }) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	const handlePressIn = () => {
		scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
	};

	const handlePressOut = () => {
		scale.value = withSpring(1, { damping: 15, stiffness: 300 });
	};

	return (
		<AnimatedPressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={animatedStyle}
			className="h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md active:bg-black/70"
			accessibilityLabel="Close plan viewer"
			accessibilityRole="button"
		>
			<Icon as={X} className="size-6 text-white" />
		</AnimatedPressable>
	);
}

export default PlanViewer;
