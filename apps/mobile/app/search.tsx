import { Stack, useRouter } from "expo-router"
import { Clock, Search, X } from "lucide-react-native"
import * as React from "react"
import { FlatList, Pressable, View } from "react-native"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { ScreenLayout } from "@/components/ui/screen-layout"
import { Text } from "@/components/ui/text"
import { Toast } from "@/components/ui/toast"
import { MOCK_RECENT_SEARCHES, MOCK_SEARCH_RESULTS, type MockSearchResult } from "@/lib/mock-data"

const TYPE_BADGE_VARIANT = {
  sheet: "info",
  schedule: "ai",
  notes: "success",
  callout: "warning",
} as const

const TYPE_LABEL = {
  sheet: "Sheet",
  schedule: "Schedule",
  notes: "Notes",
  callout: "Callout",
} as const

function HighlightedSnippet({ text, matchTerm }: { text: string; matchTerm: string }) {
  if (!matchTerm) {
    return <Text className="text-muted-foreground text-sm">{text}</Text>
  }

  const lowerText = text.toLowerCase()
  const lowerMatch = matchTerm.toLowerCase()
  const matchIndex = lowerText.indexOf(lowerMatch)

  if (matchIndex === -1) {
    return <Text className="text-muted-foreground text-sm">{text}</Text>
  }

  const before = text.slice(0, matchIndex)
  const match = text.slice(matchIndex, matchIndex + matchTerm.length)
  const after = text.slice(matchIndex + matchTerm.length)

  return (
    <Text className="text-muted-foreground text-sm">
      {before}
      <Text className="text-foreground bg-yellow-500/20 font-semibold">{match}</Text>
      {after}
    </Text>
  )
}

export default function SearchScreen() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [toastMessage, setToastMessage] = React.useState("")
  const [toastVisible, setToastVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const filteredResults = React.useMemo(() => {
    if (!debouncedQuery) return []
    const lower = debouncedQuery.toLowerCase()
    return MOCK_SEARCH_RESULTS.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.subtitle.toLowerCase().includes(lower) ||
        r.snippet.toLowerCase().includes(lower),
    )
  }, [debouncedQuery])

  const handleRecentSearchTap = React.useCallback((term: string) => {
    setQuery(term)
  }, [])

  const handleResultTap = React.useCallback((result: MockSearchResult) => {
    setToastMessage(`Navigating to ${result.title}...`)
    setToastVisible(true)
  }, [])

  const handleClearQuery = React.useCallback(() => {
    setQuery("")
  }, [])

  const handleDismissToast = React.useCallback(() => {
    setToastVisible(false)
  }, [])

  const renderResult = React.useCallback(
    ({ item }: { item: MockSearchResult }) => {
      return (
        <Pressable
          onPress={() => handleResultTap(item)}
          className="active:bg-muted/30 flex-row items-start gap-3 px-4 py-3"
          style={{ minHeight: 64 }}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.subtitle}`}
        >
          <Badge variant={TYPE_BADGE_VARIANT[item.type]} size="sm" className="mt-0.5">
            <Text>{TYPE_LABEL[item.type]}</Text>
          </Badge>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-start justify-between">
              <Text className="text-foreground flex-1 pr-2 text-base font-semibold leading-tight">
                {item.title}
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm">{item.subtitle}</Text>
            <HighlightedSnippet text={item.snippet} matchTerm={debouncedQuery} />
          </View>
        </Pressable>
      )
    },
    [debouncedQuery, handleResultTap],
  )

  const hasQuery = debouncedQuery.length > 0
  const noResults = hasQuery && filteredResults.length === 0

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenLayout title="Search" onBack={() => router.back()} scrollable={false}>
        <View className="px-4 pb-3 pt-1">
          <Input
            leftIcon={Search}
            placeholder="Search plans, schedules, notes..."
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            rightElement={
              query.length > 0 ? (
                <Pressable
                  onPress={handleClearQuery}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon as={X} className="text-muted-foreground size-4" />
                </Pressable>
              ) : undefined
            }
          />
        </View>

        {!hasQuery && (
          <View className="px-4 pt-2">
            <View className="flex-row items-center gap-2 pb-3">
              <Icon as={Clock} className="text-muted-foreground size-4" />
              <Text className="text-muted-foreground text-sm font-semibold">Recent Searches</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {MOCK_RECENT_SEARCHES.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => handleRecentSearchTap(term)}
                  className="bg-muted/30 active:bg-muted/50 rounded-full px-3.5 py-1.5"
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${term}`}
                >
                  <Text className="text-foreground text-sm font-medium">{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {noResults && (
          <View className="flex-1 items-center justify-center px-4 pt-20">
            <Icon as={Search} className="text-muted-foreground/40 mb-3 size-10" />
            <Text className="text-muted-foreground text-base">
              No results for &apos;{debouncedQuery}&apos;
            </Text>
          </View>
        )}

        {hasQuery && filteredResults.length > 0 && (
          <FlatList
            data={filteredResults}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            contentContainerClassName="pb-12"
            showsVerticalScrollIndicator={false}
          />
        )}
      </ScreenLayout>

      <Toast message={toastMessage} visible={toastVisible} onDismiss={handleDismissToast} />
    </View>
  )
}
