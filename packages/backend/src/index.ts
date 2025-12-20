import { Container } from "@cloudflare/containers"
import { HttpApiBuilder, HttpServer } from "@effect/platform"
import { D1Client } from "@effect/sql-d1"
import { ConfigProvider, Layer } from "effect"
import { Resend } from "resend"
import { Api } from "./api"
import { CoreLayer } from "./core"
import * as Bindings from "./core/bindings"
import { ensureSystemPdfProcessorUser } from "./core/startup"
import { handleTestSetup, handleTestQueue, handleTestQueueTrigger, handleTestPdfProcessingTrigger } from "./features/test"
import type { R2Notification, TileJob, MetadataExtractionJob, MarkerDetectionJob, SheetMarkerDetectionJob } from "./core/queues/types"
import { pdfProcessingQueueConsumer, tileGenerationQueueConsumer, metadataExtractionQueueConsumer, markerDetectionQueueConsumer, sheetMarkerDetectionQueueConsumer } from "./core/queues"

export { SitelinkPdfProcessor } from "./core/pdf-manager"
export { PlanCoordinator } from "./core/durable-objects/plan-coordinator"
export { PlanOcrService } from "./core/plan-ocr-service"
export { CalloutProcessor } from "./core/callout-processor"
export { tileGenerationQueueConsumer, pdfProcessingQueueConsumer, metadataExtractionQueueConsumer, markerDetectionQueueConsumer, sheetMarkerDetectionQueueConsumer } from "./core/queues"

// Track if startup tasks have run
let startupTasksCompleted = false

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		// Handle test endpoints early (bypasses Effect-TS)
		const url = new URL(request.url)
		if (url.pathname === "/api/test/setup" && request.method === "GET") {
			return handleTestSetup(request, env as Parameters<typeof handleTestSetup>[1])
		}
		if (url.pathname === "/api/test/queue" && request.method === "POST") {
			return handleTestQueue(request, env as Parameters<typeof handleTestQueue>[1])
		}
		if (url.pathname === "/api/test/queue/trigger" && request.method === "POST") {
			return handleTestQueueTrigger(request, env as Parameters<typeof handleTestQueueTrigger>[1])
		}
		if (url.pathname === "/api/test/pdf-processing-trigger" && request.method === "POST") {
			return handleTestPdfProcessingTrigger(request, env as Parameters<typeof handleTestPdfProcessingTrigger>[1])
		}

		const resend = new Resend(env.RESEND_API_KEY)

		// Run startup tasks once on first request
		if (!startupTasksCompleted) {
			await ensureSystemPdfProcessorUser(env.SitelinkDB)
			startupTasksCompleted = true
		}

		// Inject cf environment variables in config
		const ConfigLayer = Layer.setConfigProvider(
			ConfigProvider.fromMap(
				new Map(Object.entries(env).filter(([_, v]) => typeof v === "string")),
			),
		)

		

		// Create Cloudflare Binding Layers
		const D1Layer = D1Client.layer({ db: env.SitelinkDB }) // Effect SQL client
		const ResendLayer = Layer.succeed(Bindings.ResendBinding, resend)
		const R2Layer = Layer.succeed	(Bindings.R2Binding, env.SitelinkStorage)
		const QueueLayer = Layer.succeed(Bindings.TileGenerationQueue, env.TILE_GENERATION_QUEUE)
		const PdfProcessingQueueLayer = Layer.succeed(Bindings.PdfProcessingQueue, env.PDF_PROCESSING_QUEUE)
		const PdfProcessorManagerLayer = Layer.succeed(
			Bindings.PdfProcessorManager,
			env.SITELINK_PDF_PROCESSOR,
		)

		const AppLayer = Api.pipe(
			Layer.provide(CoreLayer),
			Layer.provide(D1Layer),
			Layer.provide(ResendLayer),
			Layer.provide(R2Layer),
			Layer.provide(PdfProcessorManagerLayer),
			Layer.provide(QueueLayer),
			Layer.provide(PdfProcessingQueueLayer),
		).pipe(Layer.provide(ConfigLayer))

		const { handler } = HttpApiBuilder.toWebHandler(
			Layer.mergeAll(AppLayer, HttpServer.layerContext),
		)
		return await handler(request)
	},
	async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
		switch (batch.queue) {
			case "tile-generation-queue":
				await tileGenerationQueueConsumer(
					batch as MessageBatch<TileJob>,
					env,
					ctx,
				)
				break
			case "pdf-processing-queue":
				await pdfProcessingQueueConsumer(batch as MessageBatch<R2Notification>, env, ctx)
				break
			case "metadata-extraction-queue":
				await metadataExtractionQueueConsumer(batch as MessageBatch<MetadataExtractionJob>, env, ctx)
				break
			case "marker-detection-queue":
				await markerDetectionQueueConsumer(batch as MessageBatch<MarkerDetectionJob>, env, ctx)
				break
			case "sheet-marker-detection-queue":
				await sheetMarkerDetectionQueueConsumer(batch as MessageBatch<SheetMarkerDetectionJob>, env, ctx)
				break
			default:
				throw new Error(`Unknown queue: ${batch.queue}`)
		}
	},
} satisfies ExportedHandler<Env>

// async function handleContainer(request: Request, env: Env) {
// 	const stub = env.SITELINK_PDF_PROCESSOR.getByName(
// 		new URL(request.url).pathname,
// 	)

// 	if (request.method === "POST") {
// 		try {
// 			console.log("incoming request")
// 			const res = await stub.compressString("text")
// 			return res
// 		} catch (err) {
// 			return new Response(err.message, { status: 500 })
// 		}
// 	}

// 	await stub.init()
// 	return new Response("hit with POST to compress anything")
// }
