import type { Meta, StoryObj } from "@storybook/react"
import {
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Search,
  StickyNote,
  TableProperties,
  X,
} from "lucide-react-native"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"

type ResultType = "sheet" | "schedule" | "notes" | "callout"

interface SearchResult {
  id: string
  type: ResultType
  title: string
  subtitle: string
  snippet: string
  matchTerm: string
}

const TYPE_CONFIG: Record<
  ResultType,
  {
    icon: typeof FileText
    label: string
    color: string
    bg: string
    iconClass: string
  }
> = {
  sheet: {
    icon: FileText,
    label: "Sheet",
    color: "#6b7280",
    bg: "rgba(107, 114, 128, 0.15)",
    iconClass: "text-gray-500 size-5",
  },
  schedule: {
    icon: TableProperties,
    label: "Schedule",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.15)",
    iconClass: "text-blue-600 size-5",
  },
  notes: {
    icon: StickyNote,
    label: "Notes",
    color: "#9333ea",
    bg: "rgba(147, 51, 234, 0.15)",
    iconClass: "text-purple-600 size-5",
  },
  callout: {
    icon: MapPin,
    label: "Callout",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.15)",
    iconClass: "text-amber-600 size-5",
  },
}

const MOCK_RESULTS: SearchResult[] = [
  {
    id: "r1",
    type: "sheet",
    title: "S1.0 - Foundation Plan",
    subtitle: "Sheet S1.0",
    snippet: "4000 PSI concrete mix design per ACI 318",
    matchTerm: "concrete",
  },
  {
    id: "r2",
    type: "schedule",
    title: "Slab on Grade Schedule",
    subtitle: "Sheet S1.0 - 4 entries",
    snippet: 'SL1: 6" slab, 4000 PSI concrete, 6x6 WWF',
    matchTerm: "concrete",
  },
  {
    id: "r3",
    type: "schedule",
    title: "Footing Schedule",
    subtitle: "Sheet S0.0 - 3 entries",
    snippet: 'F1: 24"x12", 4000 PSI concrete',
    matchTerm: "concrete",
  },
  {
    id: "r4",
    type: "notes",
    title: "General Structural Notes",
    subtitle: "Sheet S0.0",
    snippet: "All concrete shall achieve minimum 28-day compressive strength",
    matchTerm: "concrete",
  },
  {
    id: "r5",
    type: "callout",
    title: "5/A7 - Electrical Junction",
    subtitle: "Sheet E2.0 - Grid D/4",
    snippet: "concrete pad required at base of junction box",
    matchTerm: "concrete",
  },
]

const RECENT_SEARCHES = [
  "concrete strength",
  "rebar schedule",
  "electrical panel",
  "footing detail",
]

function HighlightedSnippet({ text, term }: { text: string; term: string }) {
  if (!term) {
    return (
      <Text className="text-muted-foreground text-sm" numberOfLines={2}>
        ...{text}...
      </Text>
    )
  }

  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  const idx = lowerText.indexOf(lowerTerm)

  if (idx === -1) {
    return (
      <Text className="text-muted-foreground text-sm" numberOfLines={2}>
        ...{text}...
      </Text>
    )
  }

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + term.length)
  const after = text.slice(idx + term.length)

  return (
    <Text className="text-muted-foreground text-sm" numberOfLines={2}>
      ...{before}
      <Text className="text-foreground font-bold">{match}</Text>
      {after}...
    </Text>
  )
}

function SearchResultRow({
  item,
  query,
  onPress,
}: {
  item: SearchResult
  query: string
  onPress?: () => void
}) {
  const config = TYPE_CONFIG[item.type]

  return (
    <Pressable
      onPress={onPress}
      className="active:bg-muted/10 flex-row items-center gap-3 px-4 py-3"
    >
      <View
        className="size-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: config.bg }}
      >
        <Icon as={config.icon} className={config.iconClass} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground shrink text-base font-bold" numberOfLines={1}>
            {item.title}
          </Text>
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: config.bg }}>
            <Text className="text-xs font-medium" style={{ color: config.color }}>
              {config.label}
            </Text>
          </View>
        </View>
        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
          {item.subtitle}
        </Text>
        <HighlightedSnippet text={item.snippet} term={query} />
      </View>
      <Icon as={ChevronRight} className="text-muted-foreground size-4" />
    </Pressable>
  )
}

export function PlanSearchScreen({
  initialQuery = "",
  onBack,
}: {
  initialQuery?: string
  onBack?: () => void
}) {
  const [query, setQuery] = React.useState(initialQuery)
  const [toastMsg, setToastMsg] = React.useState("")
  const [displayedResults, setDisplayedResults] = React.useState<SearchResult[]>(() => {
    if (!initialQuery) return []
    return MOCK_RESULTS.filter((r) =>
      r.matchTerm.toLowerCase().includes(initialQuery.toLowerCase()),
    )
  })
  const [isSearching, setIsSearching] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = (text: string) => {
    setQuery(text)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!text.trim()) {
      setDisplayedResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      const lower = text.toLowerCase()
      const filtered = MOCK_RESULTS.filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          r.snippet.toLowerCase().includes(lower) ||
          r.matchTerm.toLowerCase().includes(lower),
      )
      setDisplayedResults(filtered)
      setIsSearching(false)
    }, 300)
  }

  const handleRecentSearch = (term: string) => {
    setQuery(term)
    const lower = term.toLowerCase()
    const filtered = MOCK_RESULTS.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.snippet.toLowerCase().includes(lower) ||
        r.matchTerm.toLowerCase().includes(lower),
    )
    setDisplayedResults(filtered)
  }

  const showEmpty = !query.trim()
  const showNoResults = query.trim().length >= 2 && displayedResults.length === 0 && !isSearching
  const showResults = displayedResults.length > 0 && !isSearching

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Plan Search" onBack={onBack} />
      <View className="px-4 pt-1 pb-2">
        <Badge variant="secondary" className="bg-primary/10 self-start border-transparent">
          <Text className="text-primary text-[10px] font-bold">PRO FEATURE</Text>
        </Badge>
      </View>

      <View className="border-border/50 border-b px-4 py-2">
        <View className="bg-muted/40 flex-row items-center rounded-xl px-3" style={{ height: 44 }}>
          <Icon as={Search} className="text-muted-foreground mr-2 size-5" />
          <Input
            placeholder="Search plans, schedules, notes..."
            value={query}
            onChangeText={handleQueryChange}
            className="h-11 flex-1 border-transparent bg-transparent text-base"
            autoFocus
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery("")
                setDisplayedResults([])
                setIsSearching(false)
              }}
              className="ml-1 items-center justify-center"
              style={{ width: 28, height: 28 }}
            >
              <Icon as={X} className="text-muted-foreground size-4" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {showEmpty && (
          <View className="px-4 pt-6">
            <Text className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              Recent Searches
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {RECENT_SEARCHES.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => handleRecentSearch(term)}
                  className="active:bg-muted/40 flex-row items-center gap-1.5 rounded-full px-3 py-2"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Icon as={Clock} className="text-muted-foreground size-3.5" />
                  <Text className="text-foreground text-sm">{term}</Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-8 items-center">
              <View
                className="mb-4 items-center justify-center rounded-full"
                style={{
                  width: 64,
                  height: 64,
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                <Icon as={Search} className="text-muted-foreground size-8" />
              </View>
              <Text className="text-muted-foreground text-center text-sm leading-relaxed">
                Search across all sheets, schedules,{"\n"}
                notes, and callouts in your plan set
              </Text>
            </View>
          </View>
        )}

        {isSearching && (
          <View className="items-center py-20">
            <Text className="text-muted-foreground text-sm">Searching...</Text>
          </View>
        )}

        {showResults && (
          <View>
            <View className="flex-row items-center justify-between px-4 pt-4 pb-1">
              <Text className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {displayedResults.length} {displayedResults.length === 1 ? "Result" : "Results"}
              </Text>
            </View>
            {displayedResults.map((item) => (
              <SearchResultRow
                key={item.id}
                item={item}
                query={query}
                onPress={() => setToastMsg(`Opening ${item.title}...`)}
              />
            ))}
          </View>
        )}

        {showNoResults && (
          <View className="items-center py-20">
            <View
              className="mb-4 items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <Icon as={Search} className="text-muted-foreground size-8" />
            </View>
            <Text className="text-foreground mb-1 text-base font-semibold">
              No results for &quot;{query}&quot;
            </Text>
            <Text className="text-muted-foreground text-center text-sm leading-relaxed">
              Try a different search term or check{"\n"}your spelling
            </Text>
          </View>
        )}
      </ScrollView>
      <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
    </View>
  )
}

function DefaultStory() {
  return <PlanSearchScreen />
}

function WithResultsStory() {
  return <PlanSearchScreen initialQuery="concrete" />
}

function NoResultsStory() {
  return <PlanSearchScreen initialQuery="xyz123" />
}

function FlowStory() {
  return <PlanSearchScreen />
}

const meta: Meta<typeof PlanSearchScreen> = {
  title: "Screens/Plan Search",
  component: PlanSearchScreen,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof PlanSearchScreen>

export const Default: Story = {
  render: () => <DefaultStory />,
}

export const WithResults: Story = {
  render: () => <WithResultsStory />,
}

export const NoResults: Story = {
  render: () => <NoResultsStory />,
}

export const Flow: Story = {
  render: () => <FlowStory />,
}
