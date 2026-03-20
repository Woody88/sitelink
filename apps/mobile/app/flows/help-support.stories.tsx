import type { Meta, StoryObj } from "@storybook/react"
import { Bug, ChevronRight, FileText, Mail, MessageCircle, Upload, Wifi } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const QUICK_TIPS = [
  {
    id: "1",
    icon: Upload,
    color: "#3b82f6",
    label: "Uploading plans",
    desc: "Tap + on your project, pick a PDF, and SiteLink processes it automatically.",
  },
  {
    id: "2",
    icon: Wifi,
    color: "#22c55e",
    label: "Working offline",
    desc: "Plans and photos sync automatically when you're back online.",
  },
  {
    id: "3",
    icon: FileText,
    color: "#a855f7",
    label: "Navigating sheets",
    desc: "Pinch to zoom, swipe between sheets, tap markers to jump.",
  },
]

const CONTACT_OPTIONS = [
  {
    id: "chat",
    icon: MessageCircle,
    label: "Live Chat",
    desc: "Typically replies in under 5 minutes",
    color: "#22c55e",
  },
  {
    id: "email",
    icon: Mail,
    label: "Email Support",
    desc: "Response within 24 hours",
    color: "#3b82f6",
  },
  {
    id: "bug",
    icon: Bug,
    label: "Report a Bug",
    desc: "Include screenshots and steps to reproduce",
    color: "#f59e0b",
  },
]

type FlowScreen = "home" | "contact"

function HelpSupportFlow({ initialScreen = "home" as FlowScreen }) {
  const [screen, setScreen] = React.useState<FlowScreen>(initialScreen)
  const [toastMsg, setToastMsg] = React.useState("")

  if (screen === "contact") {
    return (
      <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
        <StoryHeader title="Contact Support" onBack={() => setScreen("home")} />
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-4 pt-6 pb-2">
            <Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Get in touch
            </Text>
          </View>
          {CONTACT_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setToastMsg(`Opening ${option.label}...`)}
              className="active:bg-muted/30 flex-row items-center gap-3 px-4 py-4"
            >
              <Icon as={option.icon} style={{ color: option.color }} className="size-5" />
              <View className="flex-1">
                <Text className="text-foreground text-base font-semibold">{option.label}</Text>
                <Text className="text-muted-foreground text-sm">{option.desc}</Text>
              </View>
              <Icon as={ChevronRight} className="text-muted-foreground size-5" />
            </Pressable>
          ))}

          <View className="px-4 pt-8">
            <Text className="text-muted-foreground text-center text-xs leading-relaxed">
              Support hours: Mon{"\u2013"}Fri, 8 AM{"\u2013"}6 PM EST
            </Text>
          </View>
        </ScrollView>
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Help & Support" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-5 pb-2">
          <Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Quick start
          </Text>
        </View>

        {QUICK_TIPS.map((tip) => (
          <View key={tip.id} className="flex-row items-start gap-3 px-4 py-4">
            <Icon as={tip.icon} style={{ color: tip.color }} className="mt-0.5 size-5" />
            <View className="flex-1">
              <Text className="text-foreground text-base font-medium">{tip.label}</Text>
              <Text className="text-muted-foreground text-sm leading-relaxed">{tip.desc}</Text>
            </View>
          </View>
        ))}

        <View className="px-4 pt-8">
          <Button onPress={() => setScreen("contact")} className="h-12 rounded-xl">
            <Icon as={MessageCircle} className="text-primary-foreground mr-2 size-4" />
            <Text className="text-primary-foreground text-base font-semibold">Contact Support</Text>
          </Button>
        </View>
      </ScrollView>
      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof HelpSupportFlow> = {
  title: "Flows/Help & Support",
  component: HelpSupportFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof HelpSupportFlow>

export const HelpHome: Story = {
  name: "1. Help Home",
  args: { initialScreen: "home" },
}

export const ContactSupport: Story = {
  name: "2. Contact Support",
  args: { initialScreen: "contact" },
}

export const FullFlow: Story = {
  name: "Full Flow",
  args: { initialScreen: "home" },
}
