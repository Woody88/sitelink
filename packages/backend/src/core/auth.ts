import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { Effect, Schema } from "effect"
import { DrizzleD1Client } from "./database"

export class BetterAuthError extends Schema.TaggedError<BetterAuthError>(
	"BetterAuthError",
)("BetterAuthError", {
	cause: Schema.Defect,
}) {}

export class BetterAuthService extends Effect.Service<BetterAuthService>()(
	"BetterAuthService",
	{
		dependencies: [DrizzleD1Client.Default],
		effect: Effect.gen(function* () {
			const database = yield* DrizzleD1Client

			const _auth = yield* database.use((db) =>
				Promise.resolve(
					betterAuth({
						database: drizzleAdapter(db.$client, {
							provider: "sqlite",
						}),
					}),
				),
			)

			const use = Effect.fn("BetterAuthService.use")(
				<A>(f: (auth: typeof _auth, signal: AbortSignal) => Promise<A>) =>
					Effect.tryPromise({
						try: (signal) => f(_auth, signal),
						catch: (cause) => new BetterAuthError({ cause }),
					}),
			)

			return {
				use,
			} as const
		}),
	},
) {}
