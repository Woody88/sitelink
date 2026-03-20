import { X } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View, type ViewProps } from "react-native"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface BottomSheetProps extends ViewProps {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string
}

function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  className,
  ...props
}: BottomSheetProps) {
  if (!visible) return null

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        className={cn("bg-card absolute right-0 bottom-0 left-0 rounded-t-3xl", className)}
        {...props}
      >
        <View className="items-center py-3">
          <View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
        </View>
        {title && (
          <View className="flex-row items-center justify-between px-6 pb-3">
            <View className="flex-1">
              <Text className="text-foreground text-lg font-bold">{title}</Text>
              {subtitle && <Text className="text-muted-foreground mt-0.5 text-sm">{subtitle}</Text>}
            </View>
            <IconButton
              icon={X}
              label="Close"
              size="sm"
              className="bg-muted/20 active:bg-muted/40 rounded-full"
              onPress={onClose}
            />
          </View>
        )}
        <ScrollView bounces={false}>{children}</ScrollView>
      </View>
    </View>
  )
}

export { BottomSheet }
export type { BottomSheetProps }
