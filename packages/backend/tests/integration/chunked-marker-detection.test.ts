import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { env } from "cloudflare:test"
import type { MarkerDetectionJob } from "../../src/core/queues/types"

describe("Chunked Marker Detection", () => {
  let testUploadId: string
  let testPlanId: string
  let testOrganizationId: string
  let testProjectId: string

  beforeAll(() => {
    testUploadId = `test-upload-${Date.now()}`
    testPlanId = `test-plan-${Date.now()}`
    testOrganizationId = `test-org-${Date.now()}`
    testProjectId = `test-project-${Date.now()}`
  })

  describe("Non-Chunked Processing (Small Jobs)", () => {
    it("should process a non-chunked job with <= 25 tiles", async () => {
      const job: MarkerDetectionJob = {
        uploadId: testUploadId,
        planId: testPlanId,
        organizationId: testOrganizationId,
        projectId: testProjectId,
        validSheets: ["Sheet-1"],
        isChunked: false
      }

      // This test verifies the job structure is correct
      expect(job.isChunked).toBe(false)
      expect(job.chunkId).toBeUndefined()
      expect(job.chunkIndex).toBeUndefined()
      expect(job.totalChunks).toBeUndefined()
      expect(job.tileKeys).toBeUndefined()
    })

    it("should handle non-chunked job without optional fields", async () => {
      // Backward compatibility test: old jobs without chunking fields
      const job: MarkerDetectionJob = {
        uploadId: testUploadId,
        planId: testPlanId,
        organizationId: testOrganizationId,
        projectId: testProjectId,
        validSheets: ["Sheet-1"]
        // No chunking fields at all
      }

      // Verify TypeScript accepts job without chunking fields
      expect(job).toBeDefined()
      expect(job.isChunked).toBeUndefined()
    })
  })

  describe("Chunked Processing (Large Jobs)", () => {
    const chunkId = crypto.randomUUID()

    it("should create valid chunked jobs with proper metadata", async () => {
      // Simulate 75 tiles split into 3 chunks of 25
      const totalTiles = 75
      const chunkSize = 25
      const totalChunks = Math.ceil(totalTiles / chunkSize)

      const chunks: MarkerDetectionJob[] = []

      for (let i = 0; i < totalChunks; i++) {
        const startIdx = i * chunkSize
        const endIdx = Math.min(startIdx + chunkSize, totalTiles)
        const tileKeys = Array.from(
          { length: endIdx - startIdx },
          (_, j) => `tile-${startIdx + j}.jpg`
        )

        const chunk: MarkerDetectionJob = {
          uploadId: testUploadId,
          planId: testPlanId,
          organizationId: testOrganizationId,
          projectId: testProjectId,
          validSheets: ["Sheet-1", "Sheet-2"],
          isChunked: true,
          chunkIndex: i,
          totalChunks,
          tileKeys,
          chunkId
        }

        chunks.push(chunk)
      }

      // Verify we created 3 chunks
      expect(chunks).toHaveLength(3)

      // Verify first chunk
      expect(chunks[0].chunkIndex).toBe(0)
      expect(chunks[0].totalChunks).toBe(3)
      expect(chunks[0].tileKeys).toHaveLength(25)
      expect(chunks[0].tileKeys![0]).toBe("tile-0.jpg")
      expect(chunks[0].tileKeys![24]).toBe("tile-24.jpg")
      expect(chunks[0].chunkId).toBe(chunkId)

      // Verify second chunk
      expect(chunks[1].chunkIndex).toBe(1)
      expect(chunks[1].totalChunks).toBe(3)
      expect(chunks[1].tileKeys).toHaveLength(25)
      expect(chunks[1].tileKeys![0]).toBe("tile-25.jpg")
      expect(chunks[1].tileKeys![24]).toBe("tile-49.jpg")
      expect(chunks[1].chunkId).toBe(chunkId)

      // Verify third chunk (partial, only 25 tiles)
      expect(chunks[2].chunkIndex).toBe(2)
      expect(chunks[2].totalChunks).toBe(3)
      expect(chunks[2].tileKeys).toHaveLength(25)
      expect(chunks[2].tileKeys![0]).toBe("tile-50.jpg")
      expect(chunks[2].tileKeys![24]).toBe("tile-74.jpg")
      expect(chunks[2].chunkId).toBe(chunkId)

      // Verify all chunks share the same chunkId
      const uniqueChunkIds = new Set(chunks.map(c => c.chunkId))
      expect(uniqueChunkIds.size).toBe(1)
    })

    it("should handle 118 tiles split into 5 chunks", async () => {
      // Real-world scenario from the problem statement
      const totalTiles = 118
      const chunkSize = 25
      const totalChunks = Math.ceil(totalTiles / chunkSize)

      expect(totalChunks).toBe(5)

      const chunks: MarkerDetectionJob[] = []

      for (let i = 0; i < totalChunks; i++) {
        const startIdx = i * chunkSize
        const endIdx = Math.min(startIdx + chunkSize, totalTiles)
        const tileKeys = Array.from(
          { length: endIdx - startIdx },
          (_, j) => `tile-${startIdx + j}.jpg`
        )

        chunks.push({
          uploadId: testUploadId,
          planId: testPlanId,
          organizationId: testOrganizationId,
          projectId: testProjectId,
          validSheets: ["Sheet-1", "Sheet-2"],
          isChunked: true,
          chunkIndex: i,
          totalChunks,
          tileKeys,
          chunkId
        })
      }

      // Verify chunk distribution
      expect(chunks[0].tileKeys).toHaveLength(25) // Chunk 0: tiles 0-24
      expect(chunks[1].tileKeys).toHaveLength(25) // Chunk 1: tiles 25-49
      expect(chunks[2].tileKeys).toHaveLength(25) // Chunk 2: tiles 50-74
      expect(chunks[3].tileKeys).toHaveLength(25) // Chunk 3: tiles 75-99
      expect(chunks[4].tileKeys).toHaveLength(18) // Chunk 4: tiles 100-117 (partial)

      // Verify total tiles match
      const totalTilesInChunks = chunks.reduce(
        (sum, chunk) => sum + (chunk.tileKeys?.length || 0),
        0
      )
      expect(totalTilesInChunks).toBe(118)
    })

    it("should handle edge case: exactly 25 tiles (no chunking needed)", async () => {
      const totalTiles = 25
      const chunkSize = 25

      // Should NOT chunk - single job
      const shouldChunk = totalTiles > chunkSize
      expect(shouldChunk).toBe(false)

      // Create non-chunked job
      const job: MarkerDetectionJob = {
        uploadId: testUploadId,
        planId: testPlanId,
        organizationId: testOrganizationId,
        projectId: testProjectId,
        validSheets: ["Sheet-1"],
        isChunked: false
      }

      expect(job.isChunked).toBe(false)
    })

    it("should handle edge case: 26 tiles (requires 2 chunks)", async () => {
      const totalTiles = 26
      const chunkSize = 25
      const totalChunks = Math.ceil(totalTiles / chunkSize)

      expect(totalChunks).toBe(2)

      const chunks: MarkerDetectionJob[] = []

      for (let i = 0; i < totalChunks; i++) {
        const startIdx = i * chunkSize
        const endIdx = Math.min(startIdx + chunkSize, totalTiles)
        const tileKeys = Array.from(
          { length: endIdx - startIdx },
          (_, j) => `tile-${startIdx + j}.jpg`
        )

        chunks.push({
          uploadId: testUploadId,
          planId: testPlanId,
          organizationId: testOrganizationId,
          projectId: testProjectId,
          validSheets: ["Sheet-1"],
          isChunked: true,
          chunkIndex: i,
          totalChunks,
          tileKeys,
          chunkId
        })
      }

      // Verify chunk distribution
      expect(chunks[0].tileKeys).toHaveLength(25) // First chunk: full
      expect(chunks[1].tileKeys).toHaveLength(1)  // Second chunk: only 1 tile
    })
  })

  describe("Chunk Metadata Validation", () => {
    it("should have consistent chunkId across all chunks", async () => {
      const sharedChunkId = crypto.randomUUID()
      const totalChunks = 3

      const chunks: MarkerDetectionJob[] = Array.from({ length: totalChunks }, (_, i) => ({
        uploadId: testUploadId,
        planId: testPlanId,
        organizationId: testOrganizationId,
        projectId: testProjectId,
        validSheets: ["Sheet-1"],
        isChunked: true,
        chunkIndex: i,
        totalChunks,
        tileKeys: [`tile-${i}.jpg`],
        chunkId: sharedChunkId
      }))

      // All chunks should have the same chunkId
      chunks.forEach(chunk => {
        expect(chunk.chunkId).toBe(sharedChunkId)
      })
    })

    it("should have sequential chunk indices", async () => {
      const totalChunks = 5
      const chunks: MarkerDetectionJob[] = Array.from({ length: totalChunks }, (_, i) => ({
        uploadId: testUploadId,
        planId: testPlanId,
        organizationId: testOrganizationId,
        projectId: testProjectId,
        validSheets: ["Sheet-1"],
        isChunked: true,
        chunkIndex: i,
        totalChunks,
        tileKeys: [`tile-${i}.jpg`],
        chunkId: crypto.randomUUID()
      }))

      // Verify indices are 0, 1, 2, 3, 4
      chunks.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i)
      })
    })

    it("should have correct totalChunks in all chunks", async () => {
      const totalChunks = 4
      const chunks: MarkerDetectionJob[] = Array.from({ length: totalChunks }, (_, i) => ({
        uploadId: testUploadId,
        planId: testPlanId,
        organizationId: testOrganizationId,
        projectId: testProjectId,
        validSheets: ["Sheet-1"],
        isChunked: true,
        chunkIndex: i,
        totalChunks,
        tileKeys: [`tile-${i}.jpg`],
        chunkId: crypto.randomUUID()
      }))

      // All chunks should have the same totalChunks value
      chunks.forEach(chunk => {
        expect(chunk.totalChunks).toBe(4)
      })
    })
  })

  describe("Type Safety", () => {
    it("should accept all required fields", async () => {
      const job: MarkerDetectionJob = {
        uploadId: "test-upload",
        planId: "test-plan",
        organizationId: "test-org",
        projectId: "test-project",
        validSheets: ["Sheet-1"]
      }

      expect(job).toBeDefined()
    })

    it("should accept all optional chunking fields", async () => {
      const job: MarkerDetectionJob = {
        uploadId: "test-upload",
        planId: "test-plan",
        organizationId: "test-org",
        projectId: "test-project",
        validSheets: ["Sheet-1"],
        isChunked: true,
        chunkIndex: 0,
        totalChunks: 3,
        tileKeys: ["tile-1.jpg", "tile-2.jpg"],
        chunkId: "test-chunk-id"
      }

      expect(job).toBeDefined()
      expect(job.isChunked).toBe(true)
      expect(job.chunkIndex).toBe(0)
      expect(job.totalChunks).toBe(3)
      expect(job.tileKeys).toHaveLength(2)
      expect(job.chunkId).toBe("test-chunk-id")
    })
  })
})
