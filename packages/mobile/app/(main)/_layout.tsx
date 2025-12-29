import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="orgs/index" />
      <Stack.Screen name="projects/index" />
      <Stack.Screen name="projects/[projectId]" />
      <Stack.Screen name="settings/index" />
    </Stack>
  );
}
