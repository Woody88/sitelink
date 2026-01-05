import { cn } from '@/lib/utils'
import * as React from 'react'
import { Animated, LayoutChangeEvent, Pressable, View, StyleSheet } from 'react-native'
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
  const animatedValue = React.useRef(new Animated.Value(selectedIndex)).current

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
  }, [selectedIndex, layouts, options.length, animatedValue])

  // Check if all layouts are measured
  const allLayoutsMeasured = layouts.length === options.length && layouts.every(l => l !== undefined)

  // Calculate animated position and width (only when layouts are ready)
  const animatedStyle = allLayoutsMeasured ? {
    transform: [
      {
        translateX: animatedValue.interpolate({
          inputRange: options.map((_, i) => i),
          outputRange: layouts.map((layout) => layout.x),
          extrapolate: 'clamp',
        }),
      },
    ],
    width: animatedValue.interpolate({
      inputRange: options.map((_, i) => i),
      outputRange: layouts.map((layout) => layout.width),
      extrapolate: 'clamp',
    }),
  } : {}

  return (
    <View
      className={cn(
        'bg-muted/50 dark:bg-muted/20 flex-row rounded-full p-1 self-center',
        className
      )}
      style={{ height: 40 }}>
      {/* Animated background pill - only render when layouts are measured */}
      {allLayoutsMeasured && (
        <Animated.View
          className="bg-background absolute rounded-full shadow-sm"
          style={[
            {
              height: 32,
              top: 3,
            },
            animatedStyle,
            styles.pillShadow
          ]}
        />
      )}

      {/* Segment buttons */}
      {options.map((option, index) => {
        const isSelected = index === selectedIndex

        return (
          <Pressable
            key={index}
            onPress={() => onIndexChange(index)}
            onLayout={handleLayout(index)}
            className="items-center justify-center px-5"
            style={{ height: 32 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}>
            <Text
              className={cn(
                'text-sm transition-colors',
                isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'
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

const styles = StyleSheet.create({
  pillShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  }
})

export { SegmentedControl }
export type { SegmentedControlProps }
