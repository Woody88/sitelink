import * as React from 'react'
import { View } from 'react-native'
import { Sparkles, RefreshCcw } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { DailySummary } from '@/hooks/use-daily-summary'
import { formatDistanceToNow } from 'date-fns'

interface SummaryCardProps {
  summary: DailySummary | null
  isLoading: boolean
  onGenerate: () => void
  className?: string
}

export const SummaryCard = React.memo(function SummaryCard({
  summary,
  isLoading,
  onGenerate,
  className
}: SummaryCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <View className="flex-row items-center gap-2">
          <Icon as={Sparkles} className="size-5 text-primary" />
          <CardTitle className="text-lg">Today&apos;s Summary</CardTitle>
        </View>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-3 gap-2"
          onPress={onGenerate}
          disabled={isLoading}
        >
          <Icon as={RefreshCcw} className={cn('size-4', isLoading && 'animate-spin')} />
          <Text className="text-sm font-medium">Generate</Text>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[40%] mt-2" />
          </View>
        ) : summary ? (
          <View className="gap-3">
            <Text className="text-base leading-relaxed text-foreground">
              {summary.text}
            </Text>
            <Text className="text-xs text-muted-foreground italic">
              Last generated {formatDistanceToNow(summary.lastGenerated, { addSuffix: true })}
            </Text>
          </View>
        ) : (
          <View className="py-4 items-center">
            <Text className="text-muted-foreground text-center mb-4">
              Generate an AI summary of today&apos;s progress and photos.
            </Text>
            <Button variant="secondary" onPress={onGenerate} className="gap-2">
              <Icon as={Sparkles} className="size-4" />
              <Text>Generate Summary</Text>
            </Button>
          </View>
        )}
      </CardContent>
    </Card>
  )
})

