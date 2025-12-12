import { DurableObject } from "cloudflare:workers"
import type { Env } from '../bindings'

interface PlanCoordinatorState {
	uploadId: string
	totalSheets: number
	completedSheets: number[] // Metadata extraction phase
	completedTiles: number[] // Tile generation phase
	status: "in_progress" | "triggering_tiles" | "tiles_in_progress" | "triggering_markers" | "complete" | "failed_timeout"
	createdAt: number
}

export class PlanCoordinator extends DurableObject<Env> {
	private state: PlanCoordinatorState | null = null

	/**
	 * Initialize the coordinator with the total number of sheets
	 * Sets up timeout alarm to prevent hanging forever
	 */
	async initialize(uploadId: string, totalSheets: number, timeoutMs: number = 15 * 60 * 1000) {
		console.log(`[PlanCoordinator] Initializing for uploadId=${uploadId}, totalSheets=${totalSheets}`)

		this.state = {
			uploadId,
			totalSheets,
			completedSheets: [],
			completedTiles: [],
			status: "in_progress",
			createdAt: Date.now(),
		}

		// Persist state
		await this.ctx.storage.put("state", this.state)

		// Set alarm for timeout (default: 15 minutes)
		await this.ctx.storage.setAlarm(Date.now() + timeoutMs)

		return {
			success: true,
			state: this.state,
		}
	}

	/**
	 * Mark a sheet as complete (idempotent)
	 * Auto-triggers tile generation when all sheets are complete
	 */
	async sheetComplete(sheetNumber: number, validSheets: string[]) {
		console.log(`[PlanCoordinator] Sheet ${sheetNumber} complete`)

		// Load state if not in memory
		if (!this.state) {
			this.state = await this.ctx.storage.get<PlanCoordinatorState>("state")
			if (!this.state) {
				throw new Error("PlanCoordinator not initialized")
			}
		}

		// Idempotent: only add if not already present
		if (!this.state.completedSheets.includes(sheetNumber)) {
			this.state.completedSheets.push(sheetNumber)
			await this.ctx.storage.put("state", this.state)
			console.log(
				`[PlanCoordinator] Progress: ${this.state.completedSheets.length}/${this.state.totalSheets}`
			)
		} else {
			console.log(`[PlanCoordinator] Sheet ${sheetNumber} already marked complete (idempotent)`)
		}

		// Check if all sheets are complete AND we haven't started triggering yet
		if (
			this.state.completedSheets.length === this.state.totalSheets &&
			this.state.status === "in_progress"
		) {
			console.log(`[PlanCoordinator] All metadata extraction complete! Auto-triggering tile generation...`)

			// 1. Immediately change state to prevent re-entry
			this.state.status = "triggering_tiles"
			await this.ctx.storage.put("state", this.state)

			// 2. Query database for all sheets and enqueue tile generation jobs
			try {
				console.log(`[PlanCoordinator] Querying database for sheets with uploadId=${this.state.uploadId}`)

				// Query plan_sheets table with joins to get planId, projectId, and organizationId
				const sheetsResult = await this.env.SitelinkDB.prepare(
					`SELECT
						ps.id,
						ps.sheet_number as sheetNumber,
						ps.sheet_key as sheetKey,
						ps.plan_id as planId,
						p.project_id as projectId,
						pr.organization_id as organizationId
					FROM plan_sheets ps
					JOIN plans p ON ps.plan_id = p.id
					JOIN projects pr ON p.project_id = pr.id
					WHERE ps.upload_id = ?
					ORDER BY ps.sheet_number ASC`
				)
					.bind(this.state.uploadId)
					.all()

				const sheets = sheetsResult.results

				if (!sheets || sheets.length === 0) {
					console.error(`[PlanCoordinator] ❌ No sheets found in database for uploadId=${this.state.uploadId}`)
					throw new Error(`No sheets found for uploadId=${this.state.uploadId}`)
				}

				console.log(`[PlanCoordinator] Found ${sheets.length} sheets in database. Enqueuing tile generation jobs...`)

				// Enqueue tile generation for each sheet
				for (const sheet of sheets) {
					await this.env.TILE_GENERATION_QUEUE.send({
						uploadId: this.state.uploadId,
						sheetId: sheet.id as string,
						sheetNumber: sheet.sheetNumber as number,
						sheetKey: sheet.sheetKey as string,
						planId: sheet.planId as string,
						projectId: sheet.projectId as string,
						organizationId: sheet.organizationId as string,
						totalSheets: this.state.totalSheets,
					})
					console.log(`[PlanCoordinator] Enqueued tile job for sheet ${sheet.sheetNumber}`)
				}

				console.log(
					`[PlanCoordinator] ✅ Tile generation enqueued for ${sheets.length} sheets (uploadId=${this.state.uploadId})`
				)
			} catch (error) {
				console.error(`[PlanCoordinator] ❌ Failed to enqueue tile generation:`, error)
				// Don't fail the whole operation - the job will need to be retried manually
			}

			// 3. Mark as tiles in progress
			this.state.status = "tiles_in_progress"
			await this.ctx.storage.put("state", this.state)
		}

		return {
			success: true,
			progress: {
				completedSheets: this.state.completedSheets.length,
				totalSheets: this.state.totalSheets,
				status: this.state.status,
			},
		}
	}

	/**
	 * Mark a tile as complete (idempotent)
	 * Auto-triggers marker detection when all tiles are complete
	 */
	async tileComplete(sheetNumber: number) {
		console.log(`[PlanCoordinator] Tile ${sheetNumber} complete`)

		// Load state if not in memory
		if (!this.state) {
			this.state = await this.ctx.storage.get<PlanCoordinatorState>("state")
			if (!this.state) {
				throw new Error("PlanCoordinator not initialized")
			}
		}

		// Idempotent: only add if not already present
		if (!this.state.completedTiles.includes(sheetNumber)) {
			this.state.completedTiles.push(sheetNumber)
			await this.ctx.storage.put("state", this.state)
			console.log(
				`[PlanCoordinator] Tile Progress: ${this.state.completedTiles.length}/${this.state.totalSheets}`
			)
		} else {
			console.log(`[PlanCoordinator] Tile ${sheetNumber} already marked complete (idempotent)`)
		}

		// Check if all tiles are complete AND we're in the right state
		if (
			this.state.completedTiles.length === this.state.totalSheets &&
			this.state.status === "tiles_in_progress"
		) {
			console.log(`[PlanCoordinator] All tiles complete! Auto-triggering marker detection...`)

			// 1. Immediately change state to prevent re-entry
			this.state.status = "triggering_markers"
			await this.ctx.storage.put("state", this.state)

			// 2. Trigger marker detection with chunking logic
			try {
				await this.triggerMarkerDetection()
			} catch (error) {
				console.error(`[PlanCoordinator] ❌ Failed to trigger marker detection:`, error)
				// Don't fail the whole operation - the job will need to be retried manually
			}

			// 3. Cancel the timeout alarm (we succeeded!)
			await this.ctx.storage.deleteAlarm()

			// 4. Mark as complete
			this.state.status = "complete"
			await this.ctx.storage.put("state", this.state)
		}

		return {
			success: true,
			progress: {
				completedTiles: this.state.completedTiles.length,
				totalSheets: this.state.totalSheets,
				status: this.state.status,
			},
		}
	}

	/**
	 * Trigger marker detection with automatic chunking for large tile sets
	 * Phase 2: Implements chunking logic to split large jobs into smaller batches
	 */
	private async triggerMarkerDetection() {
		console.log(`[PlanCoordinator] Querying database for sheets with uploadId=${this.state!.uploadId}`)

		const sheetsResult = await this.env.SitelinkDB.prepare(
			`SELECT
				ps.id,
				ps.sheet_number as sheetNumber,
				ps.sheet_name as sheetName,
				ps.plan_id as planId,
				p.project_id as projectId,
				pr.organization_id as organizationId
			FROM plan_sheets ps
			JOIN plans p ON ps.plan_id = p.id
			JOIN projects pr ON p.project_id = pr.id
			WHERE ps.upload_id = ?
			AND ps.metadata_status = 'extracted'
			ORDER BY ps.sheet_number ASC`
		)
			.bind(this.state!.uploadId)
			.all()

		const sheets = sheetsResult.results

		if (!sheets || sheets.length === 0) {
			console.error(`[PlanCoordinator] ❌ No sheets found in database for uploadId=${this.state!.uploadId}`)
			throw new Error(`No sheets found for uploadId=${this.state!.uploadId}`)
		}

		console.log(`[PlanCoordinator] Found ${sheets.length} sheets with extracted metadata`)

		// Get planId, projectId, organizationId from first sheet (they're all the same for this upload)
		const firstSheet = sheets[0]
		const planId = firstSheet.planId as string
		const projectId = firstSheet.projectId as string
		const organizationId = firstSheet.organizationId as string

		// Build valid sheets list from sheet names
		// Filter to only include sheet reference format (e.g., "A5", "A6", "A7")
		// Skip metadata sheet names like "Sheet-14a8" which don't match marker format
		const sheetReferencePattern = /^[A-Z]\d+$/i // Matches "A5", "A6", "A7", etc.
		const validSheets = sheets
			.filter((s) => s.sheetName !== null && s.sheetName !== undefined)
			.map((s) => s.sheetName as string)
			.filter((name) => sheetReferencePattern.test(name)) // Only keep valid sheet reference format

		if (validSheets.length === 0) {
			console.log(`[PlanCoordinator] No valid sheet references found (metadata names don't match marker format), proceeding without valid_sheets context`)
		} else {
			console.log(`[PlanCoordinator] Valid sheets for marker detection: ${validSheets.join(", ")}`)
		}

		// List all tile keys from R2
		const tilePrefix = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/`
		console.log(`[PlanCoordinator] Listing tiles from R2: ${tilePrefix}`)

		const env = this.env as Env
		const tileList = await env.SitelinkStorage.list({ prefix: tilePrefix })
		const tileKeys = tileList.objects
			.filter(obj => obj.key.endsWith('.jpg'))
			.map(obj => obj.key)

		console.log(`[PlanCoordinator] Found ${tileKeys.length} tile images`)

		// Define chunk size for parallel processing
		const CHUNK_SIZE = 25

		if (tileKeys.length <= CHUNK_SIZE) {
			// Small job - process as single non-chunked job
			console.log(`[PlanCoordinator] Small job (${tileKeys.length} tiles) - enqueuing single non-chunked marker detection job`)

			await this.env.MARKER_DETECTION_QUEUE.send({
				uploadId: this.state!.uploadId,
				planId,
				organizationId,
				projectId,
				validSheets,
			})

			console.log(`[PlanCoordinator] ✅ Marker detection job enqueued`)
		} else {
			// Large job - split into chunks
			const chunks = this.chunkArray(tileKeys, CHUNK_SIZE)
			const chunkId = crypto.randomUUID() // Shared ID for all chunks in this batch

			console.log(`[PlanCoordinator] Large job (${tileKeys.length} tiles) - splitting into ${chunks.length} chunks of up to ${CHUNK_SIZE} tiles each`)

			// Enqueue a job for each chunk
			for (let i = 0; i < chunks.length; i++) {
				const chunkTileKeys = chunks[i]

				await this.env.MARKER_DETECTION_QUEUE.send({
					uploadId: this.state!.uploadId,
					planId,
					organizationId,
					projectId,
					validSheets,
					isChunked: true,
					chunkIndex: i,
					totalChunks: chunks.length,
					tileKeys: chunkTileKeys,
					chunkId,
				})

				console.log(`[PlanCoordinator] Enqueued chunk ${i + 1}/${chunks.length} with ${chunkTileKeys.length} tiles`)
			}

			console.log(`[PlanCoordinator] ✅ Marker detection chunked jobs enqueued: ${chunks.length} chunks`)
		}

		// Update processing job status to complete
		await this.env.SitelinkDB.prepare(
			`UPDATE processing_jobs
			SET status = 'complete',
			    completed_at = ?,
			    updated_at = ?
			WHERE upload_id = ?`
		)
			.bind(Date.now(), Date.now(), this.state!.uploadId)
			.run()

		console.log(`[PlanCoordinator] ✅ Processing job marked as complete`)
	}

	/**
	 * Helper method to split an array into chunks of specified size
	 */
	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = []
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize))
		}
		return chunks
	}

	/**
	 * Get current progress
	 */
	async getProgress() {
		if (!this.state) {
			this.state = await this.ctx.storage.get<PlanCoordinatorState>("state")
			if (!this.state) {
				return { error: "PlanCoordinator not initialized" }
			}
		}

		return {
			uploadId: this.state.uploadId,
			completedSheets: this.state.completedSheets,
			totalSheets: this.state.totalSheets,
			status: this.state.status,
			createdAt: this.state.createdAt,
			progress: Math.round((this.state.completedSheets.length / this.state.totalSheets) * 100),
		}
	}

	/**
	 * Alarm handler for timeout
	 * Called automatically when the alarm fires
	 */
	async alarm() {
		console.log(`[PlanCoordinator] Timeout alarm fired`)

		if (!this.state) {
			this.state = await this.ctx.storage.get<PlanCoordinatorState>("state")
		}

		if (!this.state) {
			console.error(`[PlanCoordinator] Alarm fired but no state found`)
			return
		}

		// Only timeout if still in progress (not complete)
		if (this.state.status !== "complete") {
			console.error(
				`[PlanCoordinator] ⏰ TIMEOUT for uploadId=${this.state.uploadId} - Status: ${this.state.status}, Metadata: ${this.state.completedSheets.length}/${this.state.totalSheets}, Tiles: ${this.state.completedTiles.length}/${this.state.totalSheets}`
			)

			this.state.status = "failed_timeout"
			await this.ctx.storage.put("state", this.state)

			// Update processing job to reflect timeout
			try {
				await this.env.SitelinkDB.prepare(
					`UPDATE processing_jobs
					SET status = 'failed',
					    last_error = 'Processing timeout - not all steps completed within time limit',
					    updated_at = ?
					WHERE upload_id = ?`
				)
					.bind(Date.now(), this.state.uploadId)
					.run()
				console.log(`[PlanCoordinator] ✅ Processing job marked as failed due to timeout`)
			} catch (error) {
				console.error(`[PlanCoordinator] ❌ Failed to update processing job on timeout:`, error)
			}
		} else {
			console.log(
				`[PlanCoordinator] Alarm fired but status is ${this.state.status} - ignoring`
			)
		}
	}

	/**
	 * HTTP fetch handler for direct API access
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		const path = url.pathname

		try {
			if (path === "/initialize" && request.method === "POST") {
				const body = await request.json<{
					uploadId: string
					totalSheets: number
					timeoutMs?: number
				}>()
				const result = await this.initialize(body.uploadId, body.totalSheets, body.timeoutMs)
				return Response.json(result)
			}

			if (path === "/sheet-complete" && request.method === "POST") {
				const body = await request.json<{ sheetNumber: number; validSheets: string[] }>()
				const result = await this.sheetComplete(body.sheetNumber, body.validSheets)
				return Response.json(result)
			}

			if (path === "/tile-complete" && request.method === "POST") {
				const body = await request.json<{ sheetNumber: number }>()
				const result = await this.tileComplete(body.sheetNumber)
				return Response.json(result)
			}

			if (path === "/progress" && request.method === "GET") {
				const result = await this.getProgress()
				return Response.json(result)
			}

			return new Response("Not Found", { status: 404 })
		} catch (error) {
			console.error(`[PlanCoordinator] Error handling request:`, error)
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 }
			)
		}
	}
}
