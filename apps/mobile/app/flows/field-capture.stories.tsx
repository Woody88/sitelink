import type { Meta, StoryObj } from "@storybook/react"
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  MapPin,
  Mic,
  Play,
  RefreshCcw,
  RotateCw,
  Search,
  ScanText,
  TriangleAlert,
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
}

const MOCK_LOCATIONS: PlanLocation[] = [
  { id: "loc1", label: "5/A7", sheetNumber: "S1.0", sheetTitle: "Foundation Plan", type: "detail" },
  {
    id: "loc2",
    label: "3/A2",
    sheetNumber: "S1.0",
    sheetTitle: "Foundation Plan",
    type: "section",
  },
  {
    id: "loc3",
    label: "2/A1",
    sheetNumber: "S2.0",
    sheetTitle: "Structural Details",
    type: "detail",
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
  size = 48,
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
  const color = isIssueMode ? "#ef4444" : "#ffffff"
  return (
    <Pressable onPress={onPress}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 88, height: 88, borderWidth: 3, borderColor: color }}
      >
        <View className="rounded-full" style={{ width: 74, height: 74, backgroundColor: color }} />
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
    <View style={{ position: "absolute", bottom: 120, left: 16, right: 16, zIndex: 25 }}>
      <View
        className="flex-row items-center gap-4 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "rgba(28,28,28,0.95)" }}
      >
        <View className="flex-row items-center gap-2">
          <View className="size-3 rounded-full bg-red-500" />
          <Text className="text-sm font-bold text-red-400">REC</Text>
        </View>
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
        <Text
          className="text-sm font-semibold text-white"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {duration}
        </Text>
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
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
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

        <View className="px-6 pb-3">
          <View
            className="bg-muted/30 flex-row items-center rounded-xl px-3"
            style={{ height: 40 }}
          >
            <Icon as={Search} className="text-muted-foreground mr-2 size-4" />
            <Text className="text-muted-foreground flex-1 text-sm">
              Search callouts or sheets...
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator>
          <Text className="text-muted-foreground px-6 pb-2 text-xs font-bold uppercase tracking-wider">
            All Callouts
          </Text>
          {MOCK_LOCATIONS.map((location) => {
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

type CapturePhase =
  | "viewfinder"
  | "preview"
  | "linking"
  | "recording"
  | "rfi-prompt"
  | "voice-error"

function FieldCaptureFlow({
  initialPhase = "viewfinder" as CapturePhase,
  initialLinked = false,
  initialVoice = false,
  initialIssueMode = false,
  initialOCR = false,
}: {
  initialPhase?: CapturePhase
  initialLinked?: boolean
  initialVoice?: boolean
  initialIssueMode?: boolean
  initialOCR?: boolean
}) {
  const [phase, setPhase] = React.useState<CapturePhase>(initialPhase)
  const [linkedLocation, setLinkedLocation] = React.useState<PlanLocation | undefined>(
    initialLinked ? MOCK_LOCATIONS[0] : undefined,
  )
  const [hasVoiceNote, setHasVoiceNote] = React.useState(initialVoice)
  const [isIssueMode, setIsIssueMode] = React.useState(initialIssueMode)
  const [showOCR] = React.useState(initialOCR)
  const [flashOn, setFlashOn] = React.useState(false)
  const [toastMsg, setToastMsg] = React.useState("")
  const [recordingDuration, setRecordingDuration] = React.useState("0:00")
  const [copied, setCopied] = React.useState(false)

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
          autoSuggestion={MOCK_LOCATIONS[0]}
        />
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  if (phase === "voice-error") {
    return (
      <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
        <Image
          source={{ uri: "https://picsum.photos/seed/construct99/1080/1920" }}
          style={{ width: "100%", height: "100%", position: "absolute", opacity: 0.3 }}
          resizeMode="cover"
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            backgroundColor: "rgba(0,0,0,0.78)",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <View className="items-center py-3">
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.25)",
              }}
            />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <View className="items-center gap-4 py-4">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 64, height: 64, backgroundColor: "rgba(239,68,68,0.12)" }}
              >
                <Icon as={AlertCircle} style={{ color: "#ef4444" }} className="size-8" />
              </View>
              <View className="items-center gap-1.5">
                <Text style={{ color: "#ebebeb", fontSize: 16, fontWeight: "700" }}>
                  Transcription Failed
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Could not transcribe your voice note. The audio may be too noisy or too short.
                </Text>
              </View>
            </View>
            <View className="gap-3">
              <Pressable
                onPress={() => setPhase("recording")}
                className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-3.5"
              >
                <Icon as={RefreshCcw} className="text-primary-foreground size-4" />
                <Text className="text-primary-foreground text-sm font-bold">Try Again</Text>
              </Pressable>
              <Pressable
                onPress={() => setPhase("preview")}
                className="flex-row items-center justify-center rounded-xl py-3.5"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <Text className="text-foreground text-sm font-semibold">Skip Voice Note</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
        {/* Dim overlay so recording UI pops */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 5,
          }}
        />
        {/* Floating saved indicator */}
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 12,
            zIndex: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            className="flex-row items-center gap-2 rounded-full px-3 py-2"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <View
              className="items-center justify-center rounded-full bg-green-500/20"
              style={{ width: 24, height: 24 }}
            >
              <Icon as={Check} className="size-3.5 text-green-400" />
            </View>
            <Text className="text-xs font-semibold text-white">Photo Saved</Text>
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

  if (phase === "rfi-prompt") {
    return (
      <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
        <Image
          source={{ uri: "https://picsum.photos/seed/construct99/1080/1920" }}
          style={{ width: "100%", height: "100%", position: "absolute", opacity: 0.3 }}
          resizeMode="cover"
        />
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
          <Pressable
            onPress={() => setPhase("preview")}
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
              backgroundColor: "#1c1c1c",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <View className="items-center py-3">
              <View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
            </View>
            <View className="px-6 pb-6">
              <View className="mb-4 flex-row items-center gap-3">
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 40, height: 40, backgroundColor: "rgba(239,68,68,0.15)" }}
                >
                  <Icon as={Flag} style={{ color: "#ef4444" }} className="size-5" />
                </View>
                <View>
                  <Text className="text-foreground text-lg font-bold">Issue Captured</Text>
                  <Text className="text-muted-foreground text-sm">
                    Would you like to generate an RFI?
                  </Text>
                </View>
              </View>
              <View className="gap-3">
                <Pressable
                  onPress={() => setToastMsg("Opening RFI generator...")}
                  className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                >
                  <Icon as={Flag} className="text-primary-foreground size-4" />
                  <Text className="text-primary-foreground text-sm font-bold">
                    Generate RFI Draft
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPhase("preview")}
                  className="flex-row items-center justify-center rounded-xl py-3.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Text className="text-foreground text-sm font-semibold">Skip for now</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  if (phase === "preview") {
    return (
      <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
        <Image
          source={{ uri: "https://picsum.photos/seed/construct99/1080/1920" }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          resizeMode="cover"
        />

        {/* Floating back button */}
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 12,
            zIndex: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => setPhase("viewfinder")}
            className="items-center justify-center rounded-full"
            style={{ width: 40, height: 40, backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <Icon as={ChevronLeft} className="size-5 text-white" />
          </Pressable>
        </View>

        {/* OCR detected text pill */}
        {showOCR && (
          <Pressable
            onPress={() => {
              setCopied(true)
              setToastMsg("Copied to clipboard")
              setTimeout(() => setCopied(false), 2000)
            }}
            style={{ position: "absolute", top: 16, right: 12, zIndex: 20 }}
          >
            <View
              className="flex-row items-center gap-2 rounded-2xl px-4 py-2.5"
              style={{ backgroundColor: "rgba(0,0,0,0.75)", maxWidth: 260 }}
            >
              <Icon as={ScanText} className="size-4" style={{ color: "#3b82f6" }} />
              <View className="flex-1">
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600" }}>
                  Detected text
                </Text>
                <Text
                  style={{ color: "#ebebeb", fontSize: 12, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  SIEMENS Model: 5SY4-106-7
                </Text>
              </View>
              <Icon
                as={copied ? Check : Copy}
                className="size-3.5"
                style={{ color: copied ? "#22c55e" : "rgba(255,255,255,0.5)" }}
              />
            </View>
          </Pressable>
        )}

        {/* Bottom sheet */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            backgroundColor: "rgba(0,0,0,0.78)",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          {/* Drag handle */}
          <View className="items-center py-3">
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.25)",
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {/* Confirm row */}
            <View className="flex-row items-center gap-3 mb-4">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 32, height: 32, backgroundColor: "rgba(34,197,94,0.15)" }}
              >
                <Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-5" />
              </View>
              <View className="flex-1">
                {linkedLocation ? (
                  <Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>
                    Saved to {linkedLocation.label} · {linkedLocation.sheetTitle}
                  </Text>
                ) : (
                  <Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>
                    Photo captured
                  </Text>
                )}
              </View>
            </View>

            {/* Voice note section */}
            {hasVoiceNote ? (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 36, height: 36, backgroundColor: "rgba(59,130,246,0.15)" }}
                  >
                    <Icon as={Mic} style={{ color: "#3b82f6" }} className="size-4" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>
                      Voice note · 0:05
                    </Text>
                  </View>
                  <Pressable
                    className="items-center justify-center rounded-full"
                    style={{ width: 32, height: 32, backgroundColor: "rgba(59,130,246,0.2)" }}
                  >
                    <Icon as={Play} style={{ color: "#3b82f6" }} className="size-4" />
                  </Pressable>
                </View>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    marginTop: 10,
                    lineHeight: 18,
                  }}
                >
                  &quot;Exposed rebar at junction box, needs inspection before pour...&quot;
                </Text>
                <Pressable onPress={() => setPhase("recording")} className="mt-3 self-start">
                  <Text style={{ color: "#3b82f6", fontSize: 12, fontWeight: "600" }}>
                    Re-record
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setPhase("recording")}
                className="flex-row items-center gap-3 mb-4"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14 }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 36, height: 36, backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <Icon as={Mic} className="size-4" style={{ color: "rgba(255,255,255,0.7)" }} />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "500" }}>
                  Add voice note
                </Text>
              </Pressable>
            )}

            {/* Hint text */}
            {!linkedLocation && (
              <View className="flex-row items-center gap-2 mb-4">
                <Icon
                  as={MapPin}
                  className="size-3.5"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                />
                <Pressable onPress={() => setPhase("linking")}>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                    Tap to link to a plan callout
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Action buttons */}
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => setPhase("viewfinder")}
                className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                <Icon as={RotateCw} className="size-4 text-white" />
                <Text className="text-sm font-semibold text-white">Retake</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isIssueMode) {
                    setPhase("rfi-prompt")
                  } else {
                    setToastMsg("Photo saved")
                  }
                }}
                className="bg-primary items-center justify-center rounded-xl py-3.5"
                style={{ flex: 1 }}
              >
                <Text className="text-primary-foreground text-sm font-bold">Done</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  // Viewfinder — matches Pencil Screen/Camera/LinkedCapture/Dark & IssueMode/Dark
  return (
    <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
      <Image
        source={{ uri: "https://picsum.photos/seed/constructsite7/1080/1920" }}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        resizeMode="cover"
      />

      {/* Top controls row */}
      <View
        style={{
          position: "absolute",
          top: 44,
          left: 0,
          right: 0,
          zIndex: 20,
          flexDirection: "row",
          alignItems: "center",
          height: 64,
          paddingVertical: 10,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        <GlassCircle onPress={() => setToastMsg("Camera closed")}>
          <Icon as={X} className="size-5 text-white" />
        </GlassCircle>
        <View style={{ flex: 1 }} />
        <GlassCircle onPress={() => setFlashOn((f) => !f)}>
          <Icon as={flashOn ? Zap : ZapOff} className="size-5 text-white" />
        </GlassCircle>
        <GlassCircle onPress={() => setToastMsg("Camera switched")}>
          <Icon as={RotateCw} className="size-5 text-white" />
        </GlassCircle>
      </View>

      {/* Callout pill row */}
      <View
        style={{
          position: "absolute",
          top: 580,
          left: 0,
          right: 0,
          zIndex: 15,
          alignItems: "center",
        }}
      >
        {linkedLocation ? (
          <Pressable
            onPress={() => setPhase("linking")}
            className="flex-row items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.7)",
              borderRadius: 20,
              height: 36,
              paddingHorizontal: 14,
              gap: 6,
            }}
          >
            <Icon as={MapPin} style={{ color: "#ffffff" }} className="size-3.5" />
            <Text style={{ color: "#eab308", fontSize: 13, fontWeight: "700" }}>
              {linkedLocation.label}
            </Text>
            <Text style={{ color: "#ebebeb", fontSize: 13 }}>· {linkedLocation.sheetTitle}</Text>
          </Pressable>
        ) : (
          <View
            className="flex-row items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.7)",
              borderRadius: 20,
              height: 36,
              paddingHorizontal: 14,
              gap: 6,
            }}
          >
            <Text style={{ color: "#999", fontSize: 13 }}>Not linked to a callout</Text>
            <Pressable
              onPress={() => setPhase("linking")}
              className="bg-primary ml-2 rounded-full px-3 py-1.5"
            >
              <Text className="text-primary-foreground text-xs font-semibold">Link to Plan</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Bottom dim area */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 212,
          backgroundColor: "rgba(0,0,0,0.52)",
          zIndex: 10,
        }}
      />

      {/* Last photo thumbnail */}
      <View style={{ position: "absolute", bottom: 126, left: 34, zIndex: 15 }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            overflow: "hidden",
            backgroundColor: "#333",
          }}
        >
          <Image
            source={{ uri: "https://picsum.photos/seed/construct99/200/200" }}
            style={{ width: 60, height: 60 }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "rgba(0,0,0,0.75)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>3</Text>
        </View>
      </View>

      {/* Shutter button - centered */}
      <View
        style={{
          position: "absolute",
          bottom: 104,
          left: 0,
          right: 0,
          zIndex: 15,
          alignItems: "center",
        }}
      >
        <ShutterButton isIssueMode={isIssueMode} onPress={() => setPhase("preview")} />
      </View>

      {/* Issue button - right side */}
      <View style={{ position: "absolute", bottom: 120, right: 34, zIndex: 15 }}>
        <Pressable
          onPress={() => setIsIssueMode((m) => !m)}
          className="items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: isIssueMode ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.12)",
            borderWidth: isIssueMode ? 1.5 : 1,
            borderColor: isIssueMode ? "#ef4444" : "rgba(255,255,255,0.22)",
          }}
        >
          <Icon
            as={TriangleAlert}
            className="size-5"
            style={{ color: isIssueMode ? "#ef4444" : "rgba(255,255,255,0.85)" }}
          />
          <Text
            style={{
              fontSize: 10,
              fontWeight: isIssueMode ? "700" : "400",
              color: isIssueMode ? "#ef4444" : "#ebebeb",
              marginTop: 2,
            }}
          >
            Issue
          </Text>
        </Pressable>
      </View>

      {/* Mode tabs */}
      <View
        style={{
          position: "absolute",
          bottom: 44,
          left: 0,
          right: 0,
          zIndex: 15,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "700" }}>PHOTO</Text>
      </View>

      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof FieldCaptureFlow> = {
  title: "Flows/3. Field Capture",
  component: FieldCaptureFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof FieldCaptureFlow>

export const CameraUnlinked: Story = {
  name: "1. Camera — Unlinked",
  args: { initialPhase: "viewfinder" },
}

export const CameraLinked: Story = {
  name: "2. Camera — Linked to 5/A7",
  args: { initialPhase: "viewfinder", initialLinked: true },
}

export const LinkToPlan: Story = {
  name: "3. Link to Plan Picker",
  args: { initialPhase: "linking" },
}

export const PhotoReviewLinked: Story = {
  name: "4. Photo Review — Linked",
  args: { initialPhase: "preview", initialLinked: true },
}

export const PhotoReviewWithVoice: Story = {
  name: "5. Photo Review — With Voice Note",
  args: { initialPhase: "preview", initialLinked: true, initialVoice: true },
}

export const VoiceRecording: Story = {
  name: "6. Voice Note Recording",
  args: { initialPhase: "recording", initialLinked: true },
}

export const IssueModeCapture: Story = {
  name: "7. Issue Mode — Viewfinder",
  args: { initialPhase: "viewfinder", initialIssueMode: true },
}

export const IssueRfiPrompt: Story = {
  name: "8. Issue Mode — RFI Prompt",
  args: { initialPhase: "rfi-prompt", initialIssueMode: true, initialLinked: true },
}

export const CameraFirstFullFlow: Story = {
  name: "9. Camera-First — Unlinked Capture",
  args: { initialPhase: "viewfinder", initialLinked: false },
}

export const GeneralPhotoPreview: Story = {
  name: "10. General Photo — No Callout Link",
  args: { initialPhase: "preview", initialLinked: false },
}

export const OCRDetection: Story = {
  name: "11. OCR Text Detection on Preview",
  args: { initialPhase: "preview", initialLinked: true, initialOCR: true },
}

export const VoiceTranscriptionError: Story = {
  name: "12. Voice Transcription Error",
  args: { initialPhase: "voice-error", initialLinked: true },
}

export const FullFlow: Story = {
  name: "Full Flow",
  args: { initialPhase: "viewfinder" },
}
