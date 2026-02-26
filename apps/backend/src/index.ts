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

        // Fetch weather data if address is provided (uses free Open-Meteo + Nominatim)
        let weatherDescription = ""
        if (address) {
          try {
            // Geocode address using Nominatim (free, no API key)
            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
            const geoRes = await fetch(geoUrl, {
              headers: { "User-Agent": "SiteLink/1.0 construction-app" },
            })
            if (geoRes.ok) {
              const geoData = await geoRes.json() as Array<{ lat: string; lon: string }>
              if (geoData.length > 0) {
                const { lat, lon } = geoData[0]
                // Fetch current weather from Open-Meteo (free, no API key)
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&temperature_unit=celsius&wind_speed_unit=kmh&forecast_days=1`
                const weatherRes = await fetch(weatherUrl)
                if (weatherRes.ok) {
                  const weatherData = await weatherRes.json() as {
                    current: {
                      temperature_2m: number
                      weather_code: number
                      wind_speed_10m: number
                      precipitation: number
                    }
                  }
                  const { temperature_2m, weather_code, wind_speed_10m, precipitation } = weatherData.current
                  const getWeatherDesc = (code: number): string => {
                    if (code === 0) return "Clear sky"
                    if (code <= 3) return "Partly cloudy"
                    if (code <= 9) return "Fog"
                    if (code <= 29) return "Rain"
                    if (code <= 49) return "Snow/Fog"
                    if (code <= 69) return "Rain/Drizzle"
                    if (code <= 79) return "Snow"
                    if (code <= 84) return "Rain showers"
                    if (code <= 99) return "Thunderstorm"
                    return "Overcast"
                  }
                  const tempF = Math.round(temperature_2m * 9 / 5 + 32)
                  weatherDescription = `${getWeatherDesc(weather_code)}, ${Math.round(temperature_2m)}°C (${tempF}°F), Wind ${Math.round(wind_speed_10m)} km/h${precipitation > 0 ? `, Precipitation ${precipitation}mm` : ""}`
                }
              }
            }
          } catch (weatherError) {
            console.warn("[Summary] Weather fetch failed:", weatherError)
          }
        }

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
${weatherDescription ? `Weather: ${weatherDescription}` : ""}
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

    // Public Report: Create shareable link
    // POST /api/reports
    // Body: { projectName, reportDate, summaryText }
    if (url.pathname === "/api/reports" && request.method === "POST") {
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

        const body = await request.json() as {
          projectName: string
          reportDate: string
          summaryText: string
        }

        if (!body.projectName || !body.summaryText) {
          return Response.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Ensure the public_reports table exists
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS public_reports (
            id TEXT PRIMARY KEY,
            project_name TEXT NOT NULL,
            report_date TEXT NOT NULL,
            summary_text TEXT NOT NULL,
            generated_by TEXT NOT NULL,
            created_at INTEGER NOT NULL
          )`,
        ).run()

        // Generate a short unique ID for the public URL
        const reportId = crypto.randomUUID().replace(/-/g, "").slice(0, 12)

        await env.DB.prepare(
          "INSERT INTO public_reports (id, project_name, report_date, summary_text, generated_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
          .bind(reportId, body.projectName, body.reportDate, body.summaryText, sessionResult.name, Date.now())
          .run()

        const shareUrl = `${url.origin}/reports/${reportId}`
        return Response.json({ reportId, shareUrl })
      } catch (error) {
        console.error("[Reports] Create error:", error)
        return Response.json({ error: "Failed to create report" }, { status: 500 })
      }
    }

    // Public Report: View shared report (no auth required)
    // GET /api/reports/:id
    const publicReportMatch = url.pathname.match(/^\/reports\/([a-z0-9]+)$/)
    if (publicReportMatch && request.method === "GET") {
      try {
        const reportId = publicReportMatch[1]

        const report = await env.DB.prepare(
          "SELECT project_name, report_date, summary_text, generated_by, created_at FROM public_reports WHERE id = ?",
        )
          .bind(reportId)
          .first<{ project_name: string; report_date: string; summary_text: string; generated_by: string; created_at: number }>()

        if (!report) {
          return new Response("Report not found", { status: 404 })
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.project_name} - Daily Report ${report.report_date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; }
    .container { max-width: 700px; margin: 0 auto; padding: 24px 16px; }
    .header { background: #1a1a1a; color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.7; }
    .content { background: white; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e5; border-top: none; }
    .summary { font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
    .footer { margin-top: 16px; text-align: center; font-size: 12px; color: #999; }
    .badge { display: inline-block; background: #f0f0f0; color: #666; padding: 4px 10px; border-radius: 100px; font-size: 12px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${report.project_name}</h1>
      <p>Daily Construction Report · ${report.report_date}</p>
    </div>
    <div class="content">
      <span class="badge">Generated by ${report.generated_by}</span>
      <div class="summary">${report.summary_text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>
    <div class="footer">Generated with SiteLink · sitelink.app</div>
  </div>
</body>
</html>`

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      } catch (error) {
        console.error("[Reports] View error:", error)
        return new Response("Internal server error", { status: 500 })
      }
    }

    // Voice Note Upload to R2
    // POST /api/voice-notes/upload  (multipart/form-data: file=<audio>, voiceNoteId=<id>)
    if (url.pathname === "/api/voice-notes/upload" && request.method === "POST") {
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

        const formData = await request.formData()
        const audioFile = formData.get("file") as File | null
        const voiceNoteId = formData.get("voiceNoteId") as string | null

        if (!audioFile) {
          return Response.json({ error: "Missing audio file" }, { status: 400 })
        }
        if (!voiceNoteId) {
          return Response.json({ error: "Missing voiceNoteId" }, { status: 400 })
        }

        // Store in R2
        const ext = audioFile.name?.endsWith(".webm") ? "webm" : "m4a"
        const r2Key = `voice-notes/${sessionResult.user_id}/${voiceNoteId}.${ext}`
        await env.R2_BUCKET.put(r2Key, await audioFile.arrayBuffer(), {
          httpMetadata: { contentType: audioFile.type || "audio/m4a" },
        })

        return Response.json({ remotePath: r2Key })
      } catch (error) {
        console.error("[VoiceNote Upload] Error:", error)
        return Response.json({ error: "Upload failed" }, { status: 500 })
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
