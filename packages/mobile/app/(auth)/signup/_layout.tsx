import { Stack } from "expo-router";

export default function SignupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create-org"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create-account"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
