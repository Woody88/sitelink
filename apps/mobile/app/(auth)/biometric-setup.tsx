// apps/mobile/app/(auth)/biometric-setup.tsx
import { useState, useEffect } from "react"
import { View, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import {
  isBiometricAvailable,
  setBiometricEnabled,
  authenticateWithBiometric,
} from "@/lib/biometric"
import { Platform } from "react-native"

export default function BiometricSetupScreen() {
  const router = useRouter()
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAvailability()
  }, [])

  async function checkAvailability() {
    const isAvailable = await isBiometricAvailable()
    setAvailable(isAvailable)
    setLoading(false)
  }

  async function handleEnable() {
    const success = await authenticateWithBiometric()
    if (success) {
      await setBiometricEnabled(true)
      router.replace("/(tabs)/plan" as any)
    }
  }

  async function handleSkip() {
    await setBiometricEnabled(false)
      router.replace("/(tabs)/plan" as any)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading...</Text>
      </View>
    )
  }

  if (!available) {
    return (
      <View className="flex-1 items-center justify-center p-6 gap-4">
        <Text variant="h1" className="text-center">
          Biometric Unlock
        </Text>
        <Text variant="muted" className="text-center">
          Biometric authentication is not available on this device.
        </Text>
        <Button onPress={handleSkip} className="mt-4">
          <Text>Continue</Text>
        </Button>
      </View>
    )
  }

  const biometricName =
    Platform.OS === "ios" ? "Face ID" : "Fingerprint"

  return (
    <ScrollView
      contentContainerClassName="flex-1 justify-center p-6 gap-6"
    >
      <View className="gap-2">
        <Text variant="h1" className="text-center">
          Enable {biometricName}?
        </Text>
        <Text variant="muted" className="text-center">
          Use {biometricName} to quickly unlock the app and access your
          projects offline.
        </Text>
      </View>

      <View className="gap-3">
        <Button
          testID="enable-biometric-button"
          onPress={handleEnable}
        >
          <Text>Enable {biometricName}</Text>
        </Button>

        <Button
          variant="ghost"
          testID="skip-biometric-button"
          onPress={handleSkip}
        >
          <Text>Skip</Text>
        </Button>
      </View>
    </ScrollView>
  )
}

