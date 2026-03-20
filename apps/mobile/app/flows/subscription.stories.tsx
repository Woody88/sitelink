import type { Meta, StoryObj } from "@storybook/react"
import { AlertTriangle, Check, ChevronDown, ChevronUp, Crown } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const PLANS = [
  { name: "Starter", price: 29, desc: "1 project, 3 members" },
  { name: "Pro", price: 79, desc: "5 projects, 15 members, AI features", recommended: true },
  { name: "Business", price: 149, desc: "Unlimited everything, API access" },
]

type FlowPhase = "trial-banner" | "plans" | "checkout" | "success" | "expired"

function TrialBanner({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View
      className="bg-background flex-1 items-center justify-center"
      style={{ minHeight: "100vh" } as any}
    >
      <View className="items-center gap-4 px-8">
        <View
          className="items-center rounded-2xl px-6 py-5"
          style={{
            backgroundColor: "rgba(59,130,246,0.08)",
            borderWidth: 1,
            borderColor: "rgba(59,130,246,0.2)",
          }}
        >
          <View className="flex-row items-center gap-2">
            <Icon as={Crown} className="size-4" style={{ color: "#3b82f6" }} />
            <Text className="text-sm font-bold" style={{ color: "#3b82f6" }}>
              Pro Trial
            </Text>
          </View>
          <Text className="text-foreground mt-1 text-lg font-bold">3 days remaining</Text>
          <Text className="text-muted-foreground mt-0.5 text-xs">
            Full Pro features, no credit card on file
          </Text>
        </View>
        <Button className="h-12 w-full rounded-xl" onPress={onUpgrade}>
          <Text className="text-primary-foreground text-base font-semibold">View Plans</Text>
        </Button>
      </View>
    </View>
  )
}

function PlansView({ onSelect }: { onSelect: (tier: string) => void }) {
  const [showAll, setShowAll] = React.useState(false)
  const pro = PLANS.find((p) => p.recommended)!
  const others = PLANS.filter((p) => !p.recommended)

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Subscription" />
      <ScrollView contentContainerClassName="px-4 pb-8">
        <View
          className="mb-6 items-center rounded-2xl px-5 py-4"
          style={{
            backgroundColor: "rgba(59,130,246,0.08)",
            borderWidth: 1,
            borderColor: "rgba(59,130,246,0.2)",
          }}
        >
          <View className="flex-row items-center gap-2">
            <Icon as={Crown} className="size-4" style={{ color: "#3b82f6" }} />
            <Text className="text-sm font-bold" style={{ color: "#3b82f6" }}>
              Pro Trial
            </Text>
          </View>
          <Text className="text-foreground mt-1 text-lg font-bold">3 days remaining</Text>
          <Text className="text-muted-foreground mt-0.5 text-xs">
            Full Pro features, no credit card on file
          </Text>
        </View>

        <Pressable
          onPress={() => onSelect(pro.name)}
          className="overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "rgba(59,130,246,0.06)",
            borderWidth: 2,
            borderColor: "#3b82f6",
          }}
        >
          <View className="items-center py-1.5" style={{ backgroundColor: "#3b82f6" }}>
            <Text className="text-xs font-bold text-white">RECOMMENDED</Text>
          </View>
          <View className="items-center px-5 py-6">
            <Text className="text-xl font-bold" style={{ color: "#3b82f6" }}>
              {pro.name}
            </Text>
            <View className="mt-2 flex-row items-baseline">
              <Text className="text-foreground text-4xl font-black">${pro.price}</Text>
              <Text className="text-muted-foreground text-base">/mo</Text>
            </View>
            <Text className="text-muted-foreground mt-2 text-center text-sm">{pro.desc}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setShowAll(!showAll)}
          className="mt-4 flex-row items-center justify-center gap-1 py-2"
        >
          <Text className="text-muted-foreground text-sm">
            {showAll ? "Hide other plans" : "See all plans"}
          </Text>
          <Icon as={showAll ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
        </Pressable>

        {showAll && (
          <View className="gap-3">
            {others.map((plan) => (
              <Pressable
                key={plan.name}
                onPress={() => onSelect(plan.name)}
                className="flex-row items-center justify-between rounded-xl px-4 py-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <View className="flex-1">
                  <Text className="text-foreground text-base font-semibold">{plan.name}</Text>
                  <Text className="text-muted-foreground text-xs">{plan.desc}</Text>
                </View>
                <View className="items-end">
                  <View className="flex-row items-baseline">
                    <Text className="text-foreground text-xl font-bold">${plan.price}</Text>
                    <Text className="text-muted-foreground text-xs">/mo</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
          Cancel anytime. Projects become read-only after 30 days without an active subscription.
        </Text>
      </ScrollView>
    </View>
  )
}

function SuccessView() {
  return (
    <View
      className="bg-background flex-1 items-center justify-center"
      style={{ minHeight: "100vh" } as any}
    >
      <View className="items-center gap-4 px-8">
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 80, height: 80, backgroundColor: "rgba(34,197,94,0.12)" }}
        >
          <Icon as={Check} className="size-10" style={{ color: "#22c55e" }} />
        </View>
        <Text className="text-foreground text-xl font-bold">Subscription Active</Text>
        <Text className="text-muted-foreground text-center text-sm leading-relaxed">
          Welcome to Pro! All features are now unlocked.
        </Text>
      </View>
    </View>
  )
}

function ExpiredView({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View
      className="bg-background flex-1 items-center justify-center"
      style={{ minHeight: "100vh" } as any}
    >
      <View className="items-center gap-4 px-8">
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 80, height: 80, backgroundColor: "rgba(239,68,68,0.12)" }}
        >
          <Icon as={AlertTriangle} className="size-10" style={{ color: "#ef4444" }} />
        </View>
        <Text className="text-foreground text-xl font-bold">Trial Expired</Text>
        <Text className="text-muted-foreground text-center text-sm leading-relaxed">
          Your Pro trial has ended. Subscribe to keep using all features.
        </Text>
        <Button className="mt-2 h-12 w-full rounded-xl" onPress={onUpgrade}>
          <Text className="text-primary-foreground text-base font-semibold">View Plans</Text>
        </Button>
      </View>
    </View>
  )
}

function SubscriptionFlow({
  initialPhase = "trial-banner" as FlowPhase,
}: {
  initialPhase?: FlowPhase
}) {
  const [phase, setPhase] = React.useState<FlowPhase>(initialPhase)
  const [toastMsg, setToastMsg] = React.useState("")

  if (phase === "trial-banner") return <TrialBanner onUpgrade={() => setPhase("plans")} />
  if (phase === "plans")
    return (
      <PlansView
        onSelect={(tier) => {
          setToastMsg(`Subscribing to ${tier}...`)
          setTimeout(() => setPhase("success"), 1500)
        }}
      />
    )
  if (phase === "success") return <SuccessView />
  if (phase === "expired") return <ExpiredView onUpgrade={() => setPhase("plans")} />

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof SubscriptionFlow> = {
  title: "Flows/12. Subscription",
  component: SubscriptionFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof SubscriptionFlow>

export const TrialBannerStory: Story = {
  name: "1. Trial Banner",
  args: { initialPhase: "trial-banner" },
}
export const Plans: Story = { name: "2. Plans", args: { initialPhase: "plans" } }
export const Success: Story = { name: "3. Success", args: { initialPhase: "success" } }
export const Expired: Story = { name: "4. Expired", args: { initialPhase: "expired" } }
export const FullFlow: Story = { name: "Full Flow", args: { initialPhase: "trial-banner" } }
