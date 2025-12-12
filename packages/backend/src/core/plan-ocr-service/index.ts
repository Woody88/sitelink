import { Container } from "@cloudflare/containers"

/**
 * Plan OCR Service Container
 * 
 * Manages the plan-ocr-service container for metadata extraction and marker detection.
 * The container is started on-demand by Cloudflare and handles:
 * - PDF metadata extraction (sheet numbers, title blocks, etc.)
 * - Marker detection from tile images
 * 
 * Similar to SitelinkPdfProcessor, this container is R2-agnostic - it receives
 * streams from the Worker and returns results, without needing direct R2 access.
 */
export class PlanOcrService extends Container {
	override defaultPort = 8000 // Port the container is listening on
	override sleepAfter = "10m" // Stop the instance if requests not sent for 10 minutes
	
	override envVars = {
		OPENROUTER_API_KEY: "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",
	}

	override onStart() {
		console.log("PlanOcrService container successfully started")
	}

	override onError(error: string) {
		console.log("PlanOcrService container error:", error)
	}
}

