import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { Effect, Schema } from "effect"
import { DatabaseService } from "../database"

export class AuthError extends Schema.TaggedError<AuthError>("AuthError")(
	"AuthError",
	{
		cause: Schema.Defect,
	},
) {}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	dependencies: [DatabaseService.Default],
	effect: Effect.gen(function* () {
		const database = yield* DatabaseService

		const _auth = yield* database.use((db) =>
			Promise.resolve(
				betterAuth({
					database: drizzleAdapter(db.$client, {
						provider: "sqlite",
					}),
				}),
			),
		)

		const use = Effect.fn("AuthService.use")(function* <A>(
			f: (auth: typeof _auth, signal: AbortSignal) => Promise<A>,
		) {
			return yield* Effect.tryPromise({
				try: (signal) => f(_auth, signal),
				catch: (cause) => new AuthError({ cause }),
			})
		})

		return {
			use,
		} as const
	}),
}) {}
