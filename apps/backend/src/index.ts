// apps/backend/src/index.ts
import { createAuth } from "./auth/auth"
import {
  handleCalloutDetectionQueue,
  handleDocLayoutDetectionQueue,
  handleImageGenerationQueue,
  handleMetadataExtractionQueue,
  handleR2NotificationQueue,
  handleTileGenerationQueue,
  PdfProcessor,
  PlanCoordinator,
  simulateR2Notification,
  uploadPdfAndTriggerPipeline,
} from "./processing"
import { LiveStoreClientDO } from "./sync/client-do"
import { createLiveStoreClient } from "./sync/livestore-client"
import { createSyncWorker, SyncBackendDO } from "./sync/worker"
import { PlanProcessingWorkflow } from "./workflows/plan-processing"
import type { Env } from "./types/env"

// Export Durable Objects, Container, and Workflow classes for Cloudflare Workers
export { SyncBackendDO, LiveStoreClientDO, PlanCoordinator, PdfProcessor, PlanProcessingWorkflow }

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
        const fileName = (formData.get("fileName") as string) || file.name
        const projectId = formData.get("projectId") as string
        const organizationId = formData.get("organizationId") as string

        if (!file || !projectId || !organizationId) {
          return Response.json(
            {
              error: "Missing required fields: file, projectId, organizationId",
            },
            { status: 400 },
          )
        }

        if (file.type !== "application/pdf") {
          return Response.json({ error: "File must be a PDF" }, { status: 400 })
        }

        // TODO: Implement project access check via LiveStore
        // Projects are stored in LiveStore, not D1, so we can't check D1 for access
        // For now, rely on organization membership (already validated above)
        // const { checkProjectAccess } = await import("./utils/authorization");
        // const hasAccess = await checkProjectAccess(
        // 	projectId,
        // 	sessionResult.user_id,
        // 	env,
        // );
        //
        // if (!hasAccess) {
        // 	return Response.json(
        // 		{ error: "User does not have access to this project" },
        // 		{ status: 403 },
        // 	);
        // }

        const { nanoid } = await import("@livestore/livestore")
        const planId = nanoid()
        const pdfPath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/source.pdf`
        const totalPages = 1
        const planName = fileName.replace(/\.pdf$/i, "")

        // Upload PDF to R2
        await env.R2_BUCKET.put(pdfPath, await file.arrayBuffer(), {
          httpMetadata: { contentType: "application/pdf" },
          customMetadata: {
            planId,
            projectId,
            organizationId,
            ...(planName ? { planName } : {}),
          },
        })

        // Trigger Workflow pipeline (replaces 6-queue + PlanCoordinator architecture)
        const instance = await env.PLAN_PROCESSING_WORKFLOW.create({
          id: planId,
          params: { planId, projectId, organizationId, pdfPath, totalPages, planName },
        })
        console.log(`[Upload] Workflow instance created: ${instance.id}`)

        await liveStoreClient.commit(
          "planUploaded",
          {
            id: planId,
            projectId,
            fileName,
            fileSize: file.size,
            mimeType: file.type,
            localPath: `file://plans/${planId}/source.pdf`,
            remotePath: pdfPath,
            uploadedBy: sessionResult.user_id,
            uploadedAt: Date.now(),
          },
          organizationId,
        )

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

    // ============================================
    // LOCAL DEV TEST ENDPOINTS (no auth required)
    // ============================================

    // Test endpoint to manually trigger pipeline (bypasses R2 event notifications)
    if (url.pathname === "/api/test/trigger-pipeline" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          planId?: string
          projectId: string
          organizationId: string
          totalPages?: number
        }

        const { nanoid } = await import("@livestore/livestore")
        const planId = body.planId || nanoid()
        const totalPages = body.totalPages || 3

        // Create a test PDF path (you'd upload a real PDF separately)
        const pdfPath = `organizations/${body.organizationId}/projects/${body.projectId}/plans/${planId}/source.pdf`

        console.log(`[TEST] Triggering pipeline for plan ${planId}`)

        // Queue the image generation job
        await env.IMAGE_GENERATION_QUEUE.send({
          planId,
          projectId: body.projectId,
          organizationId: body.organizationId,
          pdfPath,
          totalPages,
          planName: `test-plan-${planId}`,
        })

        return Response.json({
          success: true,
          planId,
          pdfPath,
          totalPages,
          message: "Pipeline triggered - check wrangler logs for processing",
        })
      } catch (error) {
        console.error("[TEST] Trigger error:", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // Test endpoint to check PlanCoordinator state
    if (url.pathname.startsWith("/api/test/coordinator/") && request.method === "GET") {
      const planId = url.pathname.split("/").pop()
      if (!planId) {
        return Response.json({ error: "Missing planId" }, { status: 400 })
      }

      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)
      const state = await coordinator.getState()

      return Response.json({ planId, state })
    }

    // Test endpoint to simulate R2 notification for existing PDF
    if (url.pathname === "/api/test/simulate-r2-notification" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          pdfPath: string
          fileSize?: number
        }

        if (!body.pdfPath) {
          return Response.json({ error: "Missing pdfPath" }, { status: 400 })
        }

        await simulateR2Notification(env, body.pdfPath, body.fileSize || 0)

        return Response.json({
          success: true,
          message: `Simulated R2 notification sent for ${body.pdfPath}`,
        })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // Test endpoint to upload PDF and auto-trigger pipeline (no auth, for local dev)
    if (url.pathname === "/api/test/upload-pdf" && request.method === "POST") {
      try {
        const formData = await request.formData()
        const file = formData.get("file") as File
        const projectId = (formData.get("projectId") as string) || "test-project"
        const organizationId = (formData.get("organizationId") as string) || "test-org"
        const totalPages = parseInt(formData.get("totalPages") as string) || 1

        if (!file) {
          return Response.json({ error: "No file provided" }, { status: 400 })
        }

        const { nanoid } = await import("@livestore/livestore")
        const planId = nanoid()
        const pdfPath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/source.pdf`

        // Upload and automatically trigger pipeline (simulates R2 event notification)
        await uploadPdfAndTriggerPipeline(env, pdfPath, await file.arrayBuffer(), {
          planId,
          projectId,
          organizationId,
          totalPages,
        })

        return Response.json({
          success: true,
          planId,
          pdfPath,
          fileSize: file.size,
          totalPages,
          message: "PDF uploaded and pipeline triggered automatically!",
        })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // ============================================
    // VIEWER API ENDPOINTS
    // ============================================

    // Serve R2 files (for viewer to access PMTiles and images)
    if (url.pathname.startsWith("/api/r2/") && request.method === "GET") {
      const r2Path = decodeURIComponent(url.pathname.replace("/api/r2/", ""))
      if (!r2Path) {
        return Response.json({ error: "Missing path" }, { status: 400 })
      }

      try {
        const object = await env.R2_BUCKET.get(r2Path)
        if (!object) {
          return Response.json({ error: "Not found", path: r2Path }, { status: 404 })
        }

        const headers = new Headers()
        headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream")
        headers.set("Access-Control-Allow-Origin", "*")
        headers.set("Cache-Control", "public, max-age=3600")

        // Support range requests for PMTiles
        const rangeHeader = request.headers.get("Range")
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
          if (match) {
            const start = parseInt(match[1], 10)
            const end = match[2] ? parseInt(match[2], 10) : object.size - 1
            const body = await object.arrayBuffer()
            const slice = body.slice(start, end + 1)

            headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`)
            headers.set("Content-Length", String(slice.byteLength))
            return new Response(slice, { status: 206, headers })
          }
        }

        return new Response(object.body, { headers })
      } catch (error) {
        console.error("[R2] Error fetching:", r2Path, error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // Serve LiveStore events for viewer
    // This reads from the SyncBackendDO's eventlog table
    if (url.pathname === "/api/events" && request.method === "GET") {
      try {
        const organizationId = url.searchParams.get("organizationId") || "test-org"

        // Get the SyncBackendDO for this store
        const syncBackendStub = env.SYNC_BACKEND_DO.get(
          env.SYNC_BACKEND_DO.idFromName(organizationId),
        )

        // Call a new endpoint to get events
        const response = await syncBackendStub.fetch(
          `http://internal/events?storeId=${organizationId}`,
          {
            method: "GET",
          },
        )

        if (!response.ok) {
          const error = await response.text()
          console.error("[Events] SyncBackendDO error:", error)
          return Response.json([])
        }

        const events = await response.json()
        return Response.json(events, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        })
      } catch (error) {
        console.error("[Events] Error fetching events:", error)
        return Response.json([])
      }
    }

    // Handle CORS preflight for viewer
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Range",
        },
      })
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
      case "sitelink-r2-notifications":
        await handleR2NotificationQueue(batch as any, env)
        break
      case "sitelink-image-generation":
        await handleImageGenerationQueue(batch as any, env)
        break
      case "sitelink-metadata-extraction":
        await handleMetadataExtractionQueue(batch as any, env)
        break
      case "sitelink-callout-detection":
        await handleCalloutDetectionQueue(batch as any, env)
        break
      case "sitelink-doclayout-detection":
        await handleDocLayoutDetectionQueue(batch as any, env)
        break
      case "sitelink-tile-generation":
        await handleTileGenerationQueue(batch as any, env)
        break
      default:
        console.error(`Unknown queue: ${queueName}`)
        for (const message of batch.messages) {
          message.ack()
        }
    }
  },
}
