// import { Container, getRandom } from "@cloudflare/containers"

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
		const url = new URL(request.url)

		if (url.pathname === "/api/health/db") {
			const response = await env.SitelinkDB.prepare("SELECT 1 as test")
				.first()
				.then(
					(res) =>
						new Response(
							JSON.stringify({
								database: "connected",
								query: res,
							}),
							{ status: 200, headers: { "Content-Type": "application/json" } },
						),
				)
				.catch(
					(err) =>
						new Response(
							JSON.stringify({
								database: "error",
								error: err instanceof Error ? err.message : String(err),
							}),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
				)

			return response
		}

		return new Response("Hello World!", { status: 200 })
	},
} satisfies ExportedHandler<Env>
