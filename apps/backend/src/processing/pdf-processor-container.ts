import { Container } from "@cloudflare/containers";

export class PdfProcessor extends Container {
	override defaultPort = 3001;
	override sleepAfter = "5m";

	override onStart() {
		console.log("[PdfProcessor] Container started");
	}

	override onStop() {
		console.log("[PdfProcessor] Container stopped");
	}

	override onError(error: unknown) {
		console.error("[PdfProcessor] Container error:", error);
	}
}
