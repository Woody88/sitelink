import { Stack } from "expo-router";

export default function MediaLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="camera"
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
    </Stack>
  );
}
