import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { useFocusEffect } from "@react-navigation/native";
import { Camera, Database, LogOut } from "lucide-react-native";
import * as React from "react";
import {
	Alert,
	NativeModules,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/useAuth";
import {
	isBiometricAvailable,
	isBiometricEnabled,
	setBiometricEnabled,
} from "@/lib/biometric";
import { clearLiveStoreDatabase } from "@/lib/clear-database";

const { DevSettings } = NativeModules;

export default function ProfileScreen() {
	const insets = useSafeAreaInsets();
	const { signOut } = useAuth();
	const [isClearing, setIsClearing] = React.useState(false);
	const [biometricAvailable, setBiometricAvailable] = React.useState(false);
	const [biometricEnabled, setBiometricEnabledState] = React.useState(false);

	const biometricName = Platform.OS === "ios" ? "Face ID" : "Fingerprint";

	const loadBiometricState = React.useCallback(async () => {
		const available = await isBiometricAvailable();
		const enabled = await isBiometricEnabled();
		setBiometricAvailable(available);
		setBiometricEnabledState(enabled);
	}, []);

	useFocusEffect(
		React.useCallback(() => {
			loadBiometricState();
		}, [loadBiometricState]),
	);

	async function handleBiometricToggle(value: boolean) {
		await setBiometricEnabled(value);
		setBiometricEnabledState(value);
	}

	const handleClearDatabase = React.useCallback(async () => {
		Alert.alert(
			"Clear Database",
			"This will delete all local data and restart the app. The app will resync from the server on next launch.\n\nAre you sure?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear & Restart",
					style: "destructive",
					onPress: async () => {
						try {
							setIsClearing(true);
							const success = await clearLiveStoreDatabase();
							if (success) {
								Alert.alert(
									"Database Cleared",
									"Local database has been cleared. Please close and restart the app manually.",
									[
										{
											text: "OK",
											onPress: () => {
												// In development, use DevSettings to reload
												if (__DEV__ && DevSettings) {
													DevSettings.reload();
												} else {
													// In production with OTA updates
													Updates.reloadAsync().catch((err) => {
														console.error("Failed to reload:", err);
													});
												}
											},
										},
									],
								);
							} else {
								Alert.alert("Error", "Failed to clear database");
								setIsClearing(false);
							}
						} catch (error) {
							console.error("Error clearing database:", error);
							Alert.alert("Error", "Failed to clear database");
							setIsClearing(false);
						}
					},
				},
			],
		);
	}, []);

	return (
		<View className="bg-background flex-1">
			<Stack.Screen
				options={{
					headerTitle: () => (
						<Text className="text-foreground text-lg font-bold">Profile</Text>
					),
					headerShown: true,
					headerShadowVisible: false,
					headerTitleAlign: "center",
				}}
			/>

			<ScrollView
				className="flex-1"
				contentContainerClassName="px-6 pb-12"
				showsVerticalScrollIndicator={false}
			>
				{/* Avatar Section */}
				<View className="items-center pt-4 pb-8">
					<View className="relative">
						<View className="bg-primary/10 border-background size-24 items-center justify-center rounded-full border-4">
							<Text className="text-primary text-3xl font-bold">JS</Text>
						</View>
						<Pressable className="bg-secondary border-background absolute right-0 bottom-0 rounded-full border-4 p-2">
							<Icon as={Camera} className="text-secondary-foreground size-4" />
						</Pressable>
					</View>
				</View>

				{/* Form Section */}
				<View className="gap-6">
					<View className="gap-2">
						<Label nativeID="fullName">Full Name</Label>
						<Input
							nativeID="fullName"
							className="h-12 rounded-xl"
							defaultValue="John Smith"
						/>
					</View>

					<View className="gap-2">
						<Label nativeID="email">Email</Label>
						<Input
							nativeID="email"
							className="h-12 rounded-xl opacity-50"
							defaultValue="john@sitelink.com"
							editable={false}
						/>
						<Text className="text-muted-foreground px-1 text-xs">
							Email cannot be changed.
						</Text>
					</View>

					<View className="gap-2">
						<Label nativeID="phone">Phone Number</Label>
						<Input
							nativeID="phone"
							className="h-12 rounded-xl"
							defaultValue="(555) 123-4567"
							keyboardType="phone-pad"
						/>
					</View>

					<View className="gap-2">
						<Label nativeID="company">Company</Label>
						<Input
							nativeID="company"
							className="h-12 rounded-xl"
							defaultValue="Smith Electrical LLC"
						/>
					</View>

					{/* Save Button - Integrated into scroll view */}
					<View className="mt-6">
						<Button className="h-12 rounded-xl">
							<Text className="text-base font-semibold">Save Changes</Text>
						</Button>
					</View>
				</View>

				{/* Security Section */}
				{biometricAvailable && (
					<View className="border-border mt-10 border-t pt-8">
						<Text className="text-foreground mb-4 text-lg font-bold">
							Security
						</Text>
						<View className="gap-3">
							<View className="flex-row items-center justify-between">
								<Label nativeID="biometric-label">
									<Text>{biometricName} Unlock</Text>
								</Label>
								<Switch
									testID="biometric-toggle"
									nativeID="biometric-toggle"
									checked={biometricEnabled}
									onCheckedChange={handleBiometricToggle}
								/>
							</View>
							<Text className="text-muted-foreground text-sm">
								Use {biometricName} to unlock SiteLink instead of your password
							</Text>
						</View>
					</View>
				)}

				{/* Account Section */}
				<View className="border-border mt-10 border-t pt-8 pb-4">
					<Button
						variant="destructive"
						onPress={signOut}
						testID="signout-button"
						className="h-12 flex-row items-center gap-2 rounded-xl"
					>
						<Icon as={LogOut} className="text-destructive-foreground size-5" />
						<Text className="text-destructive-foreground text-base font-semibold">
							Sign Out
						</Text>
					</Button>
				</View>

				{/* Developer Section - Only show in development */}
				{__DEV__ && (
					<View className="border-border mt-12 border-t pt-8">
						<Text className="text-foreground mb-4 text-lg font-bold">
							Developer Tools
						</Text>

						<View className="gap-3">
							<View className="gap-2">
								<Text className="text-muted-foreground px-1 text-sm">
									Clear local database if you encounter schema mismatch errors
									(MaterializerHashMismatchError).
								</Text>
								<Button
									variant="destructive"
									className="h-12 flex-row items-center gap-2 rounded-xl"
									onPress={handleClearDatabase}
									disabled={isClearing}
								>
									<Icon
										as={Database}
										className="text-destructive-foreground size-5"
									/>
									<Text className="text-destructive-foreground text-base font-semibold">
										{isClearing ? "Clearing..." : "Clear Database & Restart"}
									</Text>
								</Button>
							</View>
						</View>
					</View>
				)}
			</ScrollView>
		</View>
	);
}
