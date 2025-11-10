import { env } from "cloudflare:workers"
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

export class SitelinkPdfProcessor extends Container {
	override defaultPort = 3000 // Port the container is listening on
	override sleepAfter = "10m" // Stop the instance if requests not sent for 10 minutes
	override envVars = {
		R2_ENDPOINT: env.R2_ENDPOINT,
		R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
		R2_BUCKET: env.R2_BUCKET,
	}
	override onStart() {
		console.log("Container successfully started")
	}

	override onError(error: string) {
		console.log("Container error:", error)
	}
}
