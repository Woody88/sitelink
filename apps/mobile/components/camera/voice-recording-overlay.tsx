import * as React from "react"
import { Animated, Pressable, StyleSheet, View } from "react-native"
import { Text } from "@/components/ui/text"

interface VoiceRecordingOverlayProps {
  duration: number
  onStop: () => void
}

export const VoiceRecordingOverlay = React.memo(function VoiceRecordingOverlay({
  duration,
  onStop,
}: VoiceRecordingOverlayProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current
  const barAnims = React.useRef(Array.from({ length: 12 }, () => new Animated.Value(0.3))).current

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  React.useEffect(() => {
    const animations = barAnims.map((anim, index) => {
      const delay = index * 80
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 0.3 + Math.random() * 0.7,
            duration: 200 + Math.random() * 200,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.3,
            duration: 200 + Math.random() * 200,
            useNativeDriver: false,
          }),
        ]),
      )
    })
    animations.forEach((a) => a.start())
    return () => animations.forEach((a) => a.stop())
  }, [barAnims])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <View style={styles.container}>
      <View style={styles.recBadge}>
        <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
        <Text className="text-sm font-bold text-white">REC</Text>
      </View>

      <Text className="mb-4 text-center font-mono text-4xl font-bold text-white">
        {formatDuration(duration)}
      </Text>

      <View style={styles.waveformContainer}>
        {barAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveformBar,
              {
                height: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 40],
                }),
              },
            ]}
          />
        ))}
      </View>

      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        style={styles.stopButton}
      >
        <View style={styles.stopSquare} />
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 48,
    marginBottom: 40,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "#ef4444",
  },
  stopButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
})
