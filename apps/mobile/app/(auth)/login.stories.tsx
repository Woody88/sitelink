import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";

function LoginScreen({
	initialError,
	initialLoading,
}: {
	initialError?: string | null;
	initialLoading?: boolean;
}) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(initialError ?? null);
	const [loading, setLoading] = useState(initialLoading ?? false);

	function handleSignIn() {
		if (!email || !password) {
			setError("Please fill in all fields");
			return;
		}
		setError(null);
		setLoading(true);
		setTimeout(() => setLoading(false), 2000);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1"
		>
			<ScrollView
				contentContainerClassName="flex-1 justify-center p-6 gap-6"
				keyboardShouldPersistTaps="handled"
			>
				<View className="mb-2 items-center">
					<View className="flex-row items-center gap-2">
						<View className="h-2 w-2 rounded-full bg-green-500" />
						<Text variant="small" className="text-muted-foreground">
							Synced
						</Text>
					</View>
				</View>

				<View className="gap-2">
					<Text variant="h1" className="text-center">
						Sign In
					</Text>
					<Text variant="muted" className="text-center">
						Enter your email and password to continue
					</Text>
				</View>

				<View className="gap-4">
					<View className="gap-2">
						<Label nativeID="email-label">
							<Text>Email</Text>
						</Label>
						<Input
							nativeID="email-input"
							placeholder="Email"
							value={email}
							onChangeText={setEmail}
							keyboardType="email-address"
							autoCapitalize="none"
							autoComplete="email"
							editable={!loading}
						/>
					</View>

					<View className="gap-2">
						<Label nativeID="password-label">
							<Text>Password</Text>
						</Label>
						<Input
							nativeID="password-input"
							placeholder="Password"
							value={password}
							onChangeText={setPassword}
							secureTextEntry
							autoCapitalize="none"
							autoComplete="password"
							editable={!loading}
						/>
					</View>

					{error && <Text className="text-destructive text-sm">{error}</Text>}

					<Button
						onPress={handleSignIn}
						disabled={loading}
						className="mt-2"
					>
						<Text>Sign In</Text>
					</Button>
				</View>

				<View className="flex-row justify-center gap-2">
					<Text variant="muted">Don&apos;t have an account?</Text>
					<Button variant="link" disabled={loading}>
						<Text variant="link">Sign Up</Text>
					</Button>
				</View>

				<View className="mt-4 gap-3">
					<Button
						variant="outline"
						disabled
						className="opacity-50"
					>
						<Text>Continue with Google</Text>
						<Text variant="muted" className="ml-2 text-xs">
							(Coming Soon)
						</Text>
					</Button>

					<Button
						variant="outline"
						disabled
						className="opacity-50"
					>
						<Text>Continue with Microsoft</Text>
						<Text variant="muted" className="ml-2 text-xs">
							(Coming Soon)
						</Text>
					</Button>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const meta: Meta<typeof LoginScreen> = {
	title: "Screens/Login",
	component: LoginScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof LoginScreen>;

export const Default: Story = {};

export const WithError: Story = {
	args: {
		initialError: "Invalid email or password",
	},
};

export const Loading: Story = {
	args: {
		initialLoading: true,
	},
};
