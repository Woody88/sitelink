// apps/mobile/app/_layout.tsx
import '@/lib/polyfill'
import '@/global.css'

import { NAV_THEME } from '@/lib/theme'
import { ThemeProvider } from '@react-navigation/native'
import { PortalHost } from '@rn-primitives/portal'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect, useState, useCallback } from 'react'
import { makePersistedAdapter } from '@livestore/adapter-expo'
import { LiveStoreProvider } from '@livestore/react'
import { makeCfSync } from '@livestore/sync-cf'
import { View, unstable_batchedUpdates as batchUpdates, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { schema } from '@sitelink/domain'
import { useAuth } from '@/hooks/useAuth'
import { getCookie } from '@/lib/auth'
import { ProjectProvider } from '@/context/project-context'
import {
  isBiometricEnabled,
  authenticateWithBiometric,
  isBiometricSetupComplete,
  setBiometricEnabled,
  isBiometricAvailable,
} from '@/lib/biometric'
import { Platform } from 'react-native'

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync()

const storeId = process.env.EXPO_PUBLIC_LIVESTORE_STORE_ID
const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL

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
  const [, rerender] = React.useState({})
  const { isAuthenticated, isLoading } = useAuth()

  const [flowState, setFlowState] = useState<AuthFlowState>('loading')
  const [syncPayload, setSyncPayload] = useState<{ authToken: string } | undefined>(undefined)

  // Create adapter - only enable sync when fully authenticated
  const adapter = React.useMemo(
    () =>
      makePersistedAdapter({
        sync: {
          backend:
            syncUrl && flowState === 'authenticated' ? makeCfSync({ url: syncUrl }) : undefined,
        },
      }),
    [flowState]
  )

  // Update sync payload when auth changes
  useEffect(() => {
    if (isAuthenticated) {
      const cookie = getCookie()
      if (cookie) {
        const match = cookie.match(/better-auth\.session_token=([^;]+)/)
        const token = match ? match[1] : null
        setSyncPayload(token ? { authToken: token } : undefined)
      }
    } else {
      setSyncPayload(undefined)
    }
  }, [isAuthenticated])

  // Determine flow state based on auth status
  useEffect(() => {
    async function determineFlowState() {
      console.log(
        '[LAYOUT] determineFlowState - isLoading:',
        isLoading,
        'isAuthenticated:',
        isAuthenticated
      )

      if (isLoading) {
        return // Keep current state while loading
      }

      if (!isAuthenticated) {
        console.log('[LAYOUT] → unauthenticated')
        setFlowState('unauthenticated')
        SplashScreen.hideAsync()
        return
      }

      // User is authenticated - check biometric status
      const setupComplete = await isBiometricSetupComplete()
      console.log('[LAYOUT] setupComplete:', setupComplete)

      if (!setupComplete) {
        // New user - needs to complete biometric setup
        console.log('[LAYOUT] → biometric-setup')
        setFlowState('biometric-setup')
        SplashScreen.hideAsync()
        return
      }

      // Returning user - check if biometric is enabled
      const enabled = await isBiometricEnabled()
      console.log('[LAYOUT] biometric enabled:', enabled)

      if (enabled) {
        // Need to verify biometric
        console.log('[LAYOUT] → biometric-prompt')
        setFlowState('biometric-prompt')
        SplashScreen.hideAsync()

        const success = await authenticateWithBiometric()
        if (success) {
          console.log('[LAYOUT] Biometric success → authenticated')
          setFlowState('authenticated')
        } else {
          // Failed biometric - force re-login
          console.log('[LAYOUT] Biometric failed → unauthenticated')
          setFlowState('unauthenticated')
        }
        return
      }

      // Biometric not enabled - go straight to app
      console.log('[LAYOUT] → authenticated')
      setFlowState('authenticated')
      SplashScreen.hideAsync()
    }

    determineFlowState()
  }, [isLoading, isAuthenticated])

  // Callback for biometric setup completion
  const handleBiometricSetupComplete = useCallback(() => {
    console.log('[LAYOUT] Biometric setup complete → authenticated')
    setFlowState('authenticated')
  }, [])

  // Render based on flow state
  if (flowState === 'loading' || isLoading) {
    return (
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <View className="bg-background flex-1 items-center justify-center">
          <Text>Loading...</Text>
        </View>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    )
  }

  if (flowState === 'unauthenticated') {
    return (
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
        </Stack>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <PortalHost />
      </ThemeProvider>
    )
  }

  if (flowState === 'biometric-setup') {
    return (
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <BiometricSetupScreen onComplete={handleBiometricSetupComplete} />
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <PortalHost />
      </ThemeProvider>
    )
  }

  if (flowState === 'biometric-prompt') {
    return (
      <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
        <View className="bg-background flex-1 items-center justify-center">
          <Text variant="h3">Verifying...</Text>
          <Text variant="muted" className="mt-2">
            Please authenticate to continue
          </Text>
        </View>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    )
  }

  // flowState === 'authenticated' - show main app with LiveStore
  return (
    <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
      <LiveStoreProvider
        schema={schema}
        adapter={adapter}
        storeId={storeId}
        syncPayload={syncPayload}
        renderLoading={(_) => (
          <SafeAreaView className="bg-background flex-1 items-center justify-center p-6">
            <Text variant="h3" className="mb-2">
              Loading LiveStore
            </Text>
            <Text variant="muted">{_.stage}</Text>
          </SafeAreaView>
        )}
        renderError={(error: any) => (
          <SafeAreaView className="bg-background flex-1 items-center justify-center p-6">
            <ScrollView
              contentContainerClassName="flex-1 items-center justify-center gap-4"
              showsVerticalScrollIndicator={false}>
              <Text variant="h2" className="text-destructive text-center">
                LiveStore Error
              </Text>
              <Text variant="muted" className="text-center">
                {error.toString()}
              </Text>
              <Button onPress={() => rerender({})} className="mt-4">
                <Text>Reload App</Text>
              </Button>
            </ScrollView>
          </SafeAreaView>
        )}
        renderShutdown={() => (
          <SafeAreaView className="bg-background flex-1 items-center justify-center p-6">
            <View className="items-center gap-4">
              <Text variant="h2" className="text-center">
                LiveStore Shutdown
              </Text>
              <Text variant="muted" className="text-center">
                The data store has been shut down. Please reload the app.
              </Text>
              <Button onPress={() => rerender({})}>
                <Text>Reload App</Text>
              </Button>
            </View>
          </SafeAreaView>
        )}
        batchUpdates={batchUpdates}>
        <ProjectProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ProjectProvider>
      </LiveStoreProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <PortalHost />
    </ThemeProvider>
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
