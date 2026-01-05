import * as React from 'react'
import { View, Pressable, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mic, Play, Trash2, Check } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { Svg, Rect } from 'react-native-svg'

interface RecordingLayerProps {
  isRecording: boolean
  duration: number
  waveform: number[]
  transcript: string | null
  isTranscribing: boolean
  onStop: () => void
  onPlay: () => void
  onDelete: () => void
  onDone: () => void
}

export const RecordingLayer = React.memo(function RecordingLayer({
  isRecording,
  duration,
  waveform,
  transcript,
  isTranscribing,
  onStop,
  onPlay,
  onDelete,
  onDone,
}: RecordingLayerProps) {
  const insets = useSafeAreaInsets()
  const pulseAnim = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    }
  }, [isRecording, pulseAnim])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isRecording) {
    return (
      <View className="absolute inset-0 bg-black/70 items-center justify-center z-20">
        <View className="bg-background/95 rounded-2xl p-8 w-11/12 max-w-sm">
          <View className="items-center mb-6">
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View className="size-16 rounded-full bg-destructive items-center justify-center">
                <Icon as={Mic} className="size-8 text-white" />
              </View>
            </Animated.View>
          </View>

          <Text className="text-center text-lg font-semibold text-foreground mb-2">
            Recording...
          </Text>

          <Text className="text-center text-2xl font-bold text-foreground mb-6">
            {formatDuration(duration)}
          </Text>

          {/* Waveform Visualization */}
          {waveform.length > 0 && (
            <View className="h-12 mb-6" style={{ width: '100%' }}>
              <Svg width="100%" height="48" viewBox="0 0 200 48">
                {waveform.map((height, index) => {
                  const barWidth = 200 / waveform.length
                  const barHeight = height * 40
                  const x = (index * 200) / waveform.length
                  const y = 24 - barHeight / 2
                  return (
                    <Rect
                      key={index}
                      x={x}
                      y={y}
                      width={barWidth * 0.8}
                      height={barHeight}
                      fill="hsl(var(--primary))"
                      rx={2}
                    />
                  )
                })}
              </Svg>
            </View>
          )}

          <Pressable
            onPress={onStop}
            className="bg-destructive rounded-full py-3 px-6 active:opacity-80"
          >
            <Text className="text-center text-base font-semibold text-white">
              Tap anywhere to stop
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (transcript !== null || isTranscribing) {
    return (
      <View className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md z-20" style={{ paddingBottom: insets.bottom }}>
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center gap-2 mb-2">
            <Icon as={Check} className="size-4 text-green-500" />
            <Text className="text-sm font-medium text-foreground">
              Voice note saved ({formatDuration(duration)})
            </Text>
          </View>

          {isTranscribing && (
            <Text className="text-xs text-muted-foreground mb-4">⏳ Transcribing...</Text>
          )}

          {transcript && !isTranscribing && (
            <View className="bg-muted/30 rounded-lg p-3 mb-4">
              <Text className="text-sm text-foreground leading-relaxed">{transcript}</Text>
            </View>
          )}

          <View className="flex-row gap-2">
            <Pressable
              onPress={onPlay}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 rounded-full bg-primary active:opacity-80"
            >
              <Icon as={Play} className="size-4 text-primary-foreground" />
              <Text className="text-sm font-semibold text-primary-foreground">Play</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 rounded-full bg-muted/30 active:opacity-80"
            >
              <Icon as={Trash2} className="size-4 text-destructive" />
              <Text className="text-sm font-semibold text-destructive">Delete</Text>
            </Pressable>
            <Pressable
              onPress={onDone}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 rounded-full bg-foreground active:opacity-80"
            >
              <Text className="text-sm font-semibold text-background">Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  return null
})

