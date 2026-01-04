import { memo } from 'react'
import { View, Pressable } from 'react-native'
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
  return (
    <View className="bg-background border-b border-border flex-row items-center justify-between px-4 h-14">
      {/* Back Button - 48px touch target */}
      <Pressable
        onPress={onBack}
        className="flex-row items-center gap-1 py-2 pr-4 -ml-2"
        role="button"
        accessibilityLabel="Back to Projects"
      >
        <Icon as={ArrowLeft} className="size-5 text-foreground" />
        <Text className="text-foreground text-base">Projects</Text>
      </Pressable>

      {/* Project Name */}
      <Text className="text-foreground flex-1 text-center font-medium truncate px-2">
        {projectName}
      </Text>

      {/* Right Actions */}
      <View className="flex-row gap-1">
        <Pressable
          onPress={onNotifications}
          className="w-12 h-12 items-center justify-center"
          role="button"
          accessibilityLabel="Notifications"
        >
          <Icon as={Bell} className="size-6 text-foreground" />
        </Pressable>
        <Pressable
          onPress={onSettings}
          className="w-12 h-12 items-center justify-center"
          role="button"
          accessibilityLabel="Settings"
        >
          <Icon as={Settings} className="size-6 text-foreground" />
        </Pressable>
      </View>
    </View>
  )
})
