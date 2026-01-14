// apps/mobile/app/(tabs)/more.tsx

import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/useAuth";
import {
	isBiometricAvailable,
	isBiometricEnabled,
	setBiometricEnabled,
} from "@/lib/biometric";

export default function MoreScreen() {
	const { user, signOut } = useAuth();
	const [biometricAvailable, setBiometricAvailable] = useState(false);
	const [biometricEnabled, setBiometricEnabledState] = useState(false);

	const loadBiometricState = useCallback(async () => {
		const available = await isBiometricAvailable();
		const enabled = await isBiometricEnabled();
		setBiometricAvailable(available);
		setBiometricEnabledState(enabled);
	}, []);

	// Reload biometric state when screen comes into focus
	useFocusEffect(
		useCallback(() => {
			loadBiometricState();
		}, [loadBiometricState]),
	);

	async function handleBiometricToggle(value: boolean) {
		await setBiometricEnabled(value);
		setBiometricEnabledState(value);
	}

	const biometricName = Platform.OS === "ios" ? "Face ID" : "Fingerprint";

	return (
		<ScrollView className="flex-1">
			<View className="gap-6 p-6">
				<Text variant="h1">Settings</Text>

				{user && (
					<View className="gap-2">
						<Text variant="h3">Account</Text>
						<Text>{user.email}</Text>
						{user.name && <Text variant="muted">{user.name}</Text>}
					</View>
				)}

				{biometricAvailable && (
					<View className="gap-3">
						<View className="flex-row items-center justify-between">
							<Label nativeID="biometric-label">
								<Text>Enable {biometricName}</Text>
							</Label>
							<Switch
								testID="biometric-toggle"
								nativeID="biometric-toggle"
								checked={biometricEnabled}
								onCheckedChange={handleBiometricToggle}
							/>
						</View>
						<Text variant="muted" className="text-sm">
							Use {biometricName} to unlock the app
						</Text>
					</View>
				)}

				<View className="mt-4 gap-3">
					<Button
						variant="destructive"
						onPress={signOut}
						testID="signout-button"
					>
						<Text>Sign Out</Text>
					</Button>
				</View>
			</View>
		</ScrollView>
	);
}
