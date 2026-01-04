import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Camera } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, TextInput, View, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Profile', 
          headerShown: true 
        }} 
      />
      
      <ScrollView contentContainerClassName="p-6 gap-8 pb-12">
        {/* Avatar Section */}
        <View className="items-center">
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
                <Text className="font-medium text-sm text-muted-foreground">Full Name</Text>
                <TextInput
                    className="h-12 rounded-xl border border-input bg-background px-3 text-foreground"
                    defaultValue="John Smith"
                />
            </View>

            <View className="gap-2">
                <Text className="font-medium text-sm text-muted-foreground">Email</Text>
                <TextInput
                    className="h-12 rounded-xl border border-input bg-background px-3 text-foreground opacity-50"
                    defaultValue="john@sitelink.com"
                    editable={false}
                />
                <Text className="text-xs text-muted-foreground">Email cannot be changed.</Text>
            </View>

            <View className="gap-2">
                <Text className="font-medium text-sm text-muted-foreground">Phone Number</Text>
                <TextInput
                    className="h-12 rounded-xl border border-input bg-background px-3 text-foreground"
                    defaultValue="(555) 123-4567"
                    keyboardType="phone-pad"
                />
            </View>

            <View className="gap-2">
                <Text className="font-medium text-sm text-muted-foreground">Company</Text>
                <TextInput
                    className="h-12 rounded-xl border border-input bg-background px-3 text-foreground"
                    defaultValue="Smith Electrical LLC"
                />
            </View>
        </View>

        <Button size="lg" className="mt-4">
            <Text>Save Changes</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
