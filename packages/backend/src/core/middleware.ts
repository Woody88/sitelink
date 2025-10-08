import {
	HttpApiError,
	HttpApiMiddleware,
	HttpServerRequest,
} from "@effect/platform"
import { Context, Effect, Layer, Schema } from "effect"
import { AuthError, AuthService } from "./auth"
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
		failure: Schema.Union(
			HttpApiError.Unauthorized,
			HttpApiError.HttpApiDecodeError,
		),
		provides: CurrentSession,
	},
) {}

export const AuthorizationMiddlewareLive = Layer.effect(
	Authorization,
	Effect.gen(function* () {
		const authService = yield* AuthService

		return Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest

			const session = yield* authService
				.use((auth) => auth.api.getSession({ headers: req.headers }))
				.pipe(
					Effect.andThen((rawSession) =>
						Schema.decodeUnknown(Session)(rawSession),
					),
					Effect.mapError((e) =>
						e instanceof AuthError
							? new HttpApiError.Unauthorized()
							: new HttpApiError.HttpApiDecodeError({
									issues: [],
									message: e.message,
								}),
					),
				)

			return session
		})
	}),
)
