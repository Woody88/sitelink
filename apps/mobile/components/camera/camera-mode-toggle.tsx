import * as React from 'react'
import { Pressable, Animated, StyleSheet } from 'react-native'
import { AlertTriangle, Check } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

interface CameraModeToggleProps {
  isIssueMode: boolean
  onToggle: () => void
}

export const CameraModeToggle = React.memo(function CameraModeToggle({
  isIssueMode,
  onToggle,
}: CameraModeToggleProps) {
  const backgroundColorAnim = React.useRef(new Animated.Value(isIssueMode ? 1 : 0)).current

  React.useEffect(() => {
    Animated.spring(backgroundColorAnim, {
      toValue: isIssueMode ? 1 : 0,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start()
  }, [isIssueMode, backgroundColorAnim])

  const backgroundColor = backgroundColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(128, 128, 128, 0.2)', 'rgba(239, 68, 68, 1)'], // gray -> red
  })

  return (
    <Animated.View
      className="flex-row items-center justify-center rounded-full"
      style={[styles.toggle, { backgroundColor }]}
    >
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-2 px-4 flex-1"
        accessibilityRole="button"
        accessibilityLabel={isIssueMode ? "Issue mode on" : "Issue mode off"}
      >
        <Icon 
          as={isIssueMode ? Check : AlertTriangle} 
          className={cn("size-4", isIssueMode ? "text-white" : "text-foreground")} 
        />
        <Text className={cn(
          "text-sm font-semibold",
          isIssueMode ? "text-white" : "text-foreground"
        )}>
          {isIssueMode ? 'Issue ✓' : 'Issue'}
        </Text>
      </Pressable>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  toggle: {
    height: 48,
    minWidth: 140,
  },
})

