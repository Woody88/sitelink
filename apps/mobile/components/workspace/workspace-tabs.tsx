import { memo, useRef, useEffect } from 'react'
import { View, Pressable, Animated, Dimensions } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const TAB_WIDTH = SCREEN_WIDTH / 3
const INDICATOR_WIDTH = TAB_WIDTH * 0.4

interface WorkspaceTabsProps {
  tabs: string[]
  activeTab: number
  onTabChange: (index: number) => void
}

export const WorkspaceTabs = memo(function WorkspaceTabs({
  tabs,
  activeTab,
  onTabChange,
}: WorkspaceTabsProps) {
  const indicatorPosition = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: activeTab * TAB_WIDTH,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start()
  }, [activeTab, indicatorPosition])

  return (
    <View className="bg-background border-b border-border">
      <View className="flex-row">
        {tabs.map((tab, index) => (
          <Pressable
            key={tab}
            onPress={() => onTabChange(index)}
            className="flex-1 h-12 items-center justify-center"
            role="button"
            accessibilityLabel={`${tab} tab`}
            accessibilityState={{ selected: activeTab === index }}
          >
            <Text
              className={cn(
                'text-base font-medium',
                activeTab === index ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Animated Indicator */}
      <Animated.View
        className="bg-primary h-[3px] rounded-full absolute bottom-0"
        style={{
          width: INDICATOR_WIDTH,
          transform: [
            {
              translateX: indicatorPosition.interpolate({
                inputRange: [0, TAB_WIDTH * (tabs.length - 1)],
                outputRange: tabs.map((_, i) =>
                  i * TAB_WIDTH + (TAB_WIDTH - INDICATOR_WIDTH) / 2
                ),
              }),
            },
          ],
        }}
      />
    </View>
  )
})
