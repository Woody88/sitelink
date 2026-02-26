// apps/mobile/app/(auth)/signup.tsx

import { useRouter } from "expo-router";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/useAuth";

export default function SignUpScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { signUp } = useAuth();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSignUp() {
		if (!name || !email || !password || !organizationName) {
			setError("Please fill in all fields");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setError(null);
		setLoading(true);

		const result = await signUp(email, password, name, organizationName);
		console.log("[SIGNUP] Result:", JSON.stringify(result, null, 2));

		if (result.success) {
			console.log("[SIGNUP] Success! Waiting for session refresh...");
		} else {
			setError(result.error || "Sign up failed");
			setLoading(false);
		}
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="bg-background flex-1"
		>
			<ScrollView
				contentContainerClassName="flex-grow justify-center px-6"
				keyboardShouldPersistTaps="handled"
				style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
			>
				<Pressable
					onPress={() => router.back()}
					className="mb-8 self-start pt-2"
				>
					<Text className="text-muted-foreground text-sm">← Back</Text>
				</Pressable>

				<Text className="text-foreground mb-1 text-2xl font-bold">
					Create account
				</Text>
				<Text className="text-muted-foreground mb-8 text-sm">
					Get started with a 14-day free trial
				</Text>

				<View className="gap-4">
					<Input
						testID="name-input"
						placeholder="Full Name"
						value={name}
						onChangeText={setName}
						autoCapitalize="words"
						autoComplete="name"
						autoFocus
						editable={!loading}
						className="h-14 rounded-2xl px-4"
					/>
					<Input
						testID="organization-input"
						placeholder="Company or Organization"
						value={organizationName}
						onChangeText={setOrganizationName}
						autoCapitalize="words"
						autoComplete="organization"
						editable={!loading}
						className="h-14 rounded-2xl px-4"
					/>
					<Input
						testID="email-input"
						placeholder="Email"
						value={email}
						onChangeText={setEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						autoComplete="email"
						editable={!loading}
						className="h-14 rounded-2xl px-4"
					/>
					<Input
						testID="password-input"
						placeholder="Password (8+ characters)"
						value={password}
						onChangeText={setPassword}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="password-new"
						editable={!loading}
						className="h-14 rounded-2xl px-4"
					/>

					{error && (
						<Text className="text-destructive text-sm">{error}</Text>
					)}

					<Button
						testID="signup-button"
						onPress={handleSignUp}
						disabled={loading}
						className="mt-2 h-14 rounded-2xl"
					>
						<Text className="text-base font-semibold">
							{loading ? "Creating account..." : "Create Account"}
						</Text>
					</Button>
				</View>

				<View className="mt-8 flex-row justify-center gap-1 pb-8">
					<Text className="text-muted-foreground text-sm">
						Already have an account?
					</Text>
					<Pressable
						testID="login-link"
						onPress={() => router.push("/(auth)/login" as any)}
					>
						<Text className="text-primary text-sm font-semibold">Sign In</Text>
					</Pressable>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
