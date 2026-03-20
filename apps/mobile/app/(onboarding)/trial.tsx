import { useRouter } from "expo-router"
import { Check, Crown } from "lucide-react-native"
import * as React from "react"
import { Platform, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const TRIAL_FEATURES = [
  "Unlimited projects",
  "AI-powered daily reports",
  "Team collaboration",
  "Offline mode",
  "Priority support",
] as const

export default function TrialScreen() {
  const router = useRouter()

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1 justify-between px-6 pb-10 pt-16" style={webMinHeight}>
      <View className="items-center">
        <View
          className="mb-6 items-center justify-center rounded-full"
          style={{
            width: 80,
            height: 80,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
          }}
        >
          <Icon as={Crown} className="size-10" style={{ color: "#3b82f6" } as any} />
        </View>
        <Text className="text-foreground text-center text-2xl font-bold">
          Start Your 14-Day{"\n"}Pro Trial
        </Text>
        <Text className="text-muted-foreground mt-2 text-center text-base leading-relaxed">
          Unlock every feature and see how SiteLink transforms your workflow.
        </Text>
      </View>

      <View className="bg-surface-1 gap-4 rounded-2xl p-6">
        {TRIAL_FEATURES.map((feature) => (
          <View key={feature} className="flex-row items-center gap-3">
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                backgroundColor: "rgba(34, 197, 94, 0.12)",
              }}
            >
              <Icon as={Check} className="size-4" style={{ color: "#22c55e" } as any} />
            </View>
            <Text className="text-foreground text-base font-medium">{feature}</Text>
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Button
          className="h-14 w-full rounded-xl"
          onPress={() => router.replace("/(onboarding)/signup" as any)}
        >
          <Text className="text-primary-foreground text-base font-semibold">Start Free Trial</Text>
        </Button>
        <Text className="text-muted-foreground text-center text-xs">No credit card required</Text>
      </View>
    </View>
  )
}
