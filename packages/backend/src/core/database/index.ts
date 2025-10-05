import { drizzle } from "drizzle-orm/d1"
import { Effect, Schema } from "effect"
import { D1Binding } from "../bindings"
import * as schema from "./schemas"

export class DatabaseError extends Schema.TaggedError<DatabaseError>(
	"DatabaseError",
)("DatabaseError", {
	cause: Schema.Defect,
}) {}

export class DatabaseService extends Effect.Service<DatabaseService>()(
	"DatabaseService",
	{
		effect: Effect.gen(function* () {
			const d1 = yield* D1Binding

			const database = drizzle(d1, { schema, casing: "snake_case" })

			const use = Effect.fn("AuthService.use")(function* <A>(
				f: (db: typeof database, signal: AbortSignal) => Promise<A>,
			) {
				return yield* Effect.tryPromise({
					try: (signal) => f(database, signal),
					catch: (cause) => new DatabaseError({ cause }),
				})
			})

			return { use } as const
		}),
	},
) {}
