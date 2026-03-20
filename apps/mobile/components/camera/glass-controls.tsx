import * as React from "react"
import { Animated, Pressable, StyleSheet } from "react-native"
import { Icon } from "@/components/ui/icon"
import type { LucideIcon } from "lucide-react-native"
import { cn } from "@/lib/utils"

interface GlassCircleProps {
  icon: LucideIcon
  size?: number
  onPress: () => void
  accessibilityLabel: string
  iconClassName?: string
}

export const GlassCircle = React.memo(function GlassCircle({
  icon,
  size = 44,
  onPress,
  accessibilityLabel,
  iconClassName,
}: GlassCircleProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const handlePressIn = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      damping: 15,
      stiffness: 300,
    }).start()
  }, [scaleAnim])

  const handlePressOut = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 300,
    }).start()
  }, [scaleAnim])

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.glassCircle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Icon as={icon} className={cn("size-5 text-white", iconClassName)} />
      </Pressable>
    </Animated.View>
  )
})

interface ShutterButtonProps {
  onPress: () => void
  isIssueMode: boolean
  isVideoMode?: boolean
  isRecording?: boolean
  disabled?: boolean
}

export const ShutterButton = React.memo(function ShutterButton({
  onPress,
  isIssueMode,
  isVideoMode = false,
  isRecording = false,
  disabled = false,
}: ShutterButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current
  const innerScaleAnim = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (isRecording) {
      Animated.timing(innerScaleAnim, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(innerScaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [isRecording, innerScaleAnim])

  const handlePressIn = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      damping: 15,
      stiffness: 300,
    }).start()
  }, [scaleAnim])

  const handlePressOut = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 300,
    }).start()
  }, [scaleAnim])

  const showRed = isIssueMode || isVideoMode

  return (
    <Animated.View style={[styles.shutterContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          isRecording
            ? "Stop recording"
            : isVideoMode
              ? "Start recording"
              : isIssueMode
                ? "Capture issue photo"
                : "Capture photo"
        }
        style={styles.shutterOuter}
      >
        <Animated.View
          style={[
            isRecording ? styles.shutterInnerSquare : styles.shutterInner,
            {
              backgroundColor: showRed ? "rgba(239, 68, 68, 1)" : "rgba(255, 255, 255, 1)",
              transform: [{ scale: innerScaleAnim }],
            },
            isRecording && { borderRadius: 8 },
          ]}
        />
      </Pressable>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  glassCircle: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterContainer: {
    width: 88,
    height: 88,
  },
  shutterOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  shutterInnerSquare: {
    width: 36,
    height: 36,
  },
})
