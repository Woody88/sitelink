import { Stack } from "expo-router"
import { ChevronDown, ChevronRight, Mail } from "lucide-react-native"
import * as React from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { MOCK_HELP_TOPICS } from "@/lib/mock-data"

export default function HelpScreen() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Help & Support</Text>
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
        <Text className="text-muted-foreground mb-4 mt-6 px-1 text-xs font-bold tracking-wider uppercase">
          Topics
        </Text>

        <View className="bg-surface-1 overflow-hidden rounded-xl">
          {MOCK_HELP_TOPICS.map((topic, index) => {
            const isExpanded = expandedId === topic.id

            return (
              <React.Fragment key={topic.id}>
                {index > 0 && <Divider inset={16} />}
                <Pressable
                  onPress={() => toggleExpanded(topic.id)}
                  className="active:bg-muted/30 px-4 py-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground flex-1 text-base font-medium">
                      {topic.title}
                    </Text>
                    <Icon
                      as={isExpanded ? ChevronDown : ChevronRight}
                      className="text-muted-foreground size-5"
                    />
                  </View>
                  {isExpanded && (
                    <View className="mt-3">
                      <Text className="text-muted-foreground text-sm leading-relaxed">
                        {topic.description}
                      </Text>
                      <Pressable className="mt-3">
                        <Text className="text-primary text-sm font-semibold">Learn More</Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              </React.Fragment>
            )
          })}
        </View>

        <View className="mt-10 items-center gap-4">
          <Text className="text-muted-foreground text-center text-sm">
            Can&apos;t find what you&apos;re looking for?
          </Text>
          <Button
            variant="outline"
            className="h-12 w-full flex-row items-center gap-2 rounded-xl"
            onPress={() => {}}
          >
            <Icon as={Mail} className="text-foreground size-5" />
            <Text className="text-foreground text-base font-medium">Contact Support</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
