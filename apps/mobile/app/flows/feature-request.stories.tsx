import type { Meta, StoryObj } from "@storybook/react"
import { Send } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, TextInput, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const CATEGORIES = ["Plans", "Photos", "Schedules", "Offline", "Team", "Other"]

function FeatureRequestFlow() {
  const [description, setDescription] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [toastMsg, setToastMsg] = React.useState("")

  const handleSubmit = () => {
    if (!description.trim()) return
    setToastMsg("Request submitted — thank you!")
    setDescription("")
    setSelectedCategory(null)
  }

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Feature Request" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-6">
          <View className="mb-6">
            <Text className="text-foreground text-lg font-bold">Share your idea</Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              Help us build what matters to you
            </Text>
          </View>

          <View className="mb-2">
            <Text className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
              Category
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className="rounded-full px-4 py-2"
                  style={{
                    backgroundColor:
                      selectedCategory === cat ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: selectedCategory === cat ? "rgba(168,85,247,0.4)" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: selectedCategory === cat ? "#a855f7" : "rgba(255,255,255,0.6)",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-5">
            <Text className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
              Description
            </Text>
            <View
              className="rounded-xl"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                minHeight: 140,
                padding: 14,
              }}
            >
              <TextInput
                placeholder="Describe the feature you'd like to see..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                style={{ color: "#fff", fontSize: 15, minHeight: 110 }}
              />
            </View>
          </View>

          <View className="mt-6">
            <Button
              onPress={handleSubmit}
              disabled={!description.trim()}
              className="h-12 rounded-xl"
            >
              <Icon as={Send} className="text-primary-foreground mr-2 size-4" />
              <Text className="text-primary-foreground text-base font-semibold">
                Submit Request
              </Text>
            </Button>
          </View>
        </View>
      </ScrollView>
      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof FeatureRequestFlow> = {
  title: "Flows/Feature Requests",
  component: FeatureRequestFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof FeatureRequestFlow>

export const SubmitRequest: Story = {
  name: "1. Submit Request",
}

export const FullFlow: Story = {
  name: "Full Flow",
}
