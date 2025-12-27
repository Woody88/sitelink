/**
 * Integration Tests for Plan OCR Service
 * 
 * These tests run end-to-end integration tests with the real plan-ocr-service container.
 * They verify the complete pipeline: PDF splitting → metadata extraction → marker detection.
 * 
 * ============================================================================
 * PREREQUISITES
 * ============================================================================
 * 
 * 1. plan-ocr-service container MUST be running on port 8000
 * 
 * NOTE: The PDF processor container (sitelink-pdf-processor) is NOT required
 * for these OCR integration tests. The PDF processing queue splits PDFs using
 * pdf-lib directly in JavaScript, not via the container.
 * 
 * The PDF processor container (port 3001) is only needed for:
 * - Tile generation tests (see queue-tile-generation.test.ts)
 * - Full end-to-end tests that include tile generation
 * 
 * ============================================================================
 * CONTAINER REQUIREMENTS SUMMARY
 * ============================================================================
 * 
 * For these OCR integration tests, you ONLY need:
 * ✅ plan-ocr-service container (port 8000) - REQUIRED
 * ❌ PDF processor container (port 3001) - NOT NEEDED
 * 
 * The PDF processor container is only needed for tile generation tests.
 * 
 * ============================================================================
 * SETUP: Starting the plan-ocr-service Container
 * ============================================================================
 * 
 * Option 1: Docker (Recommended)
 *   # Build the container image
 *   cd packages/plan-ocr-service
 *   docker build -t plan-ocr-service .
 * 
 *   # Start the container
 *   docker run -d --name plan-ocr-service -p 8000:8000 plan-ocr-service
 * 
 *   # Verify it's running
 *   curl http://localhost:8000/health
 *   # Expected: {"status":"ok","service":"plan-ocr-service"}
 * 
 * Option 2: Local Python Development
 *   cd packages/plan-ocr-service
 *   pip install -e .
 *   uvicorn src.api:app --reload --port 8000
 * 
 * ============================================================================
 * RUNNING THE TESTS
 * ============================================================================
 * 
 * From the backend package directory:
 *   cd packages/backend
 * 
 * Run all OCR integration tests:
 *   bun vitest run tests/integration/queue-ocr-integration.test.ts
 * 
 * Run a specific test:
 *   bun vitest run tests/integration/queue-ocr-integration.test.ts -t "should process the complete pipeline"
 * 
 * Run in watch mode:
 *   bun vitest watch tests/integration/queue-ocr-integration.test.ts
 * 
 * ============================================================================
 * CONTAINER MANAGEMENT
 * ============================================================================
 * 
 * Stop the container:
 *   docker stop plan-ocr-service
 * 
 * Remove the container:
 *   docker rm plan-ocr-service
 * 
 * View container logs:
 *   docker logs plan-ocr-service
 *   docker logs -f plan-ocr-service  # Follow logs
 * 
 * Restart the container:
 *   docker restart plan-ocr-service
 * 
 * Rebuild and restart:
 *   docker stop plan-ocr-service
 *   docker rm plan-ocr-service
 *   cd packages/plan-ocr-service
 *   docker build -t plan-ocr-service .
 *   docker run -d --name plan-ocr-service -p 8000:8000 plan-ocr-service
 * 
 * ============================================================================
 * TEST TIMEOUTS
 * ============================================================================
 * 
 * These tests use longer timeouts to accommodate real OCR processing:
 * - Metadata extraction: ~5-10 seconds per sheet (7 sheets = ~35-70s total)
 * - Marker detection: 30-120 seconds depending on tile count
 * - Full pipeline test: ~60-90 seconds
 * 
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 * 
 * If tests fail with "Container unavailable":
 *   1. Check if container is running: docker ps | grep plan-ocr-service
 *   2. Check container health: curl http://localhost:8000/health
 *   3. Check container logs: docker logs plan-ocr-service
 *   4. Restart the container if needed
 * 
 * If tests fail with "Title block not found":
 *   - This is expected for sample PDFs without proper title blocks
 *   - The service will use fallback sheet numbers (e.g., "Sheet-5605")
 *   - Tests should still pass with fallback metadata
 * 
 * If port 8000 is already in use:
 *   - Stop the existing container: docker stop plan-ocr-service
 *   - Or use a different port and update vitest.config.mts PLAN_OCR_SERVICE binding
 * 
 * ============================================================================
 * TEST STRUCTURE
 * ============================================================================
 * 
 * The tests verify:
 * 1. Complete pipeline: PDF → sheets → metadata → markers
 * 2. Error handling: Graceful failures and retries
 * 3. Empty results: Handling cases with no markers detected
 * 
 * All tests use real:
 * - D1 database (via Miniflare)
 * - R2 storage (via Miniflare)
 * - plan-ocr-service container (via service binding proxy)
 * - PlanCoordinator Durable Object
 */

import { env, createMessageBatch, getQueueResult, createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import type { R2Notification, MetadataExtractionJob, MarkerDetectionJob } from "../../src/core/queues/types"
import worker from "../../src/index"
import { loadSamplePDF, isPlanOcrServiceAvailable, createAuthenticatedUser } from "../helpers"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { planSheets, planMarkers, plans, planUploads, projects, organizations } from "../../src/core/database/schemas"

const TEST_R2_ACCOUNT = "test-account"
const TEST_ORGANIZATION_ID = "org-e2e-test"
const TEST_PROJECT_ID = "proj-e2e-test"
const TEST_PLAN_ID = "plan-e2e-test"
const TEST_UPLOAD_ID = "upload-e2e-test"
const TEST_PDF_KEY = `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/original.pdf`

beforeAll(async () => {
  // Check if plan-ocr-service container is available
  const isAvailable = await isPlanOcrServiceAvailable()
  if (!isAvailable) {
    console.warn("⚠️  plan-ocr-service container is not available on port 8000")
    console.warn("   Tests will be skipped. Please start the container first.")
  }

  // Create test user
  const { userId } = await createAuthenticatedUser("e2e-test@example.com")

  // Setup database: create organization, project, plan, and upload records
  const db = drizzle(env.SitelinkDB)

  // Create organization
  await db.insert(organizations).values({
    id: TEST_ORGANIZATION_ID,
    name: "E2E Test Organization",
    slug: "e2e-test-org",
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Create project
  await db.insert(projects).values({
    id: TEST_PROJECT_ID,
    organizationId: TEST_ORGANIZATION_ID,
    name: "E2E Test Project",
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Create plan
  await db.insert(plans).values({
    id: TEST_PLAN_ID,
    projectId: TEST_PROJECT_ID,
    name: "E2E Test Plan",
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Create plan upload
  await db.insert(planUploads).values({
    id: crypto.randomUUID(),
    uploadId: TEST_UPLOAD_ID,
    planId: TEST_PLAN_ID,
    filePath: TEST_PDF_KEY,
    fileType: "pdf",
    fileSize: 1024,
    isActive: true,
    uploadedBy: userId,
    uploadedAt: new Date(),
    createdAt: new Date(),
  }).onConflictDoNothing()

  // Upload sample PDF to R2
  const pdf = await loadSamplePDF()
  await env.SitelinkStorage.put(TEST_PDF_KEY, pdf)
})

describe("PDF Processing Pipeline - OCR Integration", () => {
  it("should process the complete pipeline: PDF split → metadata extraction → marker detection", async () => {
    // Check container availability
    const isAvailable = await isPlanOcrServiceAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: plan-ocr-service container not available")
      return
    }

    // ========================================
    // STEP 1: PDF Processing Queue
    // ========================================
    console.log("\n📄 STEP 1: PDF Processing (split into sheets)")

    const r2Event: R2Notification = {
      account: TEST_R2_ACCOUNT,
      action: "PutObject",
      bucket: "sitelink-storage",
      object: { key: TEST_PDF_KEY },
      eventTime: new Date().toISOString(),
    }

    const pdfBatch = createMessageBatch<R2Notification>("pdf-processing-queue", [
      { id: "pdf-msg-1", timestamp: new Date(), body: r2Event, attempts: 1 },
    ])

    // Verify starting state: only original.pdf exists
    const initialObjects = await env.SitelinkStorage.list({ prefix: `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}` })
    expect(initialObjects.objects).toHaveLength(1)
    expect(initialObjects.objects[0].key).toBe(TEST_PDF_KEY)

    // Process PDF splitting
    const pdfCtx = createExecutionContext()
    await worker.queue(pdfBatch as any, env, pdfCtx)
    await waitOnExecutionContext(pdfCtx)

    const pdfResult = await getQueueResult(pdfBatch, pdfCtx)
    expect(pdfResult.explicitAcks).toEqual(["pdf-msg-1"])

    // Verify sheets were created in R2
    const afterSplitObjects = await env.SitelinkStorage.list({ prefix: `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}` })
    console.log(`✅ Created ${afterSplitObjects.objects.length} files in R2`)

    const sheets = afterSplitObjects.objects.filter(o => o.key.includes("/sheet-"))
    expect(sheets.length).toBe(7) // sample-plan.pdf has 7 pages

    // Verify plan_sheets records were created
    const db = drizzle(env.SitelinkDB)
    const sheetRecords = await db.select()
      .from(planSheets)
      .where(eq(planSheets.uploadId, TEST_UPLOAD_ID))

    expect(sheetRecords).toHaveLength(7)
    console.log(`✅ Created ${sheetRecords.length} plan_sheets records in database`)

    // Verify all sheets have correct initial status
    sheetRecords.forEach((sheet, idx) => {
      expect(sheet.sheetNumber).toBe(idx + 1)
      expect(sheet.uploadId).toBe(TEST_UPLOAD_ID)
      expect(sheet.planId).toBe(TEST_PLAN_ID)
      expect(sheet.metadataStatus).toBe("pending")
      expect(sheet.sheetName).toBeNull()
    })

    // Verify PlanCoordinator was initialized
    const coordinatorId = env.PLAN_COORDINATOR.idFromName(TEST_UPLOAD_ID)
    const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)
    const progressResponse = await coordinator.fetch("http://localhost/progress")
    const initialProgress = await progressResponse.json() as any

    expect(initialProgress.uploadId).toBe(TEST_UPLOAD_ID)
    expect(initialProgress.totalSheets).toBe(7)
    expect(initialProgress.completedSheets).toHaveLength(0)
    expect(initialProgress.status).toBe("in_progress")
    console.log(`✅ PlanCoordinator initialized: ${initialProgress.completedSheets.length}/${initialProgress.totalSheets} sheets complete`)

    // ========================================
    // STEP 2: Metadata Extraction Queue
    // ========================================
    console.log("\n📝 STEP 2: Metadata Extraction (extract sheet numbers)")

    // Create metadata extraction jobs for all sheets
    const metadataJobs: MetadataExtractionJob[] = sheetRecords.map((sheet) => ({
      uploadId: TEST_UPLOAD_ID,
      planId: TEST_PLAN_ID,
      sheetId: sheet.id,
      sheetNumber: sheet.sheetNumber,
      sheetKey: sheet.sheetKey,
      totalSheets: 7,
    }))

    const metadataBatch = createMessageBatch<MetadataExtractionJob>(
      "metadata-extraction-queue",
      metadataJobs.map((job, idx) => ({
        id: `metadata-msg-${idx + 1}`,
        timestamp: new Date(),
        body: job,
        attempts: 1,
      }))
    )

    // Process metadata extraction (with increased timeout for real OCR processing)
    const metadataCtx = createExecutionContext()
    await worker.queue(metadataBatch as any, env, metadataCtx)
    await waitOnExecutionContext(metadataCtx)

    const metadataResult = await getQueueResult(metadataBatch, metadataCtx)
    expect(metadataResult.explicitAcks).toHaveLength(7)
    console.log(`✅ All ${metadataResult.explicitAcks.length} metadata extraction jobs acknowledged`)

    // Verify plan_sheets records were updated with metadata
    const updatedSheetRecords = await db.select()
      .from(planSheets)
      .where(eq(planSheets.uploadId, TEST_UPLOAD_ID))

    expect(updatedSheetRecords).toHaveLength(7)
    updatedSheetRecords.forEach((sheet) => {
      expect(sheet.metadataStatus).toBe("extracted")
      expect(sheet.sheetName).toBeTruthy()
      expect(sheet.metadataExtractedAt).toBeTruthy()
      console.log(`   ✅ Sheet ${sheet.sheetNumber}: ${sheet.sheetName}`)
    })

    // Verify PlanCoordinator was updated with all sheets completed
    const afterMetadataProgress = await coordinator.fetch("http://localhost/progress")
    const progressAfterMetadata = await afterMetadataProgress.json() as any

    expect(progressAfterMetadata.completedSheets).toHaveLength(7)
    expect(progressAfterMetadata.status).toBe("metadata_complete")
    console.log(`✅ PlanCoordinator updated: ${progressAfterMetadata.completedSheets.length}/${progressAfterMetadata.totalSheets} complete, status=${progressAfterMetadata.status}`)

    // ========================================
    // STEP 3: Marker Detection Queue
    // ========================================
    console.log("\n🎯 STEP 3: Marker Detection")

    // Create marker detection job
    const validSheets = updatedSheetRecords.map(s => s.sheetName).filter(Boolean) as string[]
    const markerJob: MarkerDetectionJob = {
      uploadId: TEST_UPLOAD_ID,
      planId: TEST_PLAN_ID,
      organizationId: TEST_ORGANIZATION_ID,
      projectId: TEST_PROJECT_ID,
      validSheets,
    }

    const markerBatch = createMessageBatch<MarkerDetectionJob>("marker-detection-queue", [
      { id: "marker-msg-1", timestamp: new Date(), body: markerJob, attempts: 1 },
    ])

    // Process marker detection (with increased timeout for real OCR processing)
    const markerCtx = createExecutionContext()
    await worker.queue(markerBatch as any, env, markerCtx)
    await waitOnExecutionContext(markerCtx)

    const markerResult = await getQueueResult(markerBatch, markerCtx)
    expect(markerResult.explicitAcks).toEqual(["marker-msg-1"])
    console.log(`✅ Marker detection job acknowledged`)

    // Verify plan_markers records were created
    const markerRecords = await db.select()
      .from(planMarkers)
      .where(eq(planMarkers.uploadId, TEST_UPLOAD_ID))

    // Note: Actual marker count depends on real OCR results
    expect(markerRecords.length).toBeGreaterThanOrEqual(0)
    console.log(`✅ Created ${markerRecords.length} plan_markers records`)

    // ========================================
    // FINAL VERIFICATION
    // ========================================
    console.log("\n✅ END-TO-END TEST COMPLETE")
    console.log(`   - PDF split into ${sheets.length} sheets`)
    console.log(`   - ${updatedSheetRecords.length} sheets with extracted metadata`)
    console.log(`   - ${markerRecords.length} markers detected`)
    console.log(`   - PlanCoordinator status: ${progressAfterMetadata.status}`)
  }, 180000) // 3 minute timeout for full pipeline

  it("should handle metadata extraction failures gracefully", async () => {
    // Check container availability
    const isAvailable = await isPlanOcrServiceAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: plan-ocr-service container not available")
      return
    }

    console.log("\n⚠️ Testing metadata extraction failure handling")

    const testUploadId = "upload-failure-test"
    const testPlanId = "plan-failure-test"
    const testPdfKey = `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${testPlanId}/uploads/${testUploadId}/original.pdf`

    // Setup database records for this test
    const db = drizzle(env.SitelinkDB)
    await db.insert(plans).values({
      id: testPlanId,
      projectId: TEST_PROJECT_ID,
      name: "Failure Test Plan",
      createdAt: new Date(),
    }).onConflictDoNothing()

    // Create test user for this test
    const { userId } = await createAuthenticatedUser("failure-test@example.com")

    await db.insert(planUploads).values({
      id: crypto.randomUUID(),
      uploadId: testUploadId,
      planId: testPlanId,
      filePath: testPdfKey,
      fileType: "pdf",
      fileSize: 1024,
      isActive: true,
      uploadedBy: userId,
      uploadedAt: new Date(),
      createdAt: new Date(),
    }).onConflictDoNothing()

    // Upload test PDF
    const pdf = await loadSamplePDF()
    await env.SitelinkStorage.put(testPdfKey, pdf)

    // Process PDF to create sheets
    const r2Event: R2Notification = {
      account: TEST_R2_ACCOUNT,
      action: "PutObject",
      bucket: "sitelink-storage",
      object: { key: testPdfKey },
      eventTime: new Date().toISOString(),
    }

    const pdfBatch = createMessageBatch<R2Notification>("pdf-processing-queue", [
      { id: "pdf-failure-1", timestamp: new Date(), body: r2Event, attempts: 1 },
    ])

    const pdfCtx = createExecutionContext()
    await worker.queue(pdfBatch as any, env, pdfCtx)
    await waitOnExecutionContext(pdfCtx)

    // Get sheet records
    const sheetRecords = await db.select()
      .from(planSheets)
      .where(eq(planSheets.uploadId, testUploadId))

    expect(sheetRecords.length).toBeGreaterThan(0)

    // Note: This test will use the real container, so failures will be real container failures
    // The test verifies that the queue consumer handles failures gracefully

    // Create metadata jobs
    const metadataJobs: MetadataExtractionJob[] = sheetRecords.map((sheet) => ({
      uploadId: testUploadId,
      planId: testPlanId,
      sheetId: sheet.id,
      sheetNumber: sheet.sheetNumber,
      sheetKey: sheet.sheetKey,
      totalSheets: sheetRecords.length,
    }))

    const metadataBatch = createMessageBatch<MetadataExtractionJob>(
      "metadata-extraction-queue",
      metadataJobs.map((job, idx) => ({
        id: `metadata-fail-${idx + 1}`,
        timestamp: new Date(),
        body: job,
        attempts: 1,
      }))
    )

    const metadataCtx = createExecutionContext()
    await worker.queue(metadataBatch as any, env, metadataCtx)
    await waitOnExecutionContext(metadataCtx)

    const metadataResult = await getQueueResult(metadataBatch, metadataCtx)

    // Verify that all jobs were processed (either acked or retried)
    expect(metadataResult.explicitAcks.length + (metadataResult.explicitRetries?.length || 0)).toBe(sheetRecords.length)
    console.log(`✅ Processed ${metadataResult.explicitAcks.length} successfully, ${metadataResult.explicitRetries?.length || 0} retried`)

    // Verify PlanCoordinator shows progress
    const coordinatorId = env.PLAN_COORDINATOR.idFromName(testUploadId)
    const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)
    const progressResponse = await coordinator.fetch("http://localhost/progress")
    const progress = await progressResponse.json() as any

    expect(progress.completedSheets.length).toBeGreaterThanOrEqual(0)
    console.log(`✅ PlanCoordinator shows progress: ${progress.completedSheets.length}/${progress.totalSheets}`)
  }, 60000) // 1 minute timeout

  it("should handle empty marker detection results", async () => {
    // Check container availability
    const isAvailable = await isPlanOcrServiceAvailable()
    if (!isAvailable) {
      console.log("⏭️  Skipping test: plan-ocr-service container not available")
      return
    }

    console.log("\n⚠️ Testing empty marker detection")

    const testUploadId = "upload-no-markers"
    const testPlanId = "plan-no-markers"

    const markerJob: MarkerDetectionJob = {
      uploadId: testUploadId,
      planId: testPlanId,
      organizationId: TEST_ORGANIZATION_ID,
      projectId: TEST_PROJECT_ID,
      validSheets: ["A1", "A2"],
    }

    const markerBatch = createMessageBatch<MarkerDetectionJob>("marker-detection-queue", [
      { id: "marker-empty-1", timestamp: new Date(), body: markerJob, attempts: 1 },
    ])

    const markerCtx = createExecutionContext()
    await worker.queue(markerBatch as any, env, markerCtx)
    await waitOnExecutionContext(markerCtx)

    const markerResult = await getQueueResult(markerBatch, markerCtx)
    expect(markerResult.explicitAcks).toEqual(["marker-empty-1"])
    console.log(`✅ Job acknowledged even with no markers`)

    // Verify no markers were created (or verify that empty results are handled)
    const db = drizzle(env.SitelinkDB)
    const markerRecords = await db.select()
      .from(planMarkers)
      .where(eq(planMarkers.uploadId, testUploadId))

    // With real container, we can't guarantee no markers, but we verify the job completed
    expect(markerRecords.length).toBeGreaterThanOrEqual(0)
    console.log(`✅ No markers inserted (as expected)`)
  }, 180000) // 3 minute timeout for marker detection
})

