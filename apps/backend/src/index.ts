// apps/backend/src/index.ts
import { createAuth } from "./auth/auth"
import { SyncBackendDO, createSyncWorker } from "./sync/worker"
import { createLiveStoreClient } from "./sync/livestore-client"
import { LiveStoreClientDO } from "./sync/client-do"
import {
  PlanCoordinator,
  handleImageGenerationQueue,
  handleMetadataExtractionQueue,
  handleCalloutDetectionQueue,
  handleTileGenerationQueue,
} from "./processing"
import type { Env } from "./types/env"

// Export Durable Objects for Cloudflare Workers
export { SyncBackendDO, LiveStoreClientDO, PlanCoordinator }

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Initialize LiveStore client from DO binding
    // This allows the backend to emit events programmatically
    const liveStoreClientStub = env.LIVESTORE_CLIENT_DO.get(
      env.LIVESTORE_CLIENT_DO.idFromName("default"),
    )
    const liveStoreClient = createLiveStoreClient(liveStoreClientStub)

    // Initialize Better Auth with LiveStore integration
    const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET, env.BETTER_AUTH_URL, liveStoreClient)

    // Handle Better Auth endpoints (e.g., /api/auth/*)
    if (url.pathname.startsWith("/api/auth")) {
      try {
        const mutableRequest = new Request(request, {
          headers: new Headers(request.headers),
        })
        const response = await auth.handler(mutableRequest)

        // Debug: Log getSession responses to see what's being returned
        if (url.pathname === "/api/auth/get-session") {
          const clonedResponse = response.clone()
          const body = await clonedResponse.json()
          console.log("[Auth API] getSession response:", JSON.stringify(body, null, 2))
        }

        return response
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

    // Handle LiveStore sync requests using the new makeWorker pattern
    // The makeWorker automatically detects sync requests via query params
    // Check if this is a sync request by looking for LiveStore query params
    const queryParams = new URLSearchParams(url.search)
    if (queryParams.has("storeId") || queryParams.has("transport")) {
      const syncWorker = createSyncWorker(env)
      return syncWorker.fetch(request as any, env, ctx) as any
    }

    // Handle plan upload endpoint
    if (url.pathname === "/api/plans/upload" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("authorization")
        const authToken = authHeader?.replace("Bearer ", "")

        if (!authToken) {
          return Response.json({ error: "Missing authorization token" }, { status: 401 })
        }

        const sessionResult = await env.DB.prepare(
          "SELECT s.*, u.id as user_id, u.email, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
        )
          .bind(authToken, Date.now())
          .first<{ user_id: string; email: string; name?: string }>()

        if (!sessionResult) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get("file") as File
        const projectId = formData.get("projectId") as string
        const organizationId = formData.get("organizationId") as string

        if (!file || !projectId || !organizationId) {
          return Response.json({ error: "Missing required fields: file, projectId, organizationId" }, { status: 400 })
        }

        if (file.type !== "application/pdf") {
          return Response.json({ error: "File must be a PDF" }, { status: 400 })
        }

        const { checkProjectAccess } = await import("./utils/authorization")
        const hasAccess = await checkProjectAccess(projectId, sessionResult.user_id, env)

        if (!hasAccess) {
          return Response.json({ error: "User does not have access to this project" }, { status: 403 })
        }

        const { nanoid } = await import("@livestore/livestore")
        const planId = nanoid()
        const pdfPath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/source.pdf`

        await env.R2_BUCKET.put(pdfPath, await file.arrayBuffer(), {
          httpMetadata: { contentType: "application/pdf" },
        })

        const totalPages = 1

        await liveStoreClient.commit(
          "planUploaded",
          {
            id: planId,
            projectId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            localPath: `file://plans/${planId}/source.pdf`,
            remotePath: pdfPath,
            uploadedBy: sessionResult.user_id,
            uploadedAt: new Date(),
          },
          organizationId,
        )

        await env.IMAGE_GENERATION_QUEUE.send({
          planId,
          projectId,
          organizationId,
          pdfPath,
          totalPages,
        })

        return Response.json({
          success: true,
          planId,
          message: "Plan uploaded, processing started",
        })
      } catch (error) {
        console.error("Plan upload error:", error)
        return Response.json(
          { error: error instanceof Error ? error.message : "Upload failed" },
          { status: 500 },
        )
      }
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

  // Queue consumers for PDF processing pipeline
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const queueName = (batch as any).queue

    switch (queueName) {
      case "sitelink-image-generation":
        await handleImageGenerationQueue(batch as any, env)
        break
      case "sitelink-metadata-extraction":
        await handleMetadataExtractionQueue(batch as any, env)
        break
      case "sitelink-callout-detection":
        await handleCalloutDetectionQueue(batch as any, env)
        break
      case "sitelink-tile-generation":
        await handleTileGenerationQueue(batch as any, env)
        break
      default:
        console.error(`Unknown queue: ${queueName}`)
        // Ack all messages to prevent infinite retries
        for (const message of batch.messages) {
          message.ack()
        }
    }
  },
}
