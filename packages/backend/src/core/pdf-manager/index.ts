import { DurableObject } from "cloudflare:workers"
import { Container } from "@cloudflare/containers"

export interface NewProcessingJob {
	jobId: string
	uploadId: string
	planId: string
	organizationId: string
	projectId: string
	pdfPath: string // R2 path to original PDF
	filename: string
	fileSize: number
	uploadedAt?: number
}

/**
 * Processing job state - stored in Durable Object
 */
export interface ProcessingJobState extends NewProcessingJob {
	// Progress fields
	status: "pending" | "processing" | "complete" | "partial_failure" | "failed"
	totalPages?: number
	completedPages?: number
	failedPages?: number[]
	progress?: number // 0-100
	startedAt?: number
	completedAt?: number
	lastError?: {
		page: number
		message: string
		timestamp: number
	}
}

export class SitelinkPdfProcessor extends DurableObject<Env> {
	defaultPort = 3000
	container?: globalThis.Container
	monitor?: Promise<unknown>
	conn?: WebSocket

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)

		// Container is optional - allows testing state management without container
		if (ctx.container !== undefined) {
			this.container = ctx.container

			ctx.blockConcurrencyWhile(async () => {
				if (!this.container!.running) this.container!.start()
				this.monitor = this.container!.monitor().then(() =>
					console.log("Container exited?"),
				)

				await Promise.resolve()
			})
		}
	}

	init() {
		console.log("Starting container")
	}

	/**
	 * Initialize a new processing job
	 */
	async initialize(job: NewProcessingJob): Promise<void> {
		const initialState: ProcessingJobState = {
			...job,
			status: "pending",
			progress: 0,
			startedAt: Date.now(),
		}

		await this.ctx.storage.put(job.jobId, initialState)
	}

	/**
	 * Get current progress for a job
	 */
	async getProgress(jobId: string): Promise<ProcessingJobState | undefined> {
		return await this.ctx.storage.get<ProcessingJobState>(jobId)
	}

	/**
	 * Update job progress
	 */
	async updateProgress(
		jobId: string,
		update: Partial<ProcessingJobState>,
	): Promise<void> {
		const current = await this.getProgress(jobId)
		if (!current) {
			throw new Error(`Job ${jobId} not found`)
		}

		const updated = { ...current, ...update }
		await this.ctx.storage.put(jobId, updated)

		// Broadcast to connected WebSocket clients if any
		this.ctx.getWebSockets().forEach((ws) => {
			ws.send(
				JSON.stringify({
					type: "progress_update",
					data: updated,
				}),
			)
		})
	}

	/**
	 * Mark a page as complete and update progress
	 */
	async markPageComplete(
		jobId: string,
		pageNum: number,
		totalPages: number,
	): Promise<void> {
		const progress = await this.getProgress(jobId)
		if (!progress) {
			throw new Error(`Job ${jobId} not found`)
		}

		const completedPages = (progress.completedPages || 0) + 1
		const progressPercent = Math.round((completedPages / totalPages) * 100)

		await this.updateProgress(jobId, {
			status: completedPages === totalPages ? "complete" : "processing",
			completedPages,
			progress: progressPercent,
			totalPages,
			...(completedPages === totalPages && { completedAt: Date.now() }),
		})
	}

	/**
	 * Mark a page as failed
	 */
	async markPageFailed(
		jobId: string,
		pageNum: number,
		error: string,
	): Promise<void> {
		const progress = await this.getProgress(jobId)
		if (!progress) {
			throw new Error(`Job ${jobId} not found`)
		}

		const failedPages = [...(progress.failedPages || []), pageNum]

		await this.updateProgress(jobId, {
			failedPages,
			status: "partial_failure",
			lastError: {
				page: pageNum,
				message: error,
				timestamp: Date.now(),
			},
		})
	}

	override async alarm(): Promise<void> {
		// Alarm has 30s CPU time (default) or up to 5 min (configured)
		const jobs = await this.ctx.storage.list<ProcessingJobState>()

		for (const [_, progress] of jobs) {
			if (progress.status === "pending") {
				// Start WebSocket - this uses some CPU time
				await this.processPDF(progress)
			}
		}
	}

	/**
	 * Process a PDF using the container (production only)
	 */
	async processPDF(
		job: NewProcessingJob,
		signal?: AbortSignal,
	): Promise<Response> {
		// Initialize job state first
		await this.initialize(job)

		// Container processing only available in production
		if (!this.container) {
			throw new Error(
				"Container not available - PDF processing requires production environment",
			)
		}

		const conn = this.container.getTcpPort(this.defaultPort)

		const res = await conn.fetch(
			new Request("http://localhost/ws", { headers: { Upgrade: "websocket" } }),
			{
				signal,
			},
		)

		if (res.webSocket === null) throw new Error("websocket server is faulty")

		res.webSocket.accept()
		res.webSocket.addEventListener("message", (msg) => {
			if (this.resolveResolve !== undefined)
				this.resolveResolve(
					typeof msg.data === "string"
						? msg.data
						: new TextDecoder().decode(msg.data),
				)
		})

		res.webSocket.addEventListener("close", () => {
			this.ctx.abort()
		})

		this.conn = res.webSocket

		res.webSocket.send("job kick offf")

		return Response.json({ message: "job kicked off" })
	}

	resolveResolve(s: string) {
		console.log("message: ", s)
	}
}
