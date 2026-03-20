import type { Meta, StoryObj } from "@storybook/react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  MapPin,
  Mic,
  Pause,
  RotateCcw,
  Search,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native"
import * as React from "react"
import { Image, Pressable, ScrollView, View } from "react-native"
import { StoryToast } from "@/app/_story-components"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

interface PlanLocation {
  id: string
  label: string
  sheetNumber: string
  sheetTitle: string
  type: "detail" | "section" | "elevation" | "area"
  confidence?: number
}

const MOCK_LOCATIONS: PlanLocation[] = [
  {
    id: "loc1",
    label: "5/A7",
    sheetNumber: "S1.0",
    sheetTitle: "Foundation Plan",
    type: "detail",
    confidence: 0.96,
  },
  {
    id: "loc2",
    label: "3/A2",
    sheetNumber: "S1.0",
    sheetTitle: "Foundation Plan",
    type: "section",
    confidence: 0.91,
  },
  {
    id: "loc3",
    label: "2/A1",
    sheetNumber: "S2.0",
    sheetTitle: "Structural Details",
    type: "detail",
    confidence: 0.88,
  },
  { id: "loc4", label: "F1", sheetNumber: "S1.0", sheetTitle: "Foundation Plan", type: "area" },
  {
    id: "loc5",
    label: "E1",
    sheetNumber: "S3.0",
    sheetTitle: "Sections & Elevations",
    type: "elevation",
  },
]

const TYPE_COLORS = {
  detail: "#22c55e",
  section: "#3b82f6",
  elevation: "#f59e0b",
  area: "#a855f7",
} as const

function GlassCircle({
  children,
  size = 44,
  bg = "rgba(0,0,0,0.4)",
  onPress,
}: {
  children: React.ReactNode
  size?: number
  bg?: string
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      {children}
    </Pressable>
  )
}

function ShutterButton({ isIssueMode, onPress }: { isIssueMode?: boolean; onPress?: () => void }) {
  const outerColor = isIssueMode ? "#ef4444" : "#ffffff"
  return (
    <Pressable onPress={onPress}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 72, height: 72, borderWidth: 4, borderColor: outerColor }}
      >
        <View
          className="rounded-full"
          style={{ width: 58, height: 58, backgroundColor: outerColor }}
        />
      </View>
    </Pressable>
  )
}

function VoiceRecordingOverlay({
  duration,
  onStop,
  onCancel,
}: {
  duration: string
  onStop: () => void
  onCancel: () => void
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 120,
        left: 16,
        right: 16,
        zIndex: 25,
      }}
    >
      <View
        className="flex-row items-center gap-4 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "rgba(28,28,28,0.95)" }}
      >
        {/* Recording indicator */}
        <View className="flex-row items-center gap-2">
          <View className="size-3 rounded-full bg-red-500" />
          <Text className="text-sm font-bold text-red-400">REC</Text>
        </View>

        {/* Waveform visualization (static bars) */}
        <View className="flex-1 flex-row items-center justify-center gap-0.5">
          {[
            0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 1.0, 0.5, 0.7, 0.3, 0.6, 0.8, 0.4, 0.9, 0.5, 0.7,
            0.3,
          ].map((h, i) => (
            <View
              key={i}
              className="rounded-full bg-red-400/60"
              style={{ width: 3, height: Math.max(4, h * 24) }}
            />
          ))}
        </View>

        {/* Duration */}
        <Text
          className="text-sm font-semibold text-white"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {duration}
        </Text>

        {/* Stop button */}
        <Pressable
          onPress={onStop}
          className="items-center justify-center rounded-full bg-red-500"
          style={{ width: 36, height: 36 }}
        >
          <View className="size-3.5 rounded-sm bg-white" />
        </Pressable>
      </View>
      <View className="mt-2 items-center">
        <Pressable onPress={onCancel}>
          <Text className="text-muted-foreground text-xs font-medium">Cancel recording</Text>
        </Pressable>
      </View>
    </View>
  )
}

function LinkToPlanSheet({
  onClose,
  onSelect,
  autoSuggestion,
}: {
  onClose: () => void
  onSelect: (location: PlanLocation) => void
  autoSuggestion?: PlanLocation
}) {
  const [searchQuery] = React.useState("")
  const filtered = searchQuery
    ? MOCK_LOCATIONS.filter(
        (l) =>
          l.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.sheetNumber.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : MOCK_LOCATIONS

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "75%",
          backgroundColor: "#1c1c1c",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        <View className="items-center py-3">
          <View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
        </View>

        <View className="flex-row items-center justify-between px-6 pb-3">
          <View>
            <Text className="text-foreground text-lg font-bold">Link to Plan</Text>
            <Text className="text-muted-foreground text-sm">
              Associate this photo with a callout location
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
          >
            <Icon as={X} className="text-foreground size-5" />
          </Pressable>
        </View>

        {/* Auto-detected suggestion */}
        {autoSuggestion && (
          <View className="px-6 pb-3">
            <View
              className="flex-row items-center gap-3 rounded-xl px-4 py-3"
              style={{
                backgroundColor: "rgba(34,197,94,0.08)",
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.2)",
              }}
            >
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 32, height: 32, backgroundColor: "rgba(34,197,94,0.15)" }}
              >
                <Icon as={MapPin} style={{ color: "#22c55e" }} className="size-4" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium" style={{ color: "#22c55e" }}>
                  Auto-detected from current view
                </Text>
                <Text className="text-foreground text-sm font-semibold">
                  {autoSuggestion.label} on {autoSuggestion.sheetNumber}
                </Text>
              </View>
              <Pressable
                onPress={() => onSelect(autoSuggestion)}
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: "rgba(34,197,94,0.15)" }}
              >
                <Text style={{ color: "#22c55e" }} className="text-xs font-bold">
                  Use
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Search */}
        <View className="px-6 pb-3">
          <View
            className="bg-muted/30 flex-row items-center rounded-xl px-3"
            style={{ height: 40 }}
          >
            <Icon as={Search} className="text-muted-foreground mr-2 size-4" />
            <Text className="text-muted-foreground flex-1 text-sm" onPress={() => {}}>
              {searchQuery || "Search callouts or sheets..."}
            </Text>
          </View>
        </View>

        {/* Recent / All callouts */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator>
          <Text className="text-muted-foreground px-6 pb-2 text-xs font-bold uppercase tracking-wider">
            All Callouts
          </Text>
          {filtered.map((location) => {
            const color = TYPE_COLORS[location.type]
            return (
              <Pressable
                key={location.id}
                onPress={() => onSelect(location)}
                className="active:bg-muted/20 flex-row items-center gap-3 px-6 py-3"
              >
                <View
                  className="items-center justify-center rounded-lg"
                  style={{ width: 36, height: 36, backgroundColor: color + "15" }}
                >
                  <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{location.label}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-semibold">{location.label}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {location.sheetNumber} — {location.sheetTitle}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: color + "15" }}
                >
                  <Text style={{ color, fontSize: 10, fontWeight: "600" }}>
                    {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
                  </Text>
                </View>
                <Icon as={ChevronRight} className="text-muted-foreground size-4" />
              </Pressable>
            )
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  )
}

function PhotoReviewScreen({
  linkedLocation,
  hasVoiceNote,
  voiceDuration,
  onRetake,
  onDone,
  onRecordVoice,
  onChangeLink,
  onRemoveLink,
}: {
  linkedLocation?: PlanLocation
  hasVoiceNote?: boolean
  voiceDuration?: string
  onRetake: () => void
  onDone: () => void
  onRecordVoice: () => void
  onChangeLink: () => void
  onRemoveLink?: () => void
}) {
  return (
    <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
      <Image
        source={{ uri: "https://picsum.photos/seed/construct99/1080/1920" }}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        resizeMode="cover"
      />

      {/* Top bar - saved confirmation */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          backgroundColor: "rgba(0,0,0,0.7)",
          paddingTop: 16,
          paddingBottom: 12,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View
              className="items-center justify-center rounded-full bg-green-500/20"
              style={{ width: 28, height: 28 }}
            >
              <Icon as={Check} className="size-4 text-green-400" />
            </View>
            <Text className="text-sm font-semibold text-white">Photo Saved</Text>
          </View>
          <Text className="text-muted-foreground text-xs">Just now</Text>
        </View>
      </View>

      {/* Plan link card */}
      <View
        style={{
          position: "absolute",
          bottom: linkedLocation ? 190 : 120,
          left: 16,
          right: 16,
          zIndex: 20,
        }}
      >
        {linkedLocation ? (
          <View
            className="overflow-hidden rounded-2xl"
            style={{ backgroundColor: "rgba(28,28,28,0.95)" }}
          >
            {/* Link confirmation header */}
            <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 28, height: 28, backgroundColor: "rgba(34,197,94,0.15)" }}
              >
                <Icon as={MapPin} style={{ color: "#22c55e" }} className="size-4" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium" style={{ color: "#22c55e" }}>
                  Linked to plan
                </Text>
                <Text className="text-foreground text-base font-bold">
                  {linkedLocation.label} on {linkedLocation.sheetNumber}
                </Text>
              </View>
            </View>

            {/* Detail row */}
            <View
              className="mx-4 mb-3 flex-row items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              <View
                className="items-center justify-center rounded"
                style={{ width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <Image
                  source={{ uri: "/plan-sample.png" }}
                  style={{ width: 40, height: 40 }}
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-sm font-semibold">
                  {linkedLocation.sheetTitle}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  Sheet {linkedLocation.sheetNumber} —{" "}
                  {linkedLocation.type.charAt(0).toUpperCase() + linkedLocation.type.slice(1)}{" "}
                  callout
                </Text>
              </View>
            </View>

            {/* Voice note indicator */}
            {hasVoiceNote && (
              <View
                className="mx-4 mb-3 flex-row items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 28, height: 28, backgroundColor: "rgba(59,130,246,0.15)" }}
                >
                  <Icon as={Mic} style={{ color: "#3b82f6" }} className="size-3.5" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-medium">Voice note attached</Text>
                  <Text className="text-muted-foreground text-xs">{voiceDuration}</Text>
                </View>
                <View className="flex-row items-center gap-1.5 rounded bg-blue-500/10 px-2 py-1">
                  <Icon as={Pause} style={{ color: "#3b82f6" }} className="size-3" />
                  <Text style={{ color: "#3b82f6" }} className="text-xs font-semibold">
                    Play
                  </Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View className="flex-row gap-2 px-4 pb-4">
              <Pressable
                onPress={onChangeLink}
                className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <Icon as={Edit2} className="size-3.5 text-white/70" />
                <Text className="text-xs font-medium text-white/70">Change</Text>
              </Pressable>
              <Pressable
                onPress={onRemoveLink}
                className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <Icon as={X} className="size-3.5 text-white/70" />
                <Text className="text-xs font-medium text-white/70">Unlink</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            className="overflow-hidden rounded-2xl"
            style={{ backgroundColor: "rgba(28,28,28,0.95)" }}
          >
            <View className="flex-row items-center gap-3 px-4 py-4">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                <Icon as={MapPin} className="text-muted-foreground size-4" />
              </View>
              <Text className="text-muted-foreground flex-1 text-sm">Not linked to a callout</Text>
              <Pressable onPress={onChangeLink} className="bg-primary rounded-full px-3.5 py-2">
                <Text className="text-primary-foreground text-xs font-bold">Link to Plan</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Bottom action buttons */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 40,
          paddingHorizontal: 20,
          zIndex: 20,
        }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={onRetake}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <Icon as={RotateCcw} className="size-4 text-white" />
            <Text className="text-sm font-semibold text-white">Retake</Text>
          </Pressable>
          <Pressable
            onPress={onRecordVoice}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
            style={{
              backgroundColor: hasVoiceNote ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.1)",
            }}
          >
            <Icon as={Mic} className="size-4 text-white" />
            <Text className="text-sm font-semibold text-white">
              {hasVoiceNote ? "Re-record" : "Add Voice"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDone}
            className="bg-primary flex-1 items-center justify-center rounded-xl py-3.5"
          >
            <Text className="text-primary-foreground text-sm font-bold">Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

type CapturePhase = "viewfinder" | "preview" | "linking" | "recording"

function PhotoCaptureScreen({
  initialPhase = "viewfinder",
  initialLinked,
  initialVoice = false,
}: {
  initialPhase?: CapturePhase
  initialLinked?: boolean
  initialVoice?: boolean
}) {
  const [phase, setPhase] = React.useState<CapturePhase>(initialPhase)
  const [linkedLocation, setLinkedLocation] = React.useState<PlanLocation | undefined>(
    initialLinked ? MOCK_LOCATIONS[0] : undefined,
  )
  const [hasVoiceNote, setHasVoiceNote] = React.useState(initialVoice)
  const [isIssueMode, setIsIssueMode] = React.useState(false)
  const [flashOn, setFlashOn] = React.useState(false)
  const [toastMsg, setToastMsg] = React.useState("")
  const [recordingDuration, setRecordingDuration] = React.useState("0:00")

  React.useEffect(() => {
    if (phase !== "recording") return
    let seconds = 0
    const timer = setInterval(() => {
      seconds++
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      setRecordingDuration(`${mins}:${secs.toString().padStart(2, "0")}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  const autoSuggestion = MOCK_LOCATIONS[0]

  if (phase === "linking") {
    return (
      <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
        <Image
          source={{ uri: "https://picsum.photos/seed/construct99/1080/1920" }}
          style={{ width: "100%", height: "100%", position: "absolute", opacity: 0.3 }}
          resizeMode="cover"
        />
        <LinkToPlanSheet
          onClose={() => setPhase("preview")}
          onSelect={(loc) => {
            setLinkedLocation(loc)
            setPhase("preview")
            setToastMsg(`Linked to ${loc.label} on ${loc.sheetNumber}`)
          }}
          autoSuggestion={autoSuggestion}
        />
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  if (phase === "preview") {
    return (
      <View style={{ position: "relative" } as any}>
        <PhotoReviewScreen
          linkedLocation={linkedLocation}
          hasVoiceNote={hasVoiceNote}
          voiceDuration="0:12"
          onRetake={() => setPhase("viewfinder")}
          onDone={() => setToastMsg("Photo saved")}
          onRecordVoice={() => setPhase("recording")}
          onChangeLink={() => setPhase("linking")}
          onRemoveLink={() => setLinkedLocation(undefined)}
        />
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  if (phase === "recording") {
    return (
      <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
        <Image
          source={{ uri: "https://picsum.photos/seed/construct99/1080/1920" }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          resizeMode="cover"
        />

        {/* Top bar */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            backgroundColor: "rgba(0,0,0,0.7)",
            paddingTop: 16,
            paddingBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className="items-center justify-center rounded-full bg-green-500/20"
                style={{ width: 28, height: 28 }}
              >
                <Icon as={Check} className="size-4 text-green-400" />
              </View>
              <Text className="text-sm font-semibold text-white">Photo Saved</Text>
            </View>
            <Text className="text-muted-foreground text-xs">Just now</Text>
          </View>
        </View>

        <VoiceRecordingOverlay
          duration={recordingDuration}
          onStop={() => {
            setHasVoiceNote(true)
            setPhase("preview")
          }}
          onCancel={() => setPhase("preview")}
        />
      </View>
    )
  }

  // Viewfinder
  return (
    <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
      <Image
        source={{ uri: "https://picsum.photos/seed/constructsite7/1080/1920" }}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        resizeMode="cover"
      />

      {/* Top controls */}
      <View
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <GlassCircle onPress={() => setToastMsg("Camera closed")}>
          <Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
        </GlassCircle>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <GlassCircle onPress={() => setFlashOn((f) => !f)}>
            <Icon as={flashOn ? Zap : ZapOff} className="size-5 text-white" />
          </GlassCircle>
          <GlassCircle>
            <Icon as={RotateCcw} className="size-5 text-white" />
          </GlassCircle>
        </View>
      </View>

      {/* Issue mode banner */}
      {isIssueMode && (
        <View
          style={{
            position: "absolute",
            top: 76,
            left: 0,
            right: 0,
            zIndex: 15,
            alignItems: "center",
          }}
        >
          <View
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: "rgba(239,68,68,0.85)" }}
          >
            <Icon as={AlertTriangle} className="size-4 text-white" />
            <Text className="text-sm font-bold text-white">Issue Mode</Text>
          </View>
        </View>
      )}

      {/* Context bar - showing what this photo will be linked to */}
      <View
        style={{
          position: "absolute",
          bottom: 140,
          left: 16,
          right: 16,
          zIndex: 15,
        }}
      >
        {linkedLocation ? (
          <Pressable
            onPress={() => setPhase("linking")}
            className="flex-row items-center gap-2 self-center rounded-full px-4 py-2.5 active:opacity-80"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Icon as={MapPin} className="text-primary size-4" />
            <Text className="text-sm font-medium text-white">
              {linkedLocation.label} — {linkedLocation.sheetTitle}
            </Text>
            <Icon as={ChevronDown} className="text-muted-foreground size-3" />
          </Pressable>
        ) : (
          <View
            className="flex-row items-center justify-between self-center rounded-full px-4 py-2"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Text className="text-muted-foreground text-sm">Not linked to a callout</Text>
            <Pressable
              onPress={() => setPhase("linking")}
              className="bg-primary ml-3 rounded-full px-3 py-1.5"
            >
              <Text className="text-primary-foreground text-xs font-semibold">Link to Plan</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 40,
          paddingHorizontal: 24,
          zIndex: 15,
        }}
      >
        <View className="flex-row items-center justify-center">
          <View className="flex-1 items-start">
            <Pressable
              onPress={() => setIsIssueMode((m) => !m)}
              className="flex-row items-center gap-2 rounded-full px-4 py-2.5"
              style={{
                backgroundColor: isIssueMode ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)",
              }}
            >
              <View
                className="rounded-full"
                style={{ width: 8, height: 8, backgroundColor: isIssueMode ? "#ef4444" : "#666" }}
              />
              <Text
                className="text-xs font-semibold"
                style={{ color: isIssueMode ? "#ef4444" : "#999" }}
              >
                Issue
              </Text>
            </Pressable>
          </View>
          <ShutterButton isIssueMode={isIssueMode} onPress={() => setPhase("preview")} />
          <View className="flex-1" />
        </View>
      </View>

      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof PhotoCaptureScreen> = {
  title: "Priority 2 — Photo Capture & Linking",
  component: PhotoCaptureScreen,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof PhotoCaptureScreen>

export const CameraViewfinder: Story = {
  name: "1. Camera Viewfinder (Unlinked)",
  args: {
    initialPhase: "viewfinder",
  },
}

export const CameraViewfinderLinked: Story = {
  name: "2. Camera Viewfinder (Linked to 5/A7)",
  args: {
    initialPhase: "viewfinder",
    initialLinked: true,
  },
}

export const LinkToPlanPicker: Story = {
  name: "3. Link to Plan — Choose Callout",
  args: {
    initialPhase: "linking",
  },
}

export const PhotoReviewLinked: Story = {
  name: "4. Photo Review — Linked to Plan",
  args: {
    initialPhase: "preview",
    initialLinked: true,
  },
}

export const PhotoReviewUnlinked: Story = {
  name: "5. Photo Review — Not Linked",
  args: {
    initialPhase: "preview",
  },
}

export const PhotoReviewWithVoiceNote: Story = {
  name: "6. Photo Review — With Voice Note",
  args: {
    initialPhase: "preview",
    initialLinked: true,
    initialVoice: true,
  },
}

export const VoiceRecording: Story = {
  name: "7. Voice Note Recording",
  args: {
    initialPhase: "recording",
    initialLinked: true,
  },
}
