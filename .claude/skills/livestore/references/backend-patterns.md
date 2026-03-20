# LiveStore Backend Patterns — SiteLink

## Sync Worker (Cloudflare Worker)

The sync worker handles WebSocket connections from mobile/web clients:

```typescript
// apps/backend/src/sync/worker.ts
import { makeDurableObject, makeWorker } from "@livestore/sync-cf/cf-worker"

// Durable Object for WebSocket sync
export class SyncBackendDO extends makeDurableObject({
  onPush: async (message, context) => {
    // message.batch = array of events from client
    // context.storeId = which store
    // context.payload = the syncPayload from client (contains authToken)
    console.log("[Sync] Received", message.batch.length, "events")
  },
  onPull: async (message, context) => {
    // message.cursor = last event the client has
    // No filtering needed — sync library handles event retrieval
  },
}) {}

// Worker factory
export function createSyncWorker(env: Env) {
  return makeWorker({
    syncBackendBinding: "SYNC_BACKEND_DO", // wrangler.json binding name
    validatePayload: (payload, context) => validateAuth(payload, context, env),
    enableCORS: true,
  })
}
```

### Auth Validation

The `validatePayload` function runs before any sync operation. Throw to reject:

```typescript
async function validatePayload(
  payload: any,
  context: { storeId: string },
  env: Env,
): Promise<void> {
  const authToken = payload?.authToken
  if (!authToken) throw new Error("Missing auth token")

  // Validate session via direct DB query
  // (auth.api.getSession() has known issues with WebSocket headers — GH #3892)
  const session = await env.DB.prepare(
    "SELECT s.*, u.id as user_id FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
  )
    .bind(authToken, Date.now())
    .first()

  if (!session) throw new Error("Invalid or expired session")
}
```

### Wrangler Configuration

```jsonc
// wrangler.json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "SYNC_BACKEND_DO",
        "class_name": "SyncBackendDO",
      },
      {
        "name": "LIVESTORE_CLIENT_DO",
        "class_name": "LiveStoreClientDO",
      },
    ],
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["SyncBackendDO", "LiveStoreClientDO"],
    },
  ],
}
```

Both DOs need `new_sqlite_classes` — LiveStore uses DO-internal SQLite for event storage.

## Server-Side LiveStore Client (Durable Object)

For committing events from the backend (e.g., after processing a plan):

```typescript
// apps/backend/src/sync/livestore-client.ts
import { createStoreDoPromise } from "@livestore/adapter-cloudflare"
import { events, schema } from "@sitelink/domain"

export class LiveStoreClientDO implements DurableObject {
  private store: any | undefined

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  private async getStore() {
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

  // Generic commit — takes event name + data
  async commit(eventName: string, data: any): Promise<void> {
    const store = await this.getStore()
    const eventCreator = (events as any)[eventName]
    if (!eventCreator) throw new Error(`Unknown event: ${eventName}`)
    await store.commit(eventCreator(data))
  }

  // HTTP handler for RPC
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/commit" && request.method === "POST") {
      const { eventName, data } = await request.json()
      await this.commit(eventName, data)
      return Response.json({ success: true })
    }
    return Response.json({ error: "Not found" }, { status: 404 })
  }
}
```

### Calling from the main worker

```typescript
// Type-safe client wrapper
export function createLiveStoreClient(stub: DurableObjectStub): LiveStoreClient {
  return {
    async commit(eventName, data, storeId) {
      const response = await stub.fetch(
        `http://internal/commit?storeId=${encodeURIComponent(storeId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventName, data }),
        },
      )
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || `Failed to commit: ${eventName}`)
      }
    },
  }
}

// Usage in a route handler
const clientStub = env.LIVESTORE_CLIENT_DO.get(env.LIVESTORE_CLIENT_DO.idFromName("default"))
const client = createLiveStoreClient(clientStub)

await client.commit(
  "planProcessingCompleted",
  {
    planId: "plan-123",
    sheetCount: 4,
    completedAt: Date.now(),
  },
  organizationId,
)
```

## Import Map

| What                              | Import from                     |
| --------------------------------- | ------------------------------- |
| `makeDurableObject`, `makeWorker` | `@livestore/sync-cf/cf-worker`  |
| `makeWsSync`                      | `@livestore/sync-cf/client`     |
| `createStoreDoPromise`            | `@livestore/adapter-cloudflare` |
| `makePersistedAdapter`            | `@livestore/adapter-expo`       |
| `events`, `tables`, `schema`      | `@sitelink/domain`              |

The `/cf-worker` and `/client` subpath imports are distinct — don't mix them. The server uses `cf-worker`, clients use `client`.
