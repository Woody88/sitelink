import { Check, Link, Mic, MicOff, RotateCcw } from "lucide-react-native"
import * as React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { GlassCircle } from "@/components/camera/glass-controls"

interface PhotoPreviewProps {
  placeholderColor: string
  isVoiceNoteActive: boolean
  voiceDuration: number
  linkedSheet: string | null
  onRetake: () => void
  onToggleVoice: () => void
  onLinkToPlan: () => void
  onDone: () => void
}

export const PhotoPreview = React.memo(function PhotoPreview({
  placeholderColor,
  isVoiceNoteActive,
  voiceDuration,
  linkedSheet,
  onRetake,
  onToggleVoice,
  onLinkToPlan,
  onDone,
}: PhotoPreviewProps) {
  const insets = useSafeAreaInsets()

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <View style={styles.container}>
      <View style={[styles.photoPlaceholder, { backgroundColor: placeholderColor }]}>
        <Text className="text-lg font-semibold text-white/60">Photo Preview</Text>
      </View>

      {linkedSheet && (
        <View style={[styles.linkedBadge, { top: insets.top + 16 }]}>
          <Icon as={Link} className="size-3.5 text-white" />
          <Text className="text-xs font-medium text-white">{linkedSheet}</Text>
        </View>
      )}

      {isVoiceNoteActive && (
        <View style={styles.voiceBadge}>
          <View style={styles.voiceDot} />
          <Text className="text-xs font-medium text-white">{formatDuration(voiceDuration)}</Text>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.toolbar}>
          <GlassCircle icon={RotateCcw} onPress={onRetake} accessibilityLabel="Retake photo" />

          <GlassCircle
            icon={isVoiceNoteActive ? MicOff : Mic}
            onPress={onToggleVoice}
            accessibilityLabel={isVoiceNoteActive ? "Remove voice note" : "Add voice note"}
            iconClassName={isVoiceNoteActive ? "text-red-400" : undefined}
          />

          <GlassCircle
            icon={Link}
            onPress={onLinkToPlan}
            accessibilityLabel="Link to plan"
            iconClassName={linkedSheet ? "text-blue-400" : undefined}
          />

          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={styles.doneButton}
          >
            <Icon as={Check} className="size-6 text-black" />
          </Pressable>
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  linkedBadge: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(59, 130, 246, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  voiceBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 24,
  },
  doneButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 1)",
    alignItems: "center",
    justifyContent: "center",
  },
})
