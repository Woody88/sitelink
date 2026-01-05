import * as React from 'react'
import { View, Image, Pressable } from 'react-native'
import { AlertCircle, Mic } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface PhotoThumbnailProps {
  uri: string
  capturedAt: number
  isIssue?: boolean
  hasVoiceNote?: boolean
  onPress?: () => void
  className?: string
}

export const PhotoThumbnail = React.memo(function PhotoThumbnail({
  uri,
  capturedAt,
  isIssue,
  hasVoiceNote,
  onPress,
  className
}: PhotoThumbnailProps) {
  // Use picsum as placeholder if needed, but adding random param to prevent caching same image
  const displayUri = uri.startsWith('http') ? uri : `https://picsum.photos/seed/${capturedAt}/300/300`

  return (
    <Pressable 
      onPress={onPress}
      className={cn('relative rounded-lg overflow-hidden bg-muted', className)}
      style={{ width: 120, height: 120 }}
    >
      <Image 
        source={{ uri: displayUri }} 
        className="w-full h-full"
        resizeMode="cover"
      />
      
      {/* Badges */}
      <View className="absolute top-1.5 left-1.5 flex-row gap-1">
        {isIssue && (
          <View className="bg-destructive rounded-full p-1 shadow-sm">
            <Icon as={AlertCircle} className="size-3 text-destructive-foreground" />
          </View>
        )}
        {hasVoiceNote && (
          <View className="bg-primary rounded-full p-1 shadow-sm">
            <Icon as={Mic} className="size-3 text-primary-foreground" />
          </View>
        )}
      </View>

      {/* Timestamp */}
      <View className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-0.5">
        <Text className="text-[10px] text-white font-medium">
          {format(new Date(capturedAt), 'h:mm a')}
        </Text>
      </View>
    </Pressable>
  )
})

