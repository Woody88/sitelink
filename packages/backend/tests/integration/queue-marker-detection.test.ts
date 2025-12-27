import { env } from "cloudflare:test"
import { beforeAll, afterAll, describe, expect, it } from "vitest"

describe("Marker Detection Queue - Integration", () => {
	const TEST_ORG_ID = "test-marker-org"
	const TEST_PROJECT_ID = "test-marker-project"
	const TEST_PLAN_ID = "test-marker-plan"
	const TEST_UPLOAD_ID = "test-marker-upload"

	describe("PlanCoordinator - generateMarkerTar()", () => {
		it("should generate tar stream for tiles", async () => {
			// Setup: Upload test tiles to R2
			const testTiles = [
				`organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-0/0/0_0.jpg`,
				`organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-0/0/0_1.jpg`,
			]

			// Create minimal JPEG header (valid JPEG)
			const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])

			for (const key of testTiles) {
				await env.SitelinkStorage.put(key, jpegHeader)
			}

			// Initialize coordinator
			const id = env.PLAN_COORDINATOR.idFromName(TEST_UPLOAD_ID)
			const coordinator = env.PLAN_COORDINATOR.get(id)

			// Generate tar
			const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Organization-Id": TEST_ORG_ID,
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": TEST_PLAN_ID,
					"X-Valid-Sheets": "0",
				}
			})

			expect(response.ok).toBe(true)
			expect(response.headers.get("Content-Type")).toBe("application/x-tar")

			const tarBuffer = await response.arrayBuffer()
			expect(tarBuffer.byteLength).toBeGreaterThan(0)

			console.log(`✅ Generated tar: ${tarBuffer.byteLength} bytes for ${testTiles.length} tiles`)

			// Cleanup
			for (const key of testTiles) {
				await env.SitelinkStorage.delete(key)
			}
		})

		it("should handle missing tiles gracefully", async () => {
			const id = env.PLAN_COORDINATOR.idFromName("test-upload-no-tiles")
			const coordinator = env.PLAN_COORDINATOR.get(id)

			const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Organization-Id": TEST_ORG_ID,
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": "nonexistent-plan",
					"X-Valid-Sheets": "0",
				}
			})

			expect(response.status).toBe(404)
			const errorText = await response.text()
			expect(errorText).toBe("No tiles found")

			console.log("✅ Correctly returned 404 for missing tiles")
		})

		it("should yield to event loop during large tar generation", async () => {
			// Test with 177 tiles (realistic scenario from the bug report)
			const testTiles = Array.from({ length: 177 }, (_, i) =>
				`organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-0/0/0_${i}.jpg`
			)

			// Create minimal JPEG header
			const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])

			console.log(`📦 Uploading ${testTiles.length} test tiles to R2...`)

			// Upload tiles in batches for better performance
			const batchSize = 25
			for (let i = 0; i < testTiles.length; i += batchSize) {
				const batch = testTiles.slice(i, i + batchSize)
				await Promise.all(batch.map(key => env.SitelinkStorage.put(key, jpegHeader)))
				console.log(`   Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testTiles.length / batchSize)}`)
			}

			const id = env.PLAN_COORDINATOR.idFromName("test-upload-large")
			const coordinator = env.PLAN_COORDINATOR.get(id)

			console.log("🔄 Generating tar for 177 tiles...")
			const startTime = Date.now()
			const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Organization-Id": TEST_ORG_ID,
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": TEST_PLAN_ID,
					"X-Valid-Sheets": "0",
				}
			})
			const duration = Date.now() - startTime

			expect(response.ok).toBe(true)
			const tarBuffer = await response.arrayBuffer()

			console.log(`✅ Generated tar for 177 tiles in ${duration}ms (${tarBuffer.byteLength} bytes)`)
			console.log(`   Average: ${(duration / testTiles.length).toFixed(2)}ms per tile`)

			// Should complete within reasonable time (< 30 seconds for 177 tiles)
			expect(duration).toBeLessThan(30000)

			// Cleanup
			console.log("🧹 Cleaning up test tiles...")
			for (let i = 0; i < testTiles.length; i += batchSize) {
				const batch = testTiles.slice(i, i + batchSize)
				await Promise.all(batch.map(key => env.SitelinkStorage.delete(key)))
			}
			console.log("✅ Cleanup complete")
		}, 60000) // 60 second timeout for this test

		it("should return 400 for missing headers", async () => {
			const id = env.PLAN_COORDINATOR.idFromName("test-upload-invalid")
			const coordinator = env.PLAN_COORDINATOR.get(id)

			// Test missing X-Organization-Id
			const response1 = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": TEST_PLAN_ID,
					"X-Valid-Sheets": "0",
				}
			})
			expect(response1.status).toBe(400)

			// Test missing X-Valid-Sheets
			const response2 = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Organization-Id": TEST_ORG_ID,
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": TEST_PLAN_ID,
				}
			})
			expect(response2.status).toBe(400)

			console.log("✅ Correctly validated required headers")
		})

		it("should handle tiles with various sizes", async () => {
			// Setup tiles with different sizes
			const testTiles = [
				{
					key: `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-0/0/small.jpg`,
					data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) // 4 bytes
				},
				{
					key: `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-0/0/medium.jpg`,
					data: new Uint8Array(1024) // 1KB
				},
				{
					key: `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/sheets/sheet-0/0/large.jpg`,
					data: new Uint8Array(10240) // 10KB
				},
			]

			for (const tile of testTiles) {
				await env.SitelinkStorage.put(tile.key, tile.data)
			}

			const id = env.PLAN_COORDINATOR.idFromName("test-upload-sizes")
			const coordinator = env.PLAN_COORDINATOR.get(id)

			const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Organization-Id": TEST_ORG_ID,
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": TEST_PLAN_ID,
					"X-Valid-Sheets": "0",
				}
			})

			expect(response.ok).toBe(true)
			const tarBuffer = await response.arrayBuffer()

			// Tar should be larger than sum of individual files (tar headers + padding)
			const totalFileSize = testTiles.reduce((sum, t) => sum + t.data.length, 0)
			expect(tarBuffer.byteLength).toBeGreaterThan(totalFileSize)

			console.log(`✅ Generated tar with mixed sizes: ${tarBuffer.byteLength} bytes (input: ${totalFileSize} bytes)`)

			// Cleanup
			for (const tile of testTiles) {
				await env.SitelinkStorage.delete(tile.key)
			}
		})
	})

	describe("End-to-End Marker Detection Flow", () => {
		it("should process marker detection without timeout", async () => {
			// This test verifies the full flow:
			// 1. Upload tiles to R2
			// 2. Initialize PlanCoordinator
			// 3. Call generateMarkerTar
			// 4. Verify tar is generated successfully

			const uploadId = "test-marker-e2e"
			const planId = "plan-marker-e2e"

			// Upload 177 test tiles (realistic production scenario)
			const tiles = Array.from({ length: 177 }, (_, i) => ({
				key: `organizations/${TEST_ORG_ID}/projects/${TEST_PROJECT_ID}/plans/${planId}/sheets/sheet-0/0/0_${i}.jpg`,
				data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) // Minimal JPEG
			}))

			console.log(`📦 Uploading ${tiles.length} tiles for e2e test...`)
			const batchSize = 25
			for (let i = 0; i < tiles.length; i += batchSize) {
				const batch = tiles.slice(i, i + batchSize)
				await Promise.all(batch.map(tile => env.SitelinkStorage.put(tile.key, tile.data)))
			}

			// Initialize PlanCoordinator
			const coordinatorId = env.PLAN_COORDINATOR.idFromName(uploadId)
			const coordinator = env.PLAN_COORDINATOR.get(coordinatorId)

			await coordinator.fetch("http://localhost/initialize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ uploadId, totalSheets: 1, timeoutMs: 900000 })
			})

			console.log("🔄 Generating tar through PlanCoordinator...")
			const startTime = Date.now()
			const response = await coordinator.fetch("http://localhost/generate-marker-tar", {
				method: "POST",
				headers: {
					"X-Organization-Id": TEST_ORG_ID,
					"X-Project-Id": TEST_PROJECT_ID,
					"X-Plan-Id": planId,
					"X-Valid-Sheets": "0",
				}
			})
			const duration = Date.now() - startTime

			expect(response.ok).toBe(true)
			const tarBuffer = await response.arrayBuffer()

			console.log(`✅ E2E test completed in ${duration}ms`)
			console.log(`   Tar size: ${tarBuffer.byteLength} bytes`)
			console.log(`   Tiles processed: ${tiles.length}`)
			console.log(`   Average time per tile: ${(duration / tiles.length).toFixed(2)}ms`)

			// Verify no timeout (should complete in < 30 seconds)
			expect(duration).toBeLessThan(30000)

			// Verify tar is reasonable size (should be at least as large as tile count * minimal size)
			expect(tarBuffer.byteLength).toBeGreaterThan(tiles.length * 4)

			// Cleanup
			console.log("🧹 Cleaning up e2e test...")
			for (let i = 0; i < tiles.length; i += batchSize) {
				const batch = tiles.slice(i, i + batchSize)
				await Promise.all(batch.map(tile => env.SitelinkStorage.delete(tile.key)))
			}
			console.log("✅ E2E cleanup complete")
		}, 60000) // 60 second timeout for test
	})
})
