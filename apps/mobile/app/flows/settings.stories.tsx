import type { Meta, StoryObj } from "@storybook/react"
import { Bell, Camera, ChevronRight, CreditCard, Download, HardDrive } from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { ActionList, FlatRow, SectionGroup, StoryHeader, StoryToast } from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"

type FlowScreen = "profile" | "notifications" | "offline" | "subscription"

function SettingsFlow({ initialScreen = "profile" as FlowScreen }: { initialScreen?: FlowScreen }) {
  const [screen, setScreen] = React.useState<FlowScreen>(initialScreen)
  const [saved, setSaved] = React.useState(false)
  const [toastMsg, setToastMsg] = React.useState("")

  const [notifyPlans, setNotifyPlans] = React.useState(true)
  const [notifyMedia, setNotifyMedia] = React.useState(true)
  const [notifyIssues, setNotifyIssues] = React.useState(true)
  const [notifyComments, setNotifyComments] = React.useState(false)

  const [offlineEnabled, setOfflineEnabled] = React.useState(true)
  const [offlinePhotos, setOfflinePhotos] = React.useState(true)

  if (screen === "notifications") {
    return (
      <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
        <StoryHeader title="Notification Preferences" onBack={() => setScreen("profile")} />
        <ScrollView className="flex-1" contentContainerClassName="pb-12">
          <SectionGroup title="Push Notifications">
            <ActionList>
              <FlatRow
                label="New Plans"
                sublabel="When plans are uploaded or processed"
                right={<Switch checked={notifyPlans} onCheckedChange={setNotifyPlans} />}
              />
              <FlatRow
                label="New Media"
                sublabel="When photos or recordings are added"
                right={<Switch checked={notifyMedia} onCheckedChange={setNotifyMedia} />}
              />
              <FlatRow
                label="Issues Flagged"
                sublabel="When team members flag issues"
                right={<Switch checked={notifyIssues} onCheckedChange={setNotifyIssues} />}
              />
              <FlatRow
                label="Comments"
                sublabel="When someone comments on your items"
                right={<Switch checked={notifyComments} onCheckedChange={setNotifyComments} />}
              />
            </ActionList>
          </SectionGroup>
        </ScrollView>
      </View>
    )
  }

  if (screen === "offline") {
    return (
      <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
        <StoryHeader title="Offline Downloads" onBack={() => setScreen("profile")} />
        <ScrollView className="flex-1" contentContainerClassName="pb-12">
          <SectionGroup title="Downloads">
            <ActionList>
              <FlatRow
                icon={Download}
                label="Auto-Download Plans"
                sublabel="Download new plans over WiFi"
                right={<Switch checked={offlineEnabled} onCheckedChange={setOfflineEnabled} />}
              />
              <FlatRow
                icon={Camera}
                label="Offline Photos"
                sublabel="Cache recent photos locally"
                right={<Switch checked={offlinePhotos} onCheckedChange={setOfflinePhotos} />}
              />
            </ActionList>
          </SectionGroup>
          <SectionGroup title="Storage">
            <ActionList>
              <FlatRow icon={HardDrive} label="Cached Data" value="245.3 MB" />
            </ActionList>
            <Button
              variant="secondary"
              className="mt-4 h-12 rounded-xl"
              onPress={() => setToastMsg("Cache cleared")}
            >
              <Text className="text-secondary-foreground text-base font-semibold">Clear Cache</Text>
            </Button>
          </SectionGroup>
        </ScrollView>
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Profile" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center pt-4 pb-8">
          <View className="relative">
            <View className="bg-primary/10 border-background size-24 items-center justify-center rounded-full border-4">
              <Text className="text-primary text-3xl font-bold">JS</Text>
            </View>
            <View className="bg-secondary border-background absolute right-0 bottom-0 rounded-full border-4 p-2">
              <Icon as={Camera} className="text-secondary-foreground size-4" />
            </View>
          </View>
        </View>
        <View className="gap-6">
          <View className="gap-2">
            <Label nativeID="settingsName">Full Name</Label>
            <Input nativeID="settingsName" className="h-12 rounded-xl" defaultValue="John Smith" />
          </View>
          <View className="gap-2">
            <Label nativeID="settingsEmail">Email</Label>
            <Input
              nativeID="settingsEmail"
              className="h-12 rounded-xl opacity-50"
              defaultValue="john@sitelink.com"
              editable={false}
            />
            <Text className="text-muted-foreground px-1 text-xs">Email cannot be changed.</Text>
          </View>
          <View className="gap-2">
            <Label nativeID="settingsCompany">Company</Label>
            <Input
              nativeID="settingsCompany"
              className="h-12 rounded-xl"
              defaultValue="Smith Electrical LLC"
            />
          </View>

          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />

          <FlatRow
            icon={CreditCard}
            label="Subscription"
            sublabel="Pro Trial · 12 days left"
            onPress={() => setScreen("subscription")}
          />
          <FlatRow
            icon={Bell}
            label="Notifications"
            sublabel="Push notification preferences"
            onPress={() => setScreen("notifications")}
          />
          <FlatRow
            icon={Download}
            label="Offline Downloads"
            sublabel="Manage cached data"
            onPress={() => setScreen("offline")}
          />

          <View className="mt-2">
            <Button
              className="h-12 rounded-xl"
              onPress={() => {
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
              }}
            >
              <Text className="text-primary-foreground text-base font-semibold">
                {saved ? "Saved!" : "Save Changes"}
              </Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const meta: Meta<typeof SettingsFlow> = {
  title: "Flows/11. Settings",
  component: SettingsFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof SettingsFlow>

export const Profile: Story = { name: "1. Profile", args: { initialScreen: "profile" } }
export const NotificationPrefs: Story = {
  name: "2. Notification Preferences",
  args: { initialScreen: "notifications" },
}
export const OfflineDownloads: Story = {
  name: "3. Offline Downloads",
  args: { initialScreen: "offline" },
}
export const FullFlow: Story = { name: "Full Flow", args: { initialScreen: "profile" } }
