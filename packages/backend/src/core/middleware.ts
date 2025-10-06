import {
	HttpApiMiddleware,
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform"
import { Effect, Layer } from "effect"
import { AuthService } from "./auth"

export class BetterAuth extends HttpApiMiddleware.Tag<BetterAuth>()(
	"BetterAuth",
) {}

export const BetterAuthMiddleware = Layer.effect(
	BetterAuth,
	Effect.gen(function* () {
		const auth = yield* AuthService
		const request = yield* HttpServerRequest.HttpServerRequest
		const webRequest = request.source as Request

		const url = new URL(request.url)

		if (url.pathname.startsWith("/api/auth/")) {
			const response = yield* auth.use((auth) => auth.handler(webRequest))

			// Convert Web Response body to Uint8Array
			const arrayBuffer = yield* Effect.tryPromise(() => response.arrayBuffer())
			const body = new Uint8Array(arrayBuffer)

			// Create HttpServerResponse with the response data
			return HttpServerResponse.uint8Array(body, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			})
		}

		return Effect.void
	}),
)
