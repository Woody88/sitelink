// apps/mobile/lib/biometric.ts
import * as LocalAuthentication from "expo-local-authentication"
import * as SecureStore from "expo-secure-store"

const BIOMETRIC_ENABLED_KEY = "biometric.enabled"

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync()
  if (!compatible) return false

  const enrolled = await LocalAuthentication.isEnrolledAsync()
  return enrolled
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
    return value === "true"
  } catch {
    return false
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false")
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access SiteLink",
      cancelLabel: "Cancel",
      fallbackLabel: "Use Password",
    })

    return result.success
  } catch {
    return false
  }
}

export function getBiometricType(): "face" | "fingerprint" | "iris" | null {
  // This is a simplified version - in production you'd check the actual type
  // For now, we'll let the system handle it
  return null
}

