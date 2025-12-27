#!/usr/bin/env bun

/**
 * Test queue endpoint from outside the worker
 * 
 * This script sends a TileJob to the test queue endpoint and verifies
 * that the queue consumer executes. Check your local worker logs to see
 * the consumer output.
 * 
 * Run with: bun run test-queue.ts
 * 
 * Environment variables:
 * - BASE_URL: Base URL of the worker (default: http://localhost:8787)
 */

const BASE_URL = process.env["BASE_URL"] || "http://localhost:8787"

// Sample TileJob data
const sampleTileJob = {
	uploadId: `test-upload-${Date.now()}`,
	projectId: "test-project-123",
	planId: "test-plan-456",
	organizationId: "test-org-789",
	sheetNumber: 1,
	sheetKey: "organizations/test-org-789/projects/test-project-123/plans/test-plan-456/uploads/test-upload-123/sheet-1.pdf",
	totalSheets: 3,
}

async function testQueue() {
	console.log("🚀 Testing queue endpoint...")
	console.log("")
	console.log("📋 Sample TileJob:")
	console.log(JSON.stringify(sampleTileJob, null, 2))
	console.log("")

	try {
		// Send POST request to test queue endpoint
		console.log(`📤 Sending POST request to ${BASE_URL}/api/test/queue...`)
		const response = await fetch(`${BASE_URL}/api/test/queue`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(sampleTileJob),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(
				`Queue request failed: ${response.status} ${errorText}`,
			)
		}

		const result = (await response.json()) as {
			success: boolean
			message: string
			data?: {
				queued: boolean
				job: typeof sampleTileJob
			}
			error?: string
		}

		if (!result.success) {
			throw new Error(`Queue failed: ${result.error}`)
		}

		console.log("✅ Tile job queued successfully!")
		console.log("   Message:", result.message)
		if (result.data) {
			console.log("   Job queued:", result.data.queued)
		}
		console.log("")
		console.log("⏳ Waiting for queue consumer to process the message...")
		console.log("   (Consumer will execute automatically via Cloudflare's queue system)")
		console.log("")
		console.log("📝 Check your worker logs (wrangler dev output) for queue consumer messages:")
		console.log("   - Look for: '🚀 [QUEUE CONSUMER] Processing X tile generation jobs'")
		console.log("   - Look for: '✅ [QUEUE CONSUMER] Processing tile job for sheet X/Y'")
		console.log("")
		console.log("💡 Note: The consumer should execute automatically within a few seconds.")
		console.log("   If you don't see logs, check that wrangler.jsonc has the consumer configured.")
	} catch (error) {
		console.error("❌ Test failed:", error)
		process.exit(1)
	}
}

// Run the test
testQueue()

