import { Stack } from "expo-router"
import { AlertTriangle, Bell, CheckCircle } from "lucide-react-native"
import * as React from "react"
import { FlatList, Pressable, View } from "react-native"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { MOCK_NOTIFICATIONS, type MockNotification } from "@/lib/mock-data"

const ICON_MAP = {
  success: CheckCircle,
  alert: AlertTriangle,
  info: Bell,
} as const

const ICON_COLOR_MAP = {
  success: "text-green-500",
  alert: "text-amber-500",
  info: "text-blue-500",
} as const

export default function NotificationsScreen() {
  const [readIds, setReadIds] = React.useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const n of MOCK_NOTIFICATIONS) {
      if (n.read) initial.add(n.id)
    }
    return initial
  })

  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !readIds.has(n.id)).length

  const handleToggleRead = React.useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleMarkAllRead = React.useCallback(() => {
    setReadIds(new Set(MOCK_NOTIFICATIONS.map((n) => n.id)))
  }, [])

  const renderNotification = React.useCallback(
    ({ item }: { item: MockNotification }) => {
      const isRead = readIds.has(item.id)
      const IconComponent = ICON_MAP[item.type]
      const iconColor = ICON_COLOR_MAP[item.type]

      return (
        <Pressable
          onPress={() => handleToggleRead(item.id)}
          className="active:bg-muted/30 flex-row"
          style={{ minHeight: 72 }}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.body}. ${isRead ? "Read" : "Unread"}`}
        >
          {!isRead && (
            <View className="bg-blue-500 self-stretch rounded-r-sm" style={{ width: 3 }} />
          )}
          <View
            className="flex-1 flex-row gap-3 px-4 py-3"
            style={!isRead ? { paddingLeft: 13 } : undefined}
          >
            <View className="bg-muted/20 mt-0.5 size-9 items-center justify-center rounded-full">
              <Icon as={IconComponent} className={`size-4 ${iconColor}`} />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-start justify-between">
                <Text
                  className={`flex-1 pr-2 text-base leading-tight ${
                    isRead ? "font-medium" : "font-bold"
                  }`}
                >
                  {item.title}
                </Text>
                <Text className="text-muted-foreground mt-0.5 text-xs">{item.time}</Text>
              </View>
              <Text
                className={`text-sm leading-snug ${
                  isRead ? "text-muted-foreground/60" : "text-muted-foreground"
                }`}
              >
                {item.body}
              </Text>
            </View>
          </View>
        </Pressable>
      )
    },
    [readIds, handleToggleRead],
  )

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Notifications</Text>
          ),
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
          headerRight: () =>
            unreadCount > 0 ? (
              <Pressable
                onPress={handleMarkAllRead}
                className="mr-2"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
              >
                <Text className="text-primary text-sm font-semibold">Mark All Read</Text>
              </Pressable>
            ) : null,
        }}
      />

      <FlatList
        data={MOCK_NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}
