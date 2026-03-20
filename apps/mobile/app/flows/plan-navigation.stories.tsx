import type { Meta, StoryObj } from "@storybook/react"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Eye,
  Flag,
  Grid3X3,
  Layers,
  MapPin,
  Maximize,
  Plus,
  ShieldAlert,
  StickyNote,
  TableProperties,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react-native"
import * as React from "react"
import { Image, Pressable, ScrollView, View } from "react-native"
import { StoryToast } from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

const MARKER_COLORS = {
  detail: "#22c55e",
  section: "#3b82f6",
  elevation: "#f59e0b",
  note: "#a855f7",
  selected: "#eab308",
} as const

interface CalloutMarker {
  id: string
  label: string
  type: keyof typeof MARKER_COLORS
  targetSheet: string
  targetSheetTitle: string
  detailNumber: string
  confidence: number
  description: string
  top: string
  left: string
  width: string
  height: string
}

const MOCK_MARKERS: CalloutMarker[] = [
  {
    id: "m1",
    label: "5/A7",
    type: "detail",
    targetSheet: "S2.0",
    targetSheetTitle: "Structural Details",
    detailNumber: "5",
    confidence: 0.96,
    description: "Footing connection detail at grid line A7",
    top: "52%",
    left: "7%",
    width: "6%",
    height: "4%",
  },
  {
    id: "m2",
    label: "3/A2",
    type: "section",
    targetSheet: "S3.0",
    targetSheetTitle: "Sections & Elevations",
    detailNumber: "3",
    confidence: 0.91,
    description: "Stage framing section cut through grid B",
    top: "60%",
    left: "18%",
    width: "8%",
    height: "5%",
  },
  {
    id: "m3",
    label: "2/A1",
    type: "detail",
    targetSheet: "S2.0",
    targetSheetTitle: "Structural Details",
    detailNumber: "2",
    confidence: 0.73,
    description: "Strip footing detail \u2014 low confidence match",
    top: "42%",
    left: "28%",
    width: "5%",
    height: "4%",
  },
  {
    id: "m4",
    label: "E1",
    type: "elevation",
    targetSheet: "S3.0",
    targetSheetTitle: "Sections & Elevations",
    detailNumber: "E1",
    confidence: 0.45,
    description: "North elevation \u2014 may be incorrect",
    top: "30%",
    left: "65%",
    width: "7%",
    height: "5%",
  },
]

interface ScheduleEntry {
  id: string
  mark: string
  confidence: number
  properties: Record<string, string>
}

interface ScheduleGroup {
  id: string
  title: string
  sheetNumber: string
  entries: ScheduleEntry[]
}

const MOCK_SCHEDULE_GROUPS: ScheduleGroup[] = [
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

const SHEETS = [
  { id: "s1", number: "S1.0", title: "Foundation Plan", markerCount: 4 },
  { id: "s2", number: "S2.0", title: "Structural Details", markerCount: 6 },
  { id: "s3", number: "S3.0", title: "Sections & Elevations", markerCount: 3 },
  { id: "s4", number: "S4.0", title: "Schedules", markerCount: 0 },
]

interface PlanRegion {
  id: string
  label: string
  type: "schedule" | "notes" | "legend"
  content: string
  top: string
  left: string
  width: string
  height: string
}

const MOCK_REGIONS: PlanRegion[] = [
  {
    id: "r1",
    label: "Slab on Grade Schedule",
    type: "schedule",
    content: '4 entries: SL1 (6" slab, 4000 PSI), SL2 (8" slab), SL3 (6" slab), SL4 (10" slab)',
    top: "68%",
    left: "55%",
    width: "38%",
    height: "18%",
  },
  {
    id: "r2",
    label: "General Notes",
    type: "notes",
    content:
      "1. All concrete shall be 4000 PSI min.\n2. Reinforcement per ACI 318.\n3. Verify all dimensions in field.",
    top: "12%",
    left: "60%",
    width: "32%",
    height: "14%",
  },
  {
    id: "r3",
    label: "Legend",
    type: "legend",
    content: "Detail callout, Section cut, Elevation marker, Grid line",
    top: "88%",
    left: "4%",
    width: "25%",
    height: "8%",
  },
]

const REGION_COLORS = {
  schedule: "#a855f7",
  notes: "#3b82f6",
  legend: "#f59e0b",
} as const

const REGION_ICONS = {
  schedule: TableProperties,
  notes: StickyNote,
  legend: Layers,
} as const

interface Project {
  id: string
  name: string
  sheetCount: number
  lastUpdated: string
}

const MOCK_PROJECTS: Project[] = [
  { id: "p1", name: "Riverside Commons Phase 2", sheetCount: 12, lastUpdated: "2 hours ago" },
  { id: "p2", name: "Oak Park Elementary Addition", sheetCount: 8, lastUpdated: "Yesterday" },
  { id: "p3", name: "Metro Station Retrofit", sheetCount: 24, lastUpdated: "3 days ago" },
  { id: "p4", name: "Harbor View Condominiums", sheetCount: 16, lastUpdated: "1 week ago" },
]

function MarkerOverlay({
  marker,
  isSelected,
  onPress,
}: {
  marker: CalloutMarker
  isSelected?: boolean
  onPress: () => void
}) {
  const color = isSelected ? MARKER_COLORS.selected : MARKER_COLORS[marker.type]
  const isLowConfidence = marker.confidence < 0.8
  const fillAlpha = isSelected
    ? "rgba(234,179,8,0.15)"
    : color === "#a855f7"
      ? "rgba(168,85,247,0.15)"
      : "transparent"
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        top: marker.top as any,
        left: marker.left as any,
        width: marker.width as any,
        height: marker.height as any,
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: 6,
        borderStyle: isLowConfidence ? "dashed" : "solid",
        backgroundColor: fillAlpha,
        zIndex: 5,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -26,
          left: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
        }}
      >
        <View
          style={{
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: color + "26",
            borderWidth: 1.5,
            borderColor: color,
          }}
        >
          <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{marker.label}</Text>
        </View>
        {isLowConfidence && (
          <View
            style={{
              backgroundColor: "rgba(234,88,12,0.9)",
              borderRadius: 4,
              paddingHorizontal: 4,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>?</Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  if (confidence >= 0.9)
    return (
      <View
        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ backgroundColor: "rgba(22,163,74,0.15)" }}
      >
        <View className="size-1.5 rounded-full bg-green-500" />
        <Text style={{ color: "#16a34a" }} className="text-xs font-semibold">
          {Math.round(confidence * 100)}% match
        </Text>
      </View>
    )
  if (confidence >= 0.8)
    return (
      <View
        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ backgroundColor: "rgba(202,138,4,0.15)" }}
      >
        <View className="size-1.5 rounded-full bg-yellow-500" />
        <Text style={{ color: "#ca8a04" }} className="text-xs font-semibold">
          {Math.round(confidence * 100)}% match
        </Text>
      </View>
    )
  if (confidence >= 0.6)
    return (
      <View
        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ backgroundColor: "rgba(234,88,12,0.15)" }}
      >
        <Icon as={AlertTriangle} style={{ color: "#ea580c" }} className="size-3" />
        <Text style={{ color: "#ea580c" }} className="text-xs font-semibold">
          {Math.round(confidence * 100)}% — verify on sheet
        </Text>
      </View>
    )
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: "rgba(239,68,68,0.15)" }}
    >
      <Icon as={ShieldAlert} style={{ color: "#ef4444" }} className="size-3" />
      <Text style={{ color: "#ef4444" }} className="text-xs font-semibold">
        {Math.round(confidence * 100)}% — likely incorrect
      </Text>
    </View>
  )
}

function CalloutDetailSheet({
  marker,
  onClose,
  onGoToDetail,
  onTakePhoto,
  onReportWrong,
}: {
  marker: CalloutMarker
  onClose: () => void
  onGoToDetail: () => void
  onTakePhoto?: () => void
  onReportWrong?: () => void
}) {
  const color = MARKER_COLORS[marker.type]
  const isLowConfidence = marker.confidence < 0.8

  return (
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
      <Pressable onPress={onClose} className="mb-4 items-center">
        <View className="bg-muted h-1 w-10 rounded-full" />
      </Pressable>

      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-row items-center gap-2.5">
          <View
            className="items-center justify-center rounded-lg"
            style={{ width: 40, height: 40, backgroundColor: color + "20" }}
          >
            <Text style={{ color, fontSize: 16, fontWeight: "800" }}>{marker.detailNumber}</Text>
          </View>
          <View>
            <Text className="text-foreground text-lg font-bold">{marker.label}</Text>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: color + "20" }}>
              <Text style={{ color, fontSize: 11, fontWeight: "600" }}>
                {marker.type.charAt(0).toUpperCase() + marker.type.slice(1)}
              </Text>
            </View>
          </View>
        </View>
        <ConfidenceIndicator confidence={marker.confidence} />
      </View>

      <View
        className="mb-3 flex-row items-center gap-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      >
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Destination
          </Text>
          <Text className="text-foreground mt-0.5 text-base font-semibold">
            Sheet {marker.targetSheet}
          </Text>
          <Text className="text-muted-foreground text-sm">{marker.targetSheetTitle}</Text>
        </View>
        <View
          className="items-center justify-center overflow-hidden rounded-lg"
          style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <Image
            source={{ uri: "/plan-sample.png" }}
            style={{ width: 64, height: 64 }}
            resizeMode="cover"
          />
        </View>
      </View>

      <Text className="text-muted-foreground mb-4 text-sm">{marker.description}</Text>

      {isLowConfidence && (
        <View
          className="mb-4 flex-row items-start gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: "rgba(234,88,12,0.08)" }}
        >
          <Icon as={AlertTriangle} style={{ color: "#ea580c" }} className="mt-0.5 size-4" />
          <View className="flex-1">
            <Text style={{ color: "#ea580c" }} className="text-sm font-semibold">
              {marker.confidence < 0.6 ? "Link may be incorrect" : "Low confidence match"}
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {marker.confidence < 0.6
                ? "Our AI couldn't confidently match this callout. Please verify manually."
                : "Double-check the detail number matches what you expect."}
            </Text>
          </View>
        </View>
      )}

      <View className="flex-row gap-3">
        <Pressable
          onPress={onGoToDetail}
          className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
        >
          <Icon as={ExternalLink} className="text-primary-foreground size-4" />
          <Text className="text-primary-foreground text-sm font-bold">Go to Detail</Text>
        </Pressable>
        <Pressable
          onPress={onTakePhoto}
          className="flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <Icon as={Camera} className="text-foreground size-4" />
          <Text className="text-foreground text-sm font-semibold">Photo</Text>
        </Pressable>
      </View>

      {isLowConfidence && (
        <Pressable
          onPress={onReportWrong}
          className="mt-3 flex-row items-center justify-center gap-2 py-2"
        >
          <Icon as={Flag} className="text-muted-foreground size-3.5" />
          <Text className="text-muted-foreground text-xs font-medium">Report wrong link</Text>
        </Pressable>
      )}
    </View>
  )
}

function NavigationBreadcrumb({
  fromSheet,
  fromLabel,
  onGoBack,
}: {
  fromSheet: string
  fromLabel: string
  onGoBack: () => void
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: 16,
        left: 68,
        right: 68,
        zIndex: 25,
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={onGoBack}
        className="flex-row items-center gap-2 rounded-full px-4 py-2.5 active:opacity-80"
        style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      >
        <Icon as={ArrowLeft} className="size-4 text-white" />
        <Text className="text-sm font-semibold text-white">Back to {fromSheet}</Text>
        <View
          className="ml-1 rounded-full px-1.5 py-0.5"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
        >
          <Text className="text-xs text-white/70">{fromLabel}</Text>
        </View>
      </Pressable>
    </View>
  )
}

function DestinationHighlight({ detailNumber, color }: { detailNumber: string; color: string }) {
  return (
    <View
      style={{
        position: "absolute",
        top: "35%",
        left: "20%",
        width: "30%",
        height: "25%",
        borderWidth: 3,
        borderColor: color,
        borderRadius: 8,
        backgroundColor: color + "10",
        zIndex: 5,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -6,
          left: -6,
          right: -6,
          bottom: -6,
          borderWidth: 2,
          borderColor: color + "40",
          borderRadius: 11,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: -28,
          left: 0,
          backgroundColor: color,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Icon as={Check} style={{ color: "#fff" }} className="size-3" />
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
          Detail {detailNumber}
        </Text>
      </View>
    </View>
  )
}

function WrongLinkSheet({
  marker,
  onClose,
  onSubmit,
}: {
  marker: CalloutMarker
  onClose: () => void
  onSubmit: () => void
}) {
  const [selectedReason, setSelectedReason] = React.useState<string | null>(null)
  const reasons = [
    { id: "wrong-sheet", label: "Points to wrong sheet" },
    { id: "wrong-detail", label: "Wrong detail number" },
    { id: "not-a-callout", label: "Not actually a callout" },
    { id: "other", label: "Other issue" },
  ]

  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 50 }}>
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
            <Text className="text-foreground text-lg font-bold">Report Issue</Text>
            <Text className="text-muted-foreground text-sm">
              Help improve callout detection for {marker.label}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
          >
            <Icon as={X} className="text-foreground size-5" />
          </Pressable>
        </View>
        <View className="gap-2 px-6 pt-2 pb-6">
          {reasons.map((reason) => (
            <Pressable
              key={reason.id}
              onPress={() => setSelectedReason(reason.id)}
              className={cn(
                "flex-row items-center gap-3 rounded-xl border-2 px-4 py-3.5",
                selectedReason === reason.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/5",
              )}
            >
              <View
                className={cn(
                  "size-5 items-center justify-center rounded-full border-2",
                  selectedReason === reason.id
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30",
                )}
              >
                {selectedReason === reason.id && <View className="size-2 rounded-full bg-white" />}
              </View>
              <Text
                className={cn(
                  "text-sm font-medium",
                  selectedReason === reason.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {reason.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onSubmit}
            disabled={!selectedReason}
            className={cn(
              "mt-2 flex-row items-center justify-center gap-2 rounded-xl py-3.5",
              selectedReason ? "bg-primary" : "bg-muted/20",
            )}
          >
            <Icon
              as={Flag}
              className={cn(
                "size-4",
                selectedReason ? "text-primary-foreground" : "text-muted-foreground",
              )}
            />
            <Text
              className={cn(
                "text-sm font-bold",
                selectedReason ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Submit Report
            </Text>
          </Pressable>
          <Text className="text-muted-foreground mt-1 text-center text-xs">
            Reports help our AI learn. The link will be flagged for review.
          </Text>
        </View>
      </View>
    </View>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const badge =
    confidence >= 0.9
      ? { label: "High", color: "#16a34a", bg: "rgba(22,163,74,0.15)" }
      : confidence >= 0.8
        ? { label: "Medium", color: "#ca8a04", bg: "rgba(202,138,4,0.15)" }
        : { label: "Review", color: "#ea580c", bg: "rgba(234,88,12,0.15)" }
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
      <Text style={{ color: badge.color }} className="text-xs font-semibold">
        {Math.round(confidence * 100)}% {badge.label}
      </Text>
    </View>
  )
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function ScheduleRow({ entry, index }: { entry: ScheduleEntry; index: number }) {
  const [expanded, setExpanded] = React.useState(false)
  const summary = Object.values(entry.properties).slice(0, 2).join("  ")

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((p) => !p)}
        className={cn(
          "flex-row items-center px-4 py-3 active:bg-muted/30",
          index % 2 === 1 && "bg-muted/10",
        )}
        style={{ minHeight: 48 }}
      >
        <Text className="text-foreground w-14 text-base font-semibold">{entry.mark}</Text>
        <Text className="text-foreground flex-1 text-sm" numberOfLines={1}>
          {summary || "\u2014"}
        </Text>
        <View className={cn("ml-2 transition-transform", expanded && "rotate-90")}>
          <Icon as={ChevronRight} className="text-muted-foreground size-4" />
        </View>
      </Pressable>
      {expanded && (
        <View className={cn("px-4 pb-4", index % 2 === 1 && "bg-muted/10")}>
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} className="mb-3" />
          <View className="gap-3 px-2">
            {Object.entries(entry.properties).map(([key, value]) => (
              <View key={key}>
                <Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {formatLabel(key)}
                </Text>
                <Text className="text-foreground mt-0.5 text-base">{value || "\u2014"}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} className="my-3" />
          <View className="flex-row items-center justify-between px-2">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-muted-foreground text-sm">Confidence:</Text>
              <ConfidenceBadge confidence={entry.confidence} />
            </View>
          </View>
          <View className="mt-3 px-2">
            <Pressable className="bg-primary h-12 flex-row items-center justify-center gap-2 rounded-lg">
              <Icon as={Eye} className="text-primary-foreground size-5" />
              <Text className="text-primary-foreground text-base font-semibold">View on Sheet</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

function ScheduleGroupSection({ group }: { group: ScheduleGroup }) {
  const [isOpen, setIsOpen] = React.useState(true)
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Pressable
          className="border-border bg-muted/30 active:bg-muted/50 flex-row items-center border-b px-4 py-3"
          style={{ minHeight: 48 }}
        >
          <View className="mr-2">
            <Icon
              as={isOpen ? ChevronDown : ChevronRight}
              className="text-muted-foreground size-4"
            />
          </View>
          <Text className="text-foreground flex-1 text-base font-semibold" numberOfLines={1}>
            {group.title}
          </Text>
          <View className="bg-secondary rounded-full px-2 py-0.5">
            <Text className="text-secondary-foreground text-xs font-semibold">
              {group.entries.length}
            </Text>
          </View>
          <Text className="text-muted-foreground ml-3 text-sm">{group.sheetNumber}</Text>
        </Pressable>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.entries.map((entry, index) => (
          <ScheduleRow key={entry.id} entry={entry} index={index} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ScheduleDrawerPanel({ onClose }: { onClose: () => void }) {
  const totalEntries = MOCK_SCHEDULE_GROUPS.reduce((sum, g) => sum + g.entries.length, 0)
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
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
              {MOCK_SCHEDULE_GROUPS.length} schedules · {totalEntries} entries
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="active:bg-muted/50 -m-2 rounded-full p-2"
            style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Icon as={X} className="text-muted-foreground size-5" />
          </Pressable>
        </View>
        <ScrollView className="flex-1" showsVerticalScrollIndicator>
          {MOCK_SCHEDULE_GROUPS.map((group) => (
            <ScheduleGroupSection key={group.id} group={group} />
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

function SheetPickerSheet({
  currentSheet,
  onSelect,
  onClose,
}: {
  currentSheet: string
  onSelect: (sheet: (typeof SHEETS)[0]) => void
  onClose: () => void
}) {
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
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
        <View className="flex-row items-center justify-between px-6 pb-3">
          <Text className="text-foreground text-lg font-bold">Sheets</Text>
          <Pressable
            onPress={onClose}
            className="bg-muted/20 size-8 items-center justify-center rounded-full"
          >
            <Icon as={X} className="text-foreground size-5" />
          </Pressable>
        </View>
        <ScrollView className="pb-8">
          {SHEETS.map((sheet) => (
            <Pressable
              key={sheet.id}
              onPress={() => onSelect(sheet)}
              className={cn(
                "active:bg-muted/20 flex-row items-center gap-3 px-6 py-3.5",
                sheet.number === currentSheet && "bg-primary/5",
              )}
            >
              <View
                className="items-center justify-center overflow-hidden rounded-lg"
                style={{ width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <Image
                  source={{ uri: "/plan-sample.png" }}
                  style={{ width: 44, height: 44 }}
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-sm font-bold">{sheet.number}</Text>
                <Text className="text-muted-foreground text-xs">{sheet.title}</Text>
              </View>
              {sheet.markerCount > 0 && (
                <View
                  className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Icon as={MapPin} className="text-primary size-3" />
                  <Text className="text-muted-foreground text-xs">{sheet.markerCount}</Text>
                </View>
              )}
              {sheet.number === currentSheet && <Icon as={Check} className="text-primary size-4" />}
            </Pressable>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </View>
  )
}

function RegionOverlay({ region, onPress }: { region: PlanRegion; onPress: () => void }) {
  const color = REGION_COLORS[region.type]
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        top: region.top as any,
        left: region.left as any,
        width: region.width as any,
        height: region.height as any,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 8,
        borderStyle: "dashed",
        backgroundColor: color + "10",
        zIndex: 4,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -24,
          left: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <View
          className="flex-row items-center gap-1.5 rounded-md px-2 py-1"
          style={{ backgroundColor: color + "30" }}
        >
          <Icon as={REGION_ICONS[region.type]} style={{ color }} className="size-3" />
          <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{region.label}</Text>
        </View>
      </View>
    </Pressable>
  )
}

function RegionDetailSheet({ region, onClose }: { region: PlanRegion; onClose: () => void }) {
  const color = REGION_COLORS[region.type]
  const RegionIcon = REGION_ICONS[region.type]
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
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
        <View className="px-6 pb-6">
          <View className="mb-4 flex-row items-center gap-3">
            <View
              className="items-center justify-center rounded-xl"
              style={{ width: 40, height: 40, backgroundColor: color + "20" }}
            >
              <Icon as={RegionIcon} style={{ color }} className="size-5" />
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-lg font-bold">{region.label}</Text>
              <Text className="text-muted-foreground text-sm">
                {region.type.charAt(0).toUpperCase() + region.type.slice(1)} region
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="bg-muted/20 size-8 items-center justify-center rounded-full"
            >
              <Icon as={X} className="text-foreground size-5" />
            </Pressable>
          </View>
          <Text
            className="text-foreground text-sm leading-relaxed"
            style={{ whiteSpace: "pre-line" } as any}
          >
            {region.content}
          </Text>
          {region.type === "schedule" && (
            <Pressable className="bg-primary mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3.5">
              <Icon as={TableProperties} className="text-primary-foreground size-4" />
              <Text className="text-primary-foreground text-sm font-bold">Open Full Schedule</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}

function ProjectSelectorSheet({
  activeProjectId,
  onSelect,
  onClose,
}: {
  activeProjectId: string
  onSelect: (project: Project) => void
  onClose: () => void
}) {
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
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
        <View className="flex-row items-center justify-between px-6 pb-4">
          <View>
            <Text className="text-foreground text-lg font-bold">Switch Project</Text>
            <Text className="text-muted-foreground text-sm">{MOCK_PROJECTS.length} projects</Text>
          </View>
          <Pressable
            onPress={onClose}
            className="bg-muted/20 size-8 items-center justify-center rounded-full"
          >
            <Icon as={X} className="text-foreground size-5" />
          </Pressable>
        </View>
        <ScrollView className="pb-8">
          {MOCK_PROJECTS.map((project) => {
            const isActive = project.id === activeProjectId
            return (
              <Pressable
                key={project.id}
                onPress={() => onSelect(project)}
                className="active:bg-muted/20 flex-row items-center gap-3 px-6 py-3.5"
                style={isActive ? { backgroundColor: "rgba(59,130,246,0.05)" } : undefined}
              >
                <View
                  className="items-center justify-center rounded-xl"
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: isActive ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <Icon
                    as={Building2}
                    className="size-5"
                    style={{ color: isActive ? "#3b82f6" : "rgba(255,255,255,0.4)" }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-bold">{project.name}</Text>
                  <View className="mt-0.5 flex-row items-center gap-2">
                    <Text className="text-muted-foreground text-xs">
                      {project.sheetCount} sheets
                    </Text>
                    <Text className="text-muted-foreground text-xs">·</Text>
                    <Text className="text-muted-foreground text-xs">{project.lastUpdated}</Text>
                  </View>
                </View>
                {isActive && <Icon as={Check} className="text-primary size-5" />}
                <Icon as={ChevronRight} className="text-muted-foreground size-4" />
              </Pressable>
            )
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </View>
  )
}

type ViewState =
  | "browsing"
  | "marker-selected"
  | "navigating"
  | "destination"
  | "report-wrong"
  | "schedule-drawer"
  | "sheet-picker"
  | "regions"
  | "region-detail"
  | "project-selector"

function PlanNavigationFlow({
  initialState = "browsing" as ViewState,
  initialMarker,
  initialRegionsVisible = false,
}: {
  initialState?: ViewState
  initialMarker?: string
  initialRegionsVisible?: boolean
}) {
  const [viewState, setViewState] = React.useState<ViewState>(initialState)
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | undefined>(initialMarker)
  const [currentSheet, setCurrentSheet] = React.useState("S1.0")
  const [fromSheet, setFromSheet] = React.useState("S1.0")
  const [toastMsg, setToastMsg] = React.useState("")
  const [regionsVisible, setRegionsVisible] = React.useState(
    initialRegionsVisible || initialState === "regions" || initialState === "region-detail",
  )
  const [selectedRegionId, setSelectedRegionId] = React.useState<string | undefined>(
    initialState === "region-detail" ? "r1" : undefined,
  )
  const [activeProjectId, setActiveProjectId] = React.useState("p1")
  const selectedRegion = selectedRegionId
    ? MOCK_REGIONS.find((r) => r.id === selectedRegionId)
    : undefined

  const selectedMarker = selectedMarkerId
    ? MOCK_MARKERS.find((m) => m.id === selectedMarkerId)
    : undefined
  const isOnDestination = viewState === "destination" || viewState === "navigating"

  const handleMarkerPress = (id: string) => {
    setSelectedMarkerId((prev) => (prev === id ? undefined : id))
    setViewState(id === selectedMarkerId ? "browsing" : "marker-selected")
  }

  const handleGoToDetail = () => {
    if (!selectedMarker) return
    setViewState("navigating")
    setFromSheet(currentSheet)
    setTimeout(() => {
      setCurrentSheet(selectedMarker.targetSheet)
      setViewState("destination")
    }, 800)
  }

  const handleGoBack = () => {
    setCurrentSheet(fromSheet)
    setViewState("browsing")
    setSelectedMarkerId(undefined)
  }

  return (
    <View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
      <Image
        source={{ uri: "/plan-sample.png" }}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          opacity: viewState === "navigating" ? 0.3 : 1,
        }}
        resizeMode="contain"
      />

      {viewState === "navigating" && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
        >
          <View className="items-center gap-3">
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 56, height: 56, backgroundColor: "rgba(34,197,94,0.15)" }}
            >
              <Icon as={ExternalLink} style={{ color: "#22c55e" }} className="size-7" />
            </View>
            <Text className="text-lg font-bold text-white">
              Going to {selectedMarker?.targetSheet}
            </Text>
            <Text className="text-muted-foreground text-sm">
              Detail {selectedMarker?.detailNumber}
            </Text>
          </View>
        </View>
      )}

      {!isOnDestination &&
        MOCK_MARKERS.map((marker) => (
          <MarkerOverlay
            key={marker.id}
            marker={marker}
            isSelected={marker.id === selectedMarkerId}
            onPress={() => handleMarkerPress(marker.id)}
          />
        ))}

      {regionsVisible &&
        !isOnDestination &&
        MOCK_REGIONS.map((region) => (
          <RegionOverlay
            key={region.id}
            region={region}
            onPress={() => {
              setSelectedRegionId(region.id)
              setViewState("region-detail")
            }}
          />
        ))}

      {viewState === "destination" && selectedMarker && (
        <DestinationHighlight
          detailNumber={selectedMarker.detailNumber}
          color={MARKER_COLORS[selectedMarker.type]}
        />
      )}

      {viewState === "destination" && selectedMarker && (
        <NavigationBreadcrumb
          fromSheet={fromSheet}
          fromLabel={selectedMarker.label}
          onGoBack={handleGoBack}
        />
      )}

      {/* Nav pill - top left */}
      <View style={{ position: "absolute", top: 52, left: 12, zIndex: 20 }}>
        <Pressable
          onPress={() => {
            setSelectedMarkerId(undefined)
            setViewState("browsing")
          }}
          className="flex-row items-center"
          style={{
            backgroundColor: "rgba(0,0,0,0.72)",
            borderRadius: 18,
            height: 36,
            gap: 8,
            paddingHorizontal: 14,
          }}
        >
          <Icon as={ChevronLeft} style={{ color: "#ffffff" }} className="size-4" />
          <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>
            {currentSheet} · {SHEETS.find((s) => s.number === currentSheet)?.title ?? ""}
          </Text>
        </Pressable>
      </View>

      {/* Zoom pill - top right */}
      <View style={{ position: "absolute", top: 52, right: 12, zIndex: 20 }}>
        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.72)",
            borderRadius: 18,
            height: 36,
            width: 60,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#ebebeb",
              fontSize: 13,
              fontWeight: "500",
              fontVariant: ["tabular-nums"] as any,
            }}
          >
            {isOnDestination ? "100%" : "42%"}
          </Text>
        </View>
      </View>

      {/* Right toolbar - vertical glass capsule */}
      <View
        style={{
          position: "absolute",
          top: 120,
          right: 12,
          zIndex: 20,
          backgroundColor: "rgba(0,0,0,0.72)",
          borderRadius: 24,
          padding: 4,
          gap: 2,
          width: 44,
        }}
      >
        {([ZoomIn, ZoomOut, Maximize, Crosshair, Grid3X3] as const).map((IconComp, i) => (
          <Pressable
            key={i}
            className="items-center justify-center"
            style={{ width: 36, height: 44, borderRadius: 22 }}
          >
            <Icon as={IconComp} className="size-5 text-white" />
          </Pressable>
        ))}
        <Pressable
          onPress={() => setViewState("schedule-drawer")}
          className="items-center justify-center"
          style={{ width: 36, height: 44, borderRadius: 22 }}
        >
          <Icon as={TableProperties} className="size-5 text-white" />
        </Pressable>
        <Pressable
          onPress={() => {
            setRegionsVisible((v) => !v)
            setToastMsg(regionsVisible ? "Regions hidden" : "Regions visible")
          }}
          className="items-center justify-center"
          style={{
            width: 36,
            height: 44,
            borderRadius: 22,
            backgroundColor: regionsVisible ? "rgba(168,85,247,0.25)" : "transparent",
          }}
        >
          <Icon
            as={Layers}
            className="size-5"
            style={{ color: regionsVisible ? "#a855f7" : "#ffffff" }}
          />
        </Pressable>
      </View>

      {/* FAB - add photo */}
      <View style={{ position: "absolute", bottom: 80, right: 16, zIndex: 15 }}>
        <Pressable
          className="bg-primary items-center justify-center rounded-full"
          style={{ width: 52, height: 52 }}
        >
          <Icon as={Plus} className="text-primary-foreground size-6" strokeWidth={2.5} />
        </Pressable>
      </View>

      {viewState === "browsing" && !selectedMarker && (
        <View
          style={{
            position: "absolute",
            bottom: 24,
            left: 12,
            right: 12,
            zIndex: 10,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => setViewState("sheet-picker")}
            className="flex-row items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.72)",
              borderRadius: 18,
              height: 36,
              gap: 6,
              paddingHorizontal: 14,
            }}
          >
            <Icon as={MapPin} style={{ color: "#ebebeb" }} className="size-3.5" />
            <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>
              {currentSheet}
            </Text>
            <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "400" }}>
              {SHEETS.find((s) => s.number === currentSheet)?.title}
            </Text>
            <Icon
              as={ChevronDown}
              style={{ color: "rgba(255,255,255,0.4)" }}
              className="size-3.5"
            />
          </Pressable>
          <View
            className="flex-row items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.72)",
              borderRadius: 18,
              height: 36,
              gap: 6,
              paddingHorizontal: 14,
            }}
          >
            <Icon as={MapPin} className="text-primary size-3.5" />
            <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>
              {MOCK_MARKERS.length}
            </Text>
          </View>
        </View>
      )}

      {viewState === "destination" && selectedMarker && (
        <View style={{ position: "absolute", bottom: 24, left: 12, right: 12, zIndex: 10 }}>
          <View
            className="flex-row items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.72)",
              borderRadius: 18,
              height: 36,
              gap: 6,
              paddingHorizontal: 14,
            }}
          >
            <Icon as={MapPin} style={{ color: "#ebebeb" }} className="size-3.5" />
            <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>
              {selectedMarker.targetSheet}
            </Text>
            <Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "400" }}>
              {selectedMarker.targetSheetTitle}
            </Text>
          </View>
        </View>
      )}

      {viewState === "marker-selected" && selectedMarker && (
        <CalloutDetailSheet
          marker={selectedMarker}
          onClose={() => {
            setSelectedMarkerId(undefined)
            setViewState("browsing")
          }}
          onGoToDetail={handleGoToDetail}
          onTakePhoto={() => setToastMsg("Opening camera...")}
          onReportWrong={() => setViewState("report-wrong")}
        />
      )}

      {viewState === "report-wrong" && selectedMarker && (
        <WrongLinkSheet
          marker={selectedMarker}
          onClose={() => setViewState("marker-selected")}
          onSubmit={() => {
            setToastMsg("Report submitted")
            setViewState("browsing")
            setSelectedMarkerId(undefined)
          }}
        />
      )}

      {viewState === "schedule-drawer" && (
        <ScheduleDrawerPanel onClose={() => setViewState("browsing")} />
      )}

      {viewState === "sheet-picker" && (
        <SheetPickerSheet
          currentSheet={currentSheet}
          onSelect={(sheet) => {
            setCurrentSheet(sheet.number)
            setViewState("browsing")
            setToastMsg(`Switched to ${sheet.number}`)
          }}
          onClose={() => setViewState("browsing")}
        />
      )}

      {viewState === "region-detail" && selectedRegion && (
        <RegionDetailSheet
          region={selectedRegion}
          onClose={() => {
            setSelectedRegionId(undefined)
            setViewState("browsing")
          }}
        />
      )}

      {viewState === "project-selector" && (
        <ProjectSelectorSheet
          activeProjectId={activeProjectId}
          onSelect={(project) => {
            setActiveProjectId(project.id)
            setViewState("browsing")
            setToastMsg(`Switched to ${project.name}`)
          }}
          onClose={() => setViewState("browsing")}
        />
      )}

      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof PlanNavigationFlow> = {
  title: "Flows/2. Plan Navigation",
  component: PlanNavigationFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof PlanNavigationFlow>

export const BrowseSheet: Story = {
  name: "1. Browse Sheet with Markers",
  args: { initialState: "browsing" },
}

export const TapCalloutHighConfidence: Story = {
  name: "2. Tap Callout — High Confidence",
  args: { initialState: "marker-selected", initialMarker: "m1" },
}

export const TapCalloutLowConfidence: Story = {
  name: "3. Tap Callout — Low Confidence",
  args: { initialState: "marker-selected", initialMarker: "m3" },
}

export const ArrivedAtDestination: Story = {
  name: "4. Navigated to Destination",
  args: { initialState: "destination", initialMarker: "m1" },
}

export const ScheduleDrawer: Story = {
  name: "5. Schedule Drawer",
  args: { initialState: "schedule-drawer" },
}

export const ReportWrongLink: Story = {
  name: "6. Report Wrong Link",
  args: { initialState: "report-wrong", initialMarker: "m3" },
}

export const RegionOverlays: Story = {
  name: "7. Region Overlays on Sheet",
  args: { initialState: "browsing", initialRegionsVisible: true },
}

export const RegionTapped: Story = {
  name: "8. Region Detail — Schedule",
  args: { initialState: "region-detail", initialRegionsVisible: true },
}

export const ProjectSelector: Story = {
  name: "9. Project Selector",
  args: { initialState: "project-selector" },
}

export const FullFlow: Story = {
  name: "Full Flow",
  args: { initialState: "browsing" },
}
