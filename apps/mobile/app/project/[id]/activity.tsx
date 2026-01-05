import * as React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { DailySummaryBanner } from '@/components/activity/daily-summary-banner'
import { PhotoTimeline } from '@/components/activity/photo-timeline'
import { ActivityFilters } from '@/components/activity/activity-filters'
import { usePhotosTimeline } from '@/hooks/use-photos-timeline'
import { useDailySummary } from '@/hooks/use-daily-summary'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Icon } from '@/components/ui/icon'
import { Camera } from 'lucide-react-native'

const FILTER_OPTIONS = [
  { label: 'All Activity', value: 'all' },
  { label: 'Issues Only', value: 'issues' },
  { label: 'With Notes', value: 'voice' },
]

// Mock data for initial development
const MOCK_SECTIONS = [
  {
    title: 'Today',
    data: [
      {
        markerId: '1',
        markerLabel: '5/A7 - Electrical Junction',
        photos: [
          { id: 'p1', capturedAt: Date.now() - 1000 * 60 * 30, isIssue: false, localPath: 'https://picsum.photos/seed/p1/300/300' },
          { id: 'p2', capturedAt: Date.now() - 1000 * 60 * 60, isIssue: true, localPath: 'https://picsum.photos/seed/p2/300/300' },
          { id: 'p3', capturedAt: Date.now() - 1000 * 60 * 90, isIssue: false, localPath: 'https://picsum.photos/seed/p3/300/300' },
        ]
      },
      {
        markerId: '2',
        markerLabel: '3/A2 - Panel Rough-in',
        photos: [
          { id: 'p4', capturedAt: Date.now() - 1000 * 60 * 120, isIssue: false, localPath: 'https://picsum.photos/seed/p4/300/300' },
          { id: 'p5', capturedAt: Date.now() - 1000 * 60 * 150, isIssue: false, localPath: 'https://picsum.photos/seed/p5/300/300' },
        ]
      }
    ]
  },
  {
    title: 'Yesterday',
    data: [
      {
        markerId: '3',
        markerLabel: '2/A1 - HVAC Duct',
        photos: [
          { id: 'p6', capturedAt: Date.now() - 1000 * 60 * 60 * 24, isIssue: false, localPath: 'https://picsum.photos/seed/p6/300/300' },
          { id: 'p7', capturedAt: Date.now() - 1000 * 60 * 60 * 25, isIssue: false, localPath: 'https://picsum.photos/seed/p7/300/300' },
        ]
      }
    ]
  }
]

export default function ActivityScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>()
  const [activeFilter, setActiveFilter] = React.useState('all')
  
  const realSections = usePhotosTimeline(projectId)
  const { summary, isLoading: isSummaryLoading, generateSummary } = useDailySummary(projectId)

  // Combine real and mock data for preview
  const sections = realSections.length > 0 ? realSections : MOCK_SECTIONS

  // Filter sections based on active filter
  const filteredSections = React.useMemo(() => {
    if (activeFilter === 'all') return sections

    return sections.map(section => ({
      ...section,
      data: section.data.map(group => ({
        ...group,
        photos: (group.photos as any[]).filter(photo => {
          if (activeFilter === 'issues') return photo.isIssue
          // Voice note filtering placeholder
          return true
        })
      })).filter(group => group.photos.length > 0)
    })).filter(section => section.data.length > 0)
  }, [sections, activeFilter])

  const handlePhotoPress = React.useCallback((photoId: string) => {
    console.log('Photo pressed:', photoId)
  }, [])

  return (
    <View className="flex-1 bg-background">
      <ActivityFilters
        options={FILTER_OPTIONS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        className="border-b border-border"
      />

      {sections.length > 0 ? (
        <PhotoTimeline
          sections={filteredSections}
          onPhotoPress={handlePhotoPress}
          ListHeaderComponent={
            <View className="p-4">
              <DailySummaryBanner
                summary={summary}
                isLoading={isSummaryLoading}
                onGenerate={generateSummary}
              />
            </View>
          }
        />
      ) : (
        <View className="flex-1">
          <View className="p-4">
            <DailySummaryBanner
              summary={summary}
              isLoading={isSummaryLoading}
              onGenerate={generateSummary}
            />
          </View>
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={Camera} className="size-8 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No Activity Yet</EmptyTitle>
              <EmptyDescription>
                Photos and activity from this project will appear here as they are captured.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </View>
      )}
    </View>
  )
}
