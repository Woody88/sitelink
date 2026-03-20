import { useRouter } from "expo-router"
import { Camera, FileText, Sparkles } from "lucide-react-native"
import * as React from "react"
import { Platform, Pressable, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const FEATURES = [
  {
    icon: FileText,
    color: "#3b82f6",
    title: "Smart Plan Reading",
    description:
      "AI detects callouts, schedules, and notes automatically from your construction plans.",
  },
  {
    icon: Camera,
    color: "#8b5cf6",
    title: "Field Photo Capture",
    description: "Capture progress photos with voice notes and automatic daily report generation.",
  },
  {
    icon: Sparkles,
    color: "#f59e0b",
    title: "AI Daily Reports",
    description: "Get AI-generated daily summaries and RFIs from your field data.",
  },
] as const

export default function WelcomeScreen() {
  const router = useRouter()

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1 justify-between px-6 pb-10 pt-16" style={webMinHeight}>
      <View className="items-center">
        <View className="bg-primary mb-3 size-16 items-center justify-center rounded-2xl">
          <Text className="text-primary-foreground text-2xl font-black">S</Text>
        </View>
        <Text className="text-foreground text-2xl font-bold">SiteLink</Text>
        <Text className="text-muted-foreground mt-1 text-base">
          Construction intelligence, simplified
        </Text>
      </View>

      <View className="gap-5 py-8">
        {FEATURES.map((feature) => (
          <View key={feature.title} className="flex-row items-start gap-4">
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 48,
                height: 48,
                backgroundColor: `${feature.color}15`,
              }}
            >
              <Icon as={feature.icon} className="size-6" style={{ color: feature.color } as any} />
            </View>
            <View className="flex-1 pt-0.5">
              <Text className="text-foreground text-base font-semibold">{feature.title}</Text>
              <Text className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-3">
        <Button
          className="h-14 w-full rounded-xl"
          onPress={() => router.replace("/(onboarding)/trial" as any)}
        >
          <Text className="text-primary-foreground text-base font-semibold">Get Started</Text>
        </Button>
        <Pressable
          className="items-center py-2"
          onPress={() => router.replace("/(onboarding)/signup" as any)}
        >
          <Text className="text-muted-foreground text-sm">
            Already have an account? <Text className="text-primary font-semibold">Sign In</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
