import type { Meta, StoryObj } from "@storybook/react"
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Folder,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  Maximize,
  Mic,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  Search,
  Settings,
  Share2,
  Sparkles,
  TableProperties,
  X,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react-native"
import * as React from "react"
import { Image, Pressable, ScrollView, View } from "react-native"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import {
  MembersScreen,
  ProcessingBanner,
  ProcessingOverlay,
  ProjectSettingsScreen,
  StorySegmentedControl,
  StoryToast,
  UploadPlanOverlay,
  useProcessingState,
} from "@/app/_story-components"
import { RfiDraftScreen } from "@/app/rfi.stories"

interface Sheet {
  id: string
  number: string
  title: string
}

const MOCK_FOLDERS = [
  {
    id: "f1",
    name: "Structural Plans",
    sheets: [
      { id: "s1", number: "S1.0", title: "Foundation Plan" },
      { id: "s2", number: "S2.0", title: "Second Floor Framing" },
      { id: "s3", number: "S3.0", title: "Slab on Grade Schedule" },
      { id: "s4", number: "S4.0", title: "Roof Framing Plan" },
    ],
  },
  {
    id: "f2",
    name: "Architectural Plans",
    sheets: [
      { id: "a1", number: "A1.0", title: "Site Plan" },
      { id: "a2", number: "A2.0", title: "Floor Plan - Level 1" },
      { id: "a3", number: "A3.0", title: "Floor Plan - Level 2" },
    ],
  },
  {
    id: "f3",
    name: "Electrical Plans",
    sheets: [
      { id: "e1", number: "E1.0", title: "Lighting Plan" },
      { id: "e2", number: "E2.0", title: "Power Plan" },
    ],
  },
]

const MOCK_MEMBERS = [
  { id: "1", name: "John Smith", role: "Owner" },
  { id: "2", name: "Mike Chen", role: "Member" },
  { id: "3", name: "Sarah Johnson", role: "Member" },
  { id: "4", name: "David Lee", role: "Member" },
  { id: "5", name: "Emily Brown", role: "Member" },
]

const MOCK_ACTIVITY = [
  { id: "1", time: "2:47 PM", message: "Mike flagged issue at 5/A7" },
  { id: "2", time: "11:30 AM", message: "Sarah added 3 photos to 3/A2" },
  { id: "3", time: "9:15 AM", message: "John added photo to 5/A7" },
  {
    id: "4",
    time: "Yesterday 4:20 PM",
    message: "David uploaded new plan sheet",
  },
  {
    id: "5",
    time: "Yesterday 2:10 PM",
    message: "Emily shared project with client",
  },
]

const MOCK_PHOTOS = [
  {
    title: "Today",
    groups: [
      {
        markerLabel: "5/A7 - Electrical Junction",
        hasIssue: true,
        voiceNote: {
          duration: "0:15",
          transcript:
            "Junction box needs to move about six inches to the left to clear the conduit run",
        },
        photos: [
          { id: "p1", seed: "elect1", time: "2:30 PM", isIssue: false },
          {
            id: "p2",
            seed: "elect2",
            time: "1:30 PM",
            isIssue: true,
            hasVoiceNote: true,
          },
          { id: "p3", seed: "elect3", time: "12:00 PM", isIssue: false },
        ],
      },
      {
        markerLabel: "3/A2 - Panel Rough-in",
        hasIssue: false,
        photos: [
          { id: "p4", seed: "panel1", time: "11:00 AM", isIssue: false },
          { id: "p5", seed: "panel2", time: "10:30 AM", isIssue: false },
        ],
      },
    ],
  },
  {
    title: "Yesterday",
    groups: [
      {
        markerLabel: "2/A1 - HVAC Duct",
        hasIssue: false,
        photos: [
          { id: "p6", seed: "hvac1", time: "4:15 PM", isIssue: false },
          { id: "p7", seed: "hvac2", time: "3:00 PM", isIssue: false },
        ],
      },
    ],
  },
]

const MARKER_COLORS = {
  detail: "#22c55e",
  section: "#3b82f6",
  note: "#a855f7",
  selected: "#facc15",
} as const

const MOCK_MARKERS = [
  {
    id: "m1",
    label: "5/A7",
    type: "detail" as const,
    description: "Electrical Junction Detail — Referenced from Sheet S1.0",
    top: "52%",
    left: "7%",
    width: "6%",
    height: "4%",
  },
  {
    id: "m2",
    label: "3/A2",
    type: "section" as const,
    description: "Stage Framing Section — See Sheet S2.0",
    top: "60%",
    left: "18%",
    width: "8%",
    height: "5%",
  },
  {
    id: "m3",
    label: "N1",
    type: "note" as const,
    description: "Foundation Notes — General structural notes",
    top: "4%",
    left: "78%",
    width: "16%",
    height: "12%",
  },
  {
    id: "m4",
    label: "2/A1",
    type: "detail" as const,
    description: "Footing Detail — Strip footing at grid line W",
    top: "42%",
    left: "28%",
    width: "5%",
    height: "4%",
  },
]

const MOCK_SCHEDULE_GROUPS = [
  {
    id: "sg1",
    title: "Slab on Grade Schedule",
    sheetNumber: "S1.0",
    entries: [
      {
        id: "se1",
        mark: "SL1",
        confidence: 0.95,
        properties: {
          thickness: '6"',
          concrete: "4000 PSI",
          reinforcement: "6x6 W2.9/W2.9 WWF",
          finish: "Broom",
        },
      },
      {
        id: "se2",
        mark: "SL2",
        confidence: 0.92,
        properties: {
          thickness: '8"',
          concrete: "4000 PSI",
          reinforcement: '#4 @ 16" O.C. E.W.',
          finish: "Hard Trowel",
        },
      },
      {
        id: "se3",
        mark: "SL3",
        confidence: 0.88,
        properties: {
          thickness: '6"',
          concrete: "4000 PSI",
          reinforcement: "6x6 W2.9/W2.9 WWF",
          finish: "Broom",
        },
      },
      {
        id: "se4",
        mark: "SL4",
        confidence: 0.71,
        properties: { thickness: '10"', concrete: "5000 PSI" },
      },
    ],
  },
  {
    id: "sg2",
    title: "Footing Schedule",
    sheetNumber: "S1.0",
    entries: [
      {
        id: "se5",
        mark: "F1",
        confidence: 0.97,
        properties: {
          width: '24"',
          depth: '12"',
          reinforcement: "3-#5 Cont. T&B",
          concrete: "4000 PSI",
        },
      },
      {
        id: "se6",
        mark: "F2",
        confidence: 0.94,
        properties: {
          width: '36"',
          depth: '18"',
          reinforcement: "4-#5 Cont. T&B",
          concrete: "4000 PSI",
        },
      },
    ],
  },
]

interface PhotoMetadata {
  time: string
  markerLabel: string
  isIssue: boolean
  hasVoiceNote: boolean
  voiceNote?: { duration: string; transcript: string }
}

type WorkspaceScreen =
  | { type: "workspace" }
  | { type: "project-settings" }
  | { type: "members" }
  | { type: "plan-viewer"; sheet: Sheet }
  | { type: "camera" }
  | { type: "photo-preview"; seed: string; metadata?: PhotoMetadata }
  | { type: "rfi"; markerLabel: string }

function PhotoThumbnailStory({
  seed,
  time,
  isIssue,
  hasVoiceNote,
  onPress,
}: {
  seed: string
  time: string
  isIssue?: boolean
  hasVoiceNote?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-muted relative overflow-hidden rounded-xl"
      style={{ width: 160, height: 160 }}
    >
      <Image
        source={{ uri: `https://picsum.photos/seed/${seed}/300/300` }}
        className="h-full w-full"
        resizeMode="cover"
      />
      {isIssue && (
        <View
          className="bg-destructive absolute top-2 right-2 items-center justify-center rounded-full"
          style={{ width: 20, height: 20 }}
        >
          <Text className="text-[12px] font-bold text-white">!</Text>
        </View>
      )}
      {hasVoiceNote && (
        <View
          className="absolute right-2 bottom-2 items-center justify-center rounded-full bg-blue-500"
          style={{ width: 20, height: 20 }}
        >
          <Icon as={Mic} className="size-3 text-white" />
        </View>
      )}
      <View className="absolute bottom-2 left-2">
        <View className="rounded bg-black/40 px-1.5 py-0.5">
          <Text className="text-[11px] font-medium text-white">{time}</Text>
        </View>
      </View>
    </Pressable>
  )
}

function MediaTabPopulated({
  onPhotoPress,
  onGenerateRfi,
}: {
  onPhotoPress?: (seed: string, metadata?: PhotoMetadata) => void
  onGenerateRfi?: (markerLabel: string) => void
}) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {MOCK_PHOTOS.map((section) => (
        <View key={section.title}>
          <View className="bg-background px-4 pt-6 pb-2">
            <Text className="text-foreground text-base font-bold">{section.title}</Text>
          </View>
          {section.groups.map((group, groupIdx) => (
            <React.Fragment key={group.markerLabel}>
              <View className="py-4">
                <View className="mb-3 px-4">
                  <View className="mb-2 flex-row items-center gap-2">
                    <Icon as={MapPin} className="text-muted-foreground size-4" />
                    <Text className="text-foreground text-sm font-semibold">
                      {group.markerLabel}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      ({group.photos.length} photos)
                    </Text>
                  </View>
                  {group.hasIssue && (
                    <Pressable
                      onPress={() => onGenerateRfi?.(group.markerLabel)}
                      className="bg-primary/10 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 active:opacity-70"
                    >
                      <Icon as={FileText} className="text-primary size-3.5" />
                      <Text className="text-primary text-xs font-medium">Generate RFI</Text>
                    </Pressable>
                  )}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="px-4 gap-3"
                >
                  {group.photos.map((photo) => (
                    <PhotoThumbnailStory
                      key={photo.id}
                      seed={photo.seed}
                      time={photo.time}
                      isIssue={photo.isIssue}
                      hasVoiceNote={photo.hasVoiceNote}
                      onPress={() =>
                        onPhotoPress?.(photo.seed, {
                          time: photo.time,
                          markerLabel: group.markerLabel,
                          isIssue: !!photo.isIssue,
                          hasVoiceNote: !!photo.hasVoiceNote,
                          voiceNote: photo.hasVoiceNote ? group.voiceNote : undefined,
                        })
                      }
                    />
                  ))}
                </ScrollView>
                {group.voiceNote && (
                  <View className="mt-3 px-4">
                    <View className="bg-muted/20 flex-row items-start gap-2 rounded-lg p-3">
                      <Icon as={Mic} className="text-primary mt-0.5 size-4" />
                      <View className="flex-1">
                        <Text className="text-muted-foreground mb-1 text-xs">
                          {group.voiceNote.duration}
                        </Text>
                        <Text className="text-foreground text-sm leading-relaxed">
                          {`\u201C${group.voiceNote.transcript}\u201D`}
                        </Text>
                      </View>
                      <Pressable className="p-1">
                        <Icon as={Play} className="text-primary size-4" />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
              {groupIdx < section.groups.length - 1 && <Separator className="ml-4" />}
            </React.Fragment>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

function PlansTab({ onSheetPress }: { onSheetPress?: (sheet: Sheet) => void }) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const [expandedFolders, setExpandedFolders] = React.useState<string[]>(["f1"])

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  return (
    <View className="flex-1">
      <View className="px-4 py-4">
        <View className="flex-row items-center gap-2">
          <View className="relative flex-1">
            <View className="absolute top-2.5 left-3 z-10">
              <Icon as={Search} className="text-muted-foreground size-4" />
            </View>
            <Input
              placeholder="Search plans"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="bg-muted/40 h-10 rounded-xl border-transparent pl-10"
            />
          </View>
          <View className="bg-muted/20 flex-row rounded-xl p-1">
            <Pressable
              onPress={() => setViewMode("grid")}
              className={cn(
                "rounded-lg p-1.5",
                viewMode === "grid" ? "bg-background shadow-sm" : "bg-transparent",
              )}
            >
              <Icon
                as={LayoutGrid}
                className={cn(
                  "size-4",
                  viewMode === "grid" ? "text-foreground" : "text-muted-foreground",
                )}
              />
            </Pressable>
            <Pressable
              onPress={() => setViewMode("list")}
              className={cn(
                "rounded-lg p-1.5",
                viewMode === "list" ? "bg-background shadow-sm" : "bg-transparent",
              )}
            >
              <Icon
                as={List}
                className={cn(
                  "size-4",
                  viewMode === "list" ? "text-foreground" : "text-muted-foreground",
                )}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {MOCK_FOLDERS.map((folder) => (
          <Collapsible
            key={folder.id}
            open={expandedFolders.includes(folder.id)}
            onOpenChange={() => toggleFolder(folder.id)}
            className="mb-4"
          >
            <CollapsibleTrigger asChild>
              <Pressable className="bg-muted/10 flex-row items-center justify-between rounded-xl px-4 py-3">
                <View className="flex-1 flex-row items-center gap-3">
                  <Icon as={Folder} className="text-muted-foreground size-5" />
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {folder.sheets.length} plans
                    </Text>
                  </View>
                </View>
                <Icon
                  as={expandedFolders.includes(folder.id) ? ChevronDown : ChevronRight}
                  className="text-muted-foreground size-5"
                />
              </Pressable>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {viewMode === "grid" ? (
                <View
                  className="pt-2"
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  {folder.sheets.map((sheet) => (
                    <Pressable
                      key={sheet.id}
                      onPress={() => onSheetPress?.(sheet)}
                      className="border-border active:bg-muted/10 overflow-hidden rounded-2xl border"
                      style={{ width: "48%" }}
                    >
                      <Image
                        source={{ uri: "/plan-sample.png" }}
                        style={{ width: "100%", aspectRatio: 3 / 2 }}
                        resizeMode="cover"
                      />
                      <View className="p-3">
                        <Text className="text-foreground text-sm font-bold">{sheet.number}</Text>
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {sheet.title}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="gap-1 pt-2">
                  {folder.sheets.map((sheet) => (
                    <Pressable
                      key={sheet.id}
                      onPress={() => onSheetPress?.(sheet)}
                      className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3"
                    >
                      <View className="bg-muted/20 size-10 items-center justify-center rounded-lg">
                        <Icon as={FileText} className="text-muted-foreground size-5" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-base font-bold">{sheet.number}</Text>
                        <Text className="text-muted-foreground text-sm">{sheet.title}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </ScrollView>
    </View>
  )
}

function MediaTab({
  isEmpty = true,
  onPhotoPress,
  onGenerateRfi,
}: {
  isEmpty?: boolean
  onPhotoPress?: (seed: string, metadata?: PhotoMetadata) => void
  onGenerateRfi?: (markerLabel: string) => void
}) {
  if (!isEmpty) {
    return <MediaTabPopulated onPhotoPress={onPhotoPress} onGenerateRfi={onGenerateRfi} />
  }
  return (
    <Empty className="mx-4 mb-4">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon as={Camera} className="text-muted-foreground size-8" />
        </EmptyMedia>
        <EmptyTitle>No Media Yet</EmptyTitle>
        <EmptyDescription>
          Photos and recordings from this project will appear here as they are captured.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function StoryDailySummary({ onViewFullReport }: { onViewFullReport?: () => void }) {
  const [state, setState] = React.useState<"default" | "loading" | "generated">("default")
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  const handleGenerate = () => {
    setState("loading")
    setTimeout(() => setState("generated"), 3000)
  }

  return (
    <View className="border-border bg-muted/20 overflow-hidden rounded-none border">
      <Pressable
        onPress={() => setIsCollapsed((c) => !c)}
        className="flex-row items-center justify-between p-4"
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Icon as={Sparkles} className="text-foreground size-4" />
          <Text className="text-foreground text-base font-semibold">{"Today's Summary"}</Text>
        </View>
        {state === "generated" && !isCollapsed && (
          <Pressable className="bg-foreground/5 flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70">
            <Icon as={ExternalLink} className="text-foreground size-4" />
            <Text className="text-foreground text-sm font-medium">Share</Text>
          </Pressable>
        )}
      </Pressable>
      {!isCollapsed && (
        <View className="px-4 pb-4">
          <View className="bg-border mb-4 h-px opacity-50" />
          {state === "loading" ? (
            <View className="gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[60%]" />
            </View>
          ) : state === "generated" ? (
            <View className="gap-3">
              <Text className="text-foreground text-sm leading-relaxed">
                Good progress today on the Holabird Ave Warehouse project. Mike flagged a junction
                box clearance issue at 5/A7 that needs resolution before the conduit run can
                proceed. Sarah documented panel rough-in progress at 3/A2 with 3 photos showing the
                installation is tracking to schedule. One voice note captured with details on the
                junction box repositioning needed.
              </Text>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-muted-foreground text-xs">Generated just now</Text>
                <View className="flex-row items-center gap-3">
                  {onViewFullReport && (
                    <Pressable
                      onPress={onViewFullReport}
                      className="flex-row items-center gap-1.5 p-1 active:opacity-70"
                    >
                      <Icon as={ExternalLink} className="text-primary size-3.5" />
                      <Text className="text-primary text-xs font-medium">View Full Report</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={handleGenerate}
                    className="flex-row items-center gap-1.5 p-1 active:opacity-70"
                  >
                    <Icon as={RefreshCcw} className="text-muted-foreground size-3.5" />
                    <Text className="text-muted-foreground text-xs">Refresh</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <View className="gap-2">
                <Text className="text-foreground text-sm leading-relaxed">
                  📷 5 photos captured
                </Text>
                <Text className="text-foreground text-sm leading-relaxed">🎤 1 voice note</Text>
                <Text className="text-foreground text-sm leading-relaxed">⚠️ 1 issue flagged</Text>
              </View>
              <View className="mt-2 flex-row justify-end">
                <Pressable
                  onPress={handleGenerate}
                  className="bg-foreground flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80"
                >
                  <Icon as={Sparkles} className="text-background size-4" />
                  <Text className="text-background text-sm font-semibold">Generate Summary</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function ActivityTab({
  onManagePress,
  onShowToast,
  onViewFullReport,
}: {
  onManagePress?: () => void
  onShowToast?: (msg: string) => void
  onViewFullReport?: () => void
}) {
  const [offlineDownloaded, setOfflineDownloaded] = React.useState(false)
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 p-4">
        <StoryDailySummary onViewFullReport={onViewFullReport} />

        <View>
          <Text className="text-foreground mb-3 text-lg font-bold">Quick Actions</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onShowToast?.("Report link copied to clipboard")}
              className="bg-muted/20 flex-1 items-center justify-center rounded-full px-3 py-2 active:opacity-70"
            >
              <Icon as={Share2} className="text-foreground mb-1 size-4" />
              <Text className="text-foreground text-center text-[11px] leading-tight font-medium">
                Share Report
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!offlineDownloaded) {
                  setOfflineDownloaded(true)
                  onShowToast?.("Project available offline")
                }
              }}
              className="bg-muted/20 flex-1 items-center justify-center rounded-full px-3 py-2 active:opacity-70"
            >
              <Icon
                as={offlineDownloaded ? Check : Download}
                className={cn(
                  "mb-1 size-4",
                  offlineDownloaded ? "text-green-500" : "text-foreground",
                )}
              />
              <Text className="text-foreground text-center text-[11px] leading-tight font-medium">
                {offlineDownloaded ? "Available Offline" : "Offline"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View>
          <View className="mb-3 flex-row items-end justify-between">
            <Text className="text-foreground text-lg font-bold">Team Members</Text>
            <Pressable onPress={onManagePress}>
              <Text className="text-primary text-sm font-medium">Manage</Text>
            </Pressable>
          </View>
          {MOCK_MEMBERS.map((member, index) => (
            <React.Fragment key={member.id}>
              <View className="flex-row items-center py-2.5">
                <View className="bg-primary/20 mr-3 size-8 items-center justify-center rounded-full">
                  <Text className="text-primary text-xs font-semibold">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </Text>
                </View>
                <Text className="text-foreground flex-1 text-base font-medium">
                  {member.name}
                  {member.role === "Owner" && (
                    <Text className="text-muted-foreground ml-2 text-xs"> (you)</Text>
                  )}
                </Text>
                <Text className="text-muted-foreground text-sm">{member.role}</Text>
              </View>
              {index < MOCK_MEMBERS.length - 1 && <Separator className="ml-11" />}
            </React.Fragment>
          ))}
        </View>

        <View>
          <Text className="text-foreground mb-3 text-lg font-bold">Recent Activity</Text>
          {MOCK_ACTIVITY.map((activity, index) => (
            <React.Fragment key={activity.id}>
              <View className="border-muted border-l-2 py-2.5 pl-4">
                <Text className="text-muted-foreground mb-0.5 text-xs">{activity.time}</Text>
                <Text className="text-foreground text-sm">{activity.message}</Text>
              </View>
              {index < MOCK_ACTIVITY.length - 1 && <View className="h-1" />}
            </React.Fragment>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function GlassButton({
  children,
  size = 44,
  onPress,
}: {
  children: React.ReactNode
  size?: number
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: "rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </Pressable>
  )
}

function InlinePlanViewer({
  sheet,
  onClose,
  onTakePhoto,
}: {
  sheet: Sheet
  onClose: () => void
  onTakePhoto: () => void
}) {
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string>()
  const [showScheduleDrawer, setShowScheduleDrawer] = React.useState(false)
  const [toastMsg, setToastMsg] = React.useState<string | null>(null)

  const selectedMarker = selectedMarkerId
    ? MOCK_MARKERS.find((m) => m.id === selectedMarkerId)
    : undefined

  const handleGoToSheet = () => {
    const refSheet = selectedMarker?.description.match(/Sheet (S\d+\.\d+)/)?.[1] ?? "S2.0"
    setToastMsg(`Navigate to Sheet ${refSheet}`)
    setSelectedMarkerId(undefined)
  }

  return (
    <View
      style={
        {
          minHeight: "100vh",
          position: "relative",
          backgroundColor: "#0a0a0a",
        } as any
      }
    >
      <Image
        source={{ uri: "/plan-sample.png" }}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        resizeMode="contain"
      />

      {MOCK_MARKERS.map((marker) => (
        <Pressable
          key={marker.id}
          onPress={() => {
            setSelectedMarkerId((prev) => (prev === marker.id ? undefined : marker.id))
            setShowScheduleDrawer(false)
          }}
          style={{
            position: "absolute",
            top: marker.top as any,
            left: marker.left as any,
            width: marker.width as any,
            height: marker.height as any,
            borderWidth: marker.id === selectedMarkerId ? 3 : 2,
            borderColor:
              marker.id === selectedMarkerId ? MARKER_COLORS.selected : MARKER_COLORS[marker.type],
            borderRadius: 4,
            backgroundColor:
              marker.id === selectedMarkerId ? "rgba(250,204,21,0.12)" : "transparent",
            zIndex: 5,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -22,
              left: 0,
              backgroundColor:
                marker.id === selectedMarkerId
                  ? MARKER_COLORS.selected
                  : MARKER_COLORS[marker.type],
              borderRadius: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{marker.label}</Text>
          </View>
        </Pressable>
      ))}

      <View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
        <GlassButton onPress={onClose}>
          <Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
        </GlassButton>
      </View>

      <View
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
          gap: 12,
          alignItems: "center",
        }}
      >
        <View
          className="items-center justify-center rounded-xl"
          style={{
            backgroundColor: "rgba(0,0,0,0.6)",
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            }}
          >
            42%
          </Text>
        </View>
        <View
          className="items-center overflow-hidden rounded-2xl"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
            <Icon as={ZoomIn} className="size-5 text-white" />
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignSelf: "stretch",
            }}
          />
          <Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
            <Icon as={ZoomOut} className="size-5 text-white" />
          </Pressable>
          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignSelf: "stretch",
            }}
          />
          <Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
            <Icon as={Maximize} className="size-5 text-white" />
          </Pressable>
        </View>
        <GlassButton>
          <Icon as={ScanLine} className="size-5 text-white" />
        </GlassButton>
        <GlassButton
          onPress={() => {
            setShowScheduleDrawer(true)
            setSelectedMarkerId(undefined)
          }}
        >
          <Icon as={TableProperties} className="size-5 text-white" />
        </GlassButton>
        <GlassButton>
          <Icon as={Plus} className="size-5 text-white" strokeWidth={2.5} />
        </GlassButton>
      </View>

      {!selectedMarker && !showScheduleDrawer && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingHorizontal: 16,
            paddingBottom: 24,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View
              className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              <Icon as={Layers} className="size-4 text-white/70" />
              <Text className="text-sm font-bold text-white">{sheet.number}</Text>
              <Text className="text-sm text-white/60">{sheet.title}</Text>
              <Icon as={ChevronDown} className="size-3.5 text-white/40" />
            </View>
            <View
              className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
              style={{ backgroundColor: "rgba(245,245,245,0.15)" }}
            >
              <Icon as={MapPin} className="text-primary size-3.5" />
              <Text className="text-primary text-sm font-semibold">{MOCK_MARKERS.length}</Text>
            </View>
          </View>
        </View>
      )}

      {selectedMarker && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            backgroundColor: "#1c1c1c",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 12,
            paddingBottom: 32,
            paddingHorizontal: 20,
          }}
        >
          <Pressable onPress={() => setSelectedMarkerId(undefined)} className="mb-4 items-center">
            <View className="bg-muted h-1 w-10 rounded-full" />
          </Pressable>
          <View className="mb-1 flex-row items-center gap-2">
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                backgroundColor: MARKER_COLORS[selectedMarker.type] + "20",
              }}
            >
              <Icon
                as={MapPin}
                style={{ color: MARKER_COLORS[selectedMarker.type] }}
                className="size-4"
              />
            </View>
            <Text className="text-foreground text-lg font-bold">{selectedMarker.label}</Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: MARKER_COLORS[selectedMarker.type] + "20",
              }}
            >
              <Text
                style={{
                  color: MARKER_COLORS[selectedMarker.type],
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {selectedMarker.type.charAt(0).toUpperCase() + selectedMarker.type.slice(1)}
              </Text>
            </View>
          </View>
          <Text className="text-muted-foreground mb-5 text-sm">{selectedMarker.description}</Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleGoToSheet}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <Icon as={ExternalLink} className="text-foreground size-4" />
              <Text className="text-foreground text-sm font-semibold">Go to Sheet</Text>
            </Pressable>
            <Pressable
              onPress={onTakePhoto}
              className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
            >
              <Icon as={Camera} className="text-primary-foreground size-4" />
              <Text className="text-primary-foreground text-sm font-semibold">Take Photo Here</Text>
            </Pressable>
          </View>
        </View>
      )}

      <StoryToast
        message={toastMsg ?? ""}
        visible={!!toastMsg}
        onDismiss={() => setToastMsg(null)}
      />

      {showScheduleDrawer && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
          }}
        >
          <Pressable
            onPress={() => setShowScheduleDrawer(false)}
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
              maxHeight: "65%",
              backgroundColor: "#1c1c1c",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <View className="items-center py-3">
              <View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
            </View>
            <View className="flex-row items-start justify-between px-6 pb-3">
              <View className="flex-1">
                <Text className="text-foreground text-2xl font-bold">Schedules</Text>
                <Text className="text-muted-foreground text-sm">
                  {MOCK_SCHEDULE_GROUPS.length} schedules ·{" "}
                  {MOCK_SCHEDULE_GROUPS.reduce((sum, g) => sum + g.entries.length, 0)} entries
                </Text>
              </View>
              <Pressable
                onPress={() => setShowScheduleDrawer(false)}
                className="active:bg-muted/50 -m-2 rounded-full p-2"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon as={X} className="text-muted-foreground size-5" />
              </Pressable>
            </View>
            <ScrollView className="flex-1" showsVerticalScrollIndicator>
              {MOCK_SCHEDULE_GROUPS.map((group) => (
                <Collapsible key={group.id} defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Pressable
                      className="border-border bg-muted/30 active:bg-muted/50 flex-row items-center border-b px-4 py-3"
                      style={{ minHeight: 48 }}
                    >
                      <View className="mr-2">
                        <Icon as={ChevronDown} className="text-muted-foreground size-4" />
                      </View>
                      <Text
                        className="text-foreground flex-1 text-base font-semibold"
                        numberOfLines={1}
                      >
                        {group.title}
                      </Text>
                      <View className="bg-secondary rounded-full px-2 py-0.5">
                        <Text className="text-secondary-foreground text-xs font-semibold">
                          {group.entries.length}
                        </Text>
                      </View>
                      <Text className="text-muted-foreground ml-3 text-sm">
                        {group.sheetNumber}
                      </Text>
                    </Pressable>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {group.entries.map((entry, index) => {
                      const summary = Object.values(entry.properties).slice(0, 2).join("  ")
                      return (
                        <View key={entry.id}>
                          <Pressable
                            className={cn(
                              "flex-row items-center px-4 py-3 active:bg-muted/30",
                              index % 2 === 1 && "bg-muted/10",
                            )}
                            style={{ minHeight: 48 }}
                          >
                            <Text className="text-foreground w-14 text-base font-semibold">
                              {entry.mark}
                            </Text>
                            <Text className="text-foreground flex-1 text-sm" numberOfLines={1}>
                              {summary || "\u2014"}
                            </Text>
                            <Icon as={ChevronRight} className="text-muted-foreground ml-2 size-4" />
                          </Pressable>
                        </View>
                      )
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}

function InlineCamera({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = React.useState<"viewfinder" | "preview">("viewfinder")
  const [isIssueMode, setIsIssueMode] = React.useState(false)
  const [flashOn, setFlashOn] = React.useState(false)
  const [isLinked, setIsLinked] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [recording, setRecording] = React.useState(false)

  if (mode === "preview") {
    return (
      <View
        style={
          {
            minHeight: "100vh",
            position: "relative",
            backgroundColor: "#000",
          } as any
        }
      >
        <Image
          source={{
            uri: "https://picsum.photos/seed/construct99/1080/1920",
          }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          resizeMode="cover"
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            backgroundColor: "rgba(0,0,0,0.7)",
            paddingTop: 16,
            paddingBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className="items-center justify-center rounded-full bg-green-500/20"
                style={{ width: 28, height: 28 }}
              >
                <Icon as={Check} className="size-4 text-green-400" />
              </View>
              <Text className="text-sm font-semibold text-white">Photo Saved</Text>
            </View>
            <Text className="text-muted-foreground text-xs">Just now</Text>
          </View>
          {isLinked && (
            <View className="mt-2 flex-row items-center gap-1.5">
              <Icon as={MapPin} className="text-primary size-3.5" />
              <Text className="text-sm text-white/70">5/A7 - Electrical Junction</Text>
            </View>
          )}
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 120,
            left: 16,
            right: 16,
            zIndex: 20,
            backgroundColor: "rgba(28,28,28,0.95)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            Detected Text
          </Text>
          <Text className="text-foreground mb-3 text-sm leading-relaxed">
            {`"PANEL SCH-2A\n208/120V 3PH 4W\nMLO 225A\nCKT 1: 20A 1P — LIGHTING"`}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <Icon as={Copy} className="size-3.5 text-white/70" />
              <Text className="text-xs font-medium text-white/70">
                {copied ? "Copied!" : "Copy"}
              </Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <Icon as={Edit2} className="size-3.5 text-white/70" />
              <Text className="text-xs font-medium text-white/70">Edit</Text>
            </Pressable>
          </View>
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 40,
            paddingHorizontal: 20,
            zIndex: 20,
          }}
        >
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setMode("viewfinder")}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <Icon as={RotateCcw} className="size-4 text-white" />
              <Text className="text-sm font-semibold text-white">Retake</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setRecording((r) => !r)
                if (!recording) setTimeout(() => setRecording(false), 3000)
              }}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
              style={{
                backgroundColor: recording ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)",
              }}
            >
              <Icon as={Mic} className="size-4 text-white" />
              <Text className="text-sm font-semibold text-white">
                {recording ? "Recording..." : "Add Voice"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              className="bg-primary flex-1 items-center justify-center rounded-xl py-3.5"
            >
              <Text className="text-primary-foreground text-sm font-bold">Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View
      style={
        {
          minHeight: "100vh",
          position: "relative",
          backgroundColor: "#000",
        } as any
      }
    >
      <Image
        source={{
          uri: "https://picsum.photos/seed/constructsite7/1080/1920",
        }}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        resizeMode="cover"
      />
      <View
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Pressable
          onPress={onClose}
          className="items-center justify-center rounded-full"
          style={{
            width: 44,
            height: 44,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setFlashOn((f) => !f)}
            className="items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <Icon as={flashOn ? Zap : ZapOff} className="size-5 text-white" />
          </Pressable>
          <Pressable
            className="items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <Icon as={RotateCcw} className="size-5 text-white" />
          </Pressable>
        </View>
      </View>
      {isIssueMode && (
        <View
          style={{
            position: "absolute",
            top: 76,
            left: 0,
            right: 0,
            zIndex: 15,
            alignItems: "center",
          }}
        >
          <View
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: "rgba(239,68,68,0.85)" }}
          >
            <Icon as={AlertTriangle} className="size-4 text-white" />
            <Text className="text-sm font-bold text-white">Issue Mode</Text>
          </View>
        </View>
      )}
      <View
        style={{
          position: "absolute",
          bottom: 140,
          left: 16,
          right: 16,
          zIndex: 15,
        }}
      >
        {isLinked ? (
          <View
            className="flex-row items-center gap-2 self-center rounded-full px-4 py-2.5"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Icon as={MapPin} className="text-primary size-4" />
            <Text className="text-sm font-medium text-white">5/A7 - Electrical Junction</Text>
          </View>
        ) : (
          <View
            className="flex-row items-center justify-between self-center rounded-full px-4 py-2"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Text className="text-muted-foreground text-sm">Not linked to a callout</Text>
            <Pressable
              onPress={() => setIsLinked(true)}
              className="bg-primary ml-3 rounded-full px-3 py-1.5"
            >
              <Text className="text-primary-foreground text-xs font-semibold">Link to Plan</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 40,
          paddingHorizontal: 24,
          zIndex: 15,
        }}
      >
        <View className="flex-row items-center justify-center">
          <View className="flex-1 items-start">
            <Pressable
              onPress={() => setIsIssueMode((m) => !m)}
              className="flex-row items-center gap-2 rounded-full px-4 py-2.5"
              style={{
                backgroundColor: isIssueMode ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)",
              }}
            >
              <View
                className="rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: isIssueMode ? "#ef4444" : "#666",
                }}
              />
              <Text
                className="text-xs font-semibold"
                style={{ color: isIssueMode ? "#ef4444" : "#999" }}
              >
                Issue
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setMode("preview")}>
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 72,
                height: 72,
                borderWidth: 4,
                borderColor: isIssueMode ? "#ef4444" : "#ffffff",
                backgroundColor: "transparent",
              }}
            >
              <View
                className="rounded-full"
                style={{
                  width: 58,
                  height: 58,
                  backgroundColor: isIssueMode ? "#ef4444" : "#ffffff",
                }}
              />
            </View>
          </Pressable>
          <View className="flex-1" />
        </View>
      </View>
    </View>
  )
}

function PhotoPreview({
  seed,
  onClose,
  metadata,
}: {
  seed: string
  onClose: () => void
  metadata?: PhotoMetadata
}) {
  return (
    <View
      style={
        {
          minHeight: "100vh",
          position: "relative",
          backgroundColor: "#000",
        } as any
      }
    >
      <Image
        source={{ uri: `https://picsum.photos/seed/${seed}/1080/1920` }}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        resizeMode="contain"
      />
      <View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
        <Pressable
          onPress={onClose}
          className="items-center justify-center rounded-full"
          style={{
            width: 44,
            height: 44,
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
        >
          <Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
        </Pressable>
      </View>

      {metadata && (
        <View
          style={{
            position: "absolute",
            bottom: 24,
            left: 16,
            right: 16,
            zIndex: 20,
            backgroundColor: "rgba(28,28,28,0.95)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon as={MapPin} className="size-4 text-white/70" />
              <Text className="text-sm font-semibold text-white">{metadata.markerLabel}</Text>
            </View>
            <Text className="text-xs text-white/50">{metadata.time}</Text>
          </View>

          {metadata.isIssue && (
            <View className="mb-3 flex-row items-center gap-2 self-start rounded-full bg-red-500/20 px-3 py-1.5">
              <Icon as={AlertTriangle} className="size-3.5 text-red-400" />
              <Text className="text-xs font-semibold text-red-400">Issue Flagged</Text>
            </View>
          )}

          {metadata.hasVoiceNote && metadata.voiceNote && (
            <View className="flex-row items-start gap-2 rounded-lg bg-white/5 p-3">
              <Icon as={Mic} className="mt-0.5 size-4 text-blue-400" />
              <View className="flex-1">
                <Text className="mb-1 text-xs text-white/50">{metadata.voiceNote.duration}</Text>
                <Text className="text-sm leading-relaxed text-white/80">
                  {`\u201C${metadata.voiceNote.transcript}\u201D`}
                </Text>
              </View>
              <Pressable className="p-1">
                <Icon as={Play} className="size-4 text-blue-400" />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

type ActiveView = "plans" | "media" | "activity"

function ProjectWorkspace({
  initialTab = "plans",
  mediaEmpty = true,
}: {
  initialTab?: ActiveView
  mediaEmpty?: boolean
}) {
  const [screen, setScreen] = React.useState<WorkspaceScreen>({
    type: "workspace",
  })
  const [activeView, setActiveView] = React.useState<ActiveView>(initialTab)
  const [modal, setModal] = React.useState<"upload-plan" | null>(null)
  const processing = useProcessingState()
  const [showProcessingOverlay, setShowProcessingOverlay] = React.useState(false)
  const [toastMsg, setToastMsg] = React.useState<string | null>(null)

  if (screen.type === "project-settings") {
    return (
      <ProjectSettingsScreen
        onBack={() => setScreen({ type: "workspace" })}
        onNavigateToMembers={() => setScreen({ type: "members" })}
      />
    )
  }

  if (screen.type === "members") {
    return <MembersScreen onBack={() => setScreen({ type: "project-settings" })} />
  }

  if (screen.type === "plan-viewer") {
    return (
      <InlinePlanViewer
        sheet={screen.sheet}
        onClose={() => setScreen({ type: "workspace" })}
        onTakePhoto={() => setScreen({ type: "camera" })}
      />
    )
  }

  if (screen.type === "camera") {
    return <InlineCamera onClose={() => setScreen({ type: "workspace" })} />
  }

  if (screen.type === "photo-preview") {
    return (
      <PhotoPreview
        seed={screen.seed}
        metadata={screen.metadata}
        onClose={() => setScreen({ type: "workspace" })}
      />
    )
  }

  if (screen.type === "rfi") {
    return (
      <RfiDraftScreen
        onBack={() => {
          setScreen({ type: "workspace" })
          setActiveView("media")
        }}
      />
    )
  }

  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View className="bg-background" style={{ paddingTop: 8 }}>
        <View className="min-h-[56px] flex-row items-center justify-between px-4">
          <Pressable
            onPress={() => setToastMsg("Back to Projects")}
            className="-ml-1 items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            <Icon as={ArrowLeft} className="text-foreground size-6" />
          </Pressable>
          <View className="flex-1 items-center justify-center px-2">
            <Text
              className="text-foreground text-center text-base leading-tight font-bold"
              numberOfLines={1}
            >
              Holabird Ave Warehouse
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
              4200 Holabird Ave, Baltimore, MD
            </Text>
          </View>
          <Pressable
            onPress={() => setScreen({ type: "project-settings" })}
            className="-mr-1 items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            <Icon as={Settings} className="text-foreground size-5" />
          </Pressable>
        </View>
        <View className="items-center pt-3 pb-4">
          <StorySegmentedControl
            options={["Plans", "Media", "Activity"]}
            selectedIndex={activeView === "plans" ? 0 : activeView === "media" ? 1 : 2}
            onIndexChange={(index) => {
              if (index === 0) setActiveView("plans")
              else if (index === 1) setActiveView("media")
              else setActiveView("activity")
            }}
          />
        </View>
      </View>

      {activeView === "plans" && (
        <>
          {processing.isProcessing && !showProcessingOverlay && (
            <ProcessingBanner
              stageIndex={processing.stageIndex}
              onPress={() => setShowProcessingOverlay(true)}
            />
          )}
          <PlansTab onSheetPress={(sheet) => setScreen({ type: "plan-viewer", sheet })} />
        </>
      )}
      {activeView === "media" && (
        <MediaTab
          isEmpty={mediaEmpty}
          onPhotoPress={(seed, metadata) => setScreen({ type: "photo-preview", seed, metadata })}
          onGenerateRfi={(markerLabel) => setScreen({ type: "rfi", markerLabel })}
        />
      )}
      {activeView === "activity" && (
        <ActivityTab
          onManagePress={() => setScreen({ type: "members" })}
          onShowToast={setToastMsg}
          onViewFullReport={() => setToastMsg("Navigate to Daily Summary Report")}
        />
      )}

      {activeView !== "activity" && (
        <View
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: 56,
            height: 56,
            zIndex: 50,
          }}
        >
          <Pressable
            onPress={() => {
              if (activeView === "plans") setModal("upload-plan")
              else setScreen({ type: "camera" })
            }}
            className="bg-primary h-14 w-14 items-center justify-center rounded-full"
          >
            <Icon
              as={activeView === "plans" ? Plus : Camera}
              className="text-primary-foreground size-6"
              strokeWidth={2.5}
            />
          </Pressable>
        </View>
      )}

      {modal === "upload-plan" && (
        <UploadPlanOverlay
          onClose={() => setModal(null)}
          onDeviceStorage={() => {
            setModal(null)
            processing.start()
            setShowProcessingOverlay(true)
          }}
        />
      )}
      {showProcessingOverlay && processing.isProcessing && (
        <ProcessingOverlay
          onClose={() => setShowProcessingOverlay(false)}
          stageIndex={processing.stageIndex}
        />
      )}
      <StoryToast
        message={toastMsg ?? ""}
        visible={!!toastMsg}
        onDismiss={() => setToastMsg(null)}
      />
    </View>
  )
}

const meta: Meta<typeof ProjectWorkspace> = {
  title: "Screens/Project Workspace",
  component: ProjectWorkspace,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof ProjectWorkspace>

export const PlansView: Story = {
  args: { initialTab: "plans" },
}

export const MediaView: Story = {
  args: { initialTab: "media", mediaEmpty: false },
}

export const MediaEmptyView: Story = {
  args: { initialTab: "media", mediaEmpty: true },
}

export const ActivityView: Story = {
  args: { initialTab: "activity" },
}

function PlansEmptyState() {
  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View className="bg-background" style={{ paddingTop: 8 }}>
        <View className="min-h-[56px] flex-row items-center justify-between px-4">
          <View style={{ width: 44, height: 44 }} />
          <Text className="text-foreground text-base font-bold">Holabird Ave Warehouse</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>
        <View className="items-center pt-3 pb-4">
          <StorySegmentedControl
            options={["Plans", "Media", "Activity"]}
            selectedIndex={0}
            onIndexChange={() => {}}
          />
        </View>
      </View>
      <Empty className="mx-4 mb-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon as={FileText} className="text-muted-foreground size-8" />
          </EmptyMedia>
          <EmptyTitle>No Plans Yet</EmptyTitle>
          <EmptyDescription>
            Upload your first construction plan to get started with AI-powered detection and search.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </View>
  )
}

export const PlansEmpty: StoryObj<typeof PlansEmptyState> = {
  render: () => <PlansEmptyState />,
}

function ActivityEmptyState() {
  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View className="bg-background" style={{ paddingTop: 8 }}>
        <View className="min-h-[56px] flex-row items-center justify-between px-4">
          <View style={{ width: 44, height: 44 }} />
          <Text className="text-foreground text-base font-bold">Holabird Ave Warehouse</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>
        <View className="items-center pt-3 pb-4">
          <StorySegmentedControl
            options={["Plans", "Media", "Activity"]}
            selectedIndex={2}
            onIndexChange={() => {}}
          />
        </View>
      </View>
      <Empty className="mx-4 mb-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon as={Layers} className="text-muted-foreground size-8" />
          </EmptyMedia>
          <EmptyTitle>No Activity Yet</EmptyTitle>
          <EmptyDescription>
            Activity will appear here as your team works on this project.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </View>
  )
}

export const ActivityEmpty: StoryObj<typeof ActivityEmptyState> = {
  render: () => <ActivityEmptyState />,
}

function WorkspaceLoading() {
  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View className="bg-background" style={{ paddingTop: 8 }}>
        <View className="min-h-[56px] flex-row items-center justify-between px-4">
          <View style={{ width: 44, height: 44 }} />
          <View className="items-center">
            <Skeleton className="mb-1 h-4 w-40" />
            <Skeleton className="h-3 w-48" />
          </View>
          <View style={{ width: 44, height: 44 }} />
        </View>
        <View className="items-center pt-3 pb-4">
          <Skeleton className="h-10 w-64 rounded-full" />
        </View>
      </View>
      <View className="gap-4 px-4">
        {[1, 2].map((i) => (
          <View key={i}>
            <Skeleton className="mb-2 h-12 w-full rounded-xl" />
            <View className="gap-1">
              {[1, 2, 3].map((j) => (
                <View key={j} className="flex-row items-center gap-4 px-2 py-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <View className="flex-1 gap-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-32" />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export const Loading: StoryObj<typeof WorkspaceLoading> = {
  render: () => <WorkspaceLoading />,
}

function MediaLoading() {
  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View className="bg-background" style={{ paddingTop: 8 }}>
        <View className="min-h-[56px] flex-row items-center justify-between px-4">
          <View style={{ width: 44, height: 44 }} />
          <Text className="text-foreground text-base font-bold">Holabird Ave Warehouse</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>
        <View className="items-center pt-3 pb-4">
          <StorySegmentedControl
            options={["Plans", "Media", "Activity"]}
            selectedIndex={1}
            onIndexChange={() => {}}
          />
        </View>
      </View>
      <View className="p-4">
        <Skeleton className="mb-4 h-5 w-16" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <Skeleton key={i} className="rounded-xl" style={{ width: "31%", aspectRatio: 1 }} />
          ))}
        </View>
      </View>
    </View>
  )
}

export const MediaLoadingView: StoryObj<typeof MediaLoading> = {
  render: () => <MediaLoading />,
}
