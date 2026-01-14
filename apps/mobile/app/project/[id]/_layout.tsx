import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import {
	Slot,
	Stack,
	useLocalSearchParams,
	useRouter,
	useSegments,
} from "expo-router";
import { Camera, Plus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, View } from "react-native";
import { UploadPlanSheet } from "@/components/plans/upload-plan-sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { WorkspaceFAB } from "@/components/workspace/camera-fab";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { usePlanUpload } from "@/hooks/use-plan-upload";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";
import ActivityScreen from "./activity";
import MediaScreen from "./media";
import PlansScreen from "./plans";

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

	const projectName = projectData?.name || "Loading...";
	const projectAddress = projectData?.address || undefined;

	// If we're on the camera route, let it render directly
	if (isCameraRoute) {
		return <Slot />;
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View className="bg-background flex-1">
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
		</>
	);
}
