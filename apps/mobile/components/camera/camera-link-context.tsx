import * as React from 'react'
import { View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapPin } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'

interface LinkToPlanContextProps {
  markerLabel: string | null
  onLinkPress: () => void
}

export const CameraLinkContext = React.memo(function CameraLinkContext({
  markerLabel,
  onLinkPress,
}: LinkToPlanContextProps) {
  const insets = useSafeAreaInsets()
  const topPosition = insets.top + 120

  if (markerLabel) {
    return (
      <View 
        className="absolute left-4 right-4 z-10"
        style={{ top: topPosition }}
      >
        <View className="flex-row items-center justify-between bg-black/60 rounded-full px-4 py-3 backdrop-blur-sm">
          <View className="flex-row items-center gap-2 flex-1">
            <Icon as={MapPin} className="size-4 text-white" />
            <Text className="text-sm font-medium text-white flex-1" numberOfLines={1}>
              Linked to: {markerLabel}
            </Text>
          </View>
          <Pressable onPress={onLinkPress} className="ml-2">
            <Text className="text-sm font-semibold text-white">Change</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View 
      className="absolute left-4 right-4 z-10"
      style={{ top: topPosition }}
    >
      <Pressable
        onPress={onLinkPress}
        className="flex-row items-center justify-between bg-black/60 rounded-full px-4 py-3 backdrop-blur-sm active:opacity-80"
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Icon as={MapPin} className="size-4 text-white/60" />
          <Text className="text-sm font-medium text-white/80">
            Not linked to a callout
          </Text>
        </View>
        <Text className="text-sm font-semibold text-white">Link to Plan</Text>
      </Pressable>
    </View>
  )
})

