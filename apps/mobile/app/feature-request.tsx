import { Stack } from "expo-router"
import * as React from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const CATEGORIES = ["Plan Reading", "Photo Capture", "Reports", "Collaboration", "Other"] as const

export default function FeatureRequestScreen() {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [description, setDescription] = React.useState("")
  const [showToast, setShowToast] = React.useState(false)

  const canSubmit = selectedCategory && description.trim().length > 0

  const handleSubmit = () => {
    setShowToast(true)
    setSelectedCategory(null)
    setDescription("")
  }

  const handleDismissToast = React.useCallback(() => {
    setShowToast(false)
  }, [])

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Feature Request</Text>
          ),
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-6 gap-6">
          <View className="gap-2">
            <Text className="text-foreground text-sm font-medium">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-full border px-4 py-2",
                    selectedCategory === cat
                      ? "bg-primary border-primary"
                      : "border-border bg-surface-1",
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      selectedCategory === cat ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-foreground text-sm font-medium">Description</Text>
            <Input
              size="lg"
              placeholder="Tell us what you'd like to see..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              className="min-h-[140px] py-3"
            />
          </View>

          <Button className="h-14 w-full rounded-xl" onPress={handleSubmit} disabled={!canSubmit}>
            <Text className="text-primary-foreground text-base font-semibold">Submit Request</Text>
          </Button>
        </View>
      </ScrollView>

      <Toast
        message="Feature request submitted. Thank you!"
        visible={showToast}
        onDismiss={handleDismissToast}
      />
    </View>
  )
}
