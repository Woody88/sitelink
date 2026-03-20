import type { Meta, StoryObj } from "@storybook/react"
import { Camera, FolderPlus, Lock, UserPlus } from "lucide-react-native"
import * as React from "react"
import { Pressable, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

function UpgradeModal({
  icon,
  heading,
  explanation,
  onViewPlans,
  onDismiss,
}: {
  icon: React.ComponentType<any>
  heading: string
  explanation: string
  onViewPlans: () => void
  onDismiss: () => void
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.78)",
        }}
      />
      <View className="flex-1 items-center justify-center px-8">
        <View
          className="w-full items-center rounded-3xl px-8 py-10"
          style={{ backgroundColor: "#1c1c1c", maxWidth: 340 }}
        >
          <Icon as={icon} className="mb-6 size-8" style={{ color: "#f97316" }} />
          <Text className="text-foreground mb-2 text-xl font-bold">{heading}</Text>
          <Text className="text-muted-foreground mb-8 text-center text-sm leading-relaxed">
            {explanation}
          </Text>
          <Button className="mb-3 h-12 w-full rounded-xl" onPress={onViewPlans}>
            <Text className="text-primary-foreground text-base font-semibold">View Plans</Text>
          </Button>
          <Pressable onPress={onDismiss} className="py-2">
            <Text className="text-muted-foreground text-sm">Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

function PhotoBlockedScreen() {
  const [dismissed, setDismissed] = React.useState(false)

  return (
    <View
      className="bg-background flex-1"
      style={{ minHeight: "100vh", position: "relative" } as any}
    >
      <View className="flex-row items-center justify-between px-4 py-3" style={{ paddingTop: 8 }}>
        <View style={{ width: 44 }} />
        <Text className="text-foreground text-base font-bold">Take Photo</Text>
        <View style={{ width: 44 }} />
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <Icon as={Camera} className="text-muted-foreground mb-4 size-8" />
        <Text className="text-muted-foreground text-center text-sm">Camera viewfinder area</Text>
      </View>

      {!dismissed && (
        <UpgradeModal
          icon={Lock}
          heading="Upgrade Required"
          explanation="Your subscription has expired. Upgrade to continue capturing photos and documenting your project."
          onViewPlans={() => {}}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </View>
  )
}

function ProjectLimitScreen() {
  const [dismissed, setDismissed] = React.useState(false)

  return (
    <View
      className="bg-background flex-1"
      style={{ minHeight: "100vh", position: "relative" } as any}
    >
      <View className="flex-row items-center justify-between px-4 py-3" style={{ paddingTop: 8 }}>
        <View style={{ width: 44 }} />
        <Text className="text-foreground text-base font-bold">Projects</Text>
        <View style={{ width: 44 }} />
      </View>
      <View className="px-4 pt-4">
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View
            className="items-center justify-center rounded-lg overflow-hidden"
            style={{ width: 48, height: 48, backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            <Text className="text-muted-foreground text-xs">S1.0</Text>
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-sm font-bold">Holabird Ave Warehouse</Text>
            <Text className="text-muted-foreground text-xs">12 sheets · 47 callouts</Text>
          </View>
        </View>
        <View className="mt-4 px-4 py-3">
          <Text className="text-sm font-medium" style={{ color: "#f97316" }}>
            Starter plan limit: 1 project
          </Text>
        </View>
      </View>

      {!dismissed && (
        <UpgradeModal
          icon={FolderPlus}
          heading="Project Limit Reached"
          explanation="Your Starter plan supports 1 project. Upgrade to Pro for up to 5 projects, or Business for unlimited."
          onViewPlans={() => {}}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </View>
  )
}

function MemberLimitScreen() {
  const [dismissed, setDismissed] = React.useState(false)

  const members = [
    { initials: "JS", name: "John Smith", role: "Owner" },
    { initials: "MC", name: "Mike Chen", role: "Admin" },
    { initials: "SJ", name: "Sarah Johnson", role: "Member" },
  ]

  return (
    <View
      className="bg-background flex-1"
      style={{ minHeight: "100vh", position: "relative" } as any}
    >
      <View className="flex-row items-center justify-between px-4 py-3" style={{ paddingTop: 8 }}>
        <View style={{ width: 44 }} />
        <Text className="text-foreground text-base font-bold">Project Members</Text>
        <View style={{ width: 44 }} />
      </View>
      <View className="px-4 pt-4">
        {members.map((m) => (
          <View
            key={m.initials}
            className="flex-row items-center gap-3 px-4 py-3 border-b border-border/30"
          >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 40, height: 40, backgroundColor: "rgba(59,130,246,0.12)" }}
            >
              <Text className="text-sm font-semibold" style={{ color: "#3b82f6" }}>
                {m.initials}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-sm font-medium">{m.name}</Text>
              <Text className="text-muted-foreground text-xs">{m.role}</Text>
            </View>
          </View>
        ))}
        <View className="mt-2 px-4 py-3">
          <Text className="text-sm font-medium" style={{ color: "#f97316" }}>
            Starter plan limit: 3 members
          </Text>
        </View>
      </View>

      {!dismissed && (
        <UpgradeModal
          icon={UserPlus}
          heading="Member Limit Reached"
          explanation="Your Starter plan supports up to 3 team members. Upgrade to Pro for 15 members, or Business for unlimited."
          onViewPlans={() => {}}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </View>
  )
}

type ScreenType = "photo-blocked" | "project-limit" | "member-limit"

function SubscriptionExpiredFlow({
  screen = "photo-blocked" as ScreenType,
}: {
  screen?: ScreenType
}) {
  switch (screen) {
    case "photo-blocked":
      return <PhotoBlockedScreen />
    case "project-limit":
      return <ProjectLimitScreen />
    case "member-limit":
      return <MemberLimitScreen />
  }
}

const meta: Meta<typeof SubscriptionExpiredFlow> = {
  title: "Flows/12a. Subscription Expired",
  component: SubscriptionExpiredFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof SubscriptionExpiredFlow>

export const PhotoBlocked: Story = { name: "1. Photo Blocked", args: { screen: "photo-blocked" } }
export const ProjectLimitReached: Story = {
  name: "2. Project Limit",
  args: { screen: "project-limit" },
}
export const MemberLimitReached: Story = {
  name: "3. Member Limit",
  args: { screen: "member-limit" },
}
