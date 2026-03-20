import type { Meta, StoryObj } from "@storybook/react"
import {
  Calendar,
  Check,
  ChevronDown,
  ClipboardCopy,
  Copy,
  Eye,
  FileText,
  ImageIcon,
  Link,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  Share2,
  Shield,
  Users,
  X,
} from "lucide-react-native"
import * as React from "react"
import { Image, Pressable, ScrollView, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const SHARE_LINK = "sitelink.app/s/dT2-xK9m"

const PROJECT = {
  name: "Downtown Tower - Phase 2",
  address: "1200 Market St, San Francisco, CA",
  sheets: 18,
  photos: 47,
  members: 5,
  lastUpdated: "2 hours ago",
}

const SHARE_OPTIONS = [
  { id: "copy", label: "Copy Link", icon: Copy, color: "#3b82f6" },
  { id: "text", label: "Text Message", icon: Phone, color: "#22c55e" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25d366" },
  { id: "email", label: "Email", icon: Mail, color: "#f59e0b" },
]

const EXPIRY_OPTIONS = ["7 days", "30 days", "Never"]

type FlowPhase = "project-detail" | "share-options" | "link-copied" | "recipient-view"

function ProjectDetailView({ onShare }: { onShare: () => void }) {
  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Project" />
      <ScrollView contentContainerClassName="px-4 pb-8">
        <View
          className="mt-2 overflow-hidden rounded-2xl"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <View className="px-5 pt-5 pb-4">
            <Text className="text-foreground text-xl font-black">{PROJECT.name}</Text>
            <Text className="text-muted-foreground mt-1 text-sm">{PROJECT.address}</Text>
          </View>

          <View className="flex-row px-5 pb-5">
            <View
              className="flex-1 items-center rounded-xl py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon as={FileText} className="size-4" style={{ color: "#3b82f6" }} />
                <Text className="text-foreground text-lg font-bold">{PROJECT.sheets}</Text>
              </View>
              <Text className="text-muted-foreground mt-0.5 text-xs">Sheets</Text>
            </View>
            <View style={{ width: 8 }} />
            <View
              className="flex-1 items-center rounded-xl py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon as={ImageIcon} className="size-4" style={{ color: "#a855f7" }} />
                <Text className="text-foreground text-lg font-bold">{PROJECT.photos}</Text>
              </View>
              <Text className="text-muted-foreground mt-0.5 text-xs">Photos</Text>
            </View>
            <View style={{ width: 8 }} />
            <View
              className="flex-1 items-center rounded-xl py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon as={Users} className="size-4" style={{ color: "#22c55e" }} />
                <Text className="text-foreground text-lg font-bold">{PROJECT.members}</Text>
              </View>
              <Text className="text-muted-foreground mt-0.5 text-xs">Members</Text>
            </View>
          </View>
        </View>

        <View
          className="mt-4 rounded-2xl px-5 py-4"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <Text className="text-muted-foreground mb-3 text-xs font-bold uppercase tracking-wider">
            Recent Activity
          </Text>
          {[
            { action: "Sarah Chen uploaded 3 photos", time: "2h ago", color: "#a855f7" },
            { action: "Mike Davis added sheet S4.1", time: "5h ago", color: "#3b82f6" },
            { action: "Plan processing completed", time: "1d ago", color: "#22c55e" },
          ].map((item) => (
            <View key={item.action} className="flex-row items-center gap-3 py-2.5">
              <View className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              <Text className="text-foreground flex-1 text-sm">{item.action}</Text>
              <Text className="text-muted-foreground text-xs">{item.time}</Text>
            </View>
          ))}
        </View>

        <View className="mt-6">
          <Button className="h-14 w-full rounded-2xl" onPress={onShare}>
            <View className="flex-row items-center gap-2.5">
              <Icon as={Share2} className="text-primary-foreground size-5" />
              <Text className="text-primary-foreground text-base font-bold">Share Project</Text>
            </View>
          </Button>
          <Text className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
            Share a view-only link with subs and stakeholders.{"\n"}No account required to view.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function ShareOptionsSheet({
  onClose,
  onCopy,
  onSend,
}: {
  onClose: () => void
  onCopy: () => void
  onSend: (method: string) => void
}) {
  const [requireSignIn, setRequireSignIn] = React.useState(false)
  const [expiryIndex, setExpiryIndex] = React.useState(0)
  const [showExpiryDropdown, setShowExpiryDropdown] = React.useState(false)

  return (
    <View style={{ minHeight: "100vh", position: "relative" } as any}>
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#1c1c1c",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        <View className="items-center py-3">
          <View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
        </View>

        <View className="flex-row items-center justify-between px-6 pb-2">
          <View>
            <Text className="text-foreground text-lg font-bold">Share Project</Text>
            <Text className="text-muted-foreground text-sm">Anyone with the link can view</Text>
          </View>
          <Pressable
            onPress={onClose}
            className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
          >
            <Icon as={X} className="text-foreground size-5" />
          </Pressable>
        </View>

        <View className="px-6 pt-4">
          <View
            className="flex-row items-center rounded-xl px-4 py-3"
            style={{
              backgroundColor: "rgba(59,130,246,0.08)",
              borderWidth: 1,
              borderColor: "rgba(59,130,246,0.2)",
            }}
          >
            <Icon as={Link} className="size-4 mr-3" style={{ color: "#3b82f6" }} />
            <Text
              className="flex-1 text-sm font-medium"
              style={{ color: "#93c5fd" }}
              numberOfLines={1}
            >
              {SHARE_LINK}
            </Text>
            <Pressable
              onPress={onCopy}
              className="ml-2 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "rgba(59,130,246,0.15)" }}
            >
              <Text style={{ color: "#3b82f6" }} className="text-xs font-bold">
                Copy
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="px-6 pt-5">
          <Text className="text-muted-foreground mb-3 text-xs font-bold uppercase tracking-wider">
            Share via
          </Text>
          <View
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            {SHARE_OPTIONS.map((option, idx) => (
              <Pressable
                key={option.id}
                onPress={() => (option.id === "copy" ? onCopy() : onSend(option.label))}
                className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
                style={
                  idx > 0 ? { borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" } : undefined
                }
              >
                <Icon as={option.icon} className="size-5" style={{ color: option.color }} />
                <Text className="text-foreground flex-1 text-sm font-medium">{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="px-6 pt-5">
          <Text className="text-muted-foreground mb-3 text-xs font-bold uppercase tracking-wider">
            Link Settings
          </Text>

          <View
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <Pressable
              onPress={() => setRequireSignIn(!requireSignIn)}
              className="flex-row items-center justify-between px-4 py-3.5"
            >
              <View className="flex-row items-center gap-3">
                <Icon
                  as={requireSignIn ? Lock : Shield}
                  className="size-4"
                  style={{ color: requireSignIn ? "#f59e0b" : "#6b7280" }}
                />
                <View>
                  <Text className="text-foreground text-sm font-medium">Require sign-in</Text>
                  <Text className="text-muted-foreground text-xs">
                    Recipients must create an account
                  </Text>
                </View>
              </View>
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 26,
                  backgroundColor: requireSignIn ? "#3b82f6" : "rgba(255,255,255,0.12)",
                }}
              >
                <View
                  className="rounded-full bg-white"
                  style={{
                    width: 20,
                    height: 20,
                    transform: [{ translateX: requireSignIn ? 9 : -9 }],
                  }}
                />
              </View>
            </Pressable>

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />

            <Pressable
              onPress={() => setShowExpiryDropdown(!showExpiryDropdown)}
              className="flex-row items-center justify-between px-4 py-3.5"
            >
              <View className="flex-row items-center gap-3">
                <Icon as={Calendar} className="size-4" style={{ color: "#6b7280" }} />
                <View>
                  <Text className="text-foreground text-sm font-medium">Link expiry</Text>
                  <Text className="text-muted-foreground text-xs">When the link stops working</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-sm font-semibold" style={{ color: "#3b82f6" }}>
                  {EXPIRY_OPTIONS[expiryIndex]}
                </Text>
                <Icon as={ChevronDown} className="size-4" style={{ color: "#3b82f6" }} />
              </View>
            </Pressable>

            {showExpiryDropdown && (
              <View className="px-4 pb-3">
                {EXPIRY_OPTIONS.map((option, idx) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setExpiryIndex(idx)
                      setShowExpiryDropdown(false)
                    }}
                    className="flex-row items-center justify-between rounded-lg px-3 py-2.5"
                    style={{
                      backgroundColor: idx === expiryIndex ? "rgba(59,130,246,0.1)" : "transparent",
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{ color: idx === expiryIndex ? "#3b82f6" : "#9ca3af" }}
                    >
                      {option}
                    </Text>
                    {idx === expiryIndex && (
                      <Icon as={Check} className="size-4" style={{ color: "#3b82f6" }} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </View>
    </View>
  )
}

function LinkCopiedView({ onDone }: { onDone: () => void }) {
  return (
    <View
      className="bg-background flex-1 items-center justify-center"
      style={{ minHeight: "100vh" } as any}
    >
      <View className="items-center gap-5 px-8">
        <Icon as={Check} className="size-10" style={{ color: "#22c55e" }} />
        <View className="items-center gap-1.5">
          <Text className="text-foreground text-xl font-bold">Link Copied</Text>
          <Text className="text-muted-foreground text-center text-sm leading-relaxed">
            Share this link with anyone to give{"\n"}them view-only access to this project.
          </Text>
        </View>

        <View
          className="w-full flex-row items-center rounded-xl px-4 py-3.5 mt-2"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Icon as={Link} className="size-4 mr-3" style={{ color: "#3b82f6" }} />
          <Text className="text-foreground flex-1 text-sm font-medium" numberOfLines={1}>
            {SHARE_LINK}
          </Text>
          <Pressable className="ml-2">
            <Icon as={ClipboardCopy} className="size-4" style={{ color: "#6b7280" }} />
          </Pressable>
        </View>

        <View
          className="w-full mt-2 rounded-xl px-4 py-3"
          style={{
            backgroundColor: "rgba(59,130,246,0.06)",
            borderWidth: 1,
            borderColor: "rgba(59,130,246,0.12)",
          }}
        >
          <View className="flex-row items-center gap-2">
            <Icon as={Eye} className="size-3.5" style={{ color: "#3b82f6" }} />
            <Text className="text-xs font-medium" style={{ color: "#93c5fd" }}>
              View-only access
            </Text>
          </View>
          <Text className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Recipients can view plans and photos but cannot edit, upload, or delete anything.
          </Text>
        </View>

        <Button className="mt-4 h-12 w-full rounded-xl" onPress={onDone}>
          <Text className="text-primary-foreground text-base font-semibold">Done</Text>
        </Button>
      </View>
    </View>
  )
}

function RecipientViewScreen() {
  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <View
        className="flex-row items-center justify-center px-4 py-2.5"
        style={{
          backgroundColor: "rgba(59,130,246,0.1)",
          borderBottomWidth: 1,
          borderColor: "rgba(59,130,246,0.15)",
        }}
      >
        <Icon as={Eye} className="size-3.5 mr-2" style={{ color: "#3b82f6" }} />
        <Text className="text-xs font-semibold" style={{ color: "#93c5fd" }}>
          View-only
        </Text>
        <Text className="text-xs mx-1.5" style={{ color: "rgba(147,197,253,0.4)" }}>
          {"·"}
        </Text>
        <Text className="text-xs" style={{ color: "#93c5fd" }}>
          Shared by Sarah Chen
        </Text>
      </View>

      <StoryHeader title={PROJECT.name} />

      <ScrollView contentContainerClassName="px-4 pb-32">
        <View
          className="mt-2 rounded-2xl overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <View className="px-5 pt-4 pb-3">
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
              Plan Sheets
            </Text>
          </View>
          {[
            { number: "S1.0", title: "Foundation Plan", markers: 6 },
            { number: "S2.0", title: "Structural Details", markers: 4 },
            { number: "S3.0", title: "Sections & Elevations", markers: 3 },
            { number: "A1.0", title: "Floor Plan - Level 1", markers: 8 },
            { number: "A2.0", title: "Floor Plan - Level 2", markers: 5 },
          ].map((sheet) => (
            <View
              key={sheet.number}
              className="flex-row items-center gap-3 px-5 py-3"
              style={{ borderTopWidth: 1, borderColor: "rgba(255,255,255,0.04)" }}
            >
              <View
                className="items-center justify-center rounded-lg"
                style={{ width: 40, height: 40, backgroundColor: "rgba(59,130,246,0.1)" }}
              >
                <Text className="text-xs font-bold" style={{ color: "#3b82f6" }}>
                  {sheet.number}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-sm font-semibold">{sheet.title}</Text>
                <Text className="text-muted-foreground text-xs">
                  {sheet.markers} callout markers
                </Text>
              </View>
              <Icon as={Eye} className="size-4" style={{ color: "#6b7280" }} />
            </View>
          ))}
        </View>

        <View
          className="mt-4 rounded-2xl overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <View className="px-5 pt-4 pb-3">
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
              Recent Photos
            </Text>
          </View>
          <View className="flex-row flex-wrap px-4 pb-4 gap-2">
            {[
              "rebar42",
              "foundation55",
              "concrete63",
              "scaffold71",
              "formwork28",
              "steelbeam19",
            ].map((seed, i) => (
              <View
                key={i}
                className="rounded-xl overflow-hidden"
                style={{ width: "31%", aspectRatio: 1 } as any}
              >
                <Image
                  source={{ uri: `https://picsum.photos/seed/${seed}/300/300` }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
        <View className="items-center px-6 py-4" style={{ backgroundColor: "rgba(0,0,0,0.9)" }}>
          <Text className="text-muted-foreground mb-3 text-xs text-center">
            Want to collaborate? Create a free SiteLink account.
          </Text>
          <Button className="h-12 w-full rounded-xl">
            <Text className="text-primary-foreground text-base font-bold">Sign up for free</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

function ShareProjectFlow({
  initialPhase = "project-detail" as FlowPhase,
}: {
  initialPhase?: FlowPhase
}) {
  const [phase, setPhase] = React.useState<FlowPhase>(initialPhase)
  const [toastMsg, setToastMsg] = React.useState("")

  if (phase === "project-detail") {
    return (
      <>
        <ProjectDetailView onShare={() => setPhase("share-options")} />
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </>
    )
  }

  if (phase === "share-options") {
    return (
      <>
        <ShareOptionsSheet
          onClose={() => setPhase("project-detail")}
          onCopy={() => {
            setPhase("link-copied")
          }}
          onSend={(method) => {
            setToastMsg(`Opening ${method}...`)
            setTimeout(() => setPhase("link-copied"), 1200)
          }}
        />
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </>
    )
  }

  if (phase === "link-copied") {
    return <LinkCopiedView onDone={() => setPhase("project-detail")} />
  }

  if (phase === "recipient-view") {
    return <RecipientViewScreen />
  }

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof ShareProjectFlow> = {
  title: "Flows/14. Share Project",
  component: ShareProjectFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ShareProjectFlow>

export const ProjectDetail: Story = {
  name: "1. Project Detail",
  args: { initialPhase: "project-detail" },
}
export const ShareOptions: Story = {
  name: "2. Share Options",
  args: { initialPhase: "share-options" },
}
export const LinkCopied: Story = { name: "3. Link Copied", args: { initialPhase: "link-copied" } }
export const RecipientView: Story = {
  name: "4. Recipient View",
  args: { initialPhase: "recipient-view" },
}
export const FullFlow: Story = { name: "Full Flow", args: { initialPhase: "project-detail" } }
