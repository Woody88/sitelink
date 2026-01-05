import * as React from 'react'
import { View, Pressable } from 'react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { ZoomIn, ZoomOut, Maximize, RotateCcw, type LucideIcon } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

interface ViewerControlsProps {
  zoom: number
  minZoom: number
  maxZoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomToFit: () => void
  onReset?: () => void
  className?: string
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Floating zoom controls for the plan viewer
 * Wealthsimple-inspired design: minimal, clean, glass effect
 */
export function ViewerControls({
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onReset,
  className,
}: ViewerControlsProps) {
  const canZoomIn = zoom < maxZoom * 0.95
  const canZoomOut = zoom > minZoom * 1.05

  // Calculate zoom percentage for display
  const zoomPercentage = Math.round(zoom * 100)

  return (
    <View className={cn('gap-2', className)}>
      {/* Zoom level indicator */}
      <View className="bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 self-center">
        <Text className="text-white text-xs font-medium tabular-nums">
          {zoomPercentage}%
        </Text>
      </View>

      {/* Control buttons */}
      <View className="bg-black/60 backdrop-blur-md rounded-2xl overflow-hidden">
        <ControlButton
          icon={ZoomIn}
          onPress={onZoomIn}
          disabled={!canZoomIn}
          accessibilityLabel="Zoom in"
        />
        <View className="h-px bg-white/10" />
        <ControlButton
          icon={ZoomOut}
          onPress={onZoomOut}
          disabled={!canZoomOut}
          accessibilityLabel="Zoom out"
        />
        <View className="h-px bg-white/10" />
        <ControlButton
          icon={Maximize}
          onPress={onZoomToFit}
          accessibilityLabel="Fit to screen"
        />
        {onReset && (
          <>
            <View className="h-px bg-white/10" />
            <ControlButton
              icon={RotateCcw}
              onPress={onReset}
              accessibilityLabel="Reset view"
            />
          </>
        )}
      </View>
    </View>
  )
}

interface ControlButtonProps {
  icon: LucideIcon
  onPress: () => void
  disabled?: boolean
  accessibilityLabel: string
}

function ControlButton({ icon: IconComponent, onPress, disabled, accessibilityLabel }: ControlButtonProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={animatedStyle}
      className={cn(
        'w-12 h-12 items-center justify-center',
        disabled && 'opacity-40'
      )}
    >
      <Icon as={IconComponent} className="size-5 text-white" />
    </AnimatedPressable>
  )
}

/**
 * Zoom slider for more precise control
 */
interface ZoomSliderProps {
  zoom: number
  minZoom: number
  maxZoom: number
  onZoomChange: (zoom: number) => void
  className?: string
}

export function ZoomSlider({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  className,
}: ZoomSliderProps) {
  // Calculate position (0-1) from zoom value
  const position = (zoom - minZoom) / (maxZoom - minZoom)

  return (
    <View className={cn('h-32 w-10 items-center justify-center', className)}>
      <View className="w-1 h-full bg-white/20 rounded-full overflow-hidden">
        <View
          className="w-full bg-primary rounded-full"
          style={{ height: `${position * 100}%` }}
        />
      </View>
    </View>
  )
}
