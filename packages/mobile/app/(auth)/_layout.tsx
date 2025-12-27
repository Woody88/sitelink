import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Sign In',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          title: 'Create Account',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
