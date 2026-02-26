// apps/backend/src/index.ts
import { createAuth } from "./auth/auth"
import { PdfProcessor } from "./processing"
import { LiveStoreClientDO } from "./sync/client-do"
import { createLiveStoreClient } from "./sync/livestore-client"
import { createSyncWorker, SyncBackendDO } from "./sync/worker"
import { PlanProcessingWorkflow } from "./workflows/plan-processing"
import type { Env } from "./types/env"

// Export Durable Objects, Container, and Workflow classes for Cloudflare Workers
export { SyncBackendDO, LiveStoreClientDO, PdfProcessor, PlanProcessingWorkflow }

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
    // VIEWER API ENDPOINTS
    // ============================================

    // Serve R2 files (for viewer to access PMTiles and images)
    // Requires authentication: either Authorization: Bearer token or ?st= query param (for WebView)
    if (url.pathname.startsWith("/api/r2/") && request.method === "GET") {
      const r2Path = decodeURIComponent(url.pathname.replace("/api/r2/", ""))
      if (!r2Path) {
        return Response.json({ error: "Missing path" }, { status: 400 })
      }

      // Authenticate: Bearer token from header, or ?st= from URL (for WebView/PMTiles use)
      const authHeader = request.headers.get("authorization")
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
      const queryToken = url.searchParams.get("st")
      const authToken = bearerToken || queryToken

      if (!authToken) {
        return Response.json({ error: "Authentication required" }, { status: 401 })
      }

      const sessionResult = await env.DB.prepare(
        "SELECT s.user_id FROM session s WHERE s.token = ? AND s.expires_at > ?",
      )
        .bind(authToken, Date.now())
        .first<{ user_id: string }>()

      if (!sessionResult) {
        return Response.json({ error: "Invalid or expired session" }, { status: 401 })
      }

      // Verify the requested path is within an organization the user owns or is a member of
      // R2 paths are organized as: organizations/{orgId}/...
      const orgMatch = r2Path.match(/^organizations\/([^/]+)\//)
      if (orgMatch) {
        const orgId = orgMatch[1]!
        const memberCheck = await env.DB.prepare(
          "SELECT 1 FROM member WHERE organization_id = ? AND user_id = ? LIMIT 1",
        )
          .bind(orgId, sessionResult.user_id)
          .first()

        if (!memberCheck) {
          return Response.json({ error: "Access denied" }, { status: 403 })
        }
      }

      // Authenticated: serve the file without public edge caching
      const isImmutable = /\.(pmtiles|png|webp)$/i.test(r2Path)

      // Cache authenticated responses in Workers edge cache, keyed per-user so
      // different users never share cached content. Both Bearer and ?st= token
      // paths are cached (PMTiles viewer uses ?st= since WebViews can't set headers).
      const cache = caches.default
      let cacheKey: Request | undefined
      if (isImmutable) {
        // Normalize URL: strip ?st= token, then append user-scoped fragment
        const cacheUrl = new URL(url.toString())
        cacheUrl.searchParams.delete("st")
        cacheKey = new Request(cacheUrl.toString() + `#${sessionResult.user_id}`, {
          headers: { Range: request.headers.get("Range") || "" },
        })
        const cached = await cache.match(cacheKey)
        if (cached) return cached
      }

      try {
        // Parse Range header and pass to R2 for native range support
        const rangeHeader = request.headers.get("Range")
        let rangeStart: number | undefined
        let rangeEnd: number | undefined

        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
          if (match) {
            rangeStart = parseInt(match[1]!, 10)
            rangeEnd = match[2] ? parseInt(match[2]!, 10) : undefined
          }
        }

        const object = await env.R2_BUCKET.get(r2Path, rangeStart !== undefined ? {
          range: rangeEnd !== undefined
            ? { offset: rangeStart, length: rangeEnd - rangeStart + 1 }
            : { offset: rangeStart },
        } : undefined)

        if (!object) {
          return Response.json({ error: "Not found", path: r2Path }, { status: 404 })
        }

        const headers = new Headers()
        headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream")
        headers.set("Access-Control-Allow-Origin", "*")
        headers.set("Accept-Ranges", "bytes")
        // PMTiles and images are immutable once generated — cache aggressively on device.
        // Use private (not shared) to prevent cross-user leakage via CDN edge caches.
        // stale-while-revalidate lets the WebView serve stale tiles instantly while
        // revalidating in the background when the 24h max-age expires.
        headers.set(
          "Cache-Control",
          isImmutable
            ? "private, max-age=86400, stale-while-revalidate=604800"
            : "private, max-age=300",
        )

        if (rangeStart !== undefined) {
          const end = rangeEnd !== undefined ? rangeEnd : object.size - 1
          const length = rangeEnd !== undefined ? rangeEnd - rangeStart + 1 : object.size - rangeStart
          headers.set("Content-Range", `bytes ${rangeStart}-${end}/${object.size}`)
          headers.set("Content-Length", String(length))
          const response = new Response(object.body, { status: 206, headers })
          if (cacheKey) ctx.waitUntil(cache.put(cacheKey, response.clone()))
          return response
        }

        headers.set("Content-Length", String(object.size))
        const response = new Response(object.body, { headers })
        if (cacheKey) ctx.waitUntil(cache.put(cacheKey, response.clone()))
        return response
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

    // ============================================
    // AI FEATURES
    // ============================================

    // Daily Summary Generation
    // POST /api/projects/:id/summary
    // Body: { photos: [{time, location, isIssue, voiceNote}], projectName, date }
    const summaryMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/summary$/)
    if (summaryMatch && request.method === "POST") {
      try {
        const authHeader = request.headers.get("authorization")
        const authToken = authHeader?.replace("Bearer ", "") || url.searchParams.get("st")

        if (!authToken) {
          return Response.json({ error: "Authentication required" }, { status: 401 })
        }

        const sessionResult = await env.DB.prepare(
          "SELECT s.user_id, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
        )
          .bind(authToken, Date.now())
          .first<{ user_id: string; name: string }>()

        if (!sessionResult) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 })
        }

        if (!env.OPENROUTER_API_KEY) {
          return Response.json({ error: "AI features not configured" }, { status: 503 })
        }

        const body = await request.json() as {
          projectName: string
          date: string
          address?: string
          photos: Array<{
            time: string
            location: string | null
            isIssue: boolean
            voiceNote?: string | null
          }>
        }

        const { projectName, date, address, photos } = body

        const photoLines = photos.length > 0
          ? photos.map(p => [
            `- Time: ${p.time}`,
            `  Location: ${p.location ?? "General"}`,
            `  Issue: ${p.isIssue ? "Yes" : "No"}`,
            p.voiceNote ? `  Voice note: "${p.voiceNote}"` : null,
          ].filter(Boolean).join("\n")).join("\n")
          : "No photos captured today."

        const prompt = `Generate a professional Daily Construction Report from the following data.

Project: ${projectName}
${address ? `Address: ${address}` : ""}
Date: ${date}
Report By: ${sessionResult.name}

Photos captured today:
${photoLines}

Format the report with these sections:
1. WORK PERFORMED - summarize by location, mention photo counts
2. ISSUES / DELAYS - list flagged issues with any voice note quotes; omit section if none
3. MATERIALS RECEIVED - only include if mentioned in voice notes; omit section if none

Keep it professional, concise, and use construction terminology. Do not include a title header — start directly with WORK PERFORMED.`

        const model = env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001"
        const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sitelink.app",
            "X-Title": "SiteLink",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 600,
            temperature: 0.3,
          }),
        })

        if (!llmResponse.ok) {
          const err = await llmResponse.text()
          console.error("[Summary] OpenRouter error:", err)
          return Response.json({ error: "AI service error" }, { status: 502 })
        }

        const llmData = await llmResponse.json() as {
          choices: Array<{ message: { content: string } }>
        }
        const summaryText = llmData.choices?.[0]?.message?.content?.trim() ?? ""

        return Response.json({ summary: summaryText })
      } catch (error) {
        console.error("[Summary] Error:", error)
        return Response.json({ error: "Failed to generate summary" }, { status: 500 })
      }
    }

    // Voice Note Transcription via Whisper
    // POST /api/voice-notes/transcribe  (multipart/form-data: file=<audio>)
    if (url.pathname === "/api/voice-notes/transcribe" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("authorization")
        const authToken = authHeader?.replace("Bearer ", "") || url.searchParams.get("st")

        if (!authToken) {
          return Response.json({ error: "Authentication required" }, { status: 401 })
        }

        const sessionResult = await env.DB.prepare(
          "SELECT s.user_id FROM session s WHERE s.token = ? AND s.expires_at > ?",
        )
          .bind(authToken, Date.now())
          .first<{ user_id: string }>()

        if (!sessionResult) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 })
        }

        if (!env.OPENAI_API_KEY) {
          return Response.json({ error: "Transcription not configured" }, { status: 503 })
        }

        const formData = await request.formData()
        const audioFile = formData.get("file") as File | null

        if (!audioFile) {
          return Response.json({ error: "Missing audio file" }, { status: 400 })
        }

        // Forward to OpenAI Whisper
        const whisperForm = new FormData()
        whisperForm.append("file", audioFile)
        whisperForm.append("model", "whisper-1")
        whisperForm.append("language", "en")

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: whisperForm,
        })

        if (!whisperRes.ok) {
          const err = await whisperRes.text()
          console.error("[Transcribe] Whisper error:", err)
          return Response.json({ error: "Transcription failed" }, { status: 502 })
        }

        const result = await whisperRes.json() as { text: string }
        return Response.json({ transcription: result.text.trim() })
      } catch (error) {
        console.error("[Transcribe] Error:", error)
        return Response.json({ error: "Transcription failed" }, { status: 500 })
      }
    }

    // Handle CORS preflight for viewer
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Range, Authorization",
          "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
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
}
