import type { LucideIcon } from "lucide-react-native"
import * as React from "react"
import { Platform, View, type ViewProps } from "react-native"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface StatusScreenProps extends ViewProps {
  icon: LucideIcon
  iconColor?: string
  title: string
  description?: string
  action?: {
    label: string
    onPress: () => void
  }
  secondaryAction?: {
    label: string
    onPress: () => void
  }
}

function StatusScreen({
  icon,
  iconColor,
  title,
  description,
  action,
  secondaryAction,
  className,
  style,
  ...props
}: StatusScreenProps) {
  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View
      className={cn("bg-background flex-1 items-center justify-center px-6", className)}
      style={[webMinHeight, style]}
      {...props}
    >
      <View className="items-center gap-4">
        <View
          className="mb-2 items-center justify-center rounded-full"
          style={{
            width: 80,
            height: 80,
            backgroundColor: iconColor ? `${iconColor}20` : "rgba(255,255,255,0.08)",
          }}
        >
          <Icon
            as={icon}
            className="size-10"
            {...(iconColor ? { style: { color: iconColor } as any } : {})}
          />
        </View>
        <Text className="text-foreground text-center text-2xl font-bold">{title}</Text>
        {description && (
          <Text className="text-muted-foreground max-w-[280px] text-center text-base leading-relaxed">
            {description}
          </Text>
        )}
      </View>
      {(action || secondaryAction) && (
        <View className="mt-8 w-full gap-3">
          {action && (
            <Button className="h-12 w-full rounded-xl" onPress={action.onPress}>
              <Text className="text-primary-foreground text-base font-semibold">
                {action.label}
              </Text>
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              className="h-12 w-full rounded-xl"
              onPress={secondaryAction.onPress}
            >
              <Text className="text-muted-foreground text-base font-medium">
                {secondaryAction.label}
              </Text>
            </Button>
          )}
        </View>
      )}
    </View>
  )
}

export { StatusScreen }
export type { StatusScreenProps }
