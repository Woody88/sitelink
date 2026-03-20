import { useLocalSearchParams } from "expo-router"
import { Camera, Mic } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { PhotoTimeline } from "@/components/activity/photo-timeline"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { usePhotosTimeline } from "@/hooks/use-photos-timeline"
import { MOCK_TIMELINE_PHOTOS } from "@/lib/mock-data"
import { isPrototypeMode } from "@/lib/prototype-mode"

// Mock data for initial development
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

function PrototypeMediaScreen() {
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="pb-12">
      {MOCK_TIMELINE_PHOTOS.map((cluster) => (
        <View key={cluster.label}>
          <View className="bg-background px-4 pt-6 pb-2">
            <Text className="text-foreground text-base font-bold">{cluster.label}</Text>
          </View>

          <View className="flex-row flex-wrap px-3">
            {cluster.photos.map((photo) => (
              <View key={photo.id} className="w-1/3 p-1">
                <Pressable className="active:opacity-80">
                  <View
                    className="aspect-square items-center justify-center rounded-lg"
                    style={{ backgroundColor: photo.color }}
                  >
                    <Text className="text-xs font-medium text-white/90">{photo.timeLabel}</Text>
                  </View>

                  {photo.isIssue && (
                    <View className="absolute inset-0 rounded-lg border-2 border-red-500 p-1" />
                  )}

                  {photo.hasVoiceNote && (
                    <View className="absolute right-2 bottom-2 flex-row items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5">
                      <Icon as={Mic} className="size-2.5 text-white" />
                      {photo.voiceDuration && (
                        <Text className="text-[9px] font-medium text-white">
                          {photo.voiceDuration}
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
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
