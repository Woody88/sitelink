import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  // Redirect based on authentication state
  if (isAuthenticated) {
    return <Redirect href="/(main)/projects" />;
  }

  return <Redirect href="/(auth)/login" />;
}
