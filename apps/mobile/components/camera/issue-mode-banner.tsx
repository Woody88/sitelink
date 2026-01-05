import * as React from 'react'
import { View, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertTriangle } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'

interface IssueModeBannerProps {
  visible: boolean
}

export const IssueModeBanner = React.memo(function IssueModeBanner({
  visible,
}: IssueModeBannerProps) {
  const insets = useSafeAreaInsets()
  const opacityAnim = React.useRef(new Animated.Value(0)).current
  const translateYAnim = React.useRef(new Animated.Value(-20)).current

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacityAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, opacityAnim, translateYAnim])

  if (!visible) return null

  return (
    <Animated.View
      className="absolute left-0 right-0 z-10 items-center"
      style={{
        top: insets.top + 60,
        opacity: opacityAnim,
        transform: [{ translateY: translateYAnim }],
      }}
    >
      <View className="bg-destructive rounded-full px-6 py-3 flex-row items-center gap-2 shadow-lg">
        <Icon as={AlertTriangle} className="size-5 text-destructive-foreground" />
        <Text className="text-base font-bold text-destructive-foreground">
          ISSUE MODE
        </Text>
      </View>
    </Animated.View>
  )
})

