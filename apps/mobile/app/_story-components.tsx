import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  HardDrive,
  ImageIcon,
  Map,
  Plus,
  Search,
  Smartphone,
  UserPlus,
  Users,
  X,
} from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { FormField } from "@/components/ui/form-field"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { ListRow } from "@/components/ui/list-row"
import { ListSection } from "@/components/ui/list-section"
import { ScreenLayout } from "@/components/ui/screen-layout"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

// Re-export design system components for backward compatibility
export { ListRow as FlatRow } from "@/components/ui/list-row"
export { ListSection as SectionGroup } from "@/components/ui/list-section"

export function ActionList({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean)
  return (
    <View className="bg-surface-1 overflow-hidden rounded-xl">
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Divider />}
          {child}
        </React.Fragment>
      ))}
    </View>
  )
}

export { SegmentedControl as StorySegmentedControl } from "@/components/ui/segmented-control"

export function StoryHeader({
  title,
  onBack,
  rightIcon,
  onRight,
  subtitle,
}: {
  title: string
  onBack?: () => void
  rightIcon?: React.ComponentType<any>
  onRight?: () => void
  subtitle?: string
}) {
  return (
    <View className="bg-background" style={{ paddingTop: 8 }}>
      <View className="min-h-[56px] flex-row items-center justify-between px-4">
        {onBack ? (
          <IconButton
            icon={require("lucide-react-native").ArrowLeft}
            label="Back"
            iconClassName="size-6"
            className="-ml-1"
            onPress={onBack}
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
        <View className="flex-1 items-center justify-center px-2">
          <Text
            className="text-foreground text-center text-base leading-tight font-bold"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
              {subtitle}
            </Text>
          )}
        </View>
        {rightIcon && onRight ? (
          <IconButton icon={rightIcon as any} label="Action" className="-mr-1" onPress={onRight} />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
    </View>
  )
}

export function StoryToast({
  message,
  visible,
  onDismiss,
}: {
  message: string
  visible: boolean
  onDismiss: () => void
}) {
  React.useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, 2000)
      return () => clearTimeout(timer)
    }
  }, [visible, onDismiss])

  if (!visible) return null

  return (
    <View
      style={{
        position: "absolute",
        bottom: 80,
        left: 16,
        right: 16,
        zIndex: 200,
      }}
    >
      <View className="bg-foreground items-center rounded-xl px-5 py-3">
        <Text className="text-background text-center text-sm font-medium">{message}</Text>
      </View>
    </View>
  )
}

export function CreateProjectOverlay({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated?: (data: { name: string; address?: string }) => void
}) {
  const [name, setName] = React.useState("")
  const [address, setAddress] = React.useState("")

  const handleSubmit = () => {
    if (!name.trim()) return
    const data = { name, address: address || undefined }
    setName("")
    setAddress("")
    if (onCreated) {
      onCreated(data)
    } else {
      onClose()
    }
  }

  return (
    <BottomSheet visible onClose={onClose} title="New Project">
      <View className="gap-6 px-6 pb-8">
        <FormField label="Project Name" nativeID="storyProjectName">
          <Input
            nativeID="storyProjectName"
            size="lg"
            placeholder="e.g. Riverside Apartments"
            value={name}
            onChangeText={setName}
          />
        </FormField>
        <FormField label="Address (Optional)" nativeID="storyAddress">
          <Input
            nativeID="storyAddress"
            size="lg"
            placeholder="e.g. 123 Main St, Denver, CO"
            value={address}
            onChangeText={setAddress}
          />
        </FormField>
        <Button onPress={handleSubmit} disabled={!name.trim()} className="h-12 w-full rounded-xl">
          <Text>Create Project</Text>
        </Button>
      </View>
    </BottomSheet>
  )
}

export function UploadPlanOverlay({
  onClose,
  onDeviceStorage,
}: {
  onClose: () => void
  onDeviceStorage?: () => void
}) {
  return (
    <BottomSheet visible onClose={onClose} title="Upload Plan">
      <View className="px-6">
        <Text className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
          Select Source
        </Text>
        <ListRow
          icon={Smartphone}
          iconColor="#f5f5f5"
          label="Device Storage"
          sublabel="PDF or images from your phone"
          onPress={onDeviceStorage}
        />
        <Divider />
        <View className="flex-row items-center gap-3 px-4 opacity-40" style={{ minHeight: 52 }}>
          <Icon as={Smartphone} className="text-muted-foreground size-5" />
          <Text className="text-muted-foreground flex-1 text-base font-medium">Google Drive</Text>
          <Text className="text-primary text-[10px] font-bold">SOON</Text>
        </View>
        <Divider />
        <View className="flex-row items-center gap-3 px-4 opacity-40" style={{ minHeight: 52 }}>
          <Icon as={Smartphone} className="text-muted-foreground size-5" />
          <Text className="text-muted-foreground flex-1 text-base font-medium">Dropbox</Text>
          <Text className="text-primary text-[10px] font-bold">SOON</Text>
        </View>
      </View>
      <View className="items-center px-6 pt-4 pb-8">
        <Text className="text-muted-foreground text-center text-xs">
          PDF, JPEG, PNG · 300 DPI recommended
        </Text>
      </View>
    </BottomSheet>
  )
}

export function NotificationsScreen({ onBack }: { onBack?: () => void }) {
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set(["3", "4"]))

  const notifications = [
    {
      id: "1",
      title: "Plan Processing Complete",
      body: "Riverside Apartments plans are ready to view.",
      time: "2h ago",
      type: "success" as const,
    },
    {
      id: "2",
      title: "New Issue Flagged",
      body: "Mike flagged an issue at 5/A7.",
      time: "5h ago",
      type: "alert" as const,
    },
    {
      id: "3",
      title: "Trial Ending Soon",
      body: "Your Pro trial ends in 3 days.",
      time: "2 days ago",
      type: "info" as const,
    },
    {
      id: "4",
      title: "Sheet Updated",
      body: "Floor 2 Electrical has been updated.",
      time: "3 days ago",
      type: "info" as const,
    },
  ]

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return CheckCircle
      case "alert":
        return AlertTriangle
      default:
        return Bell
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case "success":
        return "var(--color-success)"
      case "alert":
        return "var(--color-warning)"
      default:
        return "var(--color-info)"
    }
  }

  const hasUnread = notifications.some((n) => !readIds.has(n.id))

  return (
    <ScreenLayout title="Notifications" onBack={onBack} scrollable={false}>
      <ScrollView className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-4">
          <Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            This Week
          </Text>
          {hasUnread && (
            <Pressable onPress={() => setReadIds(new Set(notifications.map((n) => n.id)))}>
              <Text className="text-primary text-xs font-semibold">Mark All Read</Text>
            </Pressable>
          )}
        </View>
        {notifications.map((item) => {
          const isRead = readIds.has(item.id)
          return (
            <Pressable
              key={item.id}
              onPress={() => setReadIds((prev) => new Set([...prev, item.id]))}
              className="active:bg-muted/30 flex-row gap-3 px-4 py-4"
            >
              {!isRead && (
                <View
                  className="bg-info absolute top-0 bottom-0 left-0"
                  style={{
                    width: 3,
                    borderTopRightRadius: 2,
                    borderBottomRightRadius: 2,
                  }}
                />
              )}
              <Icon
                as={getIcon(item.type)}
                style={{ color: getColor(item.type) } as any}
                className="mt-0.5 size-5"
              />
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-start justify-between">
                  <Text
                    className={cn(
                      "flex-1 pr-2 text-base leading-tight",
                      isRead ? "font-medium" : "font-bold",
                    )}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">{item.time}</Text>
                </View>
                <Text
                  className={cn(
                    "text-sm leading-snug",
                    isRead ? "text-muted-foreground/60" : "text-muted-foreground",
                  )}
                >
                  {item.body}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </ScreenLayout>
  )
}

export function ProfileScreen({
  onBack,
  onNavigate,
}: {
  onBack?: () => void
  onNavigate?: (screen: string) => void
}) {
  const [saved, setSaved] = React.useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <ScreenLayout title="Profile" onBack={onBack}>
      <View className="items-center pt-4 pb-8">
        <View className="relative">
          <Avatar
            name="John Smith"
            size="xl"
            className="bg-primary/10 border-background border-4"
          />
          <View className="bg-secondary border-background absolute right-0 bottom-0 rounded-full border-4 p-2">
            <Icon as={Camera} className="text-secondary-foreground size-4" />
          </View>
        </View>
      </View>
      <View className="gap-6">
        <FormField label="Full Name" nativeID="storyFullName">
          <Input nativeID="storyFullName" size="lg" defaultValue="John Smith" />
        </FormField>
        <FormField label="Email" nativeID="storyEmail" hint="Email cannot be changed.">
          <Input
            nativeID="storyEmail"
            size="lg"
            defaultValue="john@sitelink.com"
            editable={false}
          />
        </FormField>
        <FormField label="Phone Number" nativeID="storyPhone">
          <Input nativeID="storyPhone" size="lg" defaultValue="(555) 123-4567" />
        </FormField>
        <FormField label="Company" nativeID="storyCompany">
          <Input nativeID="storyCompany" size="lg" defaultValue="Smith Electrical LLC" />
        </FormField>

        <Divider />

        <ListRow
          icon={CreditCard}
          label="Subscription"
          sublabel="Pro Trial · 12 days left"
          onPress={() => onNavigate?.("subscription")}
        />

        <View className="mt-2">
          <Button className="h-12 rounded-xl" onPress={handleSave}>
            <Text>{saved ? "Saved!" : "Save Changes"}</Text>
          </Button>
        </View>
      </View>
    </ScreenLayout>
  )
}

export function ProjectSettingsScreen({
  onBack,
  onNavigateToMembers,
}: {
  onBack?: () => void
  onNavigateToMembers?: () => void
}) {
  const [notifyPlans, setNotifyPlans] = React.useState(true)
  const [notifyMedia, setNotifyMedia] = React.useState(true)
  const [notifyComments, setNotifyComments] = React.useState(true)

  return (
    <ScreenLayout title="Project Settings" onBack={onBack} contentClassName="px-0">
      <ListSection title="Details">
        <ListRow label="Project Name" sublabel="Holabird Ave Warehouse" />
        <ListRow label="Address" sublabel="4200 Holabird Ave, Baltimore, MD" />
      </ListSection>

      <ListSection title="Storage" dividerInset={52}>
        <ListRow icon={HardDrive} label="Total Storage" value="245.3 MB" />
        <ListRow icon={FileText} label="Plans" value="180.2 MB · 12 files" />
        <ListRow icon={Camera} label="Media" value="65.1 MB · 48 files" />
      </ListSection>

      <ListSection title="Notifications">
        <ListRow
          label="New Plans"
          right={<Switch checked={notifyPlans} onCheckedChange={setNotifyPlans} />}
        />
        <ListRow
          label="New Media"
          right={<Switch checked={notifyMedia} onCheckedChange={setNotifyMedia} />}
        />
        <ListRow
          label="Comments"
          right={<Switch checked={notifyComments} onCheckedChange={setNotifyComments} />}
        />
      </ListSection>

      <ListSection title="Team" dividerInset={52}>
        <ListRow icon={Users} label="Team Members" onPress={onNavigateToMembers} />
      </ListSection>
    </ScreenLayout>
  )
}

const STORY_MEMBERS = [
  { id: "1", name: "John Smith", email: "john@sitelink.com", role: "Owner" },
  { id: "2", name: "Mike Chen", email: "mike@sitelink.com", role: "Admin" },
  { id: "3", name: "Sarah Johnson", email: "sarah@sitelink.com", role: "Member" },
  { id: "4", name: "David Lee", email: "david@sitelink.com", role: "Member" },
  { id: "5", name: "Emily Brown", email: "emily@sitelink.com", role: "Viewer" },
]

export function MembersScreen({ onBack }: { onBack?: () => void }) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<"Admin" | "Member" | "Viewer">("Member")

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery) return STORY_MEMBERS
    return STORY_MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [searchQuery])

  return (
    <ScreenLayout title="Project Members" onBack={onBack} scrollable={false}>
      <View className="px-4 py-2">
        <Input
          leftIcon={Search}
          placeholder="Search members..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          size="lg"
          className="bg-muted/40 border-transparent"
        />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-2">
        {filteredMembers.map((member, index) => (
          <React.Fragment key={member.id}>
            {index > 0 && <Divider inset={52} />}
            <View className="flex-row items-center gap-3 py-3.5">
              <Avatar name={member.name} />
              <View className="flex-1">
                <Text className="text-foreground font-medium">{member.name}</Text>
                <Text className="text-muted-foreground text-sm">{member.email}</Text>
              </View>
              <Text className="text-muted-foreground text-xs font-medium">{member.role}</Text>
            </View>
          </React.Fragment>
        ))}
      </ScrollView>

      <BottomSheet
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Team Member"
      >
        <View className="gap-6 px-6 pb-8">
          <FormField label="Email Address" nativeID="addMemberEmail">
            <Input
              nativeID="addMemberEmail"
              placeholder="member@example.com"
              value={newEmail}
              onChangeText={setNewEmail}
              size="lg"
            />
          </FormField>
          <View className="gap-2">
            <Text className="text-foreground text-sm font-medium">Role</Text>
            <View className="flex-row gap-2">
              {(["Admin", "Member", "Viewer"] as const).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setNewRole(role)}
                  className={cn(
                    "flex-1 rounded-xl border-2 px-4 py-3",
                    newRole === role ? "bg-primary border-primary" : "bg-muted/10 border-border",
                  )}
                >
                  <Text
                    className={cn(
                      "text-center font-medium",
                      newRole === role ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Button
            onPress={() => {
              setNewEmail("")
              setNewRole("Member")
              setShowAddModal(false)
            }}
            className="h-12 rounded-xl"
          >
            <Icon as={UserPlus} className="text-primary-foreground mr-2 size-5" />
            <Text>Add Member</Text>
          </Button>
        </View>
      </BottomSheet>
    </ScreenLayout>
  )
}

type ProcessingStage = "waiting" | "images" | "metadata" | "callouts" | "tiles" | "completed"

const PROCESSING_STAGES: {
  key: ProcessingStage
  label: string
  icon: typeof Clock
  color: string
}[] = [
  { key: "waiting", label: "Waiting for connection", icon: Clock, color: "var(--color-info)" },
  { key: "images", label: "Generating images", icon: ImageIcon, color: "var(--color-info)" },
  { key: "metadata", label: "Extracting metadata", icon: FileText, color: "var(--color-ai)" },
  {
    key: "callouts",
    label: "Detecting callouts",
    icon: AlertCircle,
    color: "var(--color-warning)",
  },
  { key: "tiles", label: "Creating tiles", icon: Map, color: "var(--color-success)" },
  { key: "completed", label: "Ready", icon: CheckCircle, color: "var(--color-success)" },
]

export function useProcessingState() {
  const [stageIndex, setStageIndex] = React.useState(-1)
  const isProcessing = stageIndex >= 0
  const isCompleted = isProcessing && PROCESSING_STAGES[stageIndex]?.key === "completed"

  React.useEffect(() => {
    if (!isProcessing || isCompleted) return
    const timer = setInterval(() => {
      setStageIndex((prev) => {
        if (prev >= PROCESSING_STAGES.length - 1) return prev
        return prev + 1
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [isProcessing, isCompleted])

  return {
    stageIndex,
    start: () => setStageIndex(0),
    reset: () => setStageIndex(-1),
    isProcessing,
    isCompleted,
    currentStage: isProcessing ? PROCESSING_STAGES[stageIndex] : null,
  }
}

export function ProcessingBanner({
  stageIndex,
  onPress,
}: {
  stageIndex: number
  onPress: () => void
}) {
  const stage = PROCESSING_STAGES[stageIndex]
  if (!stage) return null
  const isCompleted = stage.key === "completed"

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-1 mx-4 mb-3 flex-row items-center gap-3 rounded-xl px-4 py-3 active:opacity-80"
    >
      <Icon as={stage.icon} style={{ color: stage.color } as any} className="size-5" />
      <View className="flex-1">
        <Text className="text-foreground text-sm font-semibold">
          {isCompleted ? "Plan Ready" : "Processing Plan..."}
        </Text>
        <Text className="text-muted-foreground text-xs">{stage.label}</Text>
      </View>
      <Icon as={ChevronRight} className="text-muted-foreground size-4" />
    </Pressable>
  )
}

export function ProcessingOverlay({
  onClose,
  stageIndex: externalStageIndex,
}: {
  onClose: () => void
  stageIndex?: number
}) {
  const [internalStageIndex, setInternalStageIndex] = React.useState(0)
  const stageIndex = externalStageIndex !== undefined ? externalStageIndex : internalStageIndex

  React.useEffect(() => {
    if (externalStageIndex !== undefined) return
    const timer = setInterval(() => {
      setInternalStageIndex((prev) => {
        if (prev >= PROCESSING_STAGES.length - 1) return prev
        return prev + 1
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [externalStageIndex])

  const currentStage = PROCESSING_STAGES[stageIndex]
  const isCompleted = currentStage.key === "completed"

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
      className="bg-background"
    >
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-foreground text-lg font-bold">Processing Plan</Text>
        <IconButton
          icon={X}
          label="Close"
          size="sm"
          className="bg-muted/20 active:bg-muted/40 rounded-full"
          onPress={onClose}
        />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-8 items-center">
          <View
            className="mb-4 items-center justify-center rounded-full"
            style={{
              width: 80,
              height: 80,
              backgroundColor: `color-mix(in srgb, ${currentStage.color} 12%, transparent)`,
            }}
          >
            <Icon
              as={currentStage.icon}
              style={{ color: currentStage.color } as any}
              className="size-10"
            />
          </View>
          <Text className="text-foreground text-2xl font-bold">{currentStage.label}</Text>
          {isCompleted && (
            <Text className="text-muted-foreground mt-2 text-center">
              Your plan is ready to view
            </Text>
          )}
        </View>

        <View className="w-full gap-3">
          {PROCESSING_STAGES.map((stage, idx) => {
            const status = isCompleted
              ? "completed"
              : idx < stageIndex
                ? "completed"
                : idx === stageIndex
                  ? "active"
                  : "pending"

            return (
              <View
                key={stage.key}
                className={cn(
                  "flex-row items-center gap-3 rounded-lg px-4 py-3",
                  status === "active" && "bg-muted/20",
                  status === "completed" && "opacity-60",
                )}
              >
                <Icon
                  as={status === "completed" ? CheckCircle : stage.icon}
                  style={
                    {
                      color:
                        status === "completed"
                          ? "var(--color-success)"
                          : status === "active"
                            ? stage.color
                            : undefined,
                    } as any
                  }
                  className={cn("size-5", status === "pending" && "text-muted-foreground")}
                />
                <Text
                  className={cn(
                    "flex-1 text-sm font-medium",
                    status === "active" && "text-foreground",
                    status !== "active" && "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className="items-center px-6 pb-8">
        <Text className="text-muted-foreground text-center text-xs leading-relaxed">
          This may take a few minutes depending on plan size
        </Text>
      </View>
    </View>
  )
}
