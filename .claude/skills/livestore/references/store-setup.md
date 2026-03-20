# LiveStore Store Setup — SiteLink Patterns

## StoreRegistry (Singleton)

The `StoreRegistry` manages store lifecycle, caching, and retention. Create ONE instance for the whole app:

```typescript
// apps/mobile/lib/store-config.ts
import { StoreRegistry, storeOptions } from "@livestore/livestore"
import { makePersistedAdapter } from "@livestore/adapter-expo"
import { makeWsSync } from "@livestore/sync-cf/client"
import { schema } from "@sitelink/domain"
import { unstable_batchedUpdates as batchUpdates } from "react-native"

let _storeRegistry: StoreRegistry | null = null

export function getStoreRegistry(): StoreRegistry {
  if (!_storeRegistry) {
    _storeRegistry = new StoreRegistry({
      defaultOptions: {
        batchUpdates, // React Native's batching for optimal re-renders
        unusedCacheTime: 60_000, // Keep stores in memory 60s after last use
      },
    })
  }
  return _storeRegistry
}
```

## Store Options Factory

Create store options with conditional sync (demo mode vs authenticated):

```typescript
export function createAppStoreOptions(sessionToken?: string | null) {
  const isDemo = isDemoMode()
  const effectiveStoreId = isDemo ? "demo-store" : storeId

  return storeOptions({
    schema,
    storeId: effectiveStoreId,
    adapter: makePersistedAdapter({
      sync: {
        backend: !isDemo && syncUrl && sessionToken ? makeWsSync({ url: syncUrl }) : undefined, // undefined = local-only, no sync
      },
    }),
    syncPayload: !isDemo && sessionToken ? { authToken: sessionToken } : undefined,
  })
}
```

Key points:

- `makeWsSync` replaces `makeCfSync` from 0.3.1
- Pass `syncPayload` with auth token — the sync worker validates it
- Set `sync.backend: undefined` for local-only mode (no network)
- `storeOptions()` is a factory that returns a stable options reference

## useAppStore Hook

The hook pattern that components use:

```typescript
// apps/mobile/livestore/store.ts
import { queryDb } from "@livestore/livestore"
import { storeOptions, useStore } from "@livestore/react"
import { makePersistedAdapter } from "@livestore/adapter-expo"
import { makeWsSync } from "@livestore/sync-cf/client"
import { schema, tables } from "@sitelink/domain"

// Global cache to survive React unmount/remount cycles
const globalOptionsCache = new Map<string, any>()

export const useAppStore = (storeId: string, sessionToken?: string, sessionId?: string) => {
  const isDemo = isDemoMode()
  const effectiveStoreId = isDemo ? "demo-store" : storeId
  const cacheKey = `${effectiveStoreId}-${sessionId || "no-session"}`

  const options = useMemo(() => {
    if (globalOptionsCache.has(cacheKey)) {
      return globalOptionsCache.get(cacheKey)
    }

    const newOptions = storeOptions({
      storeId: effectiveStoreId,
      schema,
      adapter: makePersistedAdapter({
        sync: {
          backend: !isDemo && syncUrl && sessionToken ? makeWsSync({ url: syncUrl }) : undefined,
        },
      }),
      syncPayload: !isDemo && sessionToken ? { authToken: sessionToken } : undefined,
      batchUpdates,
    })

    globalOptionsCache.set(cacheKey, newOptions)
    return newOptions
  }, [cacheKey, effectiveStoreId, sessionToken, isDemo])

  const store = useStore(options)
  return store
}
```

The global cache is important — `storeOptions()` must return the same reference across re-renders. React's `useMemo` alone isn't sufficient because it doesn't survive component unmount/remount.

## Provider Setup

Wrap the app root with `StoreRegistryProvider`:

```tsx
import { StoreRegistryProvider } from "@livestore/react"

function App() {
  return (
    <StoreRegistryProvider registry={getStoreRegistry()}>
      <Suspense fallback={<LoadingScreen />}>
        <AppContent />
      </Suspense>
    </StoreRegistryProvider>
  )
}
```

Note: `StoreRegistryProvider` replaced `LiveStoreProvider` in 0.4.0. The old provider took schema/adapter/storeId as props; the new one just takes a registry. Store creation now happens inside `useStore()` via `storeOptions()`.

## Environment Variables

```bash
EXPO_PUBLIC_LIVESTORE_STORE_ID=your-store-id
EXPO_PUBLIC_LIVESTORE_SYNC_URL=wss://your-backend.workers.dev
```

## Query Patterns in Custom Hooks

```typescript
// hooks/use-projects.ts
import { queryDb } from "@livestore/livestore"
import { tables } from "@sitelink/domain"

export function useProjects(store: Store) {
  const projects = store.useQuery(queryDb(tables.projects.orderBy("updatedAt", "desc")))
  const sheets = store.useQuery(queryDb(tables.sheets))
  const photos = store.useQuery(queryDb(tables.photos))

  // Join in JS — LiveStore queries are single-table
  return projects.map((project) => ({
    ...project,
    sheetCount: sheets.filter((s) => s.planId && s.projectId === project.id).length,
    photoCount: photos.filter((p) => p.projectId === project.id).length,
  }))
}
```

LiveStore queries are single-table. Joins happen in JavaScript. This is by design — it keeps the reactive layer simple and predictable.

## Demo Mode / Seeding Data

```typescript
export function seedDemoData(store: Store): void {
  const now = Date.now()

  // Check if already seeded (one-shot query)
  const existing = store.query(
    queryDb(tables.organizations.where({ id: DEMO_ORG_ID }))
  )
  if (existing.length > 0) return

  // Commit events in sequence
  store.commit(events.organizationCreated({
    id: DEMO_ORG_ID,
    name: "Demo Corp",
    ownerId: DEMO_USER_ID,
    ownerEmail: "demo@example.com",
    ownerName: "Demo User",
    createdAt: now,
  }))

  store.commit(events.projectCreated({...}))
  // ... more seed events
}
```

Use `store.query()` (one-shot) to check if data exists before seeding. Use `store.commit()` (sync) for seeding — not `await store.commit()`.
