import { Text } from '@/components/ui/text'
import { View } from 'react-native'

export default function MoreScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-8 p-4">
      <Text variant="h1">More</Text>
      <View className="bg-border my-8 h-px w-4/5" />
      <Text className="text-muted-foreground text-center">
        This is the first tab screen. Edit <Text variant="code">app/(tabs)/more.tsx</Text> to get
        started.
      </Text>
    </View>
  )
}
