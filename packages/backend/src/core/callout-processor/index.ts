import { Container } from "@cloudflare/containers"

/**
 * Callout Processor Container
 *
 * Manages the callout-processor container for PDF processing:
 * - Metadata extraction (sheet numbers, dimensions, title blocks)
 * - Marker detection from full sheet PDFs (CV + LLM approach)
 *
 * This replaces the old plan-ocr-service with a simpler per-sheet architecture:
 * - Receives PDF binary directly (no base64 tile encoding)
 * - One job per sheet (no chunking needed)
 * - Uses headers for metadata (X-Valid-Sheets, X-Sheet-Number)
 */
export class CalloutProcessor extends Container {
	override defaultPort = 8000 // Port the container listens on
	override sleepAfter = "10m" // Stop instance after 10 minutes of inactivity

	override envVars = {
		OPENROUTER_API_KEY: "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",
	}

	override onStart() {
		console.log("CalloutProcessor container successfully started")
	}

	override onError(error: string) {
		console.log("CalloutProcessor container error:", error)
	}
}
