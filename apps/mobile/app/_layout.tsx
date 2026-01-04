// apps/mobile/app/_layout.tsx
import '@/lib/polyfill'
import '@/global.css'

import { NAV_THEME } from '@/lib/theme'
import { ThemeProvider } from '@react-navigation/native'
import { PortalHost } from '@rn-primitives/portal'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect, useState } from 'react'
import { makePersistedAdapter } from '@livestore/adapter-expo'
import { LiveStoreProvider } from '@livestore/react'
import { makeCfSync } from '@livestore/sync-cf'
import { View, unstable_batchedUpdates as batchUpdates, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { schema } from '@sitelink/domain'
import { useAuth } from '@/hooks/useAuth'
import { getSessionToken } from '@/lib/auth'
import { isBiometricEnabled, authenticateWithBiometric } from '@/lib/biometric'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

const storeId = process.env.EXPO_PUBLIC_LIVESTORE_STORE_ID
const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL

export default function RootLayout() {
  const { theme } = useUniwind()
  const [, rerender] = React.useState({})
  const { isAuthenticated, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [biometricChecked, setBiometricChecked] = useState(false)
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false)
  const [syncPayload, setSyncPayload] = useState<{ authToken: string } | undefined>(undefined)

  // Create adapter conditionally - only enable sync when authenticated
  const adapter = React.useMemo(
    () =>
      makePersistedAdapter({
        sync: {
          backend: syncUrl && isAuthenticated ? makeCfSync({ url: syncUrl }) : undefined,
        },
      }),
    [isAuthenticated]
  )

  useEffect(() => {
    async function updateSyncPayload() {
      const token = await getSessionToken()
      if (token) {
        setSyncPayload({ authToken: token })
      } else {
        setSyncPayload(undefined)
      }
    }
    if (isAuthenticated) {
      updateSyncPayload()
    } else {
      setSyncPayload(undefined)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      checkBiometric()
    } else if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading, isAuthenticated])

  async function checkBiometric() {
    const enabled = await isBiometricEnabled()
    if (enabled) {
      setShowBiometricPrompt(true)
      const success = await authenticateWithBiometric()
      if (success) {
        setShowBiometricPrompt(false)
        SplashScreen.hideAsync()
      } else {
        router.replace('/(auth)/login' as any)
      }
    } else {
      SplashScreen.hideAsync()
    }
    setBiometricChecked(true)
  }

  useEffect(() => {
    if (isLoading) return

    const firstSegment = segments[0] as string
    const inAuthGroup =
      firstSegment === '(auth)' ||
      firstSegment === 'login' ||
      firstSegment === 'signup' ||
      firstSegment === 'biometric-setup'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login' as any)
    } else if (isAuthenticated && inAuthGroup && biometricChecked && !showBiometricPrompt) {
      router.replace('/(tabs)/plan' as any)
    }
  }, [isAuthenticated, isLoading, segments, biometricChecked, showBiometricPrompt])

  if (showBiometricPrompt) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Authenticating...</Text>
      </View>
    )
  }

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
        renderShutdown={() => {
          return (
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
          )
        }}
        batchUpdates={batchUpdates}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </LiveStoreProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <PortalHost />
    </ThemeProvider>
  )
}
