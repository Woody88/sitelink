import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: Implement actual login with better-auth in Task 6
    console.log('Login:', { email, password });
    // For now, just navigate to main app
    router.replace('/(main)/projects');
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-12 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-foreground">Welcome Back</Text>
          <Text className="text-base text-muted-foreground">
            Sign in to access your construction projects
          </Text>
        </View>

        <View className="gap-4 mt-8">
          {/* TODO: Add Input component from RNR when available */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Email</Text>
            <View className="h-10 border border-input rounded-md px-3 justify-center bg-background">
              <Text className="text-muted-foreground">Input component placeholder</Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Password</Text>
            <View className="h-10 border border-input rounded-md px-3 justify-center bg-background">
              <Text className="text-muted-foreground">Input component placeholder</Text>
            </View>
          </View>

          <Button onPress={handleLogin} className="mt-4">
            <Text>Sign In</Text>
          </Button>
        </View>

        <View className="flex-row justify-center gap-2 mt-4">
          <Text className="text-muted-foreground">Don't have an account?</Text>
          <Link href="/(auth)/signup" asChild>
            <Button variant="link" className="p-0 h-auto">
              <Text className="text-primary">Sign Up</Text>
            </Button>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

