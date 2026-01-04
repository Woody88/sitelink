// apps/backend/src/index.ts
import { createAuth } from "./auth/auth"
import { WebSocketServer } from "./sync/websocket-server"
import { handleSyncRequest } from "./sync/worker"
import type { Env } from "./types/env"

// Export Durable Object for Cloudflare Workers
export { WebSocketServer }

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Initialize Better Auth
    const auth = createAuth(env.DB)

    // Handle Better Auth endpoints (e.g., /api/auth/*)
    if (url.pathname.startsWith("/api/auth")) {
      try {
        return await auth.handler(request)
      } catch (error) {
        console.error("Better Auth handler error:", error)
        return Response.json(
          {
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 },
        )
      }
    }

    // Handle LiveStore sync WebSocket endpoint
    const syncResponse = handleSyncRequest(request, env, ctx, auth)
    if (syncResponse) {
      return syncResponse
    }

    // Handle other API endpoints
    if (url.pathname === "/") {
      return new Response("Sitelink API", { status: 200 })
    }

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      })
    }

    return new Response("Not Found", { status: 404 })
  },
}
