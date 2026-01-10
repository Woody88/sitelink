import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Database } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View, Pressable, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearLiveStoreDatabase } from '@/lib/clear-database';
import * as Updates from 'expo-updates';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [isClearing, setIsClearing] = React.useState(false);

  const handleClearDatabase = React.useCallback(async () => {
    Alert.alert(
      'Clear Database',
      'This will delete all local data and restart the app. The app will resync from the server on next launch.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Restart',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              const success = await clearLiveStoreDatabase();
              if (success) {
                // Reload the app
                if (__DEV__) {
                  // In development, just reload
                  await Updates.reloadAsync();
                } else {
                  // In production, restart
                  await Updates.reloadAsync();
                }
              } else {
                Alert.alert('Error', 'Failed to clear database');
                setIsClearing(false);
              }
            } catch (error) {
              console.error('Error clearing database:', error);
              Alert.alert('Error', 'Failed to clear database');
              setIsClearing(false);
            }
          },
        },
      ]
    );
  }, []);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen 
        options={{ 
          headerTitle: () => <Text className="text-foreground text-lg font-bold">Profile</Text>,
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: 'center',
        }} 
      />
      
      <ScrollView 
        className="flex-1" 
        contentContainerClassName="px-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
          {/* Avatar Section */}
          <View className="items-center pt-4 pb-8">
              <View className="relative">
                  <View className="size-24 rounded-full bg-primary/10 items-center justify-center border-4 border-background">
                      <Text className="text-3xl font-bold text-primary">JS</Text>
                  </View>
                  <Pressable className="absolute bottom-0 right-0 bg-secondary rounded-full p-2 border-4 border-background">
                      <Icon as={Camera} className="size-4 text-secondary-foreground" />
                  </Pressable>
              </View>
          </View>

          {/* Form Section */}
          <View className="gap-6">
              <View className="gap-2">
                  <Label nativeID="fullName">Full Name</Label>
                  <Input
                      nativeID="fullName"
                      className="h-12 rounded-xl"
                      defaultValue="John Smith"
                  />
              </View>

              <View className="gap-2">
                  <Label nativeID="email">Email</Label>
                  <Input
                      nativeID="email"
                      className="h-12 rounded-xl opacity-50"
                      defaultValue="john@sitelink.com"
                      editable={false}
                  />
                  <Text className="text-xs text-muted-foreground px-1">Email cannot be changed.</Text>
              </View>

              <View className="gap-2">
                  <Label nativeID="phone">Phone Number</Label>
                  <Input
                      nativeID="phone"
                      className="h-12 rounded-xl"
                      defaultValue="(555) 123-4567"
                      keyboardType="phone-pad"
                  />
              </View>

              <View className="gap-2">
                  <Label nativeID="company">Company</Label>
                  <Input
                      nativeID="company"
                      className="h-12 rounded-xl"
                      defaultValue="Smith Electrical LLC"
                  />
              </View>

              {/* Save Button - Integrated into scroll view */}
              <View className="mt-6">
                <Button className="h-12 rounded-xl">
                    <Text className="text-base font-semibold">Save Changes</Text>
                </Button>
              </View>
          </View>

          {/* Developer Section - Only show in development */}
          {__DEV__ && (
            <View className="mt-12 pt-8 border-t border-border">
              <Text className="text-lg font-bold text-foreground mb-4">Developer Tools</Text>

              <View className="gap-3">
                <View className="gap-2">
                  <Text className="text-sm text-muted-foreground px-1">
                    Clear local database if you encounter schema mismatch errors (MaterializerHashMismatchError).
                  </Text>
                  <Button
                    variant="destructive"
                    className="h-12 rounded-xl flex-row items-center gap-2"
                    onPress={handleClearDatabase}
                    disabled={isClearing}
                  >
                    <Icon as={Database} className="size-5 text-destructive-foreground" />
                    <Text className="text-base font-semibold text-destructive-foreground">
                      {isClearing ? 'Clearing...' : 'Clear Database & Restart'}
                    </Text>
                  </Button>
                </View>
              </View>
            </View>
          )}
      </ScrollView>
    </View>
  );
}
