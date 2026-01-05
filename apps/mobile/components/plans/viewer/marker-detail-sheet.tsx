import * as React from 'react'
import { View, Pressable, Modal } from 'react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Camera,
  MapPin,
  Layers,
  X,
  ExternalLink,
} from 'lucide-react-native'
import { cn } from '@/lib/utils'
import type { CalloutMarker } from '@/hooks/use-plan-viewer'
import Animated, {
  SlideInDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Discipline labels and colors
const DISCIPLINE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  arch: { label: 'Architectural', color: '#2563eb', bgColor: 'rgba(37, 99, 235, 0.15)' },
  struct: { label: 'Structural', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)' },
  elec: { label: 'Electrical', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
  mech: { label: 'Mechanical', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
  plumb: { label: 'Plumbing', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
}

const TYPE_LABELS: Record<string, string> = {
  detail: 'Detail Callout',
  section: 'Section Callout',
  elevation: 'Elevation',
  note: 'Note',
}

interface MarkerDetailSheetProps {
  marker: CalloutMarker | null
  visible: boolean
  onClose: () => void
  onNavigateToSheet?: (sheetRef: string) => void
  onTakePhoto?: (marker: CalloutMarker) => void
}

/**
 * Bottom sheet showing marker details
 * Appears when a user taps a callout marker on the plan
 * Wealthsimple-inspired: clean, professional with clear CTAs
 */
export function MarkerDetailSheet({
  marker,
  visible,
  onClose,
  onNavigateToSheet,
  onTakePhoto,
}: MarkerDetailSheetProps) {
  const insets = useSafeAreaInsets()

  if (!marker) return null

  const discipline = DISCIPLINE_CONFIG[marker.discipline || ''] || {
    label: 'General',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
  }

  const typeLabel = TYPE_LABELS[marker.type] || 'Marker'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50"
        onPress={onClose}
      >
        <View className="flex-1" />

        {/* Sheet content */}
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          className="bg-card rounded-t-3xl"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable>
            {/* Handle */}
            <View className="items-center py-3">
              <View className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </View>

            {/* Header */}
            <View className="flex-row items-start justify-between px-6 pb-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <View
                    className="px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: discipline.bgColor }}
                  >
                    <Text style={{ color: discipline.color }} className="text-xs font-semibold">
                      {discipline.label}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {typeLabel}
                  </Text>
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {marker.label}
                </Text>
              </View>

              <Pressable
                onPress={onClose}
                className="p-2 -m-2 rounded-full active:bg-muted/50"
              >
                <Icon as={X} className="size-5 text-muted-foreground" />
              </Pressable>
            </View>

            {/* Location info */}
            <View className="flex-row items-center gap-2 px-6 pb-4">
              <Icon as={MapPin} className="size-4 text-muted-foreground" />
              <Text className="text-muted-foreground text-sm">
                Position: {Math.round(marker.x * 100)}%, {Math.round(marker.y * 100)}%
              </Text>
            </View>

            {/* Actions */}
            <View className="px-6 gap-3">
              {/* Navigate to target sheet */}
              {marker.targetSheetRef && onNavigateToSheet && (
                <Button
                  onPress={() => {
                    onNavigateToSheet(marker.targetSheetRef!)
                    onClose()
                  }}
                  className="h-14 flex-row items-center justify-between bg-primary"
                >
                  <View className="flex-row items-center gap-3">
                    <Icon as={Layers} className="size-5 text-primary-foreground" />
                    <View>
                      <Text className="text-primary-foreground font-semibold text-base">
                        Go to Sheet
                      </Text>
                      <Text className="text-primary-foreground/70 text-xs">
                        {marker.targetSheetRef}
                      </Text>
                    </View>
                  </View>
                  <Icon as={ArrowRight} className="size-5 text-primary-foreground" />
                </Button>
              )}

              {/* Take photo at this location */}
              {onTakePhoto && (
                <Button
                  variant="outline"
                  onPress={() => {
                    onTakePhoto(marker)
                    onClose()
                  }}
                  className="h-14 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Icon as={Camera} className="size-5 text-foreground" />
                    <Text className="text-foreground font-semibold text-base">
                      Take Photo Here
                    </Text>
                  </View>
                  <Icon as={ExternalLink} className="size-5 text-muted-foreground" />
                </Button>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

/**
 * Inline marker info card for showing in a list
 */
interface MarkerInfoCardProps {
  marker: CalloutMarker
  onPress?: () => void
  className?: string
}

export function MarkerInfoCard({ marker, onPress, className }: MarkerInfoCardProps) {
  const discipline = DISCIPLINE_CONFIG[marker.discipline || ''] || {
    label: 'General',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
  }

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 p-4 bg-card rounded-xl border border-border/50 active:bg-muted/50',
        className
      )}
    >
      {/* Marker indicator */}
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: discipline.bgColor }}
      >
        <Text style={{ color: discipline.color }} className="text-sm font-bold">
          {marker.label.slice(0, 3)}
        </Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text className="text-foreground font-semibold">{marker.label}</Text>
        <Text className="text-muted-foreground text-xs">{discipline.label}</Text>
      </View>

      {/* Arrow */}
      {marker.targetSheetRef && (
        <View className="flex-row items-center gap-1">
          <Icon as={ArrowRight} className="size-4 text-muted-foreground" />
          <Text className="text-muted-foreground text-xs">{marker.targetSheetRef}</Text>
        </View>
      )}
    </Pressable>
  )
}
