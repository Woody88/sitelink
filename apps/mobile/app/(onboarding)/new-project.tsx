// apps/mobile/app/(onboarding)/new-project.tsx
import { nanoid } from "@livestore/livestore";
import { events } from "@sitelink/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export default function OnboardingNewProjectScreen() {
	const router = useRouter();
	const { organizationId, userId, sessionToken, sessionId } =
		useSessionContext();
	const store = useAppStore(organizationId ?? "", sessionToken, sessionId);

	const [name, setName] = useState("");
	const [address, setAddress] = useState("");

	function handleCreate() {
		if (!name.trim() || !organizationId || !userId) return;

		const projectId = nanoid();
		store.commit(
			events.projectCreated({
				id: projectId,
				organizationId,
				name: name.trim(),
				address: address.trim() || undefined,
				createdBy: userId,
				createdAt: Date.now(),
			}),
		);

		router.push(
			`/(onboarding)/add-plans?projectId=${projectId}` as any,
		);
	}

	return (
		<SafeAreaView className="bg-background flex-1 px-6 pt-4">
			<Pressable
				onPress={() => router.back()}
				className="mb-8 self-start pt-2"
			>
				<Text className="text-muted-foreground text-sm">← Back</Text>
			</Pressable>

			<Text className="text-foreground mb-1 text-2xl font-bold">
				New Project
			</Text>
			<Text className="text-muted-foreground mb-8 text-sm">
				Give your project a name to get started
			</Text>

			<View className="gap-4">
				<Input
					testID="project-name"
					placeholder="e.g. Riverside Apartments"
					value={name}
					onChangeText={setName}
					autoCapitalize="words"
					autoFocus
					className="h-14 rounded-2xl px-4"
				/>
				<Input
					testID="project-address"
					placeholder="Address (optional)"
					value={address}
					onChangeText={setAddress}
					autoCapitalize="words"
					className="h-14 rounded-2xl px-4"
				/>

				<Button
					testID="create-and-add-plans"
					onPress={handleCreate}
					disabled={!name.trim()}
					className="mt-2 h-14 rounded-2xl"
				>
					<Text className="text-base font-semibold">Create & Add Plans</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}
