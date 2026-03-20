import * as React from "react"
import { View } from "react-native"
import { Text } from "@/components/ui/text"

export function Toast({
  message,
  visible,
  onDismiss,
}: {
  message: string
  visible: boolean
  onDismiss: () => void
}) {
  React.useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, 2000)
      return () => clearTimeout(timer)
    }
  }, [visible, onDismiss])

  if (!visible) return null

  return (
    <View
      style={{
        position: "absolute",
        bottom: 80,
        left: 16,
        right: 16,
        zIndex: 200,
      }}
    >
      <View className="bg-foreground items-center rounded-xl px-5 py-3">
        <Text className="text-background text-center text-sm font-medium">{message}</Text>
      </View>
    </View>
  )
}
