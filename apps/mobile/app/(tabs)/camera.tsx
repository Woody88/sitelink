import { Text } from '@/components/ui/text'
import { View } from 'react-native'

export default function TabTwoScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-8 p-4">
      <Text variant="h1">Tab Two</Text>
      <View className="bg-border my-8 h-px w-4/5" />
      <Text className="text-muted-foreground text-center">
        This is the second tab screen. Edit <Text variant="code">app/(tabs)/camera.tsx</Text> to
        customize it.
      </Text>
    </View>
  )
}
