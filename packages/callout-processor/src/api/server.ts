import { healthHandler } from "./routes/health"
import { metadataHandler } from "./routes/metadata"
import { markersHandler } from "./routes/markers"

let isReady = false

async function initialize() {
  console.log("[callout-processor] Initializing...")
  // Any startup tasks (e.g., verify vips is available)
  isReady = true
  console.log("[callout-processor] Ready")
}

const PORT = parseInt(process.env.PORT || "8000")

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname

    // Health endpoint
    if (path === "/health" && request.method === "GET") {
      return healthHandler(isReady)
    }

    // Metadata extraction endpoint
    if (path === "/api/extract-metadata" && request.method === "POST") {
      return metadataHandler(request)
    }

    // Marker detection endpoint
    if (path === "/api/detect-markers" && request.method === "POST") {
      return markersHandler(request)
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log(`[callout-processor] Server starting on port ${PORT}`)
initialize()
