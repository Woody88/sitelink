import { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Inbox,
  WifiOff,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useAuth, useRedirectIfAuthenticated } from "@/lib/auth-context";
import {
  SocialButton,
  GoogleIcon,
  AppleIcon,
} from "@/components/auth";
import { cn } from "@/lib/utils";

export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useRedirectIfAuthenticated();

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setLocalError("Please enter your password");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Sign in failed. Please try again.";
      Alert.alert("Sign In Failed", message);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert("Forgot Password", "Password reset functionality coming soon.");
  };

  const handleEmailLink = () => {
    Alert.alert("Magic Link", "Magic link login coming soon.");
  };

  const handleGoogleLogin = () => {
    Alert.alert("Google Login", "Google login coming soon.");
  };

  const handleAppleLogin = () => {
    Alert.alert("Apple Login", "Apple login coming soon.");
  };

  const displayError = localError || error;

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
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Offline Ready Badge - Top Right */}
          <View className="absolute top-12 right-4 bg-white/70 px-3 py-1.5 rounded-full border border-border flex-row items-center gap-1.5 z-10">
            <WifiOff size={14} color="#c9623d" strokeWidth={2} />
            <Text className="text-xs font-medium text-foreground">Offline Ready</Text>
          </View>

          {/* Hero Section - Centered SiteLink */}
          <View className="items-center pt-20 pb-8">
            <Text className="text-foreground text-4xl font-bold tracking-tight">
              SiteLink
            </Text>
            <Text className="text-muted-foreground text-base font-medium mt-1">
              Field Management OS
            </Text>
          </View>

          {/* Welcome Section */}
          <View className="px-4 pb-6 items-center">
            <Text className="text-foreground text-2xl font-bold tracking-tight">
              Welcome Back
            </Text>
            <Text className="text-muted-foreground text-sm mt-1">
              Manage plans anywhere, anytime.
            </Text>
          </View>

          {/* Error Message */}
          {displayError && (
            <View className="mx-4 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <Text className="text-red-600 text-sm text-center">{displayError}</Text>
            </View>
          )}

          {/* Form */}
          <View className="flex-1 px-4 gap-5 pb-8">
            {/* Email Field */}
            <View className="gap-2">
              <Text className="text-foreground text-sm font-semibold ml-1">
                Email Address
              </Text>
              <View className="relative flex-row items-center">
                <View className="absolute left-4 z-10">
                  <Mail size={20} color="#828180" strokeWidth={2} />
                </View>
                <TextInput
                  className="flex-1 h-14 pl-12 pr-4 rounded-xl border border-border bg-white text-foreground text-base"
                  placeholder="foreman@site.com"
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

            {/* Password Field */}
            <View className="gap-2">
              <View className="flex-row justify-between items-center ml-1 mr-1">
                <Text className="text-foreground text-sm font-semibold">Password</Text>
                <Pressable onPress={handleForgotPassword} className="p-2 -mr-2">
                  <Text className="text-primary text-sm font-semibold">Forgot?</Text>
                </Pressable>
              </View>
              <View className="relative flex-row items-center">
                <View className="absolute left-4 z-10">
                  <Lock size={20} color="#828180" strokeWidth={2} />
                </View>
                <TextInput
                  className="flex-1 h-14 pl-12 pr-14 rounded-xl border border-border bg-white text-foreground text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#828180"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
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
            </View>

            {/* Action Buttons */}
            <View className="pt-2 gap-3">
              {/* Primary Submit Button */}
              <Pressable
                onPress={handleSubmit}
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
                  {isLoading ? "Signing In..." : "Log In"}
                </Text>
                {!isLoading && <ArrowRight size={20} color="#ffffff" strokeWidth={2.5} />}
              </Pressable>

              {/* Email Magic Link Button */}
              <Pressable
                onPress={handleEmailLink}
                disabled={isLoading}
                className={cn(
                  "flex-row h-14 items-center justify-center gap-2 rounded-xl bg-white border border-border",
                  "active:bg-secondary",
                  isLoading && "opacity-50"
                )}
              >
                <Inbox size={22} color="#c9623d" strokeWidth={2} />
                <Text className="text-foreground text-base font-bold">
                  Email me a login link
                </Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View className="flex-row py-2 items-center">
              <View className="flex-1 h-px bg-border" />
              <Text className="mx-4 text-muted-foreground text-sm">Or continue with</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Social Login Buttons */}
            <View className="flex-row gap-4">
              <SocialButton
                icon={<GoogleIcon size={24} />}
                label="Google"
                onPress={handleGoogleLogin}
                disabled={isLoading}
              />
              <SocialButton
                icon={<AppleIcon size={24} />}
                label="Apple"
                onPress={handleAppleLogin}
                disabled={isLoading}
              />
            </View>

            {/* Sign Up Link */}
            <View className="flex-row justify-center items-center gap-1 pt-2">
              <Text className="text-muted-foreground text-sm">
                Don't have an account?
              </Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable disabled={isLoading}>
                  <Text className="text-primary text-sm font-semibold">
                    Sign Up
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>

          {/* Bottom padding */}
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
