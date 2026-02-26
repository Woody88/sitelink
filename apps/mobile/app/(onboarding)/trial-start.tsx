// apps/mobile/app/(onboarding)/trial-start.tsx
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { setOnboardingCompleted } from "@/lib/onboarding";

const FEATURES = [
	"Unlimited plan uploads & processing",
	"AI-powered callout detection & linking",
	"Team collaboration & role permissions",
	"Cloud sync with offline field access",
];

export default function TrialStartScreen() {
	const router = useRouter();

	function handleUploadPlans() {
		router.push("/(onboarding)/new-project" as any);
	}

	async function handleExploreDemo() {
		await setOnboardingCompleted();
		router.replace("/projects" as any);
	}

	return (
		<SafeAreaView className="bg-background flex-1 justify-center px-6">
			<View className="items-center gap-6">
				{/* Logo marks */}
				<View className="flex-row items-center gap-1.5">
					<View className="bg-primary size-10 rounded-xl" />
					<View className="bg-violet-500 size-10 rounded-xl opacity-80" />
					<View className="bg-amber-500 size-10 rounded-xl opacity-60" />
				</View>

				{/* Heading */}
				<View className="items-center gap-2">
					<Text className="text-foreground text-center text-3xl font-bold">
						Welcome to SiteLink
					</Text>
					<View className="bg-primary/10 rounded-full px-4 py-1.5">
						<Text className="text-primary text-sm font-semibold">
							14-day Pro trial — no credit card needed
						</Text>
					</View>
				</View>

				{/* Feature list */}
				<View className="w-full gap-3 py-2">
					{FEATURES.map((text) => (
						<View key={text} className="flex-row items-center gap-3">
							<View className="bg-primary/10 size-7 items-center justify-center rounded-full">
								<Icon as={Check} className="text-primary size-4" />
							</View>
							<Text className="text-foreground text-base flex-1">{text}</Text>
						</View>
					))}
				</View>

				{/* CTAs */}
				<View className="w-full gap-3 pt-2">
					<Button
						testID="upload-first-plans"
						onPress={handleUploadPlans}
						className="h-14 rounded-2xl"
					>
						<Text className="text-base font-semibold">
							Upload Your First Plans
						</Text>
					</Button>

					<Pressable
						testID="explore-demo"
						onPress={handleExploreDemo}
						className="items-center py-3"
					>
						<Text className="text-muted-foreground text-sm">
							Explore the demo project first
						</Text>
					</Pressable>
				</View>
			</View>
		</SafeAreaView>
	);
}
