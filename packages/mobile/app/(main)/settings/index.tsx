import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function SettingsScreen() {
  const handleLogout = () => {
    // TODO: Implement actual logout with better-auth in Task 6
    console.log('Logout');
    router.replace('/(auth)/login');
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

        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">Account</Text>
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
            className="mt-4"
            onPress={handleLogout}
          >
            <Text>Sign Out</Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

