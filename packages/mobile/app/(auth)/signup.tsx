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

export default function SignupScreen() {
  const { signUp, isLoading, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useRedirectIfAuthenticated();

  const handleSignup = async () => {
    // Clear previous errors
    setLocalError(null);
    clearError();

    // Validate inputs
    if (!email.trim()) {
      setLocalError("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setLocalError("Please enter a password");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    try {
      await signUp(email.trim().toLowerCase(), password, name.trim() || undefined);
      // Navigation is handled by the auth context on successful signup
    } catch (err) {
      // Error is already set in auth context, but we can show an alert too
      const message =
        err instanceof Error ? err.message : "Sign up failed. Please try again.";
      Alert.alert("Sign Up Failed", message);
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
              Create Account
            </Text>
            <Text className="text-base text-muted-foreground">
              Sign up to start managing your construction projects
            </Text>
          </View>

          {displayError && (
            <View className="bg-red-50 border border-red-200 rounded-md p-3">
              <Text className="text-red-600 text-sm">{displayError}</Text>
            </View>
          )}

          <View className="gap-4 mt-8">
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">
                Name (optional)
              </Text>
              <TextInput
                className="h-12 border border-input rounded-md px-3 bg-background text-foreground"
                placeholder="Enter your name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                editable={!isLoading}
              />
            </View>

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
                placeholder="Enter your password (min 8 characters)"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isLoading}
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">
                Confirm Password
              </Text>
              <TextInput
                className="h-12 border border-input rounded-md px-3 bg-background text-foreground"
                placeholder="Confirm your password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isLoading}
              />
            </View>

            <Button
              onPress={handleSignup}
              className="mt-4 h-12"
              disabled={isLoading}
            >
              <Text className="text-white font-semibold">
                {isLoading ? "Creating Account..." : "Create Account"}
              </Text>
            </Button>
          </View>

          <View className="flex-row justify-center gap-2 mt-4">
            <Text className="text-muted-foreground">
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Button variant="link" className="p-0 h-auto" disabled={isLoading}>
                <Text className="text-primary">Sign In</Text>
              </Button>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
