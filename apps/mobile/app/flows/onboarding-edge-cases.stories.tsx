import type { Meta, StoryObj } from "@storybook/react"
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Loader,
  Play,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react-native"
import * as React from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

function OAuthLoadingScreen() {
  return (
    <View
      className="bg-background flex-1 items-center justify-center"
      style={{ minHeight: "100vh" } as any}
    >
      <View className="items-center gap-6 px-8">
        <ActivityIndicator size="large" color="#3b82f6" />
        <View className="items-center gap-2">
          <Text className="text-foreground text-lg font-bold">Signing in...</Text>
          <Text className="text-muted-foreground text-center text-sm leading-relaxed">
            Completing authentication with your provider
          </Text>
        </View>
      </View>
    </View>
  )
}

function OAuthErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      className="bg-background flex-1 items-center justify-center"
      style={{ minHeight: "100vh" } as any}
    >
      <View className="items-center gap-6 px-8">
        <Icon as={AlertCircle} className="size-8" style={{ color: "#ef4444" }} />
        <View className="items-center gap-2">
          <Text className="text-foreground text-xl font-bold">Sign-in Failed</Text>
          <Text className="text-muted-foreground text-center text-sm leading-relaxed">
            We couldn{"\u2019"}t complete the sign-in.{"\n"}Please check your connection and try
            again.
          </Text>
        </View>
        <Button className="mt-2 h-12 w-full rounded-xl" onPress={onRetry}>
          <Text className="text-primary-foreground text-base font-semibold">Try Again</Text>
        </Button>
        <Pressable onPress={() => {}}>
          <Text className="text-muted-foreground text-sm">Use email instead</Text>
        </Pressable>
      </View>
    </View>
  )
}

function WelcomeWithDemoScreen({
  onGetStarted,
  onDemo,
}: {
  onGetStarted: () => void
  onDemo: () => void
}) {
  return (
    <View className="bg-background flex-1 justify-between px-6 py-12">
      <View className="flex-1 items-center justify-center gap-8">
        <View className="items-center gap-4">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-foreground text-4xl font-black tracking-tight">Site</Text>
            <Text className="text-primary text-4xl font-black tracking-tight">Link</Text>
          </View>
          <Text className="text-muted-foreground text-sm tracking-widest uppercase">
            Construction Plan Intelligence
          </Text>
        </View>

        <View className="w-full gap-4 pt-4">
          {[
            {
              icon: Zap,
              title: "Auto-Linked Callouts",
              desc: "Tap any callout marker to jump directly to referenced details",
              color: "#3b82f6",
            },
            {
              icon: Camera,
              title: "Photo Documentation",
              desc: "Photos auto-linked to plan locations with voice notes",
              color: "#22c55e",
            },
            {
              icon: Sparkles,
              title: "AI-Extracted Schedules",
              desc: "Schedules, notes, and legends extracted automatically",
              color: "#a855f7",
            },
            {
              icon: Shield,
              title: "Works Offline",
              desc: "Full plan access on site, even without cell service",
              color: "#f59e0b",
            },
          ].map((item) => (
            <View key={item.title} className="flex-row items-center gap-4 px-4 py-3">
              <Icon as={item.icon} style={{ color: item.color }} className="size-5" />
              <View className="flex-1">
                <Text className="text-foreground text-sm font-bold">{item.title}</Text>
                <Text className="text-muted-foreground text-xs leading-relaxed">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-4 pt-8">
        <Button onPress={onGetStarted}>
          <View className="flex-row items-center gap-2">
            <Text className="text-primary-foreground font-bold">Get Started</Text>
            <Icon as={ArrowRight} className="text-primary-foreground size-4" />
          </View>
        </Button>

        <View className="my-2 flex-row items-center gap-4">
          <View className="bg-border h-px flex-1" />
          <Text className="text-muted-foreground text-xs uppercase tracking-wider">or</Text>
          <View className="bg-border h-px flex-1" />
        </View>

        <Pressable
          onPress={onDemo}
          className="flex-row items-center justify-center gap-2 rounded-xl py-3"
          style={{
            backgroundColor: "rgba(34,197,94,0.08)",
            borderWidth: 1,
            borderColor: "rgba(34,197,94,0.2)",
          }}
        >
          <Icon as={Play} className="size-4" style={{ color: "#22c55e" }} />
          <Text className="text-sm font-semibold" style={{ color: "#22c55e" }}>
            Explore the Demo Project
          </Text>
        </Pressable>

        <Text className="text-muted-foreground text-center text-xs">
          No account needed for the demo
        </Text>
      </View>
    </View>
  )
}

type ScreenType = "oauth-loading" | "oauth-error" | "welcome-demo"

function OnboardingEdgeCases({ screen = "oauth-loading" as ScreenType }: { screen?: ScreenType }) {
  const [retrying, setRetrying] = React.useState(false)

  switch (screen) {
    case "oauth-loading":
      return <OAuthLoadingScreen />
    case "oauth-error":
      return (
        <OAuthErrorScreen
          onRetry={() => {
            setRetrying(true)
            setTimeout(() => setRetrying(false), 2000)
          }}
        />
      )
    case "welcome-demo":
      return <WelcomeWithDemoScreen onGetStarted={() => {}} onDemo={() => {}} />
  }
}

const meta: Meta<typeof OnboardingEdgeCases> = {
  title: "Flows/1a. Onboarding Edge Cases",
  component: OnboardingEdgeCases,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof OnboardingEdgeCases>

export const OAuthLoading: Story = { name: "1. OAuth Loading", args: { screen: "oauth-loading" } }
export const OAuthError: Story = { name: "2. OAuth Error", args: { screen: "oauth-error" } }
export const WelcomeWithDemo: Story = {
  name: "3. Welcome + Demo",
  args: { screen: "welcome-demo" },
}
