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

						return HttpServerResponse.uint8Array(body, {
							status: response.status,
							statusText: response.statusText,
							headers: response.headers,
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

						return HttpServerResponse.uint8Array(body, {
							status: response.status,
							statusText: response.statusText,
							headers: response.headers,
						})
					}),
				)
		}),
)
