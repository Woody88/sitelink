/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Container, getRandom } from "@cloudflare/containers"

export class SitelinkBackendContainer extends Container {
	override defaultPort = 3000
	override sleepAfter = "5m"

	override onStart() {
		console.log("Container successfully started")
	}
	override onStop() {
		console.log("Container successfully shut down")
	}
	override onError(error: unknown) {
		console.log("Container error:", error)
	}
}

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const container = await getRandom(env.SITELINK_BACKEND_CONTAINER, 2)
		return await container.fetch(request)
	},
} satisfies ExportedHandler<Env>
