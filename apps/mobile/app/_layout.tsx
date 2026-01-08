// apps/mobile/app/_layout.tsx
import '@/lib/polyfill'
import '@/global.css'

import { NAV_THEME } from '@/lib/theme'
import { ThemeProvider } from '@react-navigation/native'
import { PortalHost } from '@rn-primitives/portal'
import { Redirect, Stack, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect, useState, useCallback } from 'react'
import { StoreRegistryProvider } from '@livestore/react'
import { View, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'
import { ProjectProvider } from '@/context/project-context'
import { getStoreRegistry } from '@/lib/store-config'
import {
  isBiometricEnabled,
  authenticateWithBiometric,
  isBiometricSetupComplete,
  setBiometricEnabled,
  isBiometricAvailable,
} from '@/lib/biometric'

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync()

/**
 * Auth flow states - the layout renders different content based on this
 */
type AuthFlowState =
  | 'loading' // Auth is loading
  | 'unauthenticated' // Not logged in → show login/signup
  | 'biometric-setup' // Just signed up → show biometric setup
  | 'biometric-prompt' // Returning user → verify biometric
  | 'authenticated' // Ready → show main app

export default function RootLayout() {
  const { theme } = useUniwind()
  const { data, isPending } = authClient.useSession()
  const [, rerender] = React.useState({})
  const segments = useSegments()

  const inAuthGroup = segments[0] === '(auth)'

  React.useEffect(() => {
    if (!isPending) {
      SplashScreen.hideAsync()
    }
  }, [isPending])

  if (isPending && !data?.session) {
    return <></>
  }

  if (!data?.session) {
    if (!inAuthGroup) return <Redirect href={'/(auth)/login'} />

    return (
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <PortalHost />
      </ThemeProvider>
    )
  }

  // User is authenticated - provide StoreRegistry for data access
  return (
    <StoreRegistryProvider storeRegistry={getStoreRegistry()}>
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <ProjectProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ProjectProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <PortalHost />
      </ThemeProvider>
    </StoreRegistryProvider>
  )
}

/**
 * Inline Biometric Setup Screen - rendered directly by layout, not via navigation
 */
function BiometricSetupScreen({ onComplete }: { onComplete: () => void }) {
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAvailability() {
      const isAvailable = await isBiometricAvailable()
      setAvailable(isAvailable)
      setLoading(false)
    }
    checkAvailability()
  }, [])

  async function handleEnable() {
    setError(null)
    console.log('[BIOMETRIC-SETUP] User chose to enable biometrics')
    const success = await authenticateWithBiometric()
    if (success) {
      console.log('[BIOMETRIC-SETUP] Authentication successful, saving preference')
      await setBiometricEnabled(true)
      onComplete()
    } else {
      setError('Biometric authentication failed. Please try again.')
    }
  }

  async function handleSkip() {
    console.log('[BIOMETRIC-SETUP] User chose to skip biometrics')
    await setBiometricEnabled(false)
    onComplete()
  }

  const biometricName = Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint'

  if (loading) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <Text>Checking biometric availability...</Text>
      </SafeAreaView>
    )
  }

  if (!available) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center p-6">
        <View className="items-center gap-4">
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
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="bg-background flex-1 justify-center p-6">
      <View className="gap-6">
        <View className="gap-2">
          <Text variant="h1" className="text-center">
            Enable {biometricName}?
          </Text>
          <Text variant="muted" className="text-center">
            Use {biometricName} to quickly unlock the app and access your projects.
          </Text>
        </View>

        {error && <Text className="text-destructive text-center text-sm">{error}</Text>}

        <View className="gap-3">
          <Button testID="enable-biometric-button" onPress={handleEnable}>
            <Text>Enable {biometricName}</Text>
          </Button>

          <Button variant="ghost" testID="skip-biometric-button" onPress={handleSkip}>
            <Text>Skip for now</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  )
}
