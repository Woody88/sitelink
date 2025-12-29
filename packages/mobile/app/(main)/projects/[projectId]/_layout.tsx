import { Stack } from "expo-router";

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="plans/index" />
      <Stack.Screen name="plans/[planId]" />
    </Stack>
  );
}
