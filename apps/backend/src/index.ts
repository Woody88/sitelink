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

      // Authenticate: Bearer token from header, ?st= session token, or ?sc= share code
      const authHeader = request.headers.get("authorization")
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
      const queryToken = url.searchParams.get("st")
      const shareCode = url.searchParams.get("sc")
      const authToken = bearerToken || queryToken

      let isShareAuth = false

      if (!authToken && shareCode) {
        // Share code authentication: validate share code and verify path belongs to shared project
        const share = await env.DB.prepare(
          "SELECT project_id, organization_id, created_by, expires_at FROM project_shares WHERE code = ?",
        )
          .bind(shareCode)
          .first<{ project_id: string; organization_id: string | null; created_by: string; expires_at: number | null }>()

        if (!share || (share.expires_at !== null && share.expires_at < Date.now())) {
          return Response.json({ error: "Invalid or expired share code" }, { status: 401 })
        }

        // Resolve organization_id
        let orgId = share.organization_id
        if (!orgId) {
          const memberOrg = await env.DB.prepare(
            "SELECT organization_id FROM member WHERE user_id = ? LIMIT 1",
          )
            .bind(share.created_by)
            .first<{ organization_id: string }>()
          orgId = memberOrg?.organization_id ?? null
        }

        if (orgId) {
          // Verify the R2 path is under this org's project
          const expectedPrefix = `organizations/${orgId}/projects/${share.project_id}/`
          if (!r2Path.startsWith(expectedPrefix)) {
            return Response.json({ error: "Access denied" }, { status: 403 })
          }
          isShareAuth = true
        } else {
          return Response.json({ error: "Cannot resolve organization for share" }, { status: 500 })
        }
      } else if (!authToken) {
        return Response.json({ error: "Authentication required" }, { status: 401 })
      }

      let userId: string | undefined
      if (!isShareAuth) {
        const sessionResult = await env.DB.prepare(
          "SELECT s.user_id FROM session s WHERE s.token = ? AND s.expires_at > ?",
        )
          .bind(authToken, Date.now())
          .first<{ user_id: string }>()

        if (!sessionResult) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 })
        }

        userId = sessionResult.user_id

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
      }

      // Authenticated (session or share code): serve the file
      const isImmutable = /\.(pmtiles|png|webp)$/i.test(r2Path)

      // Cache authenticated responses in Workers edge cache, keyed per-user/share so
      // different users never share cached content. Both Bearer/?st= token and ?sc= share
      // code paths are cached (PMTiles viewer uses ?st= or ?sc= since WebViews can't set headers).
      const cache = caches.default
      let cacheKey: Request | undefined
      if (isImmutable) {
        // Normalize URL: strip auth tokens, then append scope fragment
        const cacheUrl = new URL(url.toString())
        cacheUrl.searchParams.delete("st")
        cacheUrl.searchParams.delete("sc")
        const cacheScope = isShareAuth ? `share:${shareCode}` : `user:${userId}`
        cacheKey = new Request(cacheUrl.toString() + `#${cacheScope}`, {
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
        // Share-authenticated requests use public cache (share links are public URLs).
        // Session-authenticated requests use private cache to prevent cross-user leakage.
        // stale-while-revalidate lets the WebView serve stale tiles instantly while
        // revalidating in the background when the 24h max-age expires.
        const cacheVisibility = isShareAuth ? "public" : "private"
        headers.set(
          "Cache-Control",
          isImmutable
            ? `${cacheVisibility}, max-age=86400, stale-while-revalidate=604800`
            : `${cacheVisibility}, max-age=300`,
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

    // Project Share: Create or retrieve share link
    // POST /api/projects/:projectId/share
    const projectShareCreateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/share$/)
    if (projectShareCreateMatch && request.method === "POST") {
      try {
        const authHeader = request.headers.get("authorization")
        const authToken = authHeader?.replace("Bearer ", "") || url.searchParams.get("st")

        if (!authToken) {
          return Response.json({ error: "Authentication required" }, { status: 401 })
        }

        const sessionResult = await env.DB.prepare(
          "SELECT s.user_id, s.active_organization_id, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
        )
          .bind(authToken, Date.now())
          .first<{ user_id: string; active_organization_id: string | null; name: string }>()

        if (!sessionResult) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 })
        }

        // Get organization_id: prefer session active org, fallback to first member org
        let organizationId = sessionResult.active_organization_id
        if (!organizationId) {
          const memberOrg = await env.DB.prepare(
            "SELECT organization_id FROM member WHERE user_id = ? LIMIT 1",
          )
            .bind(sessionResult.user_id)
            .first<{ organization_id: string }>()
          organizationId = memberOrg?.organization_id ?? null
        }

        const projectId = projectShareCreateMatch[1]
        const body = await request.json() as { expiresIn?: "7d" | "30d" | "never" }
        const expiresIn = body.expiresIn ?? "never"

        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS project_shares (
            code TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            organization_id TEXT,
            created_by TEXT NOT NULL,
            expires_at INTEGER,
            created_at INTEGER NOT NULL
          )`,
        ).run()

        // Add organization_id column if missing (upgrade existing table)
        try {
          await env.DB.prepare("ALTER TABLE project_shares ADD COLUMN organization_id TEXT").run()
        } catch {
          // Column already exists, ignore
        }

        // Check if a share link already exists for this project (reuse it)
        const existing = await env.DB.prepare(
          "SELECT code, expires_at FROM project_shares WHERE project_id = ? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1",
        )
          .bind(projectId, Date.now())
          .first<{ code: string; expires_at: number | null }>()

        let shareCode: string
        if (existing) {
          shareCode = existing.code
          // Update organization_id if missing
          if (organizationId) {
            await env.DB.prepare(
              "UPDATE project_shares SET organization_id = ? WHERE code = ? AND organization_id IS NULL",
            )
              .bind(organizationId, shareCode)
              .run()
          }
        } else {
          shareCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
          const expiresAt = expiresIn === "never"
            ? null
            : expiresIn === "7d"
              ? Date.now() + 7 * 24 * 60 * 60 * 1000
              : Date.now() + 30 * 24 * 60 * 60 * 1000

          await env.DB.prepare(
            "INSERT INTO project_shares (code, project_id, organization_id, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
            .bind(shareCode, projectId, organizationId, sessionResult.user_id, expiresAt, Date.now())
            .run()
        }

        const shareUrl = `${url.origin}/share/${shareCode}`
        return Response.json({ shareCode, shareUrl })
      } catch (error) {
        console.error("[ProjectShare] Create error:", error)
        return Response.json({ error: "Failed to create share link" }, { status: 500 })
      }
    }

    // Project Share: Revoke share link
    // DELETE /api/share/:code
    const projectShareRevokeMatch = url.pathname.match(/^\/api\/share\/([a-z0-9]+)$/)
    if (projectShareRevokeMatch && request.method === "DELETE") {
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

        const shareCode = projectShareRevokeMatch[1]
        await env.DB.prepare(
          "DELETE FROM project_shares WHERE code = ? AND created_by = ?",
        )
          .bind(shareCode, sessionResult.user_id)
          .run()

        return Response.json({ revoked: true })
      } catch (error) {
        console.error("[ProjectShare] Revoke error:", error)
        return Response.json({ error: "Failed to revoke share link" }, { status: 500 })
      }
    }

    // Project Share: Get project data for shared link (JSON API for mobile)
    // GET /api/share/:code
    const projectShareDataMatch = url.pathname.match(/^\/api\/share\/([a-z0-9]+)$/)
    if (projectShareDataMatch && request.method === "GET") {
      try {
        const shareCode = projectShareDataMatch[1]
        const share = await env.DB.prepare(
          "SELECT project_id, expires_at FROM project_shares WHERE code = ?",
        )
          .bind(shareCode)
          .first<{ project_id: string; expires_at: number | null }>()

        if (!share || (share.expires_at !== null && share.expires_at < Date.now())) {
          return Response.json({ error: "Share link not found or expired" }, { status: 404 })
        }

        return Response.json({ projectId: share.project_id, shareCode })
      } catch (error) {
        console.error("[ProjectShare] Data error:", error)
        return Response.json({ error: "Failed to load share data" }, { status: 500 })
      }
    }

    // Project Share: Get LiveStore events for shared project (no auth required)
    // GET /api/share/:code/events
    const projectShareEventsMatch = url.pathname.match(/^\/api\/share\/([a-z0-9]+)\/events$/)
    if (projectShareEventsMatch && request.method === "GET") {
      try {
        const shareCode = projectShareEventsMatch[1]
        const share = await env.DB.prepare(
          "SELECT project_id, organization_id, created_by, expires_at FROM project_shares WHERE code = ?",
        )
          .bind(shareCode)
          .first<{ project_id: string; organization_id: string | null; created_by: string; expires_at: number | null }>()

        if (!share || (share.expires_at !== null && share.expires_at < Date.now())) {
          return Response.json({ error: "Share link not found or expired" }, { status: 404 })
        }

        // Resolve organization_id: from share record or fall back to member table
        let organizationId = share.organization_id
        if (!organizationId) {
          const memberOrg = await env.DB.prepare(
            "SELECT organization_id FROM member WHERE user_id = ? LIMIT 1",
          )
            .bind(share.created_by)
            .first<{ organization_id: string }>()
          organizationId = memberOrg?.organization_id ?? null
        }

        if (!organizationId) {
          return Response.json({ error: "Cannot resolve organization for this share" }, { status: 500 })
        }

        // Fetch events from SyncBackendDO for this organization
        const syncBackendStub = env.SYNC_BACKEND_DO.get(
          env.SYNC_BACKEND_DO.idFromName(organizationId),
        )
        const eventsResponse = await syncBackendStub.fetch(
          `http://internal/events?storeId=${organizationId}`,
          { method: "GET" },
        )

        if (!eventsResponse.ok) {
          return Response.json([])
        }

        const allEvents = await eventsResponse.json() as Array<{ name: string; data: Record<string, unknown> }>

        // Filter to events relevant to this shared project
        const projectId = share.project_id
        const relevantEvents = allEvents.filter((event) => {
          const data = event.data as Record<string, unknown>
          return data.projectId === projectId || data.id === projectId
        })

        return Response.json(relevantEvents, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=30",
          },
        })
      } catch (error) {
        console.error("[ProjectShare] Events error:", error)
        return Response.json([])
      }
    }

    // Project Share: Public HTML web view
    // GET /share/:code
    const projectShareViewMatch = url.pathname.match(/^\/share\/([a-z0-9]+)$/)
    if (projectShareViewMatch && request.method === "GET") {
      try {
        const shareCode = projectShareViewMatch[1]
        const share = await env.DB.prepare(
          "SELECT project_id, expires_at FROM project_shares WHERE code = ?",
        )
          .bind(shareCode)
          .first<{ project_id: string; expires_at: number | null }>()

        if (!share || (share.expires_at !== null && share.expires_at < Date.now())) {
          return new Response(
            `<!DOCTYPE html><html><head><title>Link Expired</title></head><body style="font-family:system-ui;text-align:center;padding:48px"><h2>This link has expired or is no longer valid.</h2><p><a href="https://sitelink.app">SiteLink</a></p></body></html>`,
            { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } },
          )
        }

        const shareCodeVal = projectShareViewMatch[1]
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SiteLink — Shared Plans</title>
  <script src="https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/openseadragon.min.js"></script>
  <script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111; color: #f0f0f0 }
    #app { display: flex; flex-direction: column; height: 100% }
    .header { background: #1a1a1a; color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #333; flex-shrink: 0; z-index: 10 }
    .header-logo { font-size: 16px; font-weight: 800; letter-spacing: -0.5px }
    .header-badge { background: #3b82f6; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em }
    .header-project { font-size: 13px; color: #aaa; margin-left: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 }
    .header-cta { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap; flex-shrink: 0 }
    .body { display: flex; flex: 1; overflow: hidden }
    .sidebar { width: 220px; background: #1a1a1a; border-right: 1px solid #333; overflow-y: auto; flex-shrink: 0; display: flex; flex-direction: column }
    .sidebar-header { padding: 12px 14px; border-bottom: 1px solid #333; font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em }
    .sheet-list { flex: 1; overflow-y: auto }
    .sheet-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #222; transition: background 0.1s }
    .sheet-item:hover { background: #252525 }
    .sheet-item.active { background: #1d3557; border-left: 3px solid #3b82f6 }
    .sheet-number { font-size: 13px; font-weight: 700; color: #e0e0e0 }
    .sheet-title { font-size: 11px; color: #888; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .sheet-discipline { display: inline-block; font-size: 9px; font-weight: 600; background: #333; color: #aaa; padding: 1px 5px; border-radius: 3px; margin-top: 3px; text-transform: uppercase }
    .viewer-wrap { flex: 1; position: relative; background: #222 }
    #viewer { width: 100%; height: 100%; background: #222 }
    .loading-overlay { position: absolute; inset: 0; background: rgba(17,17,17,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5 }
    .spinner { width: 32px; height: 32px; border: 3px solid #333; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite }
    @keyframes spin { to { transform: rotate(360deg) } }
    .loading-text { font-size: 13px; color: #888 }
    .error-overlay { position: absolute; inset: 0; background: rgba(17,17,17,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; z-index: 5 }
    .error-icon { font-size: 32px }
    .error-msg { font-size: 14px; color: #f87171 }
    .error-sub { font-size: 12px; color: #666 }
    .empty-state { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #555; font-size: 14px }
    .marker-dot { width: 22px; height: 22px; background: #3b82f6; border: 2px solid #fff; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.5); transform: translate(-50%, -50%) }
    .marker-popup { position: absolute; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 10px 14px 10px 12px; z-index: 20; min-width: 130px; max-width: 220px; box-shadow: 0 4px 16px rgba(0,0,0,0.5) }
    .popup-label { font-size: 13px; font-weight: 700; color: #e0e0e0; margin-bottom: 4px }
    .popup-target { font-size: 12px; color: #3b82f6; cursor: pointer }
    .popup-target:hover { text-decoration: underline }
    .popup-close { float: right; margin: -2px -4px 0 6px; font-size: 16px; color: #555; cursor: pointer; line-height: 1 }
    @media (max-width: 600px) { .sidebar { width: 160px } }
  </style>
</head>
<body>
<div id="app">
  <div class="header">
    <span class="header-logo">SiteLink</span>
    <span class="header-badge">Shared</span>
    <span class="header-project" id="project-name">Loading plans…</span>
    <a class="header-cta" href="https://sitelink.app" target="_blank">Get the App</a>
  </div>
  <div class="body">
    <div class="sidebar">
      <div class="sidebar-header">Sheets</div>
      <div class="sheet-list" id="sheet-list"></div>
    </div>
    <div class="viewer-wrap">
      <div id="viewer"></div>
      <div class="loading-overlay" id="loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading plans…</div>
      </div>
    </div>
  </div>
</div>

<script>
(async function() {
  const SHARE_CODE = ${JSON.stringify(shareCodeVal)};

  // Process LiveStore events into sheet data
  function processEvents(events) {
    const plans = new Map();
    for (const event of events) {
      const d = event.data || {};
      switch (event.name) {
        case 'v1.PlanUploaded':
          if (!plans.has(d.id)) plans.set(d.id, { planId: d.id, fileName: d.fileName, projectId: d.projectId, sheets: new Map() });
          break;
        case 'v1.SheetImageGenerated': {
          let plan = plans.get(d.planId);
          if (!plan) { plan = { planId: d.planId, sheets: new Map() }; plans.set(d.planId, plan); }
          if (!plan.sheets.has(d.sheetId)) {
            plan.sheets.set(d.sheetId, { sheetId: d.sheetId, planId: d.planId, projectId: d.projectId,
              sheetNumber: 'Sheet ' + d.pageNumber, width: d.width, height: d.height, pmtilesPath: null, markers: [] });
          } else {
            const s = plan.sheets.get(d.sheetId); s.width = d.width; s.height = d.height;
          }
          break;
        }
        case 'v1.SheetMetadataExtracted': {
          const plan = plans.get(d.planId);
          if (plan) {
            const sheet = plan.sheets.get(d.sheetId);
            if (sheet) { sheet.sheetNumber = d.sheetNumber || sheet.sheetNumber; sheet.title = d.sheetTitle; sheet.discipline = d.discipline; }
          }
          break;
        }
        case 'v1.SheetTilesGenerated': {
          const plan = plans.get(d.planId);
          if (plan) { const sheet = plan.sheets.get(d.sheetId); if (sheet) sheet.pmtilesPath = d.localPmtilesPath; }
          break;
        }
        case 'v1.SheetCalloutsDetected': {
          const plan = plans.get(d.planId);
          if (plan) {
            const sheet = plan.sheets.get(d.sheetId);
            if (sheet && d.markers) sheet.markers = d.markers.map(m => ({ id: m.id, label: m.label, targetSheetRef: m.targetSheetRef, targetSheetId: m.targetSheetId, x: m.x, y: m.y }));
          }
          break;
        }
      }
    }
    return Array.from(plans.values()).flatMap(p => Array.from(p.sheets.values()));
  }

  function r2Url(path) {
    if (!path) return null;
    return '/api/r2/' + encodeURIComponent(path) + '?sc=' + SHARE_CODE;
  }

  let viewer = null;
  let currentPMTiles = null;
  let sheets = [];
  let activeSheetId = null;
  let activePopup = null;

  function hideLoading() {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
  }

  function showError(msg) {
    hideLoading();
    const wrap = document.querySelector('.viewer-wrap');
    const err = document.createElement('div');
    err.className = 'error-overlay';
    err.innerHTML = '<div class="error-icon">&#9888;</div><div class="error-msg">' + msg + '</div><div class="error-sub">Shared via SiteLink</div>';
    wrap.appendChild(err);
  }

  function closePopup() {
    if (activePopup) { activePopup.remove(); activePopup = null; }
  }

  function showMarkerPopup(markerEl, marker) {
    closePopup();
    const popup = document.createElement('div');
    popup.className = 'marker-popup';
    popup.innerHTML =
      '<span class="popup-close" onclick="closePopup()">&#215;</span>' +
      '<div class="popup-label">' + (marker.label || '\u2014') + '</div>' +
      (marker.targetSheetRef ? '<div class="popup-target" onclick="goToSheet(\'' + marker.targetSheetId + '\')">\u2192 Sheet ' + marker.targetSheetRef + '</div>' : '');
    // Position popup relative to viewer-wrap, near the marker element
    const wrapEl = document.querySelector('.viewer-wrap');
    const markerRect = markerEl.getBoundingClientRect();
    const wrapRect = wrapEl.getBoundingClientRect();
    popup.style.left = (markerRect.left - wrapRect.left + 14) + 'px';
    popup.style.top = Math.max(4, markerRect.top - wrapRect.top - 60) + 'px';
    wrapEl.appendChild(popup);
    activePopup = popup;
  }

  window.closePopup = closePopup;
  window.goToSheet = function(sheetId) {
    const sheet = sheets.find(s => s.sheetId === sheetId);
    if (sheet) loadSheet(sheet);
  };

  function renderSheetList() {
    const list = document.getElementById('sheet-list');
    list.innerHTML = '';
    sheets.forEach(sheet => {
      const item = document.createElement('div');
      item.className = 'sheet-item' + (sheet.sheetId === activeSheetId ? ' active' : '');
      item.innerHTML =
        '<div class="sheet-number">' + (sheet.sheetNumber || sheet.sheetId) + '</div>' +
        (sheet.title ? '<div class="sheet-title">' + sheet.title + '</div>' : '') +
        (sheet.discipline ? '<div class="sheet-discipline">' + sheet.discipline + '</div>' : '');
      item.addEventListener('click', () => loadSheet(sheet));
      list.appendChild(item);
    });
  }

  function addMarkerOverlays(sheet) {
    if (!viewer || !sheet.markers || !sheet.markers.length) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;
    const imageSize = tiledImage.getContentSize();
    viewer.clearOverlays();
    closePopup();
    sheet.markers.forEach(marker => {
      if (marker.x == null || marker.y == null) return;
      // Coords are normalized (0–1) or legacy pixel values
      const isNormalized = marker.x <= 1 && marker.y <= 1;
      const px = isNormalized ? marker.x * imageSize.x : marker.x;
      const py = isNormalized ? marker.y * imageSize.y : marker.y;
      const viewportPt = viewer.viewport.imageToViewportCoordinates(new OpenSeadragon.Point(px, py));
      const el = document.createElement('div');
      el.className = 'marker-dot';
      el.title = marker.label || '';
      el.addEventListener('click', function(e) { e.stopPropagation(); showMarkerPopup(el, marker); });
      viewer.addOverlay({ element: el, location: viewportPt, placement: OpenSeadragon.Placement.CENTER });
    });
  }

  function initViewer() {
    viewer = OpenSeadragon({
      element: document.getElementById('viewer'),
      tileSources: [],
      prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/images/',
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      maxZoomPixelRatio: 2,
      minZoomLevel: 0,
      visibilityRatio: 1,
      zoomPerScroll: 2,
      timeout: 120000,
      imageLoaderLimit: 4,
      showNavigator: true,
      navigatorPosition: 'TOP_RIGHT',
      showRotationControl: false,
    });
    // Intercept tile loading: resolve pmtiles:// pseudo-URLs from the current PMTiles archive
    const origAddJob = viewer.imageLoader.addJob.bind(viewer.imageLoader);
    viewer.imageLoader.addJob = function(options) {
      const src = options.src;
      if (src && src.startsWith('pmtiles://') && currentPMTiles) {
        const m = src.match(/pmtiles:\/\/(\d+)\/(\d+)\/(\d+)/);
        if (m) {
          const z = parseInt(m[1], 10), x = parseInt(m[2], 10), y = parseInt(m[3], 10);
          const job = { src: src, callback: options.callback, abort: options.abort, image: null, errorMsg: null };
          currentPMTiles.getZxy(z, x, y).then(function(tileData) {
            if (tileData && tileData.data) {
              const blob = new Blob([tileData.data], { type: 'image/webp' });
              const objUrl = URL.createObjectURL(blob);
              const img = new Image();
              img.onload = function() { job.image = img; if (job.callback) job.callback(img, null, src); URL.revokeObjectURL(objUrl); };
              img.onerror = function() { if (job.callback) job.callback(null, 'Tile load error', src); URL.revokeObjectURL(objUrl); };
              img.src = objUrl;
            } else {
              if (job.callback) job.callback(null, 'No tile data', src);
            }
          }).catch(function(err) {
            if (job.callback) job.callback(null, err.message, src);
          });
          return job;
        }
      }
      return origAddJob(options);
    };
    // Close popup on canvas interaction
    viewer.addHandler('canvas-drag', closePopup);
    viewer.addHandler('zoom', closePopup);
  }

  async function loadSheet(sheet) {
    if (!viewer) return;
    activeSheetId = sheet.sheetId;
    renderSheetList();
    closePopup();
    document.getElementById('project-name').textContent = [sheet.sheetNumber, sheet.title].filter(Boolean).join(' \u2014 ');

    const tilesUrl = r2Url(sheet.pmtilesPath);
    if (!tilesUrl) return;

    try {
      const pt = new pmtiles.PMTiles(tilesUrl);
      currentPMTiles = pt;
      const header = await pt.getHeader();
      const tileSize = header.tileType === 1 ? 256 : 512;
      const maxZoom = header.maxZoom;
      const tilesWide = Math.pow(2, maxZoom);
      const width = tilesWide * tileSize;
      const height = tilesWide * tileSize;

      const tileSource = new OpenSeadragon.TileSource({
        width: width,
        height: height,
        tileSize: tileSize,
        tileOverlap: 0,
        minLevel: header.minZoom,
        maxLevel: header.maxZoom,
        getTileUrl: function(level, x, y) { return 'pmtiles://' + level + '/' + x + '/' + y; },
      });

      // one-shot 'open' handler to place markers
      function onOpen() {
        viewer.removeHandler('open', onOpen);
        addMarkerOverlays(sheet);
      }
      viewer.addHandler('open', onOpen);
      viewer.open(tileSource);
    } catch (err) {
      console.error('Failed to load sheet:', err);
    }
  }

  // Bootstrap
  initViewer();
  try {
    const resp = await fetch('/api/share/' + SHARE_CODE + '/events');
    if (!resp.ok) { showError('This share link is no longer valid.'); return; }
    const events = await resp.json();

    sheets = processEvents(events).filter(s => s.pmtilesPath);

    if (sheets.length === 0) {
      hideLoading();
      const wrap = document.querySelector('.viewer-wrap');
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<div>&#128203;</div><div>Plans are still processing.</div><div style="font-size:12px;color:#444">Check back in a few minutes.</div>';
      wrap.appendChild(empty);
      document.getElementById('project-name').textContent = 'Plans processing\u2026';
      renderSheetList();
      return;
    }

    renderSheetList();
    hideLoading();
    await loadSheet(sheets[0]);
  } catch (err) {
    showError('Could not load plans. Please try again.');
    console.error(err);
  }
})();
</script>
</body>
</html>`

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      } catch (error) {
        console.error("[ProjectShare] View error:", error)
        return new Response("Internal server error", { status: 500 })
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
