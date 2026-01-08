// apps/mobile/lib/store-config.ts
import { makePersistedAdapter } from '@livestore/adapter-expo'
import { StoreRegistry, storeOptions } from '@livestore/livestore'
import { makeWsSync } from '@livestore/sync-cf/client'
import { schema } from '@sitelink/domain'
import { unstable_batchedUpdates as batchUpdates } from 'react-native'

const storeId = process.env.EXPO_PUBLIC_LIVESTORE_STORE_ID
const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL

let _storeRegistry: StoreRegistry | null = null

/**
 * Get or create the singleton StoreRegistry instance
 * Manages store lifecycle, caching, and retention
 */
export function getStoreRegistry(): StoreRegistry {
  if (!_storeRegistry) {
    _storeRegistry = new StoreRegistry({
      defaultOptions: {
        batchUpdates, // React Native's batching for optimal re-renders
        unusedCacheTime: 60_000, // Keep stores for 60s after last use
      },
    })
  }
  return _storeRegistry
}

/**
 * Create store options for the main app store
 * Call this function with the current session token to get properly configured store options
 */
export function createAppStoreOptions(sessionToken: string) {
  if (!storeId) {
    throw new Error('EXPO_PUBLIC_LIVESTORE_STORE_ID is not configured')
  }

  return storeOptions({
    schema,
    storeId,
    adapter: makePersistedAdapter({
      sync: {
        backend: syncUrl ? makeWsSync({ url: syncUrl }) : undefined,
      },
    }),
    // Pass session token as sync payload for backend authentication
    syncPayload: { authToken: sessionToken },
  })
}
