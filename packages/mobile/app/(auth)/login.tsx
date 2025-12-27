import { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth, useRedirectIfAuthenticated } from "@/lib/auth-context";

export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useRedirectIfAuthenticated();

  const handleLogin = async () => {
    // Clear previous errors
    setLocalError(null);
    clearError();

    // Validate inputs
    if (!email.trim()) {
      setLocalError("Please enter your email address");
      return;
    }

    if (!password) {
      setLocalError("Please enter your password");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError("Please enter a valid email address");
      return;
    }

    try {
      await signIn(email.trim().toLowerCase(), password);
      // Navigation is handled by the auth context on successful login
    } catch (err) {
      // Error is already set in auth context, but we can show an alert too
      const message =
        err instanceof Error ? err.message : "Sign in failed. Please try again.";
      Alert.alert("Sign In Failed", message);
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-12 gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Welcome Back
            </Text>
            <Text className="text-base text-muted-foreground">
              Sign in to access your construction projects
            </Text>
          </View>

          {displayError && (
            <View className="bg-red-50 border border-red-200 rounded-md p-3">
              <Text className="text-red-600 text-sm">{displayError}</Text>
            </View>
          )}

          <View className="gap-4 mt-8">
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Email</Text>
              <TextInput
                className="h-12 border border-input rounded-md px-3 bg-background text-foreground"
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">
                Password
              </Text>
              <TextInput
                className="h-12 border border-input rounded-md px-3 bg-background text-foreground"
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading}
              />
            </View>

            <Button
              onPress={handleLogin}
              className="mt-4 h-12"
              disabled={isLoading}
            >
              <Text className="text-white font-semibold">
                {isLoading ? "Signing In..." : "Sign In"}
              </Text>
            </Button>
          </View>

          <View className="flex-row justify-center gap-2 mt-4">
            <Text className="text-muted-foreground">
              Don't have an account?
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Button variant="link" className="p-0 h-auto" disabled={isLoading}>
                <Text className="text-primary">Sign Up</Text>
              </Button>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
