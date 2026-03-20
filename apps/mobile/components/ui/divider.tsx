import * as React from "react"
import { View, type ViewProps } from "react-native"
import { cn } from "@/lib/utils"

interface DividerProps extends ViewProps {
  inset?: number
}

function Divider({ inset, className, style, ...props }: DividerProps) {
  return (
    <View
      className={cn("bg-surface-2 h-px w-full", className)}
      style={[inset ? { marginLeft: inset } : undefined, style]}
      {...props}
    />
  )
}

export { Divider }
export type { DividerProps }
