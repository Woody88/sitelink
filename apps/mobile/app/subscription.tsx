import { Stack } from "expo-router"
import { Crown } from "lucide-react-native"
import * as React from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { MOCK_SUBSCRIPTION_PLANS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export default function SubscriptionScreen() {
  const [selectedPlan, setSelectedPlan] = React.useState("plan-2")

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Subscription</Text>
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
        <View className="bg-info/10 mt-4 flex-row items-center gap-3 rounded-2xl px-4 py-4">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "rgba(59, 130, 246, 0.15)",
            }}
          >
            <Icon as={Crown} className="size-5" style={{ color: "#3b82f6" } as any} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-base font-semibold">Pro Trial</Text>
            <Text className="text-muted-foreground text-sm">12 days left</Text>
          </View>
          <Badge variant="info" size="sm">
            <Text>ACTIVE</Text>
          </Badge>
        </View>

        <View className="mt-6 gap-4">
          {MOCK_SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id
            const isRecommended = plan.recommended
            const isCurrent = plan.id === "plan-2"

            return (
              <Pressable
                key={plan.id}
                onPress={() => setSelectedPlan(plan.id)}
                className={cn(
                  "overflow-hidden rounded-2xl border-2 p-5",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-surface-1",
                )}
              >
                {isRecommended && (
                  <View className="mb-3">
                    <Badge variant="default" size="sm" className="self-start">
                      <Text>RECOMMENDED</Text>
                    </Badge>
                  </View>
                )}
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-foreground text-lg font-bold">{plan.name}</Text>
                    <Text className="text-muted-foreground mt-1 text-sm">{plan.desc}</Text>
                  </View>
                  <Text className="text-foreground text-lg font-bold">{plan.price}</Text>
                </View>
                {isCurrent && (
                  <Text className="text-primary mt-2 text-xs font-semibold">Current Plan</Text>
                )}
                {!isCurrent && isSelected && (
                  <Button className="mt-4 h-11 w-full rounded-xl" onPress={() => {}}>
                    <Text className="text-primary-foreground font-semibold">Select Plan</Text>
                  </Button>
                )}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
