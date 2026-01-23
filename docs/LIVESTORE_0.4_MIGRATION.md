# LiveStore 0.4.0 Migration Guide

This document details the migration from LiveStore 0.3.1 to 0.4.0-dev.22, including breaking changes, new patterns, and implementation details.

**Migration Date:** January 7, 2026
**Project:** Sitelink Mobile + Backend
**From:** LiveStore 0.3.1
**To:** LiveStore 0.4.0-dev.22

---

## Executive Summary

LiveStore 0.4.0 introduces a **complete API redesign** around the `StoreRegistry` pattern, enabling better store lifecycle management, caching, and multi-store support. The migration required significant refactoring of both mobile and backend code.

### Key Changes

- ✅ Replaced `LiveStoreProvider` with `StoreRegistryProvider`
- ✅ Introduced `StoreRegistry` for store lifecycle management
- ✅ Server-side event emission via Cloudflare adapter
- ✅ Updated Effect package dependencies (3.15.2 → 3.19.14)
- ✅ Fixed Durable Object SQL configuration
- ✅ Cleaned up deferred client-side event emission pattern

---

## Breaking Changes

### 1. React Provider API Change

**Before (0.3.1):**

```tsx
import { LiveStoreProvider } from '@livestore/react'
import { makePersistedAdapter } from '@livestore/adapter-expo'
import { makeCfSync } from '@livestore/sync-cf'

const adapter = makePersistedAdapter({
  sync: {
    backend: makeCfSync({ url: syncUrl }),
  },
})

<LiveStoreProvider
  schema={schema}
  adapter={adapter}
  storeId={storeId}
  syncPayload={syncPayload}
  renderLoading={(stage) => <LoadingView stage={stage} />}
  renderError={(error) => <ErrorView error={error} />}
  renderShutdown={() => <ShutdownView />}
  batchUpdates={batchUpdates}>
  {children}
</LiveStoreProvider>
```

**After (0.4.0):**

```tsx
import { StoreRegistryProvider } from '@livestore/react'
import { StoreRegistry, storeOptions } from '@livestore/livestore'

// Create singleton registry
const storeRegistry = new StoreRegistry({
  defaultOptions: {
    batchUpdates,
    unusedCacheTime: 60_000, // 60 seconds
  },
})

// Components use the registry
<StoreRegistryProvider storeRegistry={storeRegistry}>
  {children}
</StoreRegistryProvider>
```

**Key Differences:**

- No more `renderLoading`, `renderError`, `renderShutdown` props
- Store configuration moved to per-component level via `useStore()` hook
- Registry handles caching and lifecycle automatically
- Simpler provider setup, more flexible usage

### 2. Mobile Sync Import Change

**Before (0.3.1):**

```tsx
import { makeCfSync } from "@livestore/sync-cf"
```

**After (0.4.0):**

```tsx
import { makeWsSync } from "@livestore/sync-cf/client"
```

**Reason:** The `@livestore/sync-cf` package is for **backend only** (Cloudflare Workers). Mobile apps must use the `/client` subpath which exports `makeWsSync` for WebSocket client connections.

### 3. Store Access Pattern

**Before (0.3.1):**
Store was provided implicitly through `LiveStoreProvider` context.

**After (0.4.0):**
Explicitly fetch store in components using `useStore()`:

```tsx
import { useStore } from "@livestore/react"
import { createAppStoreOptions } from "@/lib/store-config"

function MyComponent() {
  const sessionToken = getSessionToken()
  const { store } = useStore(createAppStoreOptions(sessionToken))

  // Use store for queries, commits, etc.
  const projects = useQuery(store.queryProjectsByUser(userId))
}
```

### 4. Server-Side Event Emission

**Before (0.3.1):**
Client-side deferred pattern - store pending user in SecureStore, emit after LiveStore mounts.

**After (0.4.0):**
Server emits events directly via better-auth `databaseHooks`:

```typescript
// apps/backend/src/auth/auth.ts
export function createAuth(
  db: D1Database,
  secret: string,
  baseUrl: string,
  liveStoreClient?: LiveStoreClient,
) {
  return betterAuth({
    // ... config
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (liveStoreClient) {
              await liveStoreClient.commitUserCreated({
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.image ?? undefined,
              })
            }
          },
        },
      },
    },
  })
}
```

---

## Package Updates

### Effect Ecosystem (Critical)

**Required for 0.4.0-dev.22 compatibility:**

```json
{
  "catalogs": {
    "effect": {
      "effect": "3.19.14", // was 3.15.2
      "@effect/platform": "0.94.1" // was 0.82.4 (added to catalog)
    }
  }
}
```

**Why:** LiveStore 0.4.0-dev.22 uses newer Effect APIs (`effect/Graph`, `@effect/platform/HttpLayerRouter`) that don't exist in older versions.

### LiveStore Packages

All updated to `0.4.0-dev.22`:

```json
{
  "catalogs": {
    "livestore": {
      "@livestore/livestore": "0.4.0-dev.22",
      "@livestore/adapter-expo": "0.4.0-dev.22",
      "@livestore/adapter-web": "0.4.0-dev.22",
      "@livestore/adapter-cloudflare": "0.4.0-dev.22", // NEW
      "@livestore/devtools-expo": "0.4.0-dev.22",
      "@livestore/react": "0.4.0-dev.22",
      "@livestore/sync-cf": "0.4.0-dev.22",
      "@livestore/peer-deps": "0.4.0-dev.22"
    }
  }
}
```

---

## Backend Changes

### 1. Wrangler Configuration

**Updated:** `apps/backend/wrangler.json`

```json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "SYNC_BACKEND_DO", // renamed from WEBSOCKET_SERVER
        "class_name": "WebSocketServer",
        "script_name": "sitelink-backend"
      },
      {
        "name": "LIVESTORE_CLIENT_DO", // NEW
        "class_name": "LiveStoreClientDO",
        "script_name": "sitelink-backend"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["WebSocketServer", "LiveStoreClientDO"] // BOTH need SQL
    }
  ]
}
```

**Critical Changes:**

- Both DOs use `new_sqlite_classes` (was `new_classes` for WebSocketServer)
- LiveStore 0.4.0 requires SQL storage for both sync backend and client DOs
- Renamed binding from `WEBSOCKET_SERVER` to `SYNC_BACKEND_DO` (required by `makeWorker`)

### 2. Worker Pattern Simplification

**Updated:** `apps/backend/src/sync/worker.ts`

```typescript
import { makeDurableObject, makeWorker } from "@livestore/sync-cf/cf-worker"

// Define WebSocketServer inline
export class WebSocketServer extends makeDurableObject({
  onPush: async (message) => {
    console.log("onPush", message.batch)
  },
  onPull: async (message) => {
    console.log("onPull", message)
  },
}) {}

// Export default worker
export default makeWorker({
  validatePayload: async (payload: any, env: Env) => {
    const { authToken } = payload

    if (!authToken) {
      throw new Error("No auth token provided")
    }

    // Direct DB query (better-auth session validation issues persist)
    const sessionResult = await env.DB.prepare(
      "SELECT s.*, u.id as user_id, u.email, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
    )
      .bind(authToken, Date.now())
      .first()

    if (!sessionResult) {
      throw new Error("Invalid or expired session")
    }

    return {
      userId: sessionResult.user_id,
      userEmail: sessionResult.email,
    }
  },
  enableCORS: true,
})
```

**Removed:**

- `createSyncWorker()` function
- `handleSyncRequest()` function
- Separate `websocket-server.ts` file

**Benefits:**

- Simpler, more declarative pattern
- Less boilerplate
- Follows official LiveStore 0.4.0 patterns

### 3. Server-Side LiveStore Client

**New File:** `apps/backend/src/sync/livestore-client.ts`

This Durable Object provides a server-side LiveStore instance for programmatic event emission:

```typescript
export class LiveStoreClientDO implements DurableObject {
  private store: any | undefined

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  private async getStore(): Promise<any> {
    if (this.store) return this.store

    const syncBackendStub = this.env.SYNC_BACKEND_DO.get(
      this.env.SYNC_BACKEND_DO.idFromName("default"),
    )

    this.store = await createStoreDoPromise({
      schema,
      storeId: "server-store",
      clientId: this.ctx.id.toString(),
      sessionId: "server-session",
      durableObject: {
        ctx: this.ctx,
        env: this.env,
        bindingName: "LIVESTORE_CLIENT_DO",
      },
      syncBackendStub,
    })

    return this.store
  }

  async commitUserCreated(data: {
    id: string
    email: string
    name: string
    avatarUrl?: string
  }): Promise<void> {
    const store = await this.getStore()

    // IMPORTANT: Call events.userCreated() as a function
    await store.commit(
      events.userCreated({
        id: data.id,
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
      }),
    )
  }

  // HTTP RPC interface
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/commit-user-created" && request.method === "POST") {
      const data = await request.json()
      await this.commitUserCreated(data)
      return Response.json({ success: true })
    }

    return Response.json({ error: "Not found" }, { status: 404 })
  }
}
```

**Event Emission Syntax:**

```typescript
// ❌ Wrong (0.3.1 style)
await store.commit(events.userCreated, { id, email, name, avatarUrl })

// ✅ Correct (0.4.0)
await store.commit(events.userCreated({ id, email, name, avatarUrl }))
```

### 4. Better Auth Configuration

**Updated:** `apps/backend/src/auth/auth.ts`

Added required `secret` and `baseURL` parameters:

```typescript
export function createAuth(
  db: D1Database,
  secret: string, // NEW: Required for signing tokens
  baseUrl: string, // NEW: Required for auth endpoints
  liveStoreClient?: LiveStoreClient,
) {
  return betterAuth({
    secret, // Signs JWT tokens, encrypts sessions
    baseURL: baseUrl, // Base URL for auth redirects
    // ... rest of config
  })
}
```

**Environment Variables** (`.dev.vars`):

```bash
BETTER_AUTH_SECRET=7y0ARec3uxL6lwYx0s5epioJTwaloPo6
BETTER_AUTH_URL=http://localhost:8787
```

---

## Mobile App Changes

### 1. Store Configuration Module

**New File:** `apps/mobile/lib/store-config.ts`

Centralizes all LiveStore setup logic:

```typescript
import { StoreRegistry, storeOptions } from "@livestore/livestore"
import { makePersistedAdapter } from "@livestore/adapter-expo"
import { makeWsSync } from "@livestore/sync-cf/client"
import { unstable_batchedUpdates as batchUpdates } from "react-native"

let _storeRegistry: StoreRegistry | null = null

export function getStoreRegistry(): StoreRegistry {
  if (!_storeRegistry) {
    _storeRegistry = new StoreRegistry({
      defaultOptions: {
        batchUpdates,
        unusedCacheTime: 60_000,
      },
    })
  }
  return _storeRegistry
}

export function createAppStoreOptions(sessionToken: string) {
  return storeOptions({
    schema,
    storeId: process.env.EXPO_PUBLIC_LIVESTORE_STORE_ID,
    adapter: makePersistedAdapter({
      sync: {
        backend: makeWsSync({ url: process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL }),
      },
    }),
    syncPayload: { authToken: sessionToken },
  })
}
```

**Pattern:**

- Lazy initialization with singleton pattern
- Registry created on first access
- Store options factory function for components

### 2. Layout Simplification

**Updated:** `apps/mobile/app/_layout.tsx`

```tsx
import { StoreRegistryProvider } from "@livestore/react"
import { getStoreRegistry } from "@/lib/store-config"

export default function RootLayout() {
  const { data, isPending } = authClient.useSession()

  if (!data?.session) {
    return <UnauthenticatedLayout />
  }

  return (
    <StoreRegistryProvider storeRegistry={getStoreRegistry()}>
      <ThemeProvider value={NAV_THEME[theme ?? "light"]}>
        <ProjectProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ProjectProvider>
      </ThemeProvider>
    </StoreRegistryProvider>
  )
}
```

**Removed:**

- All `renderLoading`, `renderError`, `renderShutdown` UI code
- `NetworkStatusMonitor` component (placeholder, not fully implemented)
- `NewUserEventCommitter` component (server handles this now)
- Old `RootLayout2` with biometric flow (unused)

### 3. Cleanup - Removed Files

**Deleted:**

- `apps/mobile/components/NewUserEventCommitter.tsx` - Server-side emission replaces this
- Deferred event code from `lib/biometric.ts`:
  - `PENDING_NEW_USER_KEY`
  - `PendingNewUser` type
  - `setPendingNewUser()`, `getPendingNewUser()`, `clearPendingNewUser()`
- Deferred event code from `hooks/useAuth.ts`:
  - `setPendingNewUser()` call in sign-up handler

---

## How Components Use Stores (0.4.0)

### Before (0.3.1)

Store was implicitly available through context:

```tsx
function MyComponent() {
  // Store was magically available via LiveStoreProvider context
  const projects = useQuery(/* ... */)
}
```

### After (0.4.0)

Explicitly fetch store with options:

```tsx
import { useStore } from '@livestore/react'
import { createAppStoreOptions } from '@/lib/store-config'

function MyComponent() {
  const { data: session } = authClient.useSession()

  // Get store with session-specific configuration
  const { store } = useStore(createAppStoreOptions(session.token))

  // Use store for queries
  const projects = useQuery(store.queryProjectsByUser(userId))

  // Commit events
  const handleCreate = () => {
    store.commit(events.projectCreated({ ... }))
  }
}
```

**Benefits:**

- Each component explicitly declares its store needs
- StoreRegistry caches stores by configuration
- Multiple stores possible (different storeIds, adapters, etc.)
- Automatic cleanup when component unmounts

---

## StoreRegistry Features

### Automatic Caching

The `StoreRegistry` automatically:

- **Reuses stores** with identical configuration (storeId, adapter, schema)
- **Tracks retention** - keeps stores alive while components use them
- **Cleans up** after `unusedCacheTime` (default 60s) when no components reference the store

### Lifecycle Management

```typescript
const registry = new StoreRegistry({
  defaultOptions: {
    batchUpdates, // React batching function
    unusedCacheTime: 60_000, // Keep stores 60s after last use
    confirmUnsavedChanges: true, // Warn before closing with unsaved data
  },
})
```

**States:**

1. **Loading** - Store is initializing (boot, sync handshake)
2. **Active** - At least one component using the store
3. **Unused** - No components using it, cache timer running
4. **Disposed** - Cleaned up after cache time expires

### Multi-Store Support

You can now have multiple stores in the same app:

```typescript
// User store
const userStoreOptions = storeOptions({
  storeId: "user-store",
  schema: userSchema,
  adapter: makePersistedAdapter({
    /* ... */
  }),
})

// Organization store
const orgStoreOptions = storeOptions({
  storeId: "org-store",
  schema: orgSchema,
  adapter: makePersistedAdapter({
    /* ... */
  }),
})

function MyComponent() {
  const { store: userStore } = useStore(userStoreOptions)
  const { store: orgStore } = useStore(orgStoreOptions)

  // Use both stores independently
}
```

---

## Testing the Migration

### Backend Tests

1. **Start backend:**

   ```bash
   cd apps/backend
   bun dev:network
   ```

2. **Verify logs:**

   ```
   ✓ Both DOs bind correctly (SYNC_BACKEND_DO, LIVESTORE_CLIENT_DO)
   ✓ Server starts on http://localhost:8787
   ✓ Health check: GET /health → 200 OK
   ```

3. **Test sign-up:**

   ```bash
   curl -X POST http://localhost:8787/api/auth/sign-up/email \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
   ```

   **Expected logs:**

   ```
   [Auth] UserCreated event emitted for: <user-id>
   [LiveStoreClientDO] Committed UserCreated event: <user-id>
   [Sync] onPush: Received batch with 1 events
   ```

### Mobile Tests

1. **Clear cache and start:**

   ```bash
   cd apps/mobile
   rm -rf .expo node_modules/.cache
   bun dev
   ```

2. **Test flows:**
   - ✅ Sign up new user
   - ✅ Sign in existing user
   - ✅ Verify sync connection logs
   - ✅ Check data appears in UI

3. **Expected logs:**
   ```
   [SyncStatus] Connected successfully
   [SIGNUP] Result: { success: true, isNewUser: true }
   [Sync] onPull: Client requesting events since...
   ```

---

## Troubleshooting

### Error: "StoreRegistry doesn't exist"

**Symptom:** Metro bundler can't find `StoreRegistry` export

**Fix:** Clear Metro cache:

```bash
rm -rf .expo node_modules/.cache
bun dev --clear
```

### Error: "SQL is not enabled for this Durable Object class"

**Symptom:** Backend crashes with SQL error

**Fix:** Update migrations in `wrangler.json`:

```json
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["WebSocketServer", "LiveStoreClientDO"]
  }
]
```

Then delete local storage:

```bash
rm -rf apps/backend/.wrangler/state
```

### Error: "Invalid event args for event 'v1.UserCreated'"

**Symptom:** Event emission fails

**Fix:** Call event factory as function:

```typescript
// ❌ Wrong
store.commit(events.userCreated, { id, email, name })

// ✅ Correct
store.commit(events.userCreated({ id, email, name }))
```

### Error: "Could not resolve effect/Graph"

**Symptom:** Backend bundling fails

**Fix:** Update Effect packages:

```json
{
  "catalogs": {
    "effect": {
      "effect": "3.19.14",
      "@effect/platform": "0.94.1"
    }
  }
}
```

---

## Migration Checklist

### Backend

- [x] Update package versions to 0.4.0-dev.22
- [x] Update Effect packages (3.19.14, @effect/platform 0.94.1)
- [x] Add `@livestore/adapter-cloudflare` dependency
- [x] Update wrangler.json:
  - [x] Rename binding to `SYNC_BACKEND_DO`
  - [x] Add `LIVESTORE_CLIENT_DO` binding
  - [x] Use `new_sqlite_classes` for both DOs
- [x] Simplify `worker.ts` with `makeWorker` pattern
- [x] Create `livestore-client.ts` DO for server events
- [x] Add `secret` and `baseURL` to better-auth config
- [x] Add `databaseHooks` to emit UserCreated events
- [x] Create `.dev.vars` with `BETTER_AUTH_SECRET`
- [x] Delete old websocket-server.ts file
- [x] Delete local DO storage (.wrangler/state)

### Mobile

- [x] Update package versions to 0.4.0-dev.22
- [x] Create `lib/store-config.ts` module
- [x] Replace `LiveStoreProvider` with `StoreRegistryProvider`
- [x] Change import from `makeCfSync` to `makeWsSync`
- [x] Remove `renderLoading`, `renderError`, `renderShutdown` code
- [x] Delete `NewUserEventCommitter.tsx`
- [x] Remove deferred event code from `biometric.ts`
- [x] Remove deferred event code from `useAuth.ts`
- [x] Clean up unused `RootLayout2` and `NetworkStatusMonitor`
- [x] Clear Metro cache before testing

---

## Future Improvements

### When 0.4.0 Stable Releases

1. **Update to stable version** - Replace `0.4.0-dev.22` with `0.4.0`
2. **Review changelog** - Check for any additional breaking changes
3. **Implement connectivity UI** - Complete network status indicator
4. **Add error boundaries** - Handle store loading/error states per-component
5. **Optimize store options** - Consider per-route store configurations

### Potential Enhancements

- **Multi-tenant stores** - Separate stores per organization/project
- **Offline-first UX** - Better feedback for sync status
- **Store preloading** - Use `registry.preload()` for faster navigation
- **Developer tools** - Integrate LiveStore devtools for debugging

---

## References

- [LiveStore Documentation](https://livestore.dev)
- [LiveStore 0.4.0 Changelog](https://github.com/livestorejs/livestore/releases)
- [Effect Documentation](https://effect.website)
- [Better Auth Documentation](https://better-auth.com)

---

**Last Updated:** January 7, 2026
**Migration Status:** ✅ Complete and Tested
