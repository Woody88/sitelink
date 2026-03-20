import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { View, type ViewProps } from "react-native"
import { TextClassContext } from "@/components/ui/text"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        destructive: "bg-destructive border-transparent",
        outline: "text-foreground",
        success: "bg-success/15 text-success border-transparent",
        warning: "bg-warning/15 text-warning border-transparent",
        info: "bg-info/15 text-info border-transparent",
        ai: "bg-ai/15 text-ai border-transparent",
      },
      size: {
        sm: "px-2 py-px text-[10px]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

const badgeTextVariants = cva("font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      success: "text-success",
      warning: "text-warning",
      info: "text-info",
      ai: "text-ai",
    },
    size: {
      sm: "text-[10px]",
      default: "text-xs",
      lg: "text-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant, size })}>
      <View className={cn(badgeVariants({ variant, size }), className)} {...props} />
    </TextClassContext.Provider>
  )
}

export { Badge, badgeVariants }
