import { cn } from '@/lib/utils'
import * as React from 'react'
import { Animated, LayoutChangeEvent, Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'

interface SegmentedControlProps {
  options: string[]
  selectedIndex: number
  onIndexChange: (index: number) => void
  className?: string
}

interface SegmentLayout {
  x: number
  width: number
}

function SegmentedControl({
  options,
  selectedIndex,
  onIndexChange,
  className,
}: SegmentedControlProps) {
  const [layouts, setLayouts] = React.useState<SegmentLayout[]>([])
  const animatedValue = React.useRef(new Animated.Value(0)).current

  // Track segment layouts
  const handleLayout = React.useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout
      setLayouts((prev) => {
        const newLayouts = [...prev]
        newLayouts[index] = { x, width }
        return newLayouts
      })
    },
    []
  )

  // Animate to selected segment
  React.useEffect(() => {
    if (layouts.length === options.length && layouts[selectedIndex]) {
      Animated.spring(animatedValue, {
        toValue: selectedIndex,
        damping: 20,
        stiffness: 200,
        useNativeDriver: false,
      }).start()
    }
  }, [selectedIndex, layouts, animatedValue, options.length])

  // Calculate animated position and width
  const animatedStyle = {
    transform: [
      {
        translateX: animatedValue.interpolate({
          inputRange: options.map((_, i) => i),
          outputRange: layouts.map((layout) => layout?.x ?? 0),
          extrapolate: 'clamp',
        }),
      },
    ],
    width: animatedValue.interpolate({
      inputRange: options.map((_, i) => i),
      outputRange: layouts.map((layout) => layout?.width ?? 0),
      extrapolate: 'clamp',
    }),
  }

  return (
    <View
      className={cn(
        'bg-muted/30 border-border dark:bg-muted/20 flex-row rounded-xl border p-1',
        className
      )}
      style={{ minHeight: 48 }}>
      {/* Animated background pill */}
      <Animated.View
        className="bg-card shadow-black/10 absolute rounded-lg shadow-md"
        style={[
          {
            height: 40,
            top: 4,
          },
          animatedStyle,
        ]}
      />

      {/* Segment buttons */}
      {options.map((option, index) => {
        const isSelected = index === selectedIndex

        return (
          <Pressable
            key={index}
            onPress={() => onIndexChange(index)}
            onLayout={handleLayout(index)}
            className="flex-1 items-center justify-center"
            style={{ minHeight: 40 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}>
            <Text
              className={cn(
                'text-sm font-medium transition-colors',
                isSelected ? 'text-foreground' : 'text-muted-foreground'
              )}
              numberOfLines={1}>
              {option}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export { SegmentedControl }
export type { SegmentedControlProps }
