import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = () => {
    // TODO: Implement actual signup with better-auth in Task 6
    console.log('Signup:', { email, password });
    // For now, just navigate to main app
    router.replace('/(main)/projects');
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-12 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-foreground">Create Account</Text>
          <Text className="text-base text-muted-foreground">
            Sign up to start managing your construction projects
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

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Confirm Password</Text>
            <View className="h-10 border border-input rounded-md px-3 justify-center bg-background">
              <Text className="text-muted-foreground">Input component placeholder</Text>
            </View>
          </View>

          <Button onPress={handleSignup} className="mt-4">
            <Text>Create Account</Text>
          </Button>
        </View>

        <View className="flex-row justify-center gap-2 mt-4">
          <Text className="text-muted-foreground">Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Button variant="link" className="p-0 h-auto">
              <Text className="text-primary">Sign In</Text>
            </Button>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

