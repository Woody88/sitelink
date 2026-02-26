// apps/mobile/app/(auth)/login.tsx

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

export default function LoginScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { signIn } = useAuth();
	const [showEmailForm, setShowEmailForm] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSignIn() {
		if (!email || !password) {
			setError("Please fill in all fields");
			return;
		}

		setError(null);
		setLoading(true);

		const result = await signIn(email, password);

		if (!result.success) {
			setError(result.error || "Sign in failed");
			setLoading(false);
		}
	}

	if (showEmailForm) {
		return (
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="bg-background flex-1"
			>
				<ScrollView
					contentContainerClassName="flex-1 justify-center px-6"
					keyboardShouldPersistTaps="handled"
					style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
				>
					<Pressable
						onPress={() => setShowEmailForm(false)}
						className="mb-8 self-start"
					>
						<Text className="text-muted-foreground text-sm">← Back</Text>
					</Pressable>

					<Text className="text-foreground mb-1 text-2xl font-bold">
						Sign in
					</Text>
					<Text className="text-muted-foreground mb-8 text-sm">
						Enter your email and password
					</Text>

					<View className="gap-4">
						<Input
							testID="email-input"
							placeholder="Email"
							value={email}
							onChangeText={setEmail}
							keyboardType="email-address"
							autoCapitalize="none"
							autoComplete="email"
							autoFocus
							editable={!loading}
							className="h-14 rounded-2xl px-4"
						/>
						<Input
							testID="password-input"
							placeholder="Password"
							value={password}
							onChangeText={setPassword}
							secureTextEntry
							autoCapitalize="none"
							autoComplete="password"
							editable={!loading}
							className="h-14 rounded-2xl px-4"
						/>

						{error && (
							<Text className="text-destructive text-sm">{error}</Text>
						)}

						<Button
							testID="signin-button"
							onPress={handleSignIn}
							disabled={loading}
							className="mt-2 h-14 rounded-2xl"
						>
							<Text className="text-base font-semibold">
								{loading ? "Signing in..." : "Sign In"}
							</Text>
						</Button>
					</View>

					<View className="mt-8 flex-row justify-center gap-1">
						<Text className="text-muted-foreground text-sm">
							Don&apos;t have an account?
						</Text>
						<Pressable onPress={() => router.push("/(auth)/signup" as any)}>
							<Text className="text-primary text-sm font-medium">Sign Up</Text>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		);
	}

	return (
		<View
			className="bg-background flex-1"
			style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}
		>
			<ScrollView
				contentContainerClassName="flex-1 justify-between px-6"
				showsVerticalScrollIndicator={false}
			>
				{/* Logo + Tagline */}
				<View className="flex-1 items-center justify-center py-16">
					{/* Logo mark — geometric accent dots using discipline colors */}
					<View className="mb-6 flex-row items-center gap-1.5">
						<View className="bg-primary size-6 rounded-md" />
						<View className="bg-violet-500 size-6 rounded-md opacity-80" />
						<View className="bg-amber-500 size-6 rounded-md opacity-60" />
					</View>

					{/* Wordmark */}
					<Text className="text-foreground mb-3 text-4xl font-bold tracking-tight">
						SiteLink
					</Text>

					{/* Tagline */}
					<Text className="text-muted-foreground max-w-[260px] text-center text-base leading-relaxed">
						The plan viewer that links itself
					</Text>
				</View>

				{/* Auth actions */}
				<View className="gap-3 pb-4">
					{/* Google OAuth */}
					<Button
						testID="oauth-google-button"
						variant="outline"
						disabled
						className="h-14 flex-row items-center justify-center gap-3 rounded-2xl opacity-50"
					>
						<Text className="text-base font-semibold">Continue with Google</Text>
					</Button>

					{/* Microsoft OAuth */}
					<Button
						testID="oauth-microsoft-button"
						variant="outline"
						disabled
						className="h-14 flex-row items-center justify-center gap-3 rounded-2xl opacity-50"
					>
						<Text className="text-base font-semibold">
							Continue with Microsoft
						</Text>
					</Button>

					{/* Divider */}
					<View className="flex-row items-center gap-3 py-1">
						<View className="bg-border h-px flex-1" />
						<Text className="text-muted-foreground text-xs">or</Text>
						<View className="bg-border h-px flex-1" />
					</View>

					{/* Email sign in */}
					<Button
						testID="email-signin-button"
						variant="ghost"
						onPress={() => setShowEmailForm(true)}
						className="h-12 rounded-2xl"
					>
						<Text className="text-muted-foreground text-sm font-medium">
							Sign in with email
						</Text>
					</Button>

					{/* Sign up link */}
					<View className="flex-row items-center justify-center gap-1">
						<Text className="text-muted-foreground text-sm">
							New to SiteLink?
						</Text>
						<Pressable
							testID="signup-link"
							onPress={() => router.push("/(auth)/signup" as any)}
						>
							<Text className="text-primary text-sm font-semibold">
								Create account
							</Text>
						</Pressable>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}
