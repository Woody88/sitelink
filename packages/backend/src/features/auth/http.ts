import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpServerResponse,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { BaseApi } from "../../core/api"
import { AuthError, AuthService } from "../../core/auth"

export const AuthAPI = HttpApiGroup.make("Auth")
	.add(
		HttpApiEndpoint.get("getAuth")`/auth/*`
			.addSuccess(Schema.Unknown)
			.addError(AuthError),
	)
	.add(
		HttpApiEndpoint.post("postAuth")`/auth/*`
			.addSuccess(Schema.Unknown)
			.addError(AuthError),
	)
	.add(
		HttpApiEndpoint.options("optionsAuth")`/auth/*`
			.addSuccess(Schema.Unknown)
			.addError(AuthError),
	)
	.prefix("/api")

export const AuthAPILive = HttpApiBuilder.group(
	BaseApi.add(AuthAPI),
	"Auth",
	(handlers) =>
		Effect.gen(function* () {
			const auth = yield* AuthService

			return handlers
				.handle("getAuth", ({ request: _request }) =>
					Effect.gen(function* () {
						const req = _request.source as Request
						const response = yield* auth.use((auth) => auth.handler(req))

						const arrayBuffer = yield* Effect.promise(() =>
							response.arrayBuffer(),
						)
						const body = new Uint8Array(arrayBuffer)

						// Add CORS headers to the response
						const headers = new Headers(response.headers)
						headers.set("Access-Control-Allow-Origin", "http://localhost:3000")
						headers.set("Access-Control-Allow-Credentials", "true")
						headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
						headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

						return HttpServerResponse.uint8Array(body, {
							status: response.status,
							statusText: response.statusText,
							headers: headers,
						})
					}),
				)
				.handle("postAuth", ({ request: _request }) =>
					Effect.gen(function* () {
						const req = _request.source as Request
						const response = yield* auth.use((auth) => auth.handler(req))

						const arrayBuffer = yield* Effect.promise(() =>
							response.arrayBuffer(),
						)

						const body = new Uint8Array(arrayBuffer)

						// Add CORS headers to the response
						const headers = new Headers(response.headers)
						headers.set("Access-Control-Allow-Origin", "http://localhost:3000")
						headers.set("Access-Control-Allow-Credentials", "true")
						headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
						headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

						return HttpServerResponse.uint8Array(body, {
							status: response.status,
							statusText: response.statusText,
							headers: headers,
						})
					}),
				)
				.handle("optionsAuth", () =>
					Effect.gen(function* () {
						// Handle CORS preflight requests
						const headers = new Headers()
						headers.set("Access-Control-Allow-Origin", "http://localhost:3000")
						headers.set("Access-Control-Allow-Credentials", "true")
						headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
						headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
						headers.set("Access-Control-Max-Age", "86400")

						return HttpServerResponse.empty({
							status: 204,
							headers: headers,
						})
					}),
				)
		}),
)
