import * as React from 'react'
import { View, Pressable, Share } from 'react-native'
import { ChevronDown, ChevronUp, RefreshCcw, Sparkles, ExternalLink } from 'lucide-react-native'
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
    <View className={cn('border border-border bg-muted/20 rounded-none overflow-hidden', className)}>
      {/* Title Bar */}
      <Pressable
        onPress={() => summary && setIsCollapsed(!isCollapsed)}
        className="flex-row items-center justify-between p-4"
        disabled={!summary}
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Icon as={Sparkles} className="size-4 text-foreground" />
          <Text className="text-base font-semibold text-foreground">Today&apos;s Summary</Text>
          {summary && (
            <Icon
              as={isCollapsed ? ChevronDown : ChevronUp}
              className="size-4 text-muted-foreground ml-1"
            />
          )}
        </View>

        {summary && !isCollapsed && (
          <Pressable
            onPress={handleShare}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 active:opacity-70"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon as={ExternalLink} className="size-4 text-foreground" />
            <Text className="text-sm font-medium text-foreground">Share</Text>
          </Pressable>
        )}
      </Pressable>

      {/* Content */}
      {!isCollapsed && (
        <View className="px-4 pb-4">
          <View className="h-px bg-border mb-4 opacity-50" />
          {isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[60%]" />
            </View>
          ) : summary ? (
            <View className="gap-3">
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
            <View className="gap-4">
              <Text className="text-sm text-muted-foreground leading-relaxed">
                Generate an AI summary of today&apos;s progress and photos.
              </Text>
              <View className="flex-row justify-end">
                <Pressable
                  onPress={onGenerate}
                  disabled={isLoading}
                  className="flex-row items-center gap-2 px-4 py-2 bg-foreground rounded-full active:opacity-80"
                >
                  <Icon
                    as={Sparkles}
                    className={cn('size-4 text-background', isLoading && 'animate-spin')}
                  />
                  <Text className="text-sm font-semibold text-background">
                    Generate Summary
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  )
})
