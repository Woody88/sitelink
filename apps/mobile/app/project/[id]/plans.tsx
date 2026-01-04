import { View } from 'react-native'
import { Text } from '@/components/ui/text'

export default function PlansScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Plans Tab
      </Text>
      <Text className="text-muted-foreground text-center">
        Plan viewer with sheet list and callout markers will be implemented here.
      </Text>
    </View>
  )
}
