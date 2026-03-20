import type { Meta, StoryObj } from "@storybook/react"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  ImageIcon,
  MapPin,
  Mic,
  Play,
} from "lucide-react-native"
import * as React from "react"
import { Image, Pressable, ScrollView, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

interface TimelinePhoto {
  id: string
  seed: number
  timestamp: string
  timeLabel: string
  hasVoiceNote: boolean
  voiceDuration?: string
  voiceTranscript?: string
  isIssue: boolean
}

interface DateCluster {
  label: string
  photos: TimelinePhoto[]
}

const MOCK_CLUSTERS: DateCluster[] = [
  {
    label: "TODAY, 2:15 PM",
    photos: [
      {
        id: "p1",
        seed: 401,
        timestamp: "2:15 PM",
        timeLabel: "Today, 2:15 PM",
        hasVoiceNote: false,
        isIssue: false,
      },
      {
        id: "p2",
        seed: 402,
        timestamp: "2:12 PM",
        timeLabel: "Today, 2:12 PM",
        hasVoiceNote: true,
        voiceDuration: "0:08",
        voiceTranscript: "Conduit run looks good through the junction. Ready for inspection.",
        isIssue: false,
      },
      {
        id: "p3",
        seed: 403,
        timestamp: "2:09 PM",
        timeLabel: "Today, 2:09 PM",
        hasVoiceNote: true,
        voiceDuration: "0:14",
        voiceTranscript:
          "Exposed rebar at junction box, needs inspection before pour. Notified foreman.",
        isIssue: true,
      },
    ],
  },
  {
    label: "TODAY, 10:30 AM",
    photos: [
      {
        id: "p4",
        seed: 404,
        timestamp: "10:32 AM",
        timeLabel: "Today, 10:32 AM",
        hasVoiceNote: false,
        isIssue: false,
      },
      {
        id: "p5",
        seed: 405,
        timestamp: "10:30 AM",
        timeLabel: "Today, 10:30 AM",
        hasVoiceNote: true,
        voiceDuration: "0:05",
        voiceTranscript: "Anchor bolts installed per spec.",
        isIssue: false,
      },
    ],
  },
  {
    label: "YESTERDAY, 4:45 PM",
    photos: [
      {
        id: "p6",
        seed: 406,
        timestamp: "4:48 PM",
        timeLabel: "Yesterday, 4:48 PM",
        hasVoiceNote: false,
        isIssue: false,
      },
      {
        id: "p7",
        seed: 407,
        timestamp: "4:45 PM",
        timeLabel: "Yesterday, 4:45 PM",
        hasVoiceNote: false,
        isIssue: false,
      },
      {
        id: "p8",
        seed: 408,
        timestamp: "4:42 PM",
        timeLabel: "Yesterday, 4:42 PM",
        hasVoiceNote: true,
        voiceDuration: "0:11",
        voiceTranscript: "Formwork stripped on east side. Minor honeycombing visible.",
        isIssue: false,
      },
    ],
  },
]

const ALL_PHOTOS = MOCK_CLUSTERS.flatMap((c) => c.photos)

type FlowPhase = "callout-sheet" | "timeline" | "photo-detail" | "issue-photo" | "empty"

function PhotoTimelineFlow({ initialPhase = "callout-sheet" as FlowPhase }) {
  const [phase, setPhase] = React.useState<FlowPhase>(initialPhase)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = React.useState(0)
  const [toastMsg, setToastMsg] = React.useState("")

  const selectedPhoto = ALL_PHOTOS[selectedPhotoIndex]

  const openPhoto = (photoId: string) => {
    const idx = ALL_PHOTOS.findIndex((p) => p.id === photoId)
    if (idx >= 0) setSelectedPhotoIndex(idx)
    const photo = ALL_PHOTOS.find((p) => p.id === photoId)
    if (photo?.isIssue) {
      setPhase("issue-photo")
    } else {
      setPhase("photo-detail")
    }
  }

  if (phase === "empty") {
    return (
      <View style={{ minHeight: "100vh", backgroundColor: "#121212" } as any}>
        <StoryHeader title="5/A7 · Photos" onBack={() => setPhase("callout-sheet")} />
        <View className="flex-1 items-center justify-center px-8" style={{ paddingTop: 120 }}>
          <Icon as={Camera} className="mb-6 size-10" style={{ color: "rgba(255,255,255,0.25)" }} />
          <Text className="text-foreground mb-2 text-xl font-bold">No photos yet</Text>
          <Text className="text-muted-foreground mb-8 text-center text-sm leading-relaxed">
            Take the first photo at this location to start building a visual history.
          </Text>
          <Pressable
            onPress={() => setToastMsg("Opening camera...")}
            className="bg-primary flex-row items-center gap-2 rounded-xl px-8 py-3.5"
          >
            <Icon as={Camera} className="text-primary-foreground size-5" />
            <Text className="text-primary-foreground text-sm font-bold">Open Camera</Text>
          </Pressable>
        </View>
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  if (phase === "photo-detail" || phase === "issue-photo") {
    const photo = selectedPhoto
    const isIssue = phase === "issue-photo" || photo?.isIssue
    const totalPhotos = ALL_PHOTOS.length
    const currentNum = selectedPhotoIndex + 1

    return (
      <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
        <Image
          source={{ uri: `https://picsum.photos/seed/construct${photo?.seed ?? 401}/1080/1920` }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          resizeMode="cover"
        />

        {isIssue && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: 3,
              borderColor: "#ef4444",
              zIndex: 2,
            }}
          />
        )}

        <View
          style={{
            position: "absolute",
            top: 16,
            left: 12,
            right: 12,
            zIndex: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => setPhase("timeline")}
            className="items-center justify-center rounded-full"
            style={{ width: 40, height: 40, backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <Icon as={ChevronLeft} className="size-5 text-white" />
          </Pressable>
          {isIssue && (
            <View
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: "rgba(239,68,68,0.9)" }}
            >
              <Icon as={Flag} className="size-3.5 text-white" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>ISSUE</Text>
            </View>
          )}
          <View style={{ width: 40 }} />
        </View>

        <View
          style={{
            position: "absolute",
            top: 72,
            left: 0,
            right: 0,
            zIndex: 15,
            alignItems: "center",
          }}
        >
          <View
            className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Icon as={MapPin} className="size-3.5" style={{ color: "#eab308" }} />
            <Text style={{ color: "#eab308", fontSize: 13, fontWeight: "700" }}>5/A7</Text>
            <Text style={{ color: "#ebebeb", fontSize: 13 }}>· Electrical Junction</Text>
          </View>
        </View>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20 }}>
          <View
            style={{
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
              <View className="mb-3 flex-row items-center gap-2">
                <Icon as={Clock} className="size-3.5" style={{ color: "rgba(255,255,255,0.5)" }} />
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500" }}>
                  {photo?.timeLabel ?? "Today, 2:15 PM"}
                </Text>
              </View>

              {photo?.hasVoiceNote && photo.voiceTranscript && (
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
                        Voice note · {photo.voiceDuration}
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
                    &quot;{photo.voiceTranscript}&quot;
                  </Text>
                </View>
              )}

              {isIssue && (
                <Pressable
                  onPress={() => setToastMsg("Opening RFI generator...")}
                  className="mb-4 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  <Icon as={Flag} className="size-4 text-white" />
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                    Generate RFI
                  </Text>
                </Pressable>
              )}

              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => {
                    if (selectedPhotoIndex > 0) setSelectedPhotoIndex(selectedPhotoIndex - 1)
                  }}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor:
                      selectedPhotoIndex > 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Icon
                    as={ChevronLeft}
                    className="size-5"
                    style={{ color: selectedPhotoIndex > 0 ? "#fff" : "rgba(255,255,255,0.2)" }}
                  />
                </Pressable>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"] as any,
                  }}
                >
                  {currentNum} of {totalPhotos}
                </Text>
                <Pressable
                  onPress={() => {
                    if (selectedPhotoIndex < totalPhotos - 1) {
                      const nextIdx = selectedPhotoIndex + 1
                      setSelectedPhotoIndex(nextIdx)
                      const nextPhoto = ALL_PHOTOS[nextIdx]
                      if (nextPhoto?.isIssue) setPhase("issue-photo")
                      else setPhase("photo-detail")
                    }
                  }}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor:
                      selectedPhotoIndex < totalPhotos - 1
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Icon
                    as={ChevronRight}
                    className="size-5"
                    style={{
                      color:
                        selectedPhotoIndex < totalPhotos - 1 ? "#fff" : "rgba(255,255,255,0.2)",
                    }}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  if (phase === "timeline") {
    return (
      <View style={{ minHeight: "100vh", backgroundColor: "#121212" } as any}>
        <StoryHeader title="5/A7 · Photos" onBack={() => setPhase("callout-sheet")} />

        <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
          <View className="flex-row items-center gap-2">
            <View
              className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ backgroundColor: "rgba(34,197,94,0.15)" }}
            >
              <View className="size-1.5 rounded-full bg-green-500" />
              <Text style={{ color: "#16a34a" }} className="text-xs font-semibold">
                96% match
              </Text>
            </View>
            <Text className="text-muted-foreground text-xs">· S1.0</Text>
          </View>
          <Text className="text-muted-foreground text-xs font-semibold">
            {ALL_PHOTOS.length} photos
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {MOCK_CLUSTERS.map((cluster, ci) => (
            <View key={ci} className="mb-2">
              <View className="px-4 pb-2 pt-4">
                <Text className="text-muted-foreground text-xs font-bold tracking-wider">
                  {cluster.label}
                </Text>
              </View>
              <View className="gap-2 px-4">
                {cluster.photos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => openPhoto(photo.id)}
                    className="active:opacity-80"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    <View className="flex-row">
                      <View style={{ position: "relative" }}>
                        <Image
                          source={{
                            uri: `https://picsum.photos/seed/construct${photo.seed}/400/300`,
                          }}
                          style={{
                            width: 120,
                            height: 90,
                            borderTopLeftRadius: 16,
                            borderBottomLeftRadius: 16,
                          }}
                          resizeMode="cover"
                        />
                        {photo.isIssue && (
                          <View style={{ position: "absolute", top: 6, left: 6 }}>
                            <View
                              className="flex-row items-center gap-1 rounded px-1.5 py-0.5"
                              style={{ backgroundColor: "rgba(239,68,68,0.9)" }}
                            >
                              <Icon as={Flag} className="size-2.5 text-white" />
                              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                                ISSUE
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View className="flex-1 justify-center px-3 py-2">
                        <View className="mb-1 flex-row items-center gap-1.5">
                          <Icon
                            as={Clock}
                            className="size-3"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                          />
                          <Text
                            style={{
                              color: "rgba(255,255,255,0.7)",
                              fontSize: 12,
                              fontWeight: "500",
                            }}
                          >
                            {photo.timestamp}
                          </Text>
                        </View>
                        {photo.hasVoiceNote && (
                          <View className="flex-row items-center gap-1.5">
                            <Icon as={Mic} style={{ color: "#3b82f6" }} className="size-3" />
                            <Text style={{ color: "#3b82f6", fontSize: 11, fontWeight: "600" }}>
                              {photo.voiceDuration}
                            </Text>
                          </View>
                        )}
                        {photo.isIssue && photo.voiceTranscript && (
                          <Text
                            style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}
                            numberOfLines={1}
                          >
                            {photo.voiceTranscript}
                          </Text>
                        )}
                      </View>
                      <View className="items-center justify-center pr-3">
                        <Icon
                          as={ChevronRight}
                          className="size-4"
                          style={{ color: "rgba(255,255,255,0.25)" }}
                        />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={{ position: "absolute", bottom: 24, right: 16, zIndex: 15 }}>
          <Pressable
            onPress={() => setToastMsg("Opening camera...")}
            className="bg-primary items-center justify-center rounded-full"
            style={{ width: 56, height: 56 }}
          >
            <Icon as={Camera} className="text-primary-foreground size-6" />
          </Pressable>
        </View>

        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  // callout-sheet phase
  return (
    <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
      <Image
        source={{ uri: "https://picsum.photos/seed/constructsite5/1080/1920" }}
        style={{ width: "100%", height: "100%", position: "absolute", opacity: 0.35 }}
        resizeMode="cover"
      />

      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Pressable
          onPress={() => setToastMsg("Dismissed")}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
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
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.25)",
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
            <View className="mb-1 flex-row items-start justify-between">
              <View className="flex-row items-center gap-2.5">
                <View
                  className="items-center justify-center rounded-lg"
                  style={{ width: 40, height: 40, backgroundColor: "rgba(34,197,94,0.15)" }}
                >
                  <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "800" }}>5</Text>
                </View>
                <View>
                  <Text className="text-foreground text-lg font-bold">
                    5/A7 · Electrical Junction
                  </Text>
                  <Text className="text-muted-foreground text-sm">S1.0 — Foundation Plan</Text>
                </View>
              </View>
            </View>

            <View className="mb-4 mt-2 flex-row items-center gap-2">
              <View
                className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: "rgba(22,163,74,0.15)" }}
              >
                <View className="size-1.5 rounded-full bg-green-500" />
                <Text style={{ color: "#16a34a" }} className="text-xs font-semibold">
                  96% match
                </Text>
              </View>
              <View
                className="flex-row items-center gap-1 rounded-full px-2 py-1"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <Icon
                  as={ImageIcon}
                  className="size-3"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" }}>
                  8 photos
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-wider">
                Recent Photos
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -4 }}
              >
                <View className="flex-row gap-2 px-1">
                  {ALL_PHOTOS.slice(0, 5).map((photo, i) => (
                    <Pressable
                      key={photo.id}
                      onPress={() => openPhoto(photo.id)}
                      style={{ position: "relative" }}
                    >
                      <Image
                        source={{
                          uri: `https://picsum.photos/seed/construct${photo.seed}/200/200`,
                        }}
                        style={{ width: 64, height: 64, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                      {photo.isIssue && (
                        <View style={{ position: "absolute", top: 3, right: 3 }}>
                          <View
                            className="items-center justify-center rounded-full"
                            style={{ width: 18, height: 18, backgroundColor: "#ef4444" }}
                          >
                            <Icon as={Flag} className="size-2.5 text-white" />
                          </View>
                        </View>
                      )}
                      {photo.hasVoiceNote && !photo.isIssue && (
                        <View style={{ position: "absolute", bottom: 3, left: 3 }}>
                          <View
                            className="items-center justify-center rounded-full"
                            style={{
                              width: 16,
                              height: 16,
                              backgroundColor: "rgba(59,130,246,0.85)",
                            }}
                          >
                            <Icon as={Mic} className="size-2.5 text-white" />
                          </View>
                        </View>
                      )}
                    </Pressable>
                  ))}
                  {ALL_PHOTOS.length > 5 && (
                    <Pressable
                      onPress={() => setPhase("timeline")}
                      className="items-center justify-center"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Text
                        style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" }}
                      >
                        +{ALL_PHOTOS.length - 5}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>

            <View className="gap-2.5">
              <Pressable
                onPress={() => setPhase("timeline")}
                className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-3.5"
              >
                <Icon as={ImageIcon} className="text-primary-foreground size-4" />
                <Text className="text-primary-foreground text-sm font-bold">View Photos (8)</Text>
              </Pressable>
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => setToastMsg("Opening camera...")}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Icon as={Camera} className="text-foreground size-4" />
                  <Text className="text-foreground text-sm font-semibold">Take Photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setToastMsg("Navigating to detail...")}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Icon as={MapPin} className="text-foreground size-4" />
                  <Text className="text-foreground text-sm font-semibold">Navigate</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>

      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof PhotoTimelineFlow> = {
  title: "Flows/16. Photo Timeline",
  component: PhotoTimelineFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof PhotoTimelineFlow>

export const CalloutSheet: Story = {
  name: "1. Callout Action Sheet",
  args: { initialPhase: "callout-sheet" },
}

export const Timeline: Story = {
  name: "2. Photo Timeline",
  args: { initialPhase: "timeline" },
}

export const PhotoDetail: Story = {
  name: "3. Photo Detail",
  args: { initialPhase: "photo-detail" },
}

export const IssuePhoto: Story = {
  name: "4. Issue Photo + RFI",
  args: { initialPhase: "issue-photo" },
}

export const EmptyState: Story = {
  name: "5. Empty — No Photos",
  args: { initialPhase: "empty" },
}

export const FullFlow: Story = {
  name: "Full Flow",
  args: { initialPhase: "callout-sheet" },
}
