/**
 * Integration Tests for Callout Processor Service
 *
 * These tests run end-to-end integration tests with the new callout-processor container.
 * The callout-processor uses sheet-based processing (not tile-based) for simpler architecture.
 *
 * ============================================================================
 * PREREQUISITES
 * ============================================================================
 *
 * 1. callout-processor container MUST be running on port 8001
 *
 * ============================================================================
 * CONTAINER SETUP
 * ============================================================================
 *
 *   # Build the container image
 *   cd packages/callout-processor
 *   docker build -t callout-processor .
 *
 *   # Start the container with API key
 *   docker run -d --name callout-processor -p 8001:8000 \
 *     -e OPENROUTER_API_KEY="your-api-key" \
 *     callout-processor
 *
 *   # Verify it's running
 *   curl http://localhost:8001/health
 *   # Expected: {"status":"ready","service":"callout-processor"}
 *
 * ============================================================================
 * RUNNING THE TESTS
 * ============================================================================
 *
 * From the backend package directory:
 *   cd packages/backend
 *
 * Run callout processor integration tests:
 *   bun vitest run tests/integration/queue-callout-processor.test.ts
 *
 * ============================================================================
 * NEW ARCHITECTURE: Sheet-Based Processing
 * ============================================================================
 *
 * OLD (plan-ocr-service):
 *   - Fetches tiles from R2
 *   - Encodes tiles as base64 JSON
 *   - Sends large JSON payloads
 *   - Uses chunking for parallelism
 *
 * NEW (callout-processor):
 *   - Sends sheet PDF directly (binary)
 *   - One job per sheet (no chunking)
 *   - Simpler architecture
 *   - Uses headers for metadata (X-Valid-Sheets, X-Sheet-Number)
 *
 */

import { env, createMessageBatch, getQueueResult, createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import type { MetadataExtractionJob } from "../../src/core/queues/types"
import worker from "../../src/index"
import { loadSamplePDF, createAuthenticatedUser, isCalloutProcessorAvailable } from "../helpers"
import { drizzle } from "drizzle-orm/d1"
import { eq, and } from "drizzle-orm"
import { planSheets, planMarkers, plans, planUploads, projects, organizations } from "../../src/core/database/schemas"

// Helper function to chunk an array
const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Test constants
const TEST_ORGANIZATION_ID = "org-callout-test"
const TEST_PROJECT_ID = "proj-callout-test"
const TEST_PLAN_ID = "plan-callout-test"
const TEST_UPLOAD_ID = "upload-callout-test"

// New per-sheet marker detection job type (to be added to types.ts)
interface SheetMarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]
  // Per-sheet fields (no chunking)
  sheetId: string
  sheetNumber: number
  sheetKey: string
  totalSheets: number
}

beforeAll(async () => {
  // Check if callout-processor container is available
  const isAvailable = await isCalloutProcessorAvailable()
  if (!isAvailable) {
    console.warn("⚠️  callout-processor container is not available on port 8001")
    console.warn("   Tests will be skipped. Please start the container first.")
    console.warn("   Run: docker run -d --name callout-processor -p 8001:8000 -e OPENROUTER_API_KEY=... callout-processor:test")
  }

  // Create test user
  const { userId } = await createAuthenticatedUser("callout-test@example.com")

  // Setup database
  const db = drizzle(env.SitelinkDB)

  // Create organization
  await db.insert(organizations).values({
    id: TEST_ORGANIZATION_ID,
    name: "Callout Test Organization",
    slug: "callout-test-org",
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Create project
  await db.insert(projects).values({
    id: TEST_PROJECT_ID,
    organizationId: TEST_ORGANIZATION_ID,
    name: "Callout Test Project",
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Create plan
  await db.insert(plans).values({
    id: TEST_PLAN_ID,
    projectId: TEST_PROJECT_ID,
    name: "Callout Test Plan",
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Create plan upload
  await db.insert(planUploads).values({
    id: crypto.randomUUID(),
    uploadId: TEST_UPLOAD_ID,
    planId: TEST_PLAN_ID,
    filePath: `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/original.pdf`,
    fileType: "pdf",
    fileSize: 1024,
    isActive: true,
    uploadedBy: userId,
    uploadedAt: new Date(),
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Upload sample PDF to R2
  const pdf = await loadSamplePDF()
  const pdfKey = `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/original.pdf`
  await env.SitelinkStorage.put(pdfKey, pdf)
})

describe("Callout Processor Integration - Sheet-Based Processing", () => {

  it("should call callout-processor health endpoint", async () => {
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: callout-processor container not available")
      return
    }

    const response = await fetch("http://localhost:8001/health")
    expect(response.status).toBe(200)

    const data = await response.json() as { status: string; service: string }
    expect(data.status).toBe("ready")
    expect(data.service).toBe("callout-processor")

    console.log("✅ callout-processor health check passed")
  })

  it("should extract metadata from PDF directly", async () => {
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: callout-processor container not available")
      return
    }

    console.log("\n📝 Testing metadata extraction endpoint")

    // Load sample PDF
    const pdf = await loadSamplePDF()

    // Call the metadata extraction endpoint directly
    const response = await fetch("http://localhost:8001/api/extract-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: pdf,
    })

    expect(response.status).toBe(200)

    const data = await response.json() as {
      sheet_number: string
      metadata: {
        width: number
        height: number
        dpi: number
      }
    }

    expect(data).toHaveProperty("sheet_number")
    expect(data).toHaveProperty("metadata")
    expect(data.metadata.width).toBeGreaterThan(0)
    expect(data.metadata.height).toBeGreaterThan(0)

    console.log(`✅ Metadata extracted: sheet_number=${data.sheet_number}, dimensions=${data.metadata.width}x${data.metadata.height}`)
  }, 120000) // 2 minute timeout for LLM processing

  it("should detect markers from PDF directly", async () => {
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: callout-processor container not available")
      return
    }

    console.log("\n🎯 Testing marker detection endpoint")

    // Load sample PDF
    const pdf = await loadSamplePDF()

    // Call the marker detection endpoint directly
    const response = await fetch("http://localhost:8001/api/detect-markers", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Valid-Sheets": "A1,A2,A3,A4,A5,A6,A7",
        "X-Sheet-Number": "1",
      },
      body: pdf,
    })

    expect(response.status).toBe(200)

    const data = await response.json() as {
      markers: Array<{
        text: string
        sheet: string
        confidence: number
        is_valid: boolean
        bbox: { x: number; y: number; w: number; h: number }
      }>
      total_detected: number
      processing_time_ms: number
    }

    expect(data).toHaveProperty("markers")
    expect(Array.isArray(data.markers)).toBe(true)
    expect(data).toHaveProperty("total_detected")
    expect(data).toHaveProperty("processing_time_ms")

    console.log(`✅ Markers detected: ${data.total_detected} markers in ${data.processing_time_ms}ms`)

    // Verify marker structure
    if (data.markers.length > 0) {
      const marker = data.markers[0]
      expect(marker).toHaveProperty("text")
      expect(marker).toHaveProperty("sheet")
      expect(marker).toHaveProperty("confidence")
      expect(marker).toHaveProperty("is_valid")
      expect(marker).toHaveProperty("bbox")

      console.log(`   First marker: ${marker.text} → ${marker.sheet} (confidence: ${(marker.confidence * 100).toFixed(1)}%)`)
    }
  }, 600000) // 10 minute timeout for LLM processing (574 shapes in sample PDF)

  it("should handle invalid content type", async () => {
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: callout-processor container not available")
      return
    }

    console.log("\n⚠️ Testing error handling: invalid content type")

    const response = await fetch("http://localhost:8001/api/extract-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: "not a pdf",
    })

    expect(response.status).toBe(400)
    console.log("✅ Correctly returned 400 for invalid content type")
  })

  it("should handle empty request body", async () => {
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: callout-processor container not available")
      return
    }

    console.log("\n⚠️ Testing error handling: empty request body")

    const response = await fetch("http://localhost:8001/api/detect-markers", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
      },
      // No body
    })

    expect(response.status).toBe(400)
    console.log("✅ Correctly returned 400 for empty body")
  })

})

describe("Callout Processor Integration - New Queue Consumer Pattern", () => {

  /**
   * This test simulates the new queue consumer pattern:
   * 1. Get sheet PDF from R2
   * 2. Send PDF directly to callout-processor
   * 3. Store markers in database
   *
   * This replaces the old tile-based, chunked approach.
   */
  it("should process sheet PDF and store markers (new pattern simulation)", async () => {
    const isAvailable = await isCalloutProcessorAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: callout-processor container not available")
      return
    }

    console.log("\n🔄 Testing new queue consumer pattern (simulation)")

    const db = drizzle(env.SitelinkDB)

    // 1. Get a sheet PDF from R2 (simulate queue consumer getting the sheet)
    const sheetKey = `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/sheet-1.pdf`

    // First, let's put a test sheet PDF in R2
    const pdf = await loadSamplePDF()
    await env.SitelinkStorage.put(sheetKey, pdf)

    // Create a sheet record in the database
    const sheetId = crypto.randomUUID()
    await db.insert(planSheets).values({
      id: sheetId,
      uploadId: TEST_UPLOAD_ID,
      planId: TEST_PLAN_ID,
      projectId: TEST_PROJECT_ID,
      organizationId: TEST_ORGANIZATION_ID,
      sheetNumber: 1,
      sheetKey: sheetKey,
      metadataStatus: "pending",
    }).onConflictDoNothing()

    // 2. Simulate what the new queue consumer would do
    const sheetPdf = await env.SitelinkStorage.get(sheetKey)
    expect(sheetPdf).not.toBeNull()

    const validSheets = ["A1", "A2", "A3", "A4", "A5"]

    // 3. Call callout-processor directly (simulating container.fetch())
    console.log("   📤 Sending sheet PDF to callout-processor...")
    const response = await fetch("http://localhost:8001/api/detect-markers", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Sheet-Id": sheetId,
        "X-Sheet-Number": "1",
        "X-Valid-Sheets": validSheets.join(","),
        "X-Total-Sheets": "1",
      },
      body: await sheetPdf!.arrayBuffer(),
    })

    expect(response.status).toBe(200)

    const result = await response.json() as {
      markers: Array<{
        text: string
        sheet: string
        confidence: number
        is_valid: boolean
        bbox: { x: number; y: number; w: number; h: number }
      }>
      total_detected: number
    }

    console.log(`   📥 Received ${result.total_detected} markers`)

    // 4. Store markers in database (simulating what queue consumer does)
    if (result.markers.length > 0) {
      const markerRecords = result.markers.map((marker) => ({
        id: crypto.randomUUID(),
        uploadId: TEST_UPLOAD_ID,
        planId: TEST_PLAN_ID,
        sheetNumber: 1,
        markerText: marker.text,
        detail: marker.text.split("/")[0] || "",
        sheet: marker.sheet,
        markerType: "detail",
        confidence: marker.confidence,
        isValid: marker.is_valid,
        fuzzyMatched: false,
        sourceTile: null,
        bbox: JSON.stringify(marker.bbox),
      }))

      // Batch insert markers to avoid D1 SQL variable limits
      const markerChunks = chunk(markerRecords, 5) // Using a conservative chunk size
      for (const batch of markerChunks) {
        if (batch.length > 0) {
          await db.insert(planMarkers).values(batch)
        }
      }
      console.log(`   💾 Stored ${markerRecords.length} markers in database`)
    }

    // 5. Verify markers were stored
    const storedMarkers = await db.select()
      .from(planMarkers)
      .where(and(
        eq(planMarkers.uploadId, TEST_UPLOAD_ID),
        eq(planMarkers.sheetNumber, 1)
      ))

    expect(storedMarkers.length).toBe(result.markers.length)
    console.log(`✅ New pattern simulation complete: ${storedMarkers.length} markers stored`)

  }, 600000) // 10 minute timeout for LLM processing (574 shapes in sample PDF)

})
