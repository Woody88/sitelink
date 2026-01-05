import { memo } from 'react'
import { View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, MoreVertical } from 'lucide-react-native'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'

export interface WorkspaceHeaderProps {
  onBack: () => void
  onMenu: () => void
  projectName: string
  address?: string
  children: React.ReactNode
}

export const WorkspaceHeader = memo(function WorkspaceHeader({
  onBack,
  onMenu,
  projectName,
  address,
  children,
}: WorkspaceHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      className="bg-background px-2"
      style={{ paddingTop: insets.top }}
    >
      {/* Row 1: Navigation & Info */}
      <View className="flex-row items-start justify-between min-h-[56px] py-2">
        {/* Back Button - Icon Only */}
        <Pressable
          onPress={onBack}
          className="items-center justify-center"
          style={{ width: 48, height: 48 }}
          role="button"
          accessibilityLabel="Back"
        >
          <Icon as={ArrowLeft} className="size-6 text-foreground" />
        </Pressable>

        {/* Center: Project Info (Wrapped & Centered) */}
        <View className="flex-1 items-center justify-center px-2 pt-1">
          <Text className="text-foreground text-base font-semibold text-center leading-tight">
            {projectName}
          </Text>
          {address && (
            <Text className="text-muted-foreground text-xs text-center mt-0.5 leading-snug">
              {address}
            </Text>
          )}
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

      {/* Row 2: Tabs (Centered) */}
      <View className="items-center pb-3">
        {children}
      </View>
    </View>
  )
})
