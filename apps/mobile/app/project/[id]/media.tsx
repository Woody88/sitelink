import { useLocalSearchParams, useRouter } from "expo-router"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  MapPin,
  Mic,
  Play,
} from "lucide-react-native"
import * as React from "react"
import { Image, Modal, Pressable, ScrollView, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { PhotoTimeline } from "@/components/activity/photo-timeline"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Icon } from "@/components/ui/icon"
import { Separator } from "@/components/ui/separator"
import { Text } from "@/components/ui/text"
import { usePhotosTimeline } from "@/hooks/use-photos-timeline"
import type { MockTimelinePhoto } from "@/lib/mock-data"
import { MOCK_TIMELINE_PHOTOS } from "@/lib/mock-data"
import { isPrototypeMode } from "@/lib/prototype-mode"

// Flatten all photos for detail navigation
const ALL_PROTOTYPE_PHOTOS = MOCK_TIMELINE_PHOTOS.flatMap((c) => c.photos)

// Mock data for initial development (live mode fallback)
const MOCK_SECTIONS = [
  {
    title: "Today",
    data: [
      {
        markerId: "1",
        markerLabel: "5/A7 - Electrical Junction",
        photos: [
          {
            id: "p1",
            projectId: "1",
            markerId: "1",
            markerLabel: "5/A7 - Electrical Junction",
            capturedAt: Date.now() - 1000 * 60 * 30,
            isIssue: false,
            localPath: "https://picsum.photos/seed/p1/300/300",
            remotePath: null,
            capturedBy: "user_1",
          },
          {
            id: "p2",
            projectId: "1",
            markerId: "1",
            markerLabel: "5/A7 - Electrical Junction",
            capturedAt: Date.now() - 1000 * 60 * 60,
            isIssue: true,
            localPath: "https://picsum.photos/seed/p2/300/300",
            remotePath: null,
            capturedBy: "user_1",
            hasVoiceNote: true,
          },
          {
            id: "p3",
            projectId: "1",
            markerId: "1",
            markerLabel: "5/A7 - Electrical Junction",
            capturedAt: Date.now() - 1000 * 60 * 90,
            isIssue: false,
            localPath: "https://picsum.photos/seed/p3/300/300",
            remotePath: null,
            capturedBy: "user_1",
          },
        ],
      },
      {
        markerId: "2",
        markerLabel: "3/A2 - Panel Rough-in",
        photos: [
          {
            id: "p4",
            projectId: "1",
            markerId: "2",
            markerLabel: "3/A2 - Panel Rough-in",
            capturedAt: Date.now() - 1000 * 60 * 120,
            isIssue: false,
            localPath: "https://picsum.photos/seed/p4/300/300",
            remotePath: null,
            capturedBy: "user_1",
          },
          {
            id: "p5",
            projectId: "1",
            markerId: "2",
            markerLabel: "3/A2 - Panel Rough-in",
            capturedAt: Date.now() - 1000 * 60 * 150,
            isIssue: false,
            localPath: "https://picsum.photos/seed/p5/300/300",
            remotePath: null,
            capturedBy: "user_1",
          },
        ],
      },
    ],
  },
  {
    title: "Yesterday",
    data: [
      {
        markerId: "3",
        markerLabel: "2/A1 - HVAC Duct",
        photos: [
          {
            id: "p6",
            projectId: "1",
            markerId: "3",
            markerLabel: "2/A1 - HVAC Duct",
            capturedAt: Date.now() - 1000 * 60 * 60 * 24,
            isIssue: false,
            localPath: "https://picsum.photos/seed/p6/300/300",
            remotePath: null,
            capturedBy: "user_1",
          },
          {
            id: "p7",
            projectId: "1",
            markerId: "3",
            markerLabel: "2/A1 - HVAC Duct",
            capturedAt: Date.now() - 1000 * 60 * 60 * 25,
            isIssue: false,
            localPath: "https://picsum.photos/seed/p7/300/300",
            remotePath: null,
            capturedBy: "user_1",
          },
        ],
      },
    ],
  },
]

export default function MediaScreen() {
  if (isPrototypeMode()) return <PrototypeMediaScreen />
  return <LiveMediaScreen />
}

/* ─── Photo Detail Modal ─────────────────────────────────── */

function PhotoDetailModal({
  visible,
  photoIndex,
  onClose,
  onNavigate,
  onRFI,
}: {
  visible: boolean
  photoIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
  onRFI?: () => void
}) {
  const photo = ALL_PROTOTYPE_PHOTOS[photoIndex]
  if (!photo) return null

  const isIssue = photo.isIssue
  const total = ALL_PROTOTYPE_PHOTOS.length
  const current = photoIndex + 1

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black">
        <Image
          source={{ uri: `https://picsum.photos/seed/construct${photo.seed}/1080/1920` }}
          style={{ position: "absolute", width: "100%", height: "100%" }}
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

        {/* Top bar */}
        <SafeAreaView edges={["top"]} style={{ zIndex: 20 }}>
          <View className="flex-row items-center justify-between px-3 pt-2">
            <Pressable
              onPress={onClose}
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
        </SafeAreaView>

        {/* Bottom sheet */}
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
            <SafeAreaView edges={["bottom"]} style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {/* Timestamp */}
              <View className="mb-3 flex-row items-center gap-2">
                <Icon
                  as={Clock}
                  className="size-3.5"
                  style={{ color: "rgba(255,255,255,0.5)" } as any}
                />
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500" }}>
                  {photo.timeLabel}
                </Text>
              </View>

              {/* Voice note */}
              {photo.hasVoiceNote && photo.voiceTranscript && (
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
                      <Icon as={Mic} style={{ color: "#3b82f6" } as any} className="size-4" />
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
                      <Icon as={Play} style={{ color: "#3b82f6" } as any} className="size-4" />
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

              {/* Generate RFI button for issues */}
              {isIssue && (
                <Pressable
                  onPress={onRFI}
                  className="mb-4 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  <Icon as={Flag} className="size-4 text-white" />
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                    Generate RFI
                  </Text>
                </Pressable>
              )}

              {/* Navigation */}
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => photoIndex > 0 && onNavigate(photoIndex - 1)}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor:
                      photoIndex > 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Icon
                    as={ChevronLeft}
                    className="size-5"
                    style={{ color: photoIndex > 0 ? "#fff" : "rgba(255,255,255,0.2)" } as any}
                  />
                </Pressable>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {current} of {total}
                </Text>
                <Pressable
                  onPress={() => photoIndex < total - 1 && onNavigate(photoIndex + 1)}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor:
                      photoIndex < total - 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Icon
                    as={ChevronRight}
                    className="size-5"
                    style={
                      {
                        color: photoIndex < total - 1 ? "#fff" : "rgba(255,255,255,0.2)",
                      } as any
                    }
                  />
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/* ─── Timeline Photo Card ─────────────────────────────────── */

function TimelinePhotoCard({ photo, onPress }: { photo: MockTimelinePhoto; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
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
            source={{ uri: `https://picsum.photos/seed/construct${photo.seed}/400/300` }}
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
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>ISSUE</Text>
              </View>
            </View>
          )}
        </View>
        <View className="flex-1 justify-center px-3 py-2">
          <View className="mb-1 flex-row items-center gap-1.5">
            <Icon as={Clock} className="size-3" style={{ color: "rgba(255,255,255,0.4)" } as any} />
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500" }}>
              {photo.timeLabel}
            </Text>
          </View>
          {photo.hasVoiceNote && (
            <View className="flex-row items-center gap-1.5">
              <Icon as={Mic} style={{ color: "#3b82f6" } as any} className="size-3" />
              <Text style={{ color: "#3b82f6", fontSize: 11, fontWeight: "600" }}>
                {photo.voiceDuration}
              </Text>
            </View>
          )}
          {photo.voiceTranscript && (
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
            style={{ color: "rgba(255,255,255,0.25)" } as any}
          />
        </View>
      </View>
    </Pressable>
  )
}

/* ─── Mock marker-grouped photo data (matches Storybook) ── */

const MOCK_MEDIA_SECTIONS = [
  {
    title: "Today",
    groups: [
      {
        markerLabel: "5/A7 - Electrical Junction",
        hasIssue: true,
        voiceNote: {
          duration: "0:15",
          transcript:
            "Junction box needs to move about six inches to the left to clear the conduit run",
        },
        photos: [
          { id: "p1", seed: "elect1", time: "2:30 PM", isIssue: false, hasVoiceNote: false },
          { id: "p2", seed: "elect2", time: "1:30 PM", isIssue: true, hasVoiceNote: true },
          { id: "p3", seed: "elect3", time: "12:00 PM", isIssue: false, hasVoiceNote: false },
        ],
      },
      {
        markerLabel: "3/A2 - Panel Rough-in",
        hasIssue: false,
        photos: [
          { id: "p4", seed: "panel1", time: "11:00 AM", isIssue: false, hasVoiceNote: false },
          { id: "p5", seed: "panel2", time: "10:30 AM", isIssue: false, hasVoiceNote: false },
        ],
      },
    ],
  },
  {
    title: "Yesterday",
    groups: [
      {
        markerLabel: "2/A1 - HVAC Duct",
        hasIssue: false,
        photos: [
          { id: "p6", seed: "hvac1", time: "4:15 PM", isIssue: false, hasVoiceNote: false },
          { id: "p7", seed: "hvac2", time: "3:00 PM", isIssue: false, hasVoiceNote: false },
        ],
      },
    ],
  },
]

const ALL_MEDIA_PHOTOS = MOCK_MEDIA_SECTIONS.flatMap((s) =>
  s.groups.flatMap((g) =>
    g.photos.map((p) => ({ ...p, markerLabel: g.markerLabel, voiceNote: g.voiceNote })),
  ),
)

/* ─── Photo Thumbnail (160x160 with badges) ──────────────── */

function PhotoThumbnailProto({
  seed,
  time,
  isIssue,
  hasVoiceNote,
  onPress,
}: {
  seed: string
  time: string
  isIssue?: boolean
  hasVoiceNote?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-muted relative overflow-hidden rounded-xl"
      style={{ width: 160, height: 160 }}
    >
      <Image
        source={{ uri: `https://picsum.photos/seed/${seed}/300/300` }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
      {isIssue && (
        <View
          className="bg-destructive absolute top-2 right-2 items-center justify-center rounded-full"
          style={{ width: 20, height: 20 }}
        >
          <Text className="text-[12px] font-bold text-white">!</Text>
        </View>
      )}
      {hasVoiceNote && (
        <View
          className="absolute right-2 bottom-2 items-center justify-center rounded-full bg-blue-500"
          style={{ width: 20, height: 20 }}
        >
          <Icon as={Mic} className="size-3 text-white" />
        </View>
      )}
      <View className="absolute bottom-2 left-2">
        <View className="rounded bg-black/40 px-1.5 py-0.5">
          <Text className="text-[11px] font-medium text-white">{time}</Text>
        </View>
      </View>
    </Pressable>
  )
}

/* ─── Prototype Media Screen (matches Storybook) ─────────── */

function PrototypeMediaScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [selectedPhotoIndex, setSelectedPhotoIndex] = React.useState(-1)

  const handleRFI = React.useCallback(() => {
    setSelectedPhotoIndex(-1)
    router.push(`/project/${projectId}/rfi` as any)
  }, [router, projectId])

  const openPhoto = React.useCallback((photoId: string) => {
    const idx = ALL_PROTOTYPE_PHOTOS.findIndex((p) => p.id === photoId)
    if (idx >= 0) setSelectedPhotoIndex(idx)
  }, [])

  return (
    <>
      <ScrollView className="bg-background flex-1" showsVerticalScrollIndicator={false}>
        {MOCK_MEDIA_SECTIONS.map((section) => (
          <View key={section.title}>
            <View className="bg-background px-4 pt-6 pb-2">
              <Text className="text-foreground text-base font-bold">{section.title}</Text>
            </View>
            {section.groups.map((group, groupIdx) => (
              <React.Fragment key={group.markerLabel}>
                <View className="py-4">
                  {/* Marker header */}
                  <View className="mb-3 px-4">
                    <View className="mb-2 flex-row items-center gap-2">
                      <Icon as={MapPin} className="text-muted-foreground size-4" />
                      <Text className="text-foreground text-sm font-semibold">
                        {group.markerLabel}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        ({group.photos.length} photos)
                      </Text>
                    </View>
                    {group.hasIssue && (
                      <Pressable
                        onPress={() => {
                          router.push(`/project/${projectId}/rfi` as any)
                        }}
                        className="bg-primary/10 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 active:opacity-70"
                      >
                        <Icon as={FileText} className="text-primary size-3.5" />
                        <Text className="text-primary text-xs font-medium">Generate RFI</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Horizontal photo scroll */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="px-4 gap-3"
                  >
                    {group.photos.map((photo) => (
                      <PhotoThumbnailProto
                        key={photo.id}
                        seed={photo.seed}
                        time={photo.time}
                        isIssue={photo.isIssue}
                        hasVoiceNote={photo.hasVoiceNote}
                        onPress={() => openPhoto(photo.id)}
                      />
                    ))}
                  </ScrollView>

                  {/* Voice note card */}
                  {group.voiceNote && (
                    <View className="mt-3 px-4">
                      <View className="bg-muted/20 flex-row items-start gap-2 rounded-lg p-3">
                        <Icon as={Mic} className="text-primary mt-0.5 size-4" />
                        <View className="flex-1">
                          <Text className="text-muted-foreground mb-1 text-xs">
                            {group.voiceNote.duration}
                          </Text>
                          <Text className="text-foreground text-sm leading-relaxed">
                            &ldquo;{group.voiceNote.transcript}&rdquo;
                          </Text>
                        </View>
                        <Pressable className="p-1">
                          <Icon as={Play} className="text-primary size-4" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
                {groupIdx < section.groups.length - 1 && <Separator className="ml-4" />}
              </React.Fragment>
            ))}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <PhotoDetailModal
        visible={selectedPhotoIndex >= 0}
        photoIndex={selectedPhotoIndex}
        onClose={() => setSelectedPhotoIndex(-1)}
        onNavigate={setSelectedPhotoIndex}
        onRFI={handleRFI}
      />
    </>
  )
}

function LiveMediaScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>()

  const realSections = usePhotosTimeline(projectId)

  // Combine real and mock data for preview
  const sections = realSections.length > 0 ? realSections : MOCK_SECTIONS

  const handlePhotoPress = React.useCallback((photoId: string) => {
    console.log("Photo pressed:", photoId)
    // TODO: Navigate to full-screen photo viewer
  }, [])

  return (
    <View className="bg-background flex-1">
      {sections.length > 0 ? (
        <PhotoTimeline sections={sections} onPhotoPress={handlePhotoPress} />
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon as={Camera} className="text-muted-foreground size-8" />
            </EmptyMedia>
            <EmptyTitle>No Media Yet</EmptyTitle>
            <EmptyDescription>
              Photos and recordings from this project will appear here as they are captured.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </View>
  )
}
