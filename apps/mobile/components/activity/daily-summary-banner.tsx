import * as React from 'react'
import { View, Pressable, Share, Modal } from 'react-native'
import { ChevronDown, ChevronUp, RefreshCcw, Sparkles, ExternalLink, X } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DailySummary } from '@/hooks/use-daily-summary'
import { formatDistanceToNow } from 'date-fns'

interface DailySummaryBannerProps {
  summary: DailySummary | null
  isLoading: boolean
  onGenerate: () => void
  onShare?: () => void
  className?: string
  stats?: {
    photoCount: number
    voiceNoteCount: number
    issueCount: number
  }
}

export const DailySummaryBanner = React.memo(function DailySummaryBanner({
  summary,
  isLoading,
  onGenerate,
  onShare,
  className,
  stats
}: DailySummaryBannerProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false)
  const hasSummary = !!summary
  
  // Build default summary from stats - always show counts, even if zero
  const buildDefaultSummary = React.useMemo(() => {
    const photoCount = stats?.photoCount ?? 0
    const voiceNoteCount = stats?.voiceNoteCount ?? 0
    const issueCount = stats?.issueCount ?? 0
    
    const lines = [
      `📷 ${photoCount} photo${photoCount !== 1 ? 's' : ''} captured`,
      `🎤 ${voiceNoteCount} voice note${voiceNoteCount !== 1 ? 's' : ''}`,
      `⚠️ ${issueCount} issue${issueCount !== 1 ? 's' : ''} flagged`
    ]
    return lines.join('\n')
  }, [stats])

  const displaySummary = summary || { text: buildDefaultSummary, lastGenerated: new Date() }

  const handleShare = React.useCallback(async () => {
    if (!displaySummary) return

    try {
      await Share.share({
        message: `Daily Summary\n\n${displaySummary.text}\n\n${!hasSummary ? 'Default summary' : `Generated ${formatDistanceToNow(displaySummary.lastGenerated, { addSuffix: true })}`}`
      })
      onShare?.()
    } catch (error) {
      console.error('Error sharing summary:', error)
    }
  }, [displaySummary, onShare, hasSummary])

  const handleGenerateClick = React.useCallback(() => {
    setShowConfirmDialog(true)
  }, [])

  const handleConfirmGenerate = React.useCallback(() => {
    setShowConfirmDialog(false)
    onGenerate()
  }, [onGenerate])

  return (
    <View className={cn('border border-border bg-muted/20 rounded-none overflow-hidden', className)}>
      {/* Title Bar */}
      <Pressable
        onPress={() => displaySummary && setIsCollapsed(!isCollapsed)}
        className="flex-row items-center justify-between p-4"
        disabled={!displaySummary}
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Icon as={Sparkles} className="size-4 text-foreground" />
          <Text className="text-base font-semibold text-foreground">Today&apos;s Summary</Text>
          {displaySummary && (
            <Icon
              as={isCollapsed ? ChevronDown : ChevronUp}
              className="size-4 text-muted-foreground ml-1"
            />
          )}
        </View>

        {displaySummary && !isCollapsed && hasSummary && (
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
          ) : displaySummary ? (
            <View className="gap-3">
              {!hasSummary && buildDefaultSummary ? (
                <View className="gap-2">
                  {displaySummary.text.split('\n').map((line, index) => (
                    <Text key={index} className="text-sm leading-relaxed text-foreground">
                      {line}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text className="text-sm leading-relaxed text-foreground">
                  {displaySummary.text}
                </Text>
              )}
              <View className="flex-row items-center justify-between mt-1">
                {!hasSummary ? (
                  <Text className="text-xs text-muted-foreground">
                    Default summary
                  </Text>
                ) : (
                  <Text className="text-xs text-muted-foreground">
                    Generated {formatDistanceToNow(displaySummary.lastGenerated, { addSuffix: true })}
                  </Text>
                )}
                {hasSummary && (
                  <Pressable
                    onPress={handleGenerateClick}
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
                )}
              </View>
              {!hasSummary && (
                <View className="flex-row justify-end mt-2">
                  <Pressable
                    onPress={handleGenerateClick}
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
              )}
            </View>
          ) : null}
        </View>
      )}

      {/* Confirmation Dialog */}
      <Modal
        visible={showConfirmDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDialog(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-background rounded-xl p-6 w-full max-w-sm border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-foreground">Generate AI Summary</Text>
              <Pressable
                onPress={() => setShowConfirmDialog(false)}
                className="p-1"
              >
                <Icon as={X} className="size-5 text-muted-foreground" />
              </Pressable>
            </View>
            <Text className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Generate a summary of today&apos;s progress and photos using AI.
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setShowConfirmDialog(false)}
                className="flex-1"
              >
                <Text className="text-foreground font-medium">Cancel</Text>
              </Button>
              <Button
                onPress={handleConfirmGenerate}
                disabled={isLoading}
                className="flex-1"
              >
                <Text className="text-primary-foreground font-medium">Generate</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
})
