import type { LucideIcon } from "lucide-react-native"
import { ChevronRight } from "lucide-react-native"
import * as React from "react"
import { Pressable, View, type ViewProps } from "react-native"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface ListRowProps extends ViewProps {
  icon?: LucideIcon
  iconColor?: string
  label: string
  sublabel?: string
  value?: string
  right?: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  destructive?: boolean
}

function ListRow({
  icon,
  iconColor,
  label,
  sublabel,
  value,
  right,
  onPress,
  disabled,
  destructive,
  className,
  ...props
}: ListRowProps) {
  const content = (
    <View
      className={cn("flex-row items-center justify-between px-4", className)}
      style={{ minHeight: 52 }}
      {...props}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {icon && (
          <Icon
            as={icon}
            className={cn(
              "size-5",
              destructive ? "text-destructive" : !iconColor && "text-muted-foreground",
            )}
            {...(iconColor ? { style: { color: iconColor } as any } : {})}
          />
        )}
        <View className="flex-1">
          <Text
            className={cn(
              "text-base font-medium",
              destructive ? "text-destructive" : "text-foreground",
              disabled && "opacity-40",
            )}
          >
            {label}
          </Text>
          {sublabel && (
            <Text className={cn("text-muted-foreground text-sm", disabled && "opacity-40")}>
              {sublabel}
            </Text>
          )}
        </View>
      </View>
      {value && <Text className="text-muted-foreground ml-2 text-sm">{value}</Text>}
      {right}
      {!right && onPress && (
        <Icon as={ChevronRight} className="text-muted-foreground ml-2 size-5" />
      )}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="active:bg-muted/30"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    )
  }
  return content
}

export { ListRow }
export type { ListRowProps }
