import type { LucideIcon } from "lucide-react-native"
import { Pressable, type PressableProps } from "react-native"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

interface IconButtonProps extends Omit<PressableProps, "children"> {
  icon: LucideIcon
  label: string
  size?: "sm" | "default" | "lg"
  iconClassName?: string
}

const sizeMap = {
  sm: { button: 36, icon: "size-4" },
  default: { button: 44, icon: "size-5" },
  lg: { button: 48, icon: "size-6" },
} as const

function IconButton({
  icon,
  label,
  size = "default",
  iconClassName,
  className,
  ...props
}: IconButtonProps) {
  const s = sizeMap[size]
  return (
    <Pressable
      className={cn("items-center justify-center active:opacity-70", className)}
      style={{ width: s.button, height: s.button }}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
    >
      <Icon as={icon} className={cn("text-foreground", s.icon, iconClassName)} />
    </Pressable>
  )
}

export { IconButton }
export type { IconButtonProps }
