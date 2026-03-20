import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Camera, FileText, HardDrive, Users } from "lucide-react-native"
import * as React from "react"
import { Platform, ScrollView, View } from "react-native"
import { ListRow } from "@/components/ui/list-row"
import { ListSection } from "@/components/ui/list-section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { isPrototypeMode } from "@/lib/prototype-mode"

export default function ProjectSettingsScreen() {
  if (isPrototypeMode()) return <PrototypeProjectSettings />
  return <PrototypeProjectSettings />
}

function PrototypeProjectSettings() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()

  const [notifyPlans, setNotifyPlans] = React.useState(true)
  const [notifyMedia, setNotifyMedia] = React.useState(true)
  const [notifyComments, setNotifyComments] = React.useState(true)

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Project Settings</Text>
          ),
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
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
          <ListRow
            icon={Users}
            label="Team Members"
            onPress={() => router.push(`/project/${params.id}/members` as any)}
          />
        </ListSection>
      </ScrollView>
    </View>
  )
}
