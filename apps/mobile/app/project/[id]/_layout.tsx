import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import {
	Slot,
	Stack,
	useLocalSearchParams,
	useRouter,
	useSegments,
} from "expo-router";
import * as Network from "expo-network";
import { Camera, Plus, WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Modal, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { UploadPlanSheet } from "@/components/plans/upload-plan-sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { WorkspaceFAB } from "@/components/workspace/camera-fab";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { usePlanUpload } from "@/hooks/use-plan-upload";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";
import ActivityScreen from "./activity";
import MediaScreen from "./media";
import PlansScreen from "./plans";

const SCREEN_WIDTH = Dimensions.get("window").width;
const EDGE_HIT_SLOP = SCREEN_WIDTH * 0.2;
const NAVIGATE_THRESHOLD = SCREEN_WIDTH * 0.4;
const TAB_SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const VIEWS: ActiveView[] = ["plans", "media", "activity"];

type ActiveView = "plans" | "media" | "activity";

export default function ProjectWorkspaceLayout() {
	const router = useRouter();
	const params = useLocalSearchParams<{ id: string }>();
	const segments = useSegments();
	const [activeView, setActiveView] = useState<ActiveView>("plans");
	const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);

	const { sessionToken, organizationId, sessionId } =
		useSessionContext();

	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const projectQuery = useMemo(
		() => queryDb(tables.projects.where({ id: params.id })),
		[params.id],
	);

	const project = store.useQuery(projectQuery);

	const projectData = Array.isArray(project) ? project[0] : null;

	const { pickAndUploadPlan, uploadProgress } = usePlanUpload({
		projectId: params.id,
		organizationId: organizationId!,
	});

	const isCameraRoute = segments[segments.length - 1] === "camera";

	const handleBack = useCallback(() => {
		router.back();
	}, [router]);

	// Back gesture: swipe from left edge to navigate back
	const overlayOpacity = useSharedValue(0);

	const navigateBack = useCallback(() => {
		router.back();
	}, [router]);

	const backGesture = Gesture.Pan()
		.activeOffsetX(10)
		.hitSlop({ left: 0, top: 0, width: EDGE_HIT_SLOP })
		.onUpdate((e) => {
			if (e.translationX > 0) {
				overlayOpacity.value = interpolate(
					e.translationX,
					[0, SCREEN_WIDTH],
					[0, 0.4],
				);
			}
		})
		.onEnd((e) => {
			if (e.translationX > NAVIGATE_THRESHOLD) {
				overlayOpacity.value = withTiming(0, { duration: 150 });
				runOnJS(navigateBack)();
			} else {
				overlayOpacity.value = withTiming(0, { duration: 200 });
			}
		});

	const overlayStyle = useAnimatedStyle(() => ({
		opacity: overlayOpacity.value,
	}));

	// Tab swipe gesture: horizontal swipe to change tabs
	const activeViewIndex = VIEWS.indexOf(activeView);

	const changeTab = useCallback(
		(direction: number) => {
			const next = Math.max(0, Math.min(VIEWS.length - 1, activeViewIndex + direction));
			if (next !== activeViewIndex) {
				setActiveView(VIEWS[next]);
			}
		},
		[activeViewIndex],
	);

	const tabSwipeGesture = Gesture.Pan()
		.activeOffsetX([-10, 10])
		.onEnd((e) => {
			if (Math.abs(e.translationX) > TAB_SWIPE_THRESHOLD) {
				const direction = e.translationX > 0 ? -1 : 1;
				runOnJS(changeTab)(direction);
			}
		});

	// Back gesture wins at left edge; tab swipe handles rest
	const combinedGesture = Gesture.Exclusive(backGesture, tabSwipeGesture);

	const handleMenu = useCallback(() => {
		router.push(`/project/${params.id}/settings` as any);
	}, [router, params.id]);

	const handleFABPress = useCallback(() => {
		if (activeView === "plans") {
			setIsUploadSheetVisible(true);
		} else {
			router.push(`/project/${params.id}/camera` as any);
		}
	}, [activeView, router, params.id]);

	const handleUploadFromDevice = useCallback(async () => {
		try {
			setIsUploadSheetVisible(false);

			await pickAndUploadPlan();

			// Success alert will be handled by progress UI or a timeout
		} catch (error) {
			console.error("[UPLOAD] Error uploading plan:", error);
			Alert.alert(
				"Error",
				"Failed to upload and process plan. Please try again.",
				[{ text: "OK" }],
			);
		}
	}, [pickAndUploadPlan]);

	const getFABIcon = () => {
		if (activeView === "plans") return Plus;
		return Camera;
	};

	// Network status — tracked independently from upload retry logic
	const [isOffline, setIsOffline] = useState(false);
	const networkChecked = useRef(false);

	useEffect(() => {
		Network.getNetworkStateAsync().then((state) => {
			if (!networkChecked.current) {
				networkChecked.current = true;
				setIsOffline(!(state.isConnected && state.isInternetReachable));
			}
		});

		const sub = Network.addNetworkStateListener((state) => {
			setIsOffline(!(state.isConnected && state.isInternetReachable));
		});
		return () => sub.remove();
	}, []);

	const projectName = projectData?.name || "Loading...";
	const projectAddress = projectData?.address || undefined;

	// If we're on the camera route, let it render directly
	if (isCameraRoute) {
		return <Slot />;
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<GestureDetector gesture={combinedGesture}>
			<View className="bg-background flex-1">
				{/* Back gesture overlay */}
				<Animated.View
					pointerEvents="none"
					className="absolute inset-0 z-50 bg-black"
					style={overlayStyle}
				/>
				<WorkspaceHeader
					onBack={handleBack}
					onMenu={handleMenu}
					projectName={projectName}
					address={projectAddress}
				>
					<SegmentedControl
						options={["Plans", "Media", "Activity"]}
						selectedIndex={
							activeView === "plans" ? 0 : activeView === "media" ? 1 : 2
						}
						onIndexChange={(index) => {
							if (index === 0) setActiveView("plans");
							else if (index === 1) setActiveView("media");
							else setActiveView("activity");
						}}
					/>
				</WorkspaceHeader>

				{/* Offline banner — construction sites often have poor signal */}
				{isOffline && (
					<View className="flex-row items-center gap-2 bg-amber-500 px-4 py-2">
						<Icon as={WifiOff} className="text-white size-4 flex-shrink-0" />
						<Text className="text-white text-xs font-semibold flex-1">
							Working offline — changes will sync when connected
						</Text>
					</View>
				)}

				{activeView === "plans" && <PlansScreen />}
				{activeView === "media" && <MediaScreen />}
				{activeView === "activity" && <ActivityScreen />}

				<WorkspaceFAB onPress={handleFABPress} icon={getFABIcon()} />

				<UploadPlanSheet
					isVisible={isUploadSheetVisible}
					onClose={() => setIsUploadSheetVisible(false)}
					onUploadFromDevice={handleUploadFromDevice}
				/>

				{/* Upload Modal */}
				<Modal
					visible={uploadProgress?.status === "uploading"}
					transparent
					animationType="fade"
				>
					<View className="flex-1 items-center justify-center bg-black/50">
						<View className="bg-background mx-8 items-center rounded-xl p-6">
							<ActivityIndicator size="large" />
							<Text className="text-foreground mt-4 text-lg font-semibold">
								Uploading Plan
							</Text>
							<Text className="text-muted-foreground mt-2 text-sm">
								Processing will begin automatically
							</Text>
						</View>
					</View>
				</Modal>
			</View>
			</GestureDetector>
		</>
	);
}
