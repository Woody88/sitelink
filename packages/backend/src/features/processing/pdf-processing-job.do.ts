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
class SitelinkPdfProcessor extends DurableObject<Env> {
	defaultPort = 3000
	container: globalThis.Container
	monitor?: Promise<unknown>
	conn?: WebSocket

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		if (ctx.container === undefined) throw new Error("no container")
		this.container = ctx.container

		ctx.blockConcurrencyWhile(async () => {
			if (!this.container.running) this.container.start()
			this.monitor = this.container
				.monitor()
				.then(() => console.log("Container exited?"))

			await Promise.resolve()
		})
	}

	init() {
		console.log("Starting container")
	}

	async compressString(value: string): Promise<Response> {
		const conn = this.container.getTcpPort(3000)

		const res = await conn.fetch(
			new Request("http://localhost/ws", { headers: { Upgrade: "websocket" } }),
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
