import * as React from "react"
import { View, type ViewProps } from "react-native"
import { Label } from "@/components/ui/label"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface FormFieldProps extends ViewProps {
  label: string
  nativeID: string
  error?: string
  hint?: string
}

function FormField({
  label,
  nativeID,
  error,
  hint,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <View className={cn("gap-2", className)} {...props}>
      <Label nativeID={nativeID}>{label}</Label>
      {children}
      {error && <Text className="text-destructive px-1 text-xs">{error}</Text>}
      {!error && hint && <Text className="text-muted-foreground px-1 text-xs">{hint}</Text>}
    </View>
  )
}

export { FormField }
export type { FormFieldProps }
