// import { Container, getRandom } from "@cloudflare/containers"

import { HttpApiBuilder, HttpServer } from "@effect/platform"
import { Layer } from "effect"
import { Api } from "./api"
import { CloudflareEnv } from "./core/database"

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
		// const url = new URL(request.url)
		const cloudflareEnv = Layer.succeed(CloudflareEnv, env)
		const SiteLinkApiLive = Api.pipe(Layer.provide(cloudflareEnv))

		const { handler } = HttpApiBuilder.toWebHandler(
			Layer.mergeAll(SiteLinkApiLive, HttpServer.layerContext),
		)

		return handler(request)
	},
} satisfies ExportedHandler<Env>
