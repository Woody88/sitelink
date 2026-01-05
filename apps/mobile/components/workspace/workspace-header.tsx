import { memo } from 'react'
import { View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, MoreVertical } from 'lucide-react-native'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'

export interface WorkspaceHeaderProps {
  onBack: () => void
  onMenu: () => void
  children: React.ReactNode
}

export const WorkspaceHeader = memo(function WorkspaceHeader({
  onBack,
  onMenu,
  children,
}: WorkspaceHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      className="bg-background border-b border-border flex-row items-center justify-between px-2"
      style={{ paddingTop: insets.top, height: 56 + insets.top }}
    >
      {/* Back Button */}
      <Pressable
        onPress={onBack}
        className="flex-row items-center justify-center"
        style={{ width: 48, height: 48 }}
        role="button"
        accessibilityLabel="Back"
      >
        <Icon as={ArrowLeft} className="size-5 text-foreground" />
        <Text className="text-foreground text-base ml-1">Back</Text>
      </Pressable>

      {/* Center Content - Segmented Control */}
      <View className="flex-1 items-center justify-center px-2">
        {children}
      </View>

      {/* Menu Button */}
      <Pressable
        onPress={onMenu}
        className="items-center justify-center"
        style={{ width: 48, height: 48 }}
        role="button"
        accessibilityLabel="Menu"
      >
        <Icon as={MoreVertical} className="size-5 text-foreground" />
      </Pressable>
    </View>
  )
})
