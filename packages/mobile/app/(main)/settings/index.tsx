import { View, ScrollView, Pressable, Alert } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

export default function SettingsScreen() {
  const { user, signOut, isLoading } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              // Navigation is handled by the auth context
            } catch (error) {
              console.error("[Settings] Sign out error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-6 gap-6">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Settings</Text>
          <Text className="text-base text-muted-foreground">
            Manage your account and preferences
          </Text>
        </View>

        {/* User Info Section */}
        {user && (
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">
              Signed In As
            </Text>
            <View className="border border-input rounded-lg p-4 bg-card">
              <Text className="text-base font-medium text-foreground">
                {user.name || "No name set"}
              </Text>
              <Text className="text-sm text-muted-foreground">{user.email}</Text>
            </View>
          </View>
        )}

        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">
              Account
            </Text>
            <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
              <Text className="text-base text-foreground">Profile Settings</Text>
            </Pressable>
            <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
              <Text className="text-base text-foreground">Notifications</Text>
            </Pressable>
          </View>

          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">App</Text>
            <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
              <Text className="text-base text-foreground">About</Text>
            </Pressable>
            <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
              <Text className="text-base text-foreground">Help & Support</Text>
            </Pressable>
          </View>

          <Button
            variant="destructive"
            className="mt-4 h-12"
            onPress={handleLogout}
            disabled={isLoading}
          >
            <Text className="text-white font-semibold">
              {isLoading ? "Signing Out..." : "Sign Out"}
            </Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
