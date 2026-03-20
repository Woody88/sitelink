import type { Meta, StoryObj } from "@storybook/react"
import {
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle,
  CreditCard,
  FileText,
  HardDrive,
  Mail,
  Search,
  Settings,
  Shield,
  Trash2,
  User,
  Users,
  WifiOff,
  X,
} from "lucide-react-native"
import * as React from "react"
import { View } from "react-native"
import { Avatar } from "./avatar"
import { Badge } from "./badge"
import { BottomSheet } from "./bottom-sheet"
import { Button } from "./button"
import { Divider } from "./divider"
import { FormField } from "./form-field"
import { IconButton } from "./icon-button"
import { Input } from "./input"
import { ListRow } from "./list-row"
import { ListSection } from "./list-section"
import { ScreenLayout } from "./screen-layout"
import { StatusScreen } from "./status-screen"
import { Switch } from "./switch"
import { Text } from "./text"

const meta: Meta = {
  title: "Design System",
}
export default meta

type Story = StoryObj

export const ColorTokens: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 24 }}>
      <Text className="text-foreground text-lg font-bold">Status Colors</Text>
      <View style={{ gap: 8 }}>
        {[
          { label: "Success", bg: "bg-success", fg: "bg-success-foreground" },
          { label: "Warning", bg: "bg-warning", fg: "bg-warning-foreground" },
          { label: "Info", bg: "bg-info", fg: "bg-info-foreground" },
          { label: "AI", bg: "bg-ai", fg: "bg-ai-foreground" },
          { label: "Destructive", bg: "bg-destructive", fg: "" },
        ].map((c) => (
          <View key={c.label} className="flex-row items-center gap-3">
            <View className={`${c.bg} size-10 rounded-lg`} />
            <Text className="text-foreground text-sm font-medium">{c.label}</Text>
          </View>
        ))}
      </View>
      <Text className="text-foreground text-lg font-bold">Surface Elevation</Text>
      <View style={{ gap: 8 }}>
        {["bg-surface-1", "bg-surface-2", "bg-surface-3", "bg-surface-4"].map((s, i) => (
          <View key={s} className={`${s} h-12 items-center justify-center rounded-lg`}>
            <Text className="text-muted-foreground text-xs">Surface {i + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  ),
}

export const Badges: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 16 }}>
      <Text className="text-foreground text-lg font-bold">Badge Variants</Text>
      <View className="flex-row flex-wrap gap-2">
        <Badge variant="default">
          <Text>Default</Text>
        </Badge>
        <Badge variant="secondary">
          <Text>Secondary</Text>
        </Badge>
        <Badge variant="destructive">
          <Text>Destructive</Text>
        </Badge>
        <Badge variant="outline">
          <Text>Outline</Text>
        </Badge>
        <Badge variant="success">
          <Text>Success</Text>
        </Badge>
        <Badge variant="warning">
          <Text>Warning</Text>
        </Badge>
        <Badge variant="info">
          <Text>Info</Text>
        </Badge>
        <Badge variant="ai">
          <Text>AI</Text>
        </Badge>
      </View>
      <Text className="text-foreground text-lg font-bold">Badge Sizes</Text>
      <View className="flex-row items-center gap-2">
        <Badge size="sm" variant="success">
          <Text>Small</Text>
        </Badge>
        <Badge size="default" variant="info">
          <Text>Default</Text>
        </Badge>
        <Badge size="lg" variant="warning">
          <Text>Large</Text>
        </Badge>
      </View>
    </View>
  ),
}

export const Inputs: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 16 }}>
      <Text className="text-foreground text-lg font-bold">Input Sizes</Text>
      <Input placeholder="Default size (h-10)" />
      <Input size="lg" placeholder="Large size (h-12)" />
      <Text className="text-foreground text-lg font-bold">With Icons</Text>
      <Input leftIcon={Search} placeholder="Search..." size="lg" />
      <Input leftIcon={Mail} placeholder="Email address" size="lg" />
      <Text className="text-foreground text-lg font-bold">Error State</Text>
      <Input error placeholder="Invalid input" size="lg" />
    </View>
  ),
}

export const Avatars: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 16 }}>
      <Text className="text-foreground text-lg font-bold">Avatar Sizes</Text>
      <View className="flex-row items-center gap-3">
        <Avatar name="John Smith" size="sm" />
        <Avatar name="Mike Chen" size="default" />
        <Avatar name="Sarah Johnson" size="lg" />
        <Avatar name="David Lee" size="xl" />
      </View>
    </View>
  ),
}

export const IconButtons: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 16 }}>
      <Text className="text-foreground text-lg font-bold">IconButton Sizes</Text>
      <View className="flex-row items-center gap-2">
        <IconButton icon={ArrowLeft} label="Back" size="sm" />
        <IconButton icon={Bell} label="Notifications" size="default" />
        <IconButton icon={Settings} label="Settings" size="lg" />
      </View>
      <Text className="text-foreground text-lg font-bold">With Background</Text>
      <View className="flex-row items-center gap-2">
        <IconButton icon={X} label="Close" size="sm" className="bg-muted/20 rounded-full" />
        <IconButton
          icon={Camera}
          label="Camera"
          size="default"
          className="bg-primary rounded-full"
          iconClassName="text-primary-foreground"
        />
      </View>
    </View>
  ),
}

export const Dividers: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 16 }}>
      <Text className="text-foreground text-lg font-bold">Full Width</Text>
      <Divider />
      <Text className="text-foreground text-lg font-bold">With Inset</Text>
      <Divider inset={16} />
      <Text className="text-foreground text-lg font-bold">With Large Inset</Text>
      <Divider inset={52} />
    </View>
  ),
}

export const ListRows: Story = {
  render: () => (
    <View style={{ gap: 0 }}>
      <ListRow icon={User} label="Profile" sublabel="John Smith" onPress={() => {}} />
      <Divider inset={52} />
      <ListRow icon={Bell} label="Notifications" value="3 new" onPress={() => {}} />
      <Divider inset={52} />
      <ListRow
        icon={Shield}
        label="Privacy"
        right={<Switch checked={true} onCheckedChange={() => {}} />}
      />
      <Divider inset={52} />
      <ListRow icon={Trash2} label="Delete Account" destructive onPress={() => {}} />
    </View>
  ),
}

export const ListSections: Story = {
  render: () => (
    <View className="bg-background" style={{ minHeight: "100vh" } as any}>
      <View style={{ padding: 16 }}>
        <Text className="text-foreground text-xl font-bold">Settings</Text>
      </View>
      <ListSection title="Account" dividerInset={52}>
        <ListRow icon={User} label="Profile" sublabel="John Smith" onPress={() => {}} />
        <ListRow icon={CreditCard} label="Subscription" sublabel="Pro Trial" onPress={() => {}} />
      </ListSection>
      <ListSection title="Storage" dividerInset={52}>
        <ListRow icon={HardDrive} label="Total Storage" value="245 MB" />
        <ListRow icon={FileText} label="Plans" value="180 MB" />
        <ListRow icon={Camera} label="Media" value="65 MB" />
      </ListSection>
      <ListSection title="Preferences">
        <ListRow
          label="Push Notifications"
          right={<Switch checked={true} onCheckedChange={() => {}} />}
        />
        <ListRow label="Auto-Sync" right={<Switch checked={false} onCheckedChange={() => {}} />} />
      </ListSection>
    </View>
  ),
}

export const FormFields: Story = {
  render: () => (
    <View style={{ padding: 16, gap: 16 }}>
      <FormField label="Full Name" nativeID="name">
        <Input nativeID="name" size="lg" defaultValue="John Smith" />
      </FormField>
      <FormField label="Email" nativeID="email" hint="Email cannot be changed.">
        <Input nativeID="email" size="lg" defaultValue="john@sitelink.com" editable={false} />
      </FormField>
      <FormField
        label="Password"
        nativeID="password"
        error="Password must be at least 8 characters."
      >
        <Input nativeID="password" size="lg" error secureTextEntry />
      </FormField>
    </View>
  ),
}

function BottomSheetDemo() {
  const [visible, setVisible] = React.useState(false)
  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View style={{ padding: 16 }}>
        <Button onPress={() => setVisible(true)}>
          <Text>Open Bottom Sheet</Text>
        </Button>
      </View>
      <BottomSheet visible={visible} onClose={() => setVisible(false)} title="New Project">
        <View className="gap-6 px-6 pb-8">
          <FormField label="Project Name" nativeID="bsName">
            <Input nativeID="bsName" size="lg" placeholder="e.g. Riverside Apartments" />
          </FormField>
          <FormField label="Address" nativeID="bsAddr">
            <Input nativeID="bsAddr" size="lg" placeholder="e.g. 123 Main St" />
          </FormField>
          <Button className="h-12 w-full rounded-xl">
            <Text>Create Project</Text>
          </Button>
        </View>
      </BottomSheet>
    </View>
  )
}

export const BottomSheets: Story = {
  render: () => <BottomSheetDemo />,
}

export const ScreenLayouts: Story = {
  render: () => (
    <ScreenLayout title="Project Settings" onBack={() => {}} rightIcon={Bell} onRight={() => {}}>
      <ListSection title="Details">
        <ListRow label="Project Name" sublabel="Holabird Ave Warehouse" />
        <ListRow label="Address" sublabel="4200 Holabird Ave, Baltimore" />
      </ListSection>
      <ListSection title="Team" dividerInset={52}>
        <ListRow icon={Users} label="Team Members" value="5" onPress={() => {}} />
      </ListSection>
    </ScreenLayout>
  ),
}

export const StatusScreenSuccess: Story = {
  render: () => (
    <StatusScreen
      icon={CheckCircle}
      iconColor="#22c55e"
      title="Plan Ready"
      description="Your construction plan has been processed and is ready to view."
      action={{ label: "View Plan", onPress: () => {} }}
      secondaryAction={{ label: "Back to Projects", onPress: () => {} }}
    />
  ),
}

export const StatusScreenError: Story = {
  render: () => (
    <StatusScreen
      icon={WifiOff}
      iconColor="#ef4444"
      title="Connection Lost"
      description="Check your internet connection and try again."
      action={{ label: "Retry", onPress: () => {} }}
    />
  ),
}

export const StatusScreenEmpty: Story = {
  render: () => (
    <StatusScreen
      icon={FileText}
      title="No Plans Yet"
      description="Upload your first construction plan to get started."
      action={{ label: "Upload Plan", onPress: () => {} }}
    />
  ),
}

function KitchenSinkDemo() {
  const [notifs, setNotifs] = React.useState(true)
  const [autoSync, setAutoSync] = React.useState(true)
  const [sheet, setSheet] = React.useState(false)

  return (
    <ScreenLayout title="Profile" onBack={() => {}} rightIcon={Bell} onRight={() => {}}>
      <View className="items-center pt-4 pb-6">
        <Avatar name="John Smith" size="xl" className="bg-primary/10" />
        <Text className="text-foreground mt-3 text-lg font-bold">John Smith</Text>
        <Text className="text-muted-foreground text-sm">john@sitelink.com</Text>
      </View>

      <View className="gap-4">
        <FormField label="Full Name" nativeID="ksName">
          <Input nativeID="ksName" size="lg" defaultValue="John Smith" />
        </FormField>
        <FormField label="Company" nativeID="ksCompany">
          <Input nativeID="ksCompany" size="lg" defaultValue="Smith Electrical LLC" />
        </FormField>
        <FormField label="Phone" nativeID="ksPhone">
          <Input nativeID="ksPhone" size="lg" defaultValue="(555) 123-4567" />
        </FormField>
      </View>

      <ListSection title="Subscription">
        <ListRow
          icon={CreditCard}
          label="Current Plan"
          sublabel="Pro Trial · 12 days left"
          onPress={() => setSheet(true)}
        />
      </ListSection>

      <ListSection title="Preferences">
        <ListRow
          label="Push Notifications"
          right={<Switch checked={notifs} onCheckedChange={setNotifs} />}
        />
        <ListRow
          label="Auto-Sync"
          right={<Switch checked={autoSync} onCheckedChange={setAutoSync} />}
        />
      </ListSection>

      <View className="mt-6">
        <Button className="h-12 w-full rounded-xl">
          <Text>Save Changes</Text>
        </Button>
      </View>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Subscription">
        <View className="gap-4 px-6 pb-8">
          <View className="flex-row items-center gap-2">
            <Badge variant="success">
              <Text>Active</Text>
            </Badge>
            <Text className="text-foreground font-medium">Pro Trial</Text>
          </View>
          <Text className="text-muted-foreground text-sm">
            Your trial ends in 12 days. Upgrade to keep all features.
          </Text>
          <Button className="h-12 w-full rounded-xl">
            <Text>Upgrade to Pro</Text>
          </Button>
        </View>
      </BottomSheet>
    </ScreenLayout>
  )
}

export const KitchenSink: Story = {
  render: () => <KitchenSinkDemo />,
}
