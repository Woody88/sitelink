import * as React from 'react'
import { View, Image, Pressable } from 'react-native'
import { Mic } from 'lucide-react-native'
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
      className={cn('relative rounded-xl overflow-hidden bg-muted', className)}
      style={{ width: 160, height: 160 }}
    >
      <Image 
        source={{ uri: displayUri }} 
        className="w-full h-full"
        resizeMode="cover"
      />
      
      {/* Issue Badge (Top Right) */}
      {isIssue && (
        <View className="absolute top-2 right-2 bg-destructive rounded-full items-center justify-center shadow-md" style={{ width: 20, height: 20 }}>
          <Text className="text-[12px] text-destructive-foreground font-bold">!</Text>
        </View>
      )}

      {/* Voice Note Badge (Bottom Right) */}
      {hasVoiceNote && (
        <View className="absolute bottom-2 right-2 bg-blue-500 rounded-full items-center justify-center shadow-md" style={{ width: 20, height: 20 }}>
          <Icon as={Mic} className="size-3 text-white" />
        </View>
      )}

      {/* Timestamp (Bottom Left) */}
      <View className="absolute bottom-2 left-2">
        <View className="bg-black/40 rounded px-1.5 py-0.5">
          <Text className="text-[11px] text-white font-medium">
            {format(new Date(capturedAt), 'h:mm a')}
          </Text>
        </View>
      </View>
    </Pressable>
  )
})

