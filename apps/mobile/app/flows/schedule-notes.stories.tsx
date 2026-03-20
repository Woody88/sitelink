import type { Meta, StoryObj } from "@storybook/react"
import { ArrowLeft, Check, ChevronRight, Copy, Eye, ImageOff, Layers, X } from "lucide-react-native"
import * as React from "react"
import { Image, Pressable, ScrollView, View } from "react-native"
import { StoryToast } from "@/app/_story-components"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface ScheduleEntry {
  id: string
  mark: string
  scheduleType: string
  confidence: number
  properties: Record<string, string>
}

interface Region {
  id: string
  regionClass: "schedule" | "notes" | "legend"
  regionTitle: string
  sheetNumber: string
  confidence: number
  entries?: ScheduleEntry[]
  notesContent?: string
  legendImageUrl?: string
}

const MOCK_ENTRIES_FOOTING: ScheduleEntry[] = [
  {
    id: "e1",
    mark: "F1",
    scheduleType: "footing",
    confidence: 0.94,
    properties: {
      size: '24" x 12"',
      reinforcing: "4-#5 E.W.",
      concrete: "4000 PSI",
      notes: "Standard footing",
    },
  },
  {
    id: "e2",
    mark: "F2",
    scheduleType: "footing",
    confidence: 0.92,
    properties: {
      size: '36" x 18"',
      reinforcing: "5-#6 E.W.",
      concrete: "4000 PSI",
      notes: "Heavy load footing",
    },
  },
  {
    id: "e3",
    mark: "F3",
    scheduleType: "footing",
    confidence: 0.88,
    properties: {
      size: '30" x 15"',
      reinforcing: "4-#5 E.W.",
      concrete: "5000 PSI",
      notes: "Corner footing",
    },
  },
]

const MOCK_ENTRIES_SLAB: ScheduleEntry[] = [
  {
    id: "e4",
    mark: "SL1",
    scheduleType: "slab",
    confidence: 0.96,
    properties: {
      thickness: '6"',
      concrete: "4000 PSI",
      reinforcing: '#4@12" O.C. E.W.',
      finish: "Broom",
    },
  },
  {
    id: "e5",
    mark: "SL2",
    scheduleType: "slab",
    confidence: 0.93,
    properties: {
      thickness: '8"',
      concrete: "4000 PSI",
      reinforcing: '#5@10" O.C. E.W.',
      finish: "Trowel",
    },
  },
  {
    id: "e6",
    mark: "SL3",
    scheduleType: "slab",
    confidence: 0.91,
    properties: {
      thickness: '6"',
      concrete: "4000 PSI",
      reinforcing: '#4@12" O.C. E.W.',
      finish: "Broom",
    },
  },
  {
    id: "e7",
    mark: "SL4",
    scheduleType: "slab",
    confidence: 0.89,
    properties: {
      thickness: '10"',
      concrete: "5000 PSI",
      reinforcing: '#5@8" O.C. E.W.',
      finish: "Trowel",
    },
  },
]

const MOCK_REGIONS: Region[] = [
  {
    id: "r1",
    regionClass: "schedule",
    regionTitle: "Footing Schedule",
    sheetNumber: "S0.0",
    confidence: 0.94,
    entries: MOCK_ENTRIES_FOOTING,
  },
  {
    id: "r2",
    regionClass: "schedule",
    regionTitle: "Slab on Grade Schedule",
    sheetNumber: "S1.0",
    confidence: 0.93,
    entries: MOCK_ENTRIES_SLAB,
  },
  {
    id: "r4",
    regionClass: "notes",
    regionTitle: "General Structural Notes",
    sheetNumber: "S0.0",
    confidence: 0.89,
    notesContent: JSON.stringify({
      title: "General Structural Notes",
      items: [
        {
          number: 1,
          text: "All concrete shall have minimum 28-day compressive strength as noted on drawings.",
        },
        {
          number: 2,
          text: "Concrete cover for reinforcement:",
          subItems: [
            { letter: "a", text: 'Footings and foundation walls: 3" clear' },
            { letter: "b", text: 'Slabs on grade: 2" clear (bottom), 3/4" clear (top)' },
          ],
        },
        { number: 3, text: "All reinforcing steel shall be Grade 60, ASTM A615." },
        {
          number: 4,
          text: "Lap splices shall be minimum 40 bar diameters unless noted otherwise.",
        },
      ],
    }),
  },
  {
    id: "r5",
    regionClass: "notes",
    regionTitle: "Concrete Notes",
    sheetNumber: "S0.1",
    confidence: 0.91,
    notesContent: JSON.stringify({
      title: "Concrete Notes",
      items: [
        {
          number: 1,
          text: 'All concrete slabs on grade shall be placed on minimum 4" compacted granular fill over undisturbed soil.',
        },
        {
          number: 2,
          text: "Control joints in slabs shall be placed at maximum 15'-0\" intervals in each direction.",
        },
      ],
    }),
  },
  {
    id: "r6",
    regionClass: "legend",
    regionTitle: "Slab & Deck Legend",
    sheetNumber: "S0.0",
    confidence: 0.87,
    legendImageUrl: "https://picsum.photos/seed/legend1/600/300",
  },
  {
    id: "r7",
    regionClass: "legend",
    regionTitle: "Symbol Legend",
    sheetNumber: "S0.1",
    confidence: 0.85,
    legendImageUrl: "https://picsum.photos/seed/legend2/600/400",
  },
]

function getConfidenceBadge(confidence: number) {
  if (confidence >= 0.9)
    return { label: "High confidence", color: "#16a34a", bg: "rgba(22,163,74,0.15)" }
  if (confidence >= 0.8)
    return { label: "Medium confidence", color: "#ca8a04", bg: "rgba(202,138,4,0.15)" }
  return { label: "Review recommended", color: "#ea580c", bg: "rgba(234,88,12,0.15)" }
}

function formatColumnHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function BrowseView({ onRegionPress }: { onRegionPress: (r: Region) => void }) {
  const schedules = MOCK_REGIONS.filter((r) => r.regionClass === "schedule")
  const notes = MOCK_REGIONS.filter((r) => r.regionClass === "notes")
  const legends = MOCK_REGIONS.filter((r) => r.regionClass === "legend")

  const renderSection = (title: string, regions: Region[]) => (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center gap-2 px-1">
        <Text className="text-muted-foreground text-xs font-semibold tracking-wider">{title}</Text>
        <Text className="text-muted-foreground text-xs">{regions.length}</Text>
      </View>
      <View
        className="overflow-hidden rounded-xl"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      >
        {regions.map((region) => (
          <Pressable
            key={region.id}
            className="active:bg-muted/20 flex-row items-center px-4 py-3"
            onPress={() => onRegionPress(region)}
          >
            <View className="flex-1">
              <Text className="text-foreground text-base font-medium">{region.regionTitle}</Text>
              {region.entries && (
                <Text className="text-muted-foreground text-xs">
                  {region.entries.length} entries
                </Text>
              )}
            </View>
            <Text className="text-muted-foreground mr-2 text-sm">{region.sheetNumber}</Text>
            <Icon as={ChevronRight} className="text-muted-foreground size-4" />
          </Pressable>
        ))}
      </View>
    </View>
  )

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Icon as={Layers} className="text-primary size-5" />
        <Text className="text-foreground text-lg font-bold">Plan Info</Text>
      </View>
      <Text className="text-muted-foreground px-4 pb-4 text-sm">
        AI-extracted schedules, notes, and legends from your plan set
      </Text>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {schedules.length > 0 && renderSection("SCHEDULES", schedules)}
        {notes.length > 0 && renderSection("NOTES", notes)}
        {legends.length > 0 && renderSection("LEGENDS", legends)}
      </ScrollView>
    </View>
  )
}

function ScheduleDetailView({
  region,
  onBack,
  onRowPress,
}: {
  region: Region
  onBack: () => void
  onRowPress: (entry: ScheduleEntry) => void
}) {
  const entries = region.entries ?? []
  const columns = entries.length > 0 ? ["Mark", ...Object.keys(entries[0].properties)] : []
  const avgConfidence =
    entries.length > 0
      ? entries.reduce((acc, e) => acc + e.confidence, 0) / entries.length
      : region.confidence
  const badge = getConfidenceBadge(avgConfidence)

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <Pressable onPress={onBack}>
            <Icon as={ArrowLeft} className="text-foreground size-5" />
          </Pressable>
          <Text className="text-foreground text-lg font-bold" numberOfLines={1}>
            {region.regionTitle}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 px-4 pb-3">
        <Text className="text-muted-foreground text-sm">Sheet {region.sheetNumber}</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
          <Text style={{ color: badge.color }} className="text-xs font-medium">
            {Math.round(avgConfidence * 100)}% {badge.label}
          </Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View className="min-w-full">
            <View className="flex-row" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              {columns.map((col) => (
                <View key={col} className="w-36 px-3 py-3">
                  <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    {formatColumnHeader(col)}
                  </Text>
                </View>
              ))}
            </View>
            {entries.map((entry, rowIndex) => (
              <Pressable
                key={entry.id}
                className={cn("flex-row active:bg-muted/30", rowIndex % 2 === 1 && "bg-muted/10")}
                style={{ minHeight: 48 }}
                onPress={() => onRowPress(entry)}
              >
                {columns.map((col) => {
                  const value = col === "Mark" ? entry.mark : (entry.properties[col] ?? "")
                  return (
                    <View key={col} className="w-36 justify-center px-3 py-3">
                      <Text
                        className={cn(
                          "text-sm",
                          col === "Mark" ? "text-foreground font-semibold" : "text-foreground",
                        )}
                        numberOfLines={3}
                      >
                        {value || "\u2014"}
                      </Text>
                    </View>
                  )
                })}
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View className="items-center py-4">
          <Text className="text-muted-foreground text-xs">Tap a row for full details</Text>
        </View>
      </ScrollView>
      <View className="border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Pressable className="bg-primary items-center rounded-xl py-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Eye} className="text-primary-foreground size-5" />
            <Text className="text-primary-foreground text-base font-semibold">View on Sheet</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

function RowDetailSheet({
  entry,
  scheduleName,
  sheetNumber,
  onClose,
}: {
  entry: ScheduleEntry
  scheduleName: string
  sheetNumber: string
  onClose: () => void
}) {
  const badge = getConfidenceBadge(entry.confidence)
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
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-foreground text-2xl font-black">{entry.mark}</Text>
        <Pressable onPress={onClose}>
          <Icon as={X} className="text-muted-foreground size-5" />
        </Pressable>
      </View>
      <Text className="text-muted-foreground mb-4 text-sm">{scheduleName}</Text>
      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} className="mb-4" />
      <View className="gap-3">
        {Object.entries(entry.properties).map(([key, value]) => (
          <View key={key}>
            <Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {formatColumnHeader(key)}
            </Text>
            <Text className="text-foreground mt-0.5 text-base">{value || "\u2014"}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} className="my-4" />
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground text-xs">
          {scheduleName} · Sheet {sheetNumber}
        </Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
          <Text style={{ color: badge.color }} className="text-xs font-medium">
            {Math.round(entry.confidence * 100)}%
          </Text>
        </View>
      </View>
      <Pressable className="bg-primary mt-4 items-center rounded-xl py-3">
        <View className="flex-row items-center gap-2">
          <Icon as={Eye} className="text-primary-foreground size-4" />
          <Text className="text-primary-foreground text-sm font-bold">View on Sheet</Text>
        </View>
      </Pressable>
    </View>
  )
}

function NotesDetailView({ region, onBack }: { region: Region; onBack: () => void }) {
  const [copied, setCopied] = React.useState(false)
  const badge = getConfidenceBadge(region.confidence)
  let parsed: {
    items: { number: number; text: string; subItems?: { letter: string; text: string }[] }[]
  } | null = null
  try {
    if (region.notesContent) parsed = JSON.parse(region.notesContent)
  } catch {
    /* ignore */
  }

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <Pressable onPress={onBack}>
            <Icon as={ArrowLeft} className="text-foreground size-5" />
          </Pressable>
          <Text className="text-foreground text-lg font-bold" numberOfLines={1}>
            {region.regionTitle}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          <Icon
            as={copied ? Check : Copy}
            className={copied ? "text-green-500 size-5" : "text-muted-foreground size-5"}
          />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-2 px-4 pb-3">
        <Text className="text-muted-foreground text-sm">Sheet {region.sheetNumber}</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
          <Text style={{ color: badge.color }} className="text-xs font-medium">
            {Math.round(region.confidence * 100)}% {badge.label}
          </Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {parsed?.items ? (
          <View className="gap-4">
            {parsed.items.map((item) => (
              <View key={item.number}>
                <View className="flex-row gap-3">
                  <Text
                    className="text-muted-foreground text-sm font-bold"
                    style={{ minWidth: 24 }}
                  >
                    {item.number}.
                  </Text>
                  <Text className="text-foreground flex-1 text-sm leading-relaxed">
                    {item.text}
                  </Text>
                </View>
                {item.subItems && (
                  <View className="ml-8 mt-2 gap-2">
                    {item.subItems.map((sub) => (
                      <View key={sub.letter} className="flex-row gap-3">
                        <Text className="text-muted-foreground text-sm">{sub.letter}.</Text>
                        <Text className="text-foreground flex-1 text-sm leading-relaxed">
                          {sub.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-foreground text-sm leading-relaxed">{region.notesContent}</Text>
        )}
      </ScrollView>
      <View className="border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Pressable className="bg-primary items-center rounded-xl py-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Eye} className="text-primary-foreground size-5" />
            <Text className="text-primary-foreground text-base font-semibold">View on Sheet</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

function LegendDetailView({ region, onBack }: { region: Region; onBack: () => void }) {
  const badge = getConfidenceBadge(region.confidence)
  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1 flex-row items-center gap-3">
          <Pressable onPress={onBack}>
            <Icon as={ArrowLeft} className="text-foreground size-5" />
          </Pressable>
          <Text className="text-foreground text-lg font-bold" numberOfLines={1}>
            {region.regionTitle}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 px-4 pb-3">
        <Text className="text-muted-foreground text-sm">Sheet {region.sheetNumber}</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
          <Text style={{ color: badge.color }} className="text-xs font-medium">
            {Math.round(region.confidence * 100)}% {badge.label}
          </Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="items-center px-4 pb-8">
        {region.legendImageUrl ? (
          <View
            className="w-full overflow-hidden rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <Image
              source={{ uri: region.legendImageUrl }}
              style={{ width: "100%", aspectRatio: 2 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View
            className="w-full items-center justify-center rounded-xl py-20"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <Icon as={ImageOff} className="text-muted-foreground size-12" />
            <Text className="text-muted-foreground mt-3 text-sm">Legend image not available</Text>
          </View>
        )}
        <Text className="text-muted-foreground mt-3 text-xs">Pinch to zoom on device</Text>
      </ScrollView>
    </View>
  )
}

type FlowState =
  | { screen: "browse" }
  | { screen: "schedule"; region: Region }
  | { screen: "row-detail"; region: Region; entry: ScheduleEntry }
  | { screen: "notes"; region: Region }
  | { screen: "legend"; region: Region }

function ScheduleNotesFlow({ initialScreen = "browse" }: { initialScreen?: string }) {
  const [state, setState] = React.useState<FlowState>(() => {
    if (initialScreen === "schedule") return { screen: "schedule", region: MOCK_REGIONS[0] }
    if (initialScreen === "notes") return { screen: "notes", region: MOCK_REGIONS[2] }
    if (initialScreen === "legend") return { screen: "legend", region: MOCK_REGIONS[4] }
    return { screen: "browse" }
  })
  const [toastMsg, setToastMsg] = React.useState("")

  const handleRegionPress = (region: Region) => {
    if (region.regionClass === "schedule") setState({ screen: "schedule", region })
    else if (region.regionClass === "notes") setState({ screen: "notes", region })
    else if (region.regionClass === "legend") setState({ screen: "legend", region })
  }

  const renderScreen = () => {
    switch (state.screen) {
      case "browse":
        return <BrowseView onRegionPress={handleRegionPress} />
      case "schedule":
        return (
          <View className="flex-1" style={{ position: "relative" } as any}>
            <ScheduleDetailView
              region={state.region}
              onBack={() => setState({ screen: "browse" })}
              onRowPress={(entry) =>
                setState({ screen: "row-detail", region: state.region, entry })
              }
            />
          </View>
        )
      case "row-detail":
        return (
          <View className="flex-1" style={{ position: "relative" } as any}>
            <ScheduleDetailView
              region={state.region}
              onBack={() => setState({ screen: "browse" })}
              onRowPress={(entry) =>
                setState({ screen: "row-detail", region: state.region, entry })
              }
            />
            <RowDetailSheet
              entry={state.entry}
              scheduleName={state.region.regionTitle}
              sheetNumber={state.region.sheetNumber}
              onClose={() => setState({ screen: "schedule", region: state.region })}
            />
          </View>
        )
      case "notes":
        return (
          <NotesDetailView region={state.region} onBack={() => setState({ screen: "browse" })} />
        )
      case "legend":
        return (
          <LegendDetailView region={state.region} onBack={() => setState({ screen: "browse" })} />
        )
    }
  }

  return (
    <View className="flex-1" style={{ position: "relative" } as any}>
      {renderScreen()}
      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

const meta: Meta<typeof ScheduleNotesFlow> = {
  title: "Flows/4. Schedule & Notes",
  component: ScheduleNotesFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ScheduleNotesFlow>

export const Browse: Story = { name: "1. Browse All", args: { initialScreen: "browse" } }
export const ScheduleDetail: Story = {
  name: "2. Schedule Detail",
  args: { initialScreen: "schedule" },
}
export const NotesDetail: Story = { name: "3. Notes Detail", args: { initialScreen: "notes" } }
export const LegendDetail: Story = { name: "4. Legend Detail", args: { initialScreen: "legend" } }
export const FullFlow: Story = { name: "Full Flow", args: { initialScreen: "browse" } }
