import type { LucideIcon } from "lucide-react-native"
import { ArrowLeft } from "lucide-react-native"
import * as React from "react"
import { Platform, ScrollView, View, type ViewProps } from "react-native"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface ScreenLayoutProps extends ViewProps {
  title: string
  subtitle?: string
  onBack?: () => void
  rightIcon?: LucideIcon
  onRight?: () => void
  scrollable?: boolean
  contentClassName?: string
}

function ScreenLayout({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRight,
  scrollable = true,
  contentClassName,
  children,
  className,
  style,
  ...props
}: ScreenLayoutProps) {
  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View
      className={cn("bg-background flex-1", className)}
      style={[webMinHeight, style]}
      {...props}
    >
      <View className="bg-background" style={{ paddingTop: 8 }}>
        <View className="min-h-[56px] flex-row items-center justify-between px-4">
          {onBack ? (
            <IconButton
              icon={ArrowLeft}
              label="Back"
              size="default"
              iconClassName="size-6"
              className="-ml-1"
              onPress={onBack}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
          <View className="flex-1 items-center justify-center px-2">
            <Text
              className="text-foreground text-center text-base leading-tight font-bold"
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
                {subtitle}
              </Text>
            )}
          </View>
          {rightIcon && onRight ? (
            <IconButton icon={rightIcon} label="Action" className="-mr-1" onPress={onRight} />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </View>
      {scrollable ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn("px-4 pb-12", contentClassName)}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1", contentClassName)}>{children}</View>
      )}
    </View>
  )
}

export { ScreenLayout }
export type { ScreenLayoutProps }
