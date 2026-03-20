import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { Image, View, type ViewProps } from "react-native"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

const avatarVariants = cva("bg-secondary items-center justify-center rounded-full", {
  variants: {
    size: {
      sm: "size-8",
      default: "size-10",
      lg: "size-14",
      xl: "size-24",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

const avatarTextVariants = cva("text-secondary-foreground font-semibold", {
  variants: {
    size: {
      sm: "text-xs",
      default: "text-sm",
      lg: "text-lg",
      xl: "text-3xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

interface AvatarProps extends ViewProps, VariantProps<typeof avatarVariants> {
  name?: string
  uri?: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function Avatar({ name, uri, size, className, style, ...props }: AvatarProps) {
  if (uri) {
    return (
      <View className={cn(avatarVariants({ size }), className)} style={style} {...props}>
        <Image source={{ uri }} className="size-full rounded-full" />
      </View>
    )
  }

  return (
    <View className={cn(avatarVariants({ size }), className)} style={style} {...props}>
      <Text className={avatarTextVariants({ size })}>{name ? getInitials(name) : "?"}</Text>
    </View>
  )
}

export { Avatar, avatarVariants }
export type { AvatarProps }
