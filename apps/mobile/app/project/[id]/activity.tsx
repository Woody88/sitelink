import * as React from 'react'
import { View, ScrollView, Pressable } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { DailySummaryBanner } from '@/components/activity/daily-summary-banner'
import { useDailySummary } from '@/hooks/use-daily-summary'
import { usePhotosTimeline } from '@/hooks/use-photos-timeline'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { Share2, Download, type LucideIcon } from 'lucide-react-native'
import { Separator } from '@/components/ui/separator'

// Mock data for dashboard
const MOCK_MEMBERS = [
  { id: '1', name: 'John Smith', role: 'Owner' },
  { id: '2', name: 'Mike Chen', role: 'Member' },
  { id: '3', name: 'Sarah Johnson', role: 'Member' },
  { id: '4', name: 'David Lee', role: 'Member' },
  { id: '5', name: 'Emily Brown', role: 'Member' },
  { id: '6', name: 'Tom Wilson', role: 'Member' },
  { id: '7', name: 'Lisa Anderson', role: 'Member' },
]

const MOCK_ACTIVITY = [
  { id: '1', time: '2:47 PM', message: 'Mike flagged issue at 5/A7' },
  { id: '2', time: '11:30 AM', message: 'Sarah added 3 photos to 3/A2' },
  { id: '3', time: '9:15 AM', message: 'John added photo to 5/A7' },
  { id: '4', time: 'Yesterday 4:20 PM', message: 'David uploaded new plan sheet' },
  { id: '5', time: 'Yesterday 2:10 PM', message: 'Emily shared project with client' },
]

interface QuickActionButtonProps {
  icon: LucideIcon
  label: string
  onPress: () => void
}

const QuickActionButton = React.memo(function QuickActionButton({
  icon: IconComponent,
  label,
  onPress,
}: QuickActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center py-2 px-3 rounded-full bg-muted/20 active:opacity-70"
    >
      <Icon as={IconComponent} className="size-4 text-foreground mb-1" />
      <Text className="text-[11px] font-medium text-foreground text-center leading-tight">{label}</Text>
    </Pressable>
  )
})

export default function ActivityScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>()
  const { summary, isLoading: isSummaryLoading, generateSummary } = useDailySummary(projectId)
  const timelineSections = usePhotosTimeline(projectId)

  // Calculate today's stats
  const todayStats = React.useMemo(() => {
    const todaySection = timelineSections.find(section => section.title === 'Today')
    if (!todaySection) {
      return { photoCount: 0, voiceNoteCount: 0, issueCount: 0 }
    }

    let photoCount = 0
    let voiceNoteCount = 0
    let issueCount = 0

    todaySection.data.forEach(group => {
      group.photos.forEach(photo => {
        photoCount++
        if (photo.isIssue) issueCount++
        // Check if photo has voice note (mock data has hasVoiceNote property)
        if ((photo as any).hasVoiceNote) voiceNoteCount++
      })
    })

    return { photoCount, voiceNoteCount, issueCount }
  }, [timelineSections])


  const handleShare = React.useCallback(() => {
    console.log('Share project')
  }, [])

  const handleOffline = React.useCallback(() => {
    console.log('Offline mode')
  }, [])

  const displayedMembers = MOCK_MEMBERS.slice(0, 6)
  const hasMoreMembers = MOCK_MEMBERS.length > 6
  const moreCount = MOCK_MEMBERS.length - 6

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="p-4 gap-6">
        {/* Daily Summary Banner */}
        <DailySummaryBanner
          summary={summary}
          isLoading={isSummaryLoading}
          onGenerate={generateSummary}
          stats={todayStats}
        />

        {/* Quick Actions */}
        <View>
          <Text className="text-lg font-bold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row gap-2">
            <QuickActionButton
              icon={Share2}
              label="Share"
              onPress={handleShare}
            />
            <QuickActionButton
              icon={Download}
              label="Offline"
              onPress={handleOffline}
            />
          </View>
        </View>

        {/* Team Members */}
        <View>
          <View className="flex-row justify-between items-end mb-3">
            <Text className="text-lg font-bold text-foreground">Team Members</Text>
            <Pressable onPress={() => console.log('Manage members')}>
              <Text className="text-sm font-medium text-primary">Manage</Text>
            </Pressable>
          </View>
          {displayedMembers.map((member, index) => (
            <React.Fragment key={member.id}>
              <View className="flex-row items-center py-2.5">
                <View className="size-8 rounded-full bg-primary/20 items-center justify-center mr-3">
                  <Text className="text-xs font-semibold text-primary">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <Text className="flex-1 text-base font-medium text-foreground">
                  {member.name}
                  {member.role === 'Owner' && (
                    <Text className="text-xs text-muted-foreground ml-2">(you)</Text>
                  )}
                </Text>
                <Text className="text-sm text-muted-foreground">{member.role}</Text>
              </View>
              {index < displayedMembers.length - 1 && <Separator className="ml-11" />}
            </React.Fragment>
          ))}
          {hasMoreMembers && (
            <View className="mt-2">
              <Text className="text-sm text-muted-foreground text-center">
                +{moreCount} more
              </Text>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View>
          <Text className="text-lg font-bold text-foreground mb-3">Recent Activity</Text>
          {MOCK_ACTIVITY.map((activity, index) => (
            <React.Fragment key={activity.id}>
              <View className="border-l-2 border-muted pl-4 py-2.5">
                <Text className="text-xs text-muted-foreground mb-0.5">{activity.time}</Text>
                <Text className="text-sm text-foreground">{activity.message}</Text>
              </View>
              {index < MOCK_ACTIVITY.length - 1 && <View className="h-1" />}
            </React.Fragment>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
