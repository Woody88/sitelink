import * as React from 'react'
import { View, Pressable, Share } from 'react-native'
import { Share as ShareIcon, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { DailySummary } from '@/hooks/use-daily-summary'
import { formatDistanceToNow } from 'date-fns'

interface DailySummaryBannerProps {
  summary: DailySummary | null
  isLoading: boolean
  onGenerate: () => void
  onShare?: () => void
  className?: string
}

export const DailySummaryBanner = React.memo(function DailySummaryBanner({
  summary,
  isLoading,
  onGenerate,
  onShare,
  className
}: DailySummaryBannerProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  const handleShare = React.useCallback(async () => {
    if (!summary) return

    try {
      await Share.share({
        message: `Daily Summary\n\n${summary.text}\n\nGenerated ${formatDistanceToNow(summary.lastGenerated, { addSuffix: true })}`
      })
      onShare?.()
    } catch (error) {
      console.error('Error sharing summary:', error)
    }
  }, [summary, onShare])

  return (
    <View className={cn('border border-border bg-muted/20 rounded-lg overflow-hidden', className)}>
      {/* Title Bar */}
      <Pressable
        onPress={() => summary && setIsCollapsed(!isCollapsed)}
        className="flex-row items-center justify-between p-4"
        disabled={!summary}
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Text className="text-base font-semibold text-foreground">Daily Summary</Text>
          {summary && (
            <Icon
              as={isCollapsed ? ChevronDown : ChevronUp}
              className="size-4 text-muted-foreground"
            />
          )}
        </View>

        {summary && !isCollapsed && (
          <Pressable
            onPress={handleShare}
            className="p-2 -mr-2 active:opacity-70"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon as={ShareIcon} className="size-5 text-foreground" />
          </Pressable>
        )}
      </Pressable>

      {/* Content */}
      {!isCollapsed && (
        <View className="px-4 pb-4">
          {isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[60%]" />
            </View>
          ) : summary ? (
            <View className="gap-2">
              <Text className="text-sm leading-relaxed text-foreground">
                {summary.text}
              </Text>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs text-muted-foreground">
                  Generated {formatDistanceToNow(summary.lastGenerated, { addSuffix: true })}
                </Text>
                <Pressable
                  onPress={onGenerate}
                  disabled={isLoading}
                  className="flex-row items-center gap-1.5 p-1 active:opacity-70"
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Icon
                    as={RefreshCcw}
                    className={cn('size-3.5 text-muted-foreground', isLoading && 'animate-spin')}
                  />
                  <Text className="text-xs text-muted-foreground">Refresh</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-sm text-muted-foreground">
                Generate an AI summary of today&apos;s progress and photos.
              </Text>
              <Pressable
                onPress={onGenerate}
                disabled={isLoading}
                className="self-start flex-row items-center gap-2 px-3 py-2 bg-secondary rounded-md active:opacity-80"
              >
                <Icon
                  as={RefreshCcw}
                  className={cn('size-4 text-secondary-foreground', isLoading && 'animate-spin')}
                />
                <Text className="text-sm font-medium text-secondary-foreground">
                  Generate Summary
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  )
})
