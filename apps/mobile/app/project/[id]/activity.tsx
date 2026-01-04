import { View } from 'react-native'
import { Text } from '@/components/ui/text'

export default function ActivityScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Activity Tab
      </Text>
      <Text className="text-muted-foreground text-center">
        AI summary and photo timeline will be implemented here.
      </Text>
    </View>
  )
}
