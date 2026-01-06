import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen 
        options={{ 
          headerTitle: () => <Text className="text-foreground text-lg font-bold">Profile</Text>,
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#121212',
          },
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
      </ScrollView>
    </View>
  );
}
