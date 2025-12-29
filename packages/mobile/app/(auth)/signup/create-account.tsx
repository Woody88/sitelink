import { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, Link } from "expo-router";
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Construction,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useAuth, useRedirectIfAuthenticated } from "@/lib/auth-context";
import { StepIndicator } from "@/components/signup";
import { getSignupOrgData, clearSignupOrgData } from "./create-org";
import { cn } from "@/lib/utils";

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signUp, isLoading, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useRedirectIfAuthenticated();

  // Ensure we have org data from step 1
  useEffect(() => {
    const orgData = getSignupOrgData();
    if (!orgData.name || !orgData.industryType || !orgData.teamSize) {
      // No org data, go back to step 1
      router.replace("/(auth)/signup/create-org");
    }
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleCreateAccount = async () => {
    setLocalError(null);
    clearError();

    // Validate email
    if (!email.trim()) {
      setLocalError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError("Please enter a valid email address");
      return;
    }

    // Validate password
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
      const orgData = getSignupOrgData();

      // Create account with org name
      // The backend will handle organization creation via the user.create.after hook
      await signUp(email.trim().toLowerCase(), password, orgData.name);

      // Clear the signup data after successful registration
      clearSignupOrgData();

      // Navigation is handled by the auth context
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign up failed. Please try again.";
      Alert.alert("Sign Up Failed", message);
    }
  };

  const displayError = localError || authError;

  return (
    <LinearGradient
      colors={["#f9f7f2", "#f0ebe0", "#e8e2d4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header with safe area inset */}
        <View
          className="flex-row items-center justify-between px-4 pb-4"
          style={{ paddingTop: insets.top + 8 }}
        >
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/70 border border-border"
            >
              <ArrowLeft size={20} color="#3d3929" strokeWidth={2} />
            </Pressable>
            <Text className="text-lg font-semibold text-foreground">
              Sign Up
            </Text>
            <View className="w-10" />
          </View>

          {/* Step Indicator */}
          <View className="py-4">
            <StepIndicator currentStep={2} />
          </View>

          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Construction Icon */}
            <View className="items-center pb-4">
              <View className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                <Construction size={32} color="#c9623d" strokeWidth={1.5} />
              </View>
            </View>

            {/* Title Section */}
            <View className="px-6 pb-6">
              <Text className="text-2xl font-bold text-foreground text-center">
                Create Account
              </Text>
              <Text className="text-muted-foreground text-center mt-2">
                Enter your details to start managing your site.
              </Text>
            </View>

            {/* Error Message */}
            {displayError && (
              <View className="mx-6 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <Text className="text-red-600 text-sm text-center">
                  {displayError}
                </Text>
              </View>
            )}

            {/* Form */}
            <View className="px-6 gap-5">
              {/* Work Email */}
              <View className="gap-2">
                <Text className="text-foreground text-sm font-semibold ml-1">
                  Work Email
                </Text>
                <View className="relative flex-row items-center">
                  <View className="absolute left-4 z-10">
                    <Mail size={20} color="#828180" strokeWidth={2} />
                  </View>
                  <TextInput
                    className="flex-1 h-14 pl-12 pr-4 rounded-xl border border-border bg-white text-foreground text-base"
                    placeholder="foreman@construction.com"
                    placeholderTextColor="#828180"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Password */}
              <View className="gap-2">
                <Text className="text-foreground text-sm font-semibold ml-1">
                  Password
                </Text>
                <View className="relative flex-row items-center">
                  <View className="absolute left-4 z-10">
                    <Lock size={20} color="#828180" strokeWidth={2} />
                  </View>
                  <TextInput
                    className="flex-1 h-14 pl-12 pr-14 rounded-xl border border-border bg-white text-foreground text-base"
                    placeholder="Enter password"
                    placeholderTextColor="#828180"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute right-4"
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#828180" strokeWidth={2} />
                    ) : (
                      <Eye size={20} color="#828180" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
                <Text className="text-muted-foreground text-xs ml-1">
                  Min. 8 characters
                </Text>
              </View>

              {/* Confirm Password */}
              <View className="gap-2">
                <Text className="text-foreground text-sm font-semibold ml-1">
                  Confirm Password
                </Text>
                <View className="relative flex-row items-center">
                  <View className="absolute left-4 z-10">
                    <Lock size={20} color="#828180" strokeWidth={2} />
                  </View>
                  <TextInput
                    className="flex-1 h-14 pl-12 pr-14 rounded-xl border border-border bg-white text-foreground text-base"
                    placeholder="Re-enter password"
                    placeholderTextColor="#828180"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#828180" strokeWidth={2} />
                    ) : (
                      <Eye size={20} color="#828180" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Create Account Button */}
              <View className="pt-4">
                <Pressable
                  onPress={handleCreateAccount}
                  disabled={isLoading}
                  className={cn(
                    "flex-row h-14 items-center justify-center gap-2 rounded-xl bg-primary",
                    "active:opacity-90",
                    isLoading && "opacity-50"
                  )}
                  style={{
                    shadowColor: "#c9623d",
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.25,
                    shadowRadius: 15,
                    elevation: 8,
                  }}
                >
                  <Text className="text-white text-base font-bold tracking-wide">
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Text>
                </Pressable>
              </View>

              {/* Login Link */}
              <View className="flex-row justify-center items-center gap-1 pt-2">
                <Text className="text-muted-foreground text-sm">
                  Already have an account?
                </Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable disabled={isLoading}>
                    <Text className="text-primary text-sm font-semibold">
                      Log In
                    </Text>
                  </Pressable>
                </Link>
              </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
