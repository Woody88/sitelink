import '@/global.css'

import { NAV_THEME } from '@/lib/theme'
import { ThemeProvider } from '@react-navigation/native'
import { PortalHost } from '@rn-primitives/portal'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useUniwind } from 'uniwind'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect } from 'react'
import { makePersistedAdapter } from '@livestore/adapter-expo'
import { nanoid } from '@livestore/livestore'
import { LiveStoreProvider } from '@livestore/react'
import { makeCfSync } from '@livestore/sync-cf'
import { View, unstable_batchedUpdates as batchUpdates } from 'react-native'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { events, schema, tables } from '@/src/livestore/schema'

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

const storeId = process.env.EXPO_PUBLIC_LIVESTORE_STORE_ID
const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL

const adapter = makePersistedAdapter({
  sync: { backend: syncUrl ? makeCfSync({ url: syncUrl }) : undefined },
})

export default function RootLayout() {
  const { theme } = useUniwind()
  const [, rerender] = React.useState({})

  useEffect(() => {
    // Hide the splash screen once the app is ready
    SplashScreen.hideAsync()
  }, [])

  return (
    <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
      <LiveStoreProvider
        schema={schema}
        adapter={adapter}
        storeId={storeId}
        syncPayload={{ authToken: 'insecure-token-change-me' }}
        renderLoading={(_) => <Text>Loading LiveStore ({_.stage})...</Text>}
        renderError={(error: any) => <Text>Error: {error.toString()}</Text>}
        renderShutdown={() => {
          return (
            <View>
              <Text>LiveStore Shutdown</Text>
              <Button title="Reload" onPress={() => rerender({})} />
            </View>
          )
        }}
        boot={(store) => {
          if (store.query(tables.todos.count()) === 0) {
            store.commit(events.todoCreated({ id: nanoid(), text: 'Make coffee' }))
          }
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
