import { Stack, useLocalSearchParams } from "expo-router"
import { Link, Mail, MessageSquare } from "lucide-react-native"
import * as React from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Input } from "@/components/ui/input"
import { ListRow } from "@/components/ui/list-row"
import { ListSection } from "@/components/ui/list-section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export default function ShareProjectScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const [permission, setPermission] = React.useState<"view" | "edit">("view")
  const [anyoneWithLink, setAnyoneWithLink] = React.useState(false)
  const [showCopied, setShowCopied] = React.useState(false)

  const shareLink = `https://app.sitelink.com/project/${params.id}`

  const handleCopyLink = () => {
    setShowCopied(true)
  }

  const handleDismissCopied = React.useCallback(() => {
    setShowCopied(false)
  }, [])

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Share Project</Text>
          ),
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-6 gap-2">
          <Text className="text-foreground text-sm font-medium">Share Link</Text>
          <View className="flex-row items-center gap-2">
            <Input size="lg" value={shareLink} editable={false} className="flex-1" />
            <Button className="h-12 rounded-xl px-5" onPress={handleCopyLink}>
              <Text className="text-primary-foreground font-semibold">Copy</Text>
            </Button>
          </View>
        </View>

        <ListSection title="Permissions">
          <View className="px-4 py-3">
            <Text className="text-foreground mb-3 text-base font-medium">Link Permission</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setPermission("view")}
                className={cn(
                  "flex-1 rounded-xl border-2 px-4 py-3",
                  permission === "view" ? "bg-primary border-primary" : "bg-muted/10 border-border",
                )}
              >
                <Text
                  className={cn(
                    "text-center font-medium",
                    permission === "view" ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  Can View
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPermission("edit")}
                className={cn(
                  "flex-1 rounded-xl border-2 px-4 py-3",
                  permission === "edit" ? "bg-primary border-primary" : "bg-muted/10 border-border",
                )}
              >
                <Text
                  className={cn(
                    "text-center font-medium",
                    permission === "edit" ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  Can Edit
                </Text>
              </Pressable>
            </View>
          </View>
          <Divider inset={16} />
          <ListRow
            label="Anyone with link"
            right={<Switch checked={anyoneWithLink} onCheckedChange={setAnyoneWithLink} />}
          />
        </ListSection>

        <ListSection title="Share Via" dividerInset={52}>
          <ListRow icon={Link} label="Copy Link" onPress={handleCopyLink} />
          <ListRow icon={Mail} label="Email" onPress={() => {}} />
          <ListRow icon={MessageSquare} label="Messages" onPress={() => {}} />
        </ListSection>
      </ScrollView>

      <Toast
        message="Link copied to clipboard"
        visible={showCopied}
        onDismiss={handleDismissCopied}
      />
    </View>
  )
}
