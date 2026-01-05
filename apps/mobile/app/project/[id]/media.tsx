import * as React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { PhotoTimeline } from '@/components/activity/photo-timeline'
import { usePhotosTimeline } from '@/hooks/use-photos-timeline'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Icon } from '@/components/ui/icon'
import { Camera } from 'lucide-react-native'

// Mock data for initial development
const MOCK_SECTIONS = [
  {
    title: 'Today',
    data: [
      {
        markerId: '1',
        markerLabel: '5/A7 - Electrical Junction',
        photos: [
          {
            id: 'p1',
            projectId: '1',
            markerId: '1',
            markerLabel: '5/A7 - Electrical Junction',
            capturedAt: Date.now() - 1000 * 60 * 30,
            isIssue: false,
            localPath: 'https://picsum.photos/seed/p1/300/300',
            remotePath: null,
            capturedBy: 'user_1',
          },
          {
            id: 'p2',
            projectId: '1',
            markerId: '1',
            markerLabel: '5/A7 - Electrical Junction',
            capturedAt: Date.now() - 1000 * 60 * 60,
            isIssue: true,
            localPath: 'https://picsum.photos/seed/p2/300/300',
            remotePath: null,
            capturedBy: 'user_1',
            hasVoiceNote: true,
          },
          {
            id: 'p3',
            projectId: '1',
            markerId: '1',
            markerLabel: '5/A7 - Electrical Junction',
            capturedAt: Date.now() - 1000 * 60 * 90,
            isIssue: false,
            localPath: 'https://picsum.photos/seed/p3/300/300',
            remotePath: null,
            capturedBy: 'user_1',
          },
        ],
      },
      {
        markerId: '2',
        markerLabel: '3/A2 - Panel Rough-in',
        photos: [
          {
            id: 'p4',
            projectId: '1',
            markerId: '2',
            markerLabel: '3/A2 - Panel Rough-in',
            capturedAt: Date.now() - 1000 * 60 * 120,
            isIssue: false,
            localPath: 'https://picsum.photos/seed/p4/300/300',
            remotePath: null,
            capturedBy: 'user_1',
          },
          {
            id: 'p5',
            projectId: '1',
            markerId: '2',
            markerLabel: '3/A2 - Panel Rough-in',
            capturedAt: Date.now() - 1000 * 60 * 150,
            isIssue: false,
            localPath: 'https://picsum.photos/seed/p5/300/300',
            remotePath: null,
            capturedBy: 'user_1',
          },
        ],
      },
    ],
  },
  {
    title: 'Yesterday',
    data: [
      {
        markerId: '3',
        markerLabel: '2/A1 - HVAC Duct',
        photos: [
          {
            id: 'p6',
            projectId: '1',
            markerId: '3',
            markerLabel: '2/A1 - HVAC Duct',
            capturedAt: Date.now() - 1000 * 60 * 60 * 24,
            isIssue: false,
            localPath: 'https://picsum.photos/seed/p6/300/300',
            remotePath: null,
            capturedBy: 'user_1',
          },
          {
            id: 'p7',
            projectId: '1',
            markerId: '3',
            markerLabel: '2/A1 - HVAC Duct',
            capturedAt: Date.now() - 1000 * 60 * 60 * 25,
            isIssue: false,
            localPath: 'https://picsum.photos/seed/p7/300/300',
            remotePath: null,
            capturedBy: 'user_1',
          },
        ],
      },
    ],
  },
]

export default function MediaScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>()
  
  const realSections = usePhotosTimeline(projectId)

  // Combine real and mock data for preview
  const sections = realSections.length > 0 ? realSections : MOCK_SECTIONS

  const handlePhotoPress = React.useCallback((photoId: string) => {
    console.log('Photo pressed:', photoId)
    // TODO: Navigate to full-screen photo viewer
  }, [])

  return (
    <View className="flex-1 bg-background">
      {sections.length > 0 ? (
        <PhotoTimeline
          sections={sections}
          onPhotoPress={handlePhotoPress}
        />
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon as={Camera} className="size-8 text-muted-foreground" />
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

