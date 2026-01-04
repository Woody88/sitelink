// apps/mobile/app/(tabs)/more.tsx
import { Text } from "@/components/ui/text"
import { View, ScrollView } from "react-native"
import { Switch } from "@rn-primitives/switch"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from "@/lib/biometric"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Platform } from "react-native"

export default function MoreScreen() {
  const { user, signOut } = useAuth()
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabledState] = useState(false)

  useEffect(() => {
    loadBiometricState()
  }, [])

  async function loadBiometricState() {
    const available = await isBiometricAvailable()
    const enabled = await isBiometricEnabled()
    setBiometricAvailable(available)
    setBiometricEnabledState(enabled)
  }

  async function handleBiometricToggle(value: boolean) {
    await setBiometricEnabled(value)
    setBiometricEnabledState(value)
  }

  const biometricName = Platform.OS === "ios" ? "Face ID" : "Fingerprint"

  return (
    <ScrollView className="flex-1">
      <View className="p-6 gap-6">
        <Text variant="h1">Settings</Text>

        {user && (
          <View className="gap-2">
            <Text variant="h3">Account</Text>
            <Text>{user.email}</Text>
            {user.name && <Text variant="muted">{user.name}</Text>}
          </View>
        )}

        {biometricAvailable && (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Label nativeID="biometric-label">
                <Text>Enable {biometricName}</Text>
              </Label>
              <Switch
                testID="biometric-toggle"
                nativeID="biometric-toggle"
                checked={biometricEnabled}
                onCheckedChange={handleBiometricToggle}
              />
            </View>
            <Text variant="muted" className="text-sm">
              Use {biometricName} to unlock the app
            </Text>
          </View>
        )}

        <View className="gap-3 mt-4">
          <Button
            variant="destructive"
            onPress={signOut}
            testID="signout-button"
          >
            <Text>Sign Out</Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}
