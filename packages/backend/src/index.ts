import { Container } from "@cloudflare/containers"
import { HttpApiBuilder, HttpServer } from "@effect/platform"
import { D1Client } from "@effect/sql-d1"
import { ConfigProvider, Layer } from "effect"
import { Resend } from "resend"
import { Api } from "./api"
import { CoreLayer } from "./core"
import { R2Binding, ResendBinding } from "./core/bindings"
import { SitelinkPdfProcessor } from "./features/processing/pdf-processing-job.do"

export { SitelinkPdfProcessor } from "./features/processing/pdf-processing-job.do"

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const resend = new Resend(env.RESEND_API_KEY)
		// Inject cf environment variables in config
		const ConfigLayer = Layer.setConfigProvider(
			ConfigProvider.fromMap(
				new Map(Object.entries(env).filter(([_, v]) => typeof v === "string")),
			),
		)
		// Create Cloudflare Binding Layers
		const D1Layer = D1Client.layer({ db: env.SitelinkDB }) // Effect SQL client
		const ResendLayer = Layer.succeed(ResendBinding, resend)
		const R2Layer = Layer.succeed(R2Binding, env.SitelinkStorage)

		const AppLayer = Api.pipe(
			Layer.provide(CoreLayer),
			Layer.provide(D1Layer),
			Layer.provide(ResendLayer),
			Layer.provide(R2Layer),
		).pipe(Layer.provide(ConfigLayer))

		const { handler } = HttpApiBuilder.toWebHandler(
			Layer.mergeAll(AppLayer, HttpServer.layerContext),
		)
		return await handler(request)
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
