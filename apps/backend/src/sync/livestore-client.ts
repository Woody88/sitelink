// apps/backend/src/sync/livestore-client.ts
import { createStoreDoPromise } from '@livestore/adapter-cloudflare'
import { schema, events } from '@sitelink/domain'
import type { Env } from '../types/env'

/**
 * LiveStoreClientDO - Server-side LiveStore client running in a Durable Object
 *
 * This DO provides a server-side LiveStore instance that can:
 * - Commit events to the sync backend
 * - React to database changes (via Better Auth hooks)
 * - Emit events that sync to all connected clients
 *
 * Unlike the WebSocketServer DO which handles client connections,
 * this DO is used by the backend to emit events programmatically.
 */
export class LiveStoreClientDO implements DurableObject {
  // Use any for now due to complex type inference issues with @cloudflare/workers-types
  private store: any | undefined

  constructor(
    private ctx: DurableObjectState,
    private env: Env
  ) {}

  /**
   * Initialize the server-side LiveStore instance
   */
  private async getStore(): Promise<any> {
    if (this.store) {
      return this.store
    }

    // Get the sync backend stub
    const syncBackendStub: any = this.env.SYNC_BACKEND_DO.get(
      // Use a deterministic ID for the sync backend
      this.env.SYNC_BACKEND_DO.idFromName('default')
    )

    // Create the server-side LiveStore instance
    this.store = await createStoreDoPromise({
      schema,
      storeId: 'server-store',
      clientId: this.ctx.id.toString(),
      sessionId: 'server-session',
      durableObject: {
        ctx: this.ctx,
        env: this.env,
        bindingName: 'LIVESTORE_CLIENT_DO',
      },
      syncBackendStub,
    } as any)

    return this.store
  }

  /**
   * Commit a UserCreated event
   * Called from Better Auth hooks when a new user is created
   */
  async commitUserCreated(data: {
    id: string
    email: string
    name: string
    avatarUrl?: string
  }): Promise<void> {
    const store = await this.getStore()

    // Call events.userCreated() as a function to create the event
    await store.commit(events.userCreated({
      id: data.id,
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
    }))

    console.log('[LiveStoreClientDO] Committed UserCreated event:', data.id)
  }

  /**
   * Handle HTTP requests to this DO
   * Provides RPC-style endpoints for backend operations
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // RPC endpoint for committing UserCreated events
    if (url.pathname === '/commit-user-created' && request.method === 'POST') {
      try {
        const data = await request.json() as {
          id: string
          email: string
          name: string
          avatarUrl?: string
        }
        await this.commitUserCreated(data)
        return Response.json({ success: true })
      } catch (error) {
        console.error('[LiveStoreClientDO] Error committing UserCreated:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return Response.json(
          { error: errorMessage },
          { status: 500 }
        )
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}

/**
 * Type-safe interface for calling LiveStoreClientDO from the main worker
 */
export interface LiveStoreClient {
  commitUserCreated(data: {
    id: string
    email: string
    name: string
    avatarUrl?: string
  }): Promise<void>
}

/**
 * Create a LiveStoreClient instance from a DO stub
 */
export function createLiveStoreClient(
  stub: DurableObjectStub
): LiveStoreClient {
  return {
    async commitUserCreated(data) {
      const response = await stub.fetch('http://internal/commit-user-created', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json() as { error?: string }
        throw new Error(errorData.error || 'Failed to commit UserCreated event')
      }
    },
  }
}
