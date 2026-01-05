import * as React from 'react'
import { SectionList, View, ScrollView, Pressable } from 'react-native'
import { Text } from '@/components/ui/text'
import { Separator } from '@/components/ui/separator'
import { PhotoThumbnail } from './photo-thumbnail'
import { TimelineSection, CalloutGroup as CalloutGroupType } from '@/hooks/use-photos-timeline'
import { MapPin, FileText, Mic, Play } from 'lucide-react-native'
import { Icon } from '@/components/ui/icon'

interface PhotoTimelineProps {
  sections: TimelineSection[]
  onPhotoPress?: (photoId: string) => void
  ListHeaderComponent?: React.ReactElement
}

const CalloutGroup = React.memo(function CalloutGroup({
  group,
  onPhotoPress
}: {
  group: CalloutGroupType
  onPhotoPress?: (photoId: string) => void
}) {
  const hasIssues = group.photos.some(photo => photo.isIssue)
  const hasVoiceNotes = group.photos.some(photo => (photo as any).hasVoiceNote)

  const handleGenerateRFI = React.useCallback(() => {
    // TODO: Implement RFI generation
    console.log('Generate RFI for', group.markerLabel)
  }, [group.markerLabel])

  // Mock voice note data - in real app, this would come from the photo data
  const mockVoiceNote = hasVoiceNotes ? {
    transcript: "Junction box needs to move about six inches to the left to clear the conduit run",
    duration: "0:15"
  } : null

  return (
    <View className="py-4">
      <View className="px-4 mb-3">
        <View className="flex-row items-center gap-2 mb-2">
          <Icon as={MapPin} className="size-4 text-muted-foreground" />
          <Text className="text-sm font-semibold text-foreground">
            {group.markerLabel}
          </Text>
          <Text className="text-xs text-muted-foreground">
            ({group.photos.length} photos)
          </Text>
        </View>
        {hasIssues && (
          <Pressable
            onPress={handleGenerateRFI}
            className="self-start flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 active:opacity-70"
          >
            <Icon as={FileText} className="size-3.5 text-primary" />
            <Text className="text-xs font-medium text-primary">Generate RFI</Text>
          </Pressable>
        )}
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 gap-3"
      >
        {group.photos.map((photo) => (
          <PhotoThumbnail
            key={photo.id}
            uri={photo.localPath}
            capturedAt={photo.capturedAt}
            isIssue={photo.isIssue}
            hasVoiceNote={(photo as any).hasVoiceNote || (photo.id === 'p2')}
            onPress={() => onPhotoPress?.(photo.id)}
          />
        ))}
      </ScrollView>

      {/* Voice Note Display */}
      {mockVoiceNote && (
        <View className="px-4 mt-3">
          <View className="flex-row items-start gap-2 p-3 bg-muted/20 rounded-lg">
            <Icon as={Mic} className="size-4 text-primary mt-0.5" />
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-1">{mockVoiceNote.duration}</Text>
              <Text className="text-sm text-foreground leading-relaxed">
                &ldquo;{mockVoiceNote.transcript}&rdquo;
              </Text>
            </View>
            <Pressable className="p-1">
              <Icon as={Play} className="size-4 text-primary" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
})

export const PhotoTimeline = React.memo(function PhotoTimeline({
  sections,
  onPhotoPress,
  ListHeaderComponent
}: PhotoTimelineProps) {
  return (
    <SectionList
      sections={sections}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={ListHeaderComponent}
      keyExtractor={(item, index) => item.markerId + index}
      renderSectionHeader={({ section: { title } }) => (
        <View className="bg-background pt-6 pb-2 px-4">
          <Text className="text-base font-bold text-foreground">
            {title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <CalloutGroup group={item} onPhotoPress={onPhotoPress} />
      )}
      ItemSeparatorComponent={() => <Separator className="ml-4" />}
      contentContainerClassName="pb-12"
    />
  )
})

