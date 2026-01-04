import { memo } from 'react'
import { View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Bell, Settings } from 'lucide-react-native'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'

interface WorkspaceHeaderProps {
  projectName: string
  onBack: () => void
  onNotifications: () => void
  onSettings: () => void
}

export const WorkspaceHeader = memo(function WorkspaceHeader({
  projectName,
  onBack,
  onNotifications,
  onSettings,
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
        className="flex-row items-center h-11 px-2"
        style={{ minWidth: 100 }}
        role="button"
        accessibilityLabel="Back to Projects"
      >
        <Icon as={ArrowLeft} className="size-5 text-foreground" />
        <Text className="text-foreground text-base ml-1">Projects</Text>
      </Pressable>

      {/* Project Name - Centered */}
      <View className="flex-1 items-center justify-center">
        <Text 
          className="text-foreground font-medium text-base"
          numberOfLines={1}
        >
          {projectName}
        </Text>
      </View>

      {/* Right Actions */}
      <View className="flex-row" style={{ minWidth: 100, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onNotifications}
          className="w-11 h-11 items-center justify-center"
          role="button"
          accessibilityLabel="Notifications"
        >
          <Icon as={Bell} className="size-5 text-foreground" />
        </Pressable>
        <Pressable
          onPress={onSettings}
          className="w-11 h-11 items-center justify-center"
          role="button"
          accessibilityLabel="Settings"
        >
          <Icon as={Settings} className="size-5 text-foreground" />
        </Pressable>
      </View>
    </View>
  )
})
