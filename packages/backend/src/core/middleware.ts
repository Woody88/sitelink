import {
	HttpApiError,
	HttpApiMiddleware,
	HttpApiSecurity,
	HttpServerRequest,
} from "@effect/platform"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { AuthService } from "./auth"
import type { BetterAuthSession } from "./auth/config"

// This will error if any field in BetterAuthSession is missing from our schema
type ValidateSessionFields = {
	[K in keyof Required<BetterAuthSession["session"]>]: unknown
}

type ValidateUserFields = {
	[K in keyof Required<BetterAuthSession["user"]>]: unknown
}

export class Session extends Schema.Class<Session>("Session")({
	session: Schema.Struct({
		id: Schema.String,
		createdAt: Schema.Date,
		updatedAt: Schema.Date,
		userId: Schema.String,
		expiresAt: Schema.Date,
		token: Schema.String,
		ipAddress: Schema.optional(
			Schema.Union(Schema.String, Schema.Null, Schema.Undefined),
		),
		userAgent: Schema.optional(
			Schema.Union(Schema.String, Schema.Null, Schema.Undefined),
		),
		activeOrganizationId: Schema.optional(
			Schema.Union(Schema.String, Schema.Null, Schema.Undefined),
		),
		activeProjectId: Schema.optional(
			Schema.Union(Schema.String, Schema.Null, Schema.Undefined),
		),
		activeProjectUpdatedAt: Schema.optional(
			Schema.Union(Schema.Date, Schema.Null, Schema.Undefined),
		),
	} satisfies ValidateSessionFields),
	user: Schema.Struct({
		id: Schema.String,
		createdAt: Schema.Date,
		updatedAt: Schema.Date,
		email: Schema.String,
		emailVerified: Schema.Boolean,
		name: Schema.String,
		image: Schema.optional(
			Schema.Union(Schema.String, Schema.Null, Schema.Undefined),
		),
	} satisfies ValidateUserFields),
}) {}

export class CurrentSession extends Context.Tag("CurrentSession")<
	CurrentSession,
	Session
>() {}

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
	"Authorization",
	{
		failure: HttpApiError.Unauthorized,
		provides: CurrentSession,
	},
) {}

export class AuthorizationApiKey extends HttpApiMiddleware.Tag<Authorization>()(
	"AuthorizationApiKey",
	{
		failure: HttpApiError.Unauthorized,
		security: {
			apiKey: HttpApiSecurity.apiKey({
				in: "header",
				key: "apiKey",
			}),
		},
	},
) {}

export const AuthorizationApiKeyMiddlewareLayer = Layer.effect(
	AuthorizationApiKey,
	Effect.gen(function* () {
		const authService = yield* AuthService

		return {
			apiKey: (key) =>
				Effect.gen(function* () {
					const keyValue = Redacted.value(key)

					if (!keyValue || keyValue === "") {
						return yield* Effect.fail(new HttpApiError.Unauthorized())
					}

					return yield* authService.use((auth) =>
						auth.api.verifyApiKey({
							body: {
								key: keyValue,
							},
						}),
					)
				}).pipe(Effect.mapError(() => new HttpApiError.Unauthorized())),
		}
	}),
)

export const AuthorizationMiddlewareLive = Layer.effect(
	Authorization,
	Effect.gen(function* () {
		const authService = yield* AuthService

		return Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest

			// Debug: log request headers
			console.log("🔍 Authorization middleware - cookie header:", req.headers.cookie)

			const rawSession = yield* authService
				.use((auth) => auth.api.getSession({ headers: req.headers }))
				.pipe(
					Effect.mapError((error) => {
						console.log("❌ getSession error:", error)
						return new HttpApiError.Unauthorized()
					}),
					Effect.filterOrFail(
						(session): session is BetterAuthSession =>
							session !== null && session.session !== null,
						() => {
							console.log("❌ Session is null or session.session is null")
							return new HttpApiError.Unauthorized()
						},
					),
					Effect.tap((session) =>
						Effect.sync(() => {
							console.log("✅ Session found:", session)
						}),
					),
				)

			// Better Auth returns the session already properly typed
			// Just wrap it in our Session class without schema validation
			return new Session(rawSession as Session)
		})
	}),
)
