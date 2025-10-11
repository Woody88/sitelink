// import { Container, getRandom } from "@cloudflare/containers"

import { HttpApiBuilder, HttpServer } from "@effect/platform"
import { D1Client } from "@effect/sql-d1"
import { ConfigProvider, Layer } from "effect"
import { Resend } from "resend"
import { Api } from "./api"
import { CoreLayer } from "./core"
import { ResendBinding } from "./core/bindings"

// export class SitelinkBackendContainer extends Container {
// 	override defaultPort = 3000
// 	override sleepAfter = "5m"

// 	override onStart() {
// 		console.log("Container successfully started")
// 	}
// 	override onStop() {
// 		console.log("Container successfully shut down")
// 	}
// 	override onError(error: unknown) {
// 		console.log("Container error:", error)
// 	}
// }

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const resend = new Resend(env.RESEND_API_KEY)

		const ConfigLayer = Layer.setConfigProvider(
			ConfigProvider.fromMap(
				new Map(Object.entries(env).filter(([_, v]) => typeof v === "string")),
			),
		)

		// Create Cloudflare Binding Layers
		const D1Layer = D1Client.layer({ db: env.SitelinkDB })
		const ResendLayer = Layer.succeed(ResendBinding, resend)

		// Assemble App Layer by providing binding layers
		const AppLayer = CoreLayer.pipe(
			Layer.provide(ConfigLayer),
			Layer.provide(D1Layer),
			Layer.provide(ResendLayer),
		)

		const SiteLinkApiLive = Api.pipe(Layer.provide(AppLayer))

		const { handler } = HttpApiBuilder.toWebHandler(
			Layer.mergeAll(SiteLinkApiLive, HttpServer.layerContext),
		)

		return await handler(request)
	},
} satisfies ExportedHandler<Env>
