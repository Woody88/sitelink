import * as React from 'react'
import { SectionList, View, ScrollView } from 'react-native'
import { Text } from '@/components/ui/text'
import { Separator } from '@/components/ui/separator'
import { PhotoThumbnail } from './photo-thumbnail'
import { TimelineSection, CalloutGroup as CalloutGroupType } from '@/hooks/use-photos-timeline'
import { MapPin } from 'lucide-react-native'
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
  return (
    <View className="py-4">
      <View className="flex-row items-center gap-2 px-4 mb-3">
        <Icon as={MapPin} className="size-4 text-muted-foreground" />
        <Text className="text-sm font-semibold text-foreground">
          {group.markerLabel}
        </Text>
        <Text className="text-xs text-muted-foreground">
          ({group.photos.length} photos)
        </Text>
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
            onPress={() => onPhotoPress?.(photo.id)}
          />
        ))}
      </ScrollView>
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

