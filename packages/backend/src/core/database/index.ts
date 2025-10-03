import { drizzle } from "drizzle-orm/d1"
import { Context, Effect, Schema } from "effect"
import * as schema from "./schemas"

export class CloudflareEnv extends Context.Tag("CloudflareEnv")<
	CloudflareEnv,
	Env
>() {}

export class DrizzleD1Error extends Schema.TaggedError<DrizzleD1Error>(
	"DrizzleD1Error",
)("DrizzleD1Error", {
	cause: Schema.Defect,
}) {}

export class DrizzleD1Client extends Effect.Service<DrizzleD1Client>()(
	"DrizzleD1Service",
	{
		effect: Effect.gen(function* () {
			const env = yield* CloudflareEnv

			const database = drizzle(env.SitelinkDB, { schema, casing: "snake_case" })

			const use = Effect.fn("DrizzleD1Client.use")(
				<A>(
					f: (db: typeof database, signal: AbortSignal) => Promise<A>,
				): Effect.Effect<A, DrizzleD1Error> =>
					Effect.tryPromise({
						try: (signal) => f(database, signal),
						catch: (cause) => new DrizzleD1Error({ cause }),
					}),
			)

			return { use } as const
		}),
	},
) {}
