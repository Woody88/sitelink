import { Stack, useRouter } from "expo-router"
import {
  Bell,
  Camera,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Lightbulb,
  LogOut,
  Trash2,
} from "lucide-react-native"
import * as React from "react"
import { Platform, ScrollView, View } from "react-native"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { ListRow } from "@/components/ui/list-row"
import { ListSection } from "@/components/ui/list-section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { Toast } from "@/components/ui/toast"
import { isPrototypeMode } from "@/lib/prototype-mode"

export default function SettingsScreen() {
  if (isPrototypeMode()) return <PrototypeSettingsScreen />
  return <PrototypeSettingsScreen />
}

function PrototypeSettingsScreen() {
  const router = useRouter()
  const [saved, setSaved] = React.useState(false)
  const [name, setName] = React.useState("John Smith")
  const [phone, setPhone] = React.useState("(555) 123-4567")
  const [company, setCompany] = React.useState("Smith Electrical LLC")

  const [notifyPlans, setNotifyPlans] = React.useState(true)
  const [notifyPhotos, setNotifyPhotos] = React.useState(true)
  const [notifyReports, setNotifyReports] = React.useState(false)
  const [autoDownload, setAutoDownload] = React.useState(true)

  const handleSave = () => {
    setSaved(true)
  }

  const handleDismissToast = React.useCallback(() => {
    setSaved(false)
  }, [])

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => <Text className="text-foreground text-lg font-bold">Profile</Text>,
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
        <View className="items-center pt-4 pb-6">
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

        <View className="gap-5 px-4">
          <FormField label="Full Name" nativeID="settingsName">
            <Input nativeID="settingsName" size="lg" value={name} onChangeText={setName} />
          </FormField>
          <FormField label="Email" nativeID="settingsEmail" hint="Email cannot be changed.">
            <Input
              nativeID="settingsEmail"
              size="lg"
              defaultValue="john@smithelectrical.com"
              editable={false}
            />
          </FormField>
          <FormField label="Phone Number" nativeID="settingsPhone">
            <Input
              nativeID="settingsPhone"
              size="lg"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </FormField>
          <FormField label="Company" nativeID="settingsCompany">
            <Input nativeID="settingsCompany" size="lg" value={company} onChangeText={setCompany} />
          </FormField>

          <Button className="h-12 rounded-xl" onPress={handleSave}>
            <Text className="text-primary-foreground text-base font-semibold">Save Changes</Text>
          </Button>
        </View>

        <ListSection title="Notifications">
          <ListRow
            icon={FileText}
            label="Plan Updates"
            right={<Switch checked={notifyPlans} onCheckedChange={setNotifyPlans} />}
          />
          <ListRow
            icon={Camera}
            label="Photo Alerts"
            right={<Switch checked={notifyPhotos} onCheckedChange={setNotifyPhotos} />}
          />
          <ListRow
            icon={Bell}
            label="Daily Reports"
            right={<Switch checked={notifyReports} onCheckedChange={setNotifyReports} />}
          />
        </ListSection>

        <ListSection title="Offline">
          <ListRow
            icon={Download}
            label="Auto-download Plans"
            right={<Switch checked={autoDownload} onCheckedChange={setAutoDownload} />}
          />
          <ListRow icon={Trash2} label="Clear Cache" value="128.4 MB" onPress={() => {}} />
        </ListSection>

        <ListSection title="Account">
          <ListRow
            icon={CreditCard}
            label="Subscription"
            sublabel="Pro Trial · 12 days left"
            onPress={() => router.push("/subscription" as any)}
          />
          <ListRow icon={HelpCircle} label="Help" onPress={() => router.push("/help" as any)} />
          <ListRow
            icon={Lightbulb}
            label="Feature Request"
            onPress={() => router.push("/feature-request" as any)}
          />
          <ListRow icon={LogOut} label="Sign Out" destructive onPress={() => {}} />
        </ListSection>
      </ScrollView>

      <Toast message="Changes saved" visible={saved} onDismiss={handleDismissToast} />
    </View>
  )
}
