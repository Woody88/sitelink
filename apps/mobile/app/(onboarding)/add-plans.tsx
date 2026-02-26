// apps/mobile/app/(onboarding)/add-plans.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { FileUp } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePlanUpload } from "@/hooks/use-plan-upload";
import { setOnboardingCompleted } from "@/lib/onboarding";
import { useSessionContext } from "@/lib/session-context";

export default function OnboardingAddPlansScreen() {
	const router = useRouter();
	const { projectId } = useLocalSearchParams<{ projectId: string }>();
	const { organizationId } = useSessionContext();

	const { pickAndUploadPlan, isUploading } = usePlanUpload({
		projectId: projectId ?? "",
		organizationId: organizationId ?? "",
	});

	async function handlePickPlan() {
		try {
			await pickAndUploadPlan();
			await setOnboardingCompleted();
			router.replace(`/project/${projectId}/plans` as any);
		} catch {
			// Error handled within hook; user can retry
		}
	}

	async function handleSkip() {
		await setOnboardingCompleted();
		router.replace(`/project/${projectId}/plans` as any);
	}

	return (
		<SafeAreaView className="bg-background flex-1 px-6 pt-4">
			<Pressable
				onPress={() => router.back()}
				className="mb-8 self-start pt-2"
			>
				<Text className="text-muted-foreground text-sm">← Back</Text>
			</Pressable>

			<Text className="text-foreground mb-1 text-2xl font-bold">Add Plans</Text>
			<Text className="text-muted-foreground mb-8 text-sm">
				Upload your PDF construction plans to get started
			</Text>

			{/* Drop zone */}
			<Pressable
				testID="plan-drop-zone"
				onPress={handlePickPlan}
				disabled={isUploading}
				className="border-border mb-8 items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-16"
			>
				<View className="bg-primary/10 size-16 items-center justify-center rounded-full">
					<Icon as={FileUp} className="text-primary size-8" />
				</View>
				<View className="items-center gap-1">
					<Text className="text-foreground text-base font-semibold">
						{isUploading ? "Uploading..." : "Drop PDF files here"}
					</Text>
					<Text className="text-muted-foreground text-sm">
						or tap to browse your files
					</Text>
				</View>
			</Pressable>

			<Button
				testID="upload-plans-button"
				onPress={handlePickPlan}
				disabled={isUploading}
				className="mb-4 h-14 rounded-2xl"
			>
				<Text className="text-base font-semibold">
					{isUploading ? "Uploading..." : "Choose PDF"}
				</Text>
			</Button>

			<Pressable
				testID="skip-upload"
				onPress={handleSkip}
				className="items-center py-3"
			>
				<Text className="text-muted-foreground text-sm">
					Skip for now — I'll upload plans later
				</Text>
			</Pressable>

			<Text className="text-muted-foreground mt-auto pb-4 text-center text-xs">
				Supported formats: PDF · Recommended: 300 DPI
			</Text>
		</SafeAreaView>
	);
}
