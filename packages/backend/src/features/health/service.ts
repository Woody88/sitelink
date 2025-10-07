import { performance } from "node:perf_hooks"
import { Effect, Option, Schema } from "effect"
import { sql } from 'drizzle-orm' 
import { Drizzle } from "../../core/database"

export class HealthStatus extends Schema.Class<HealthStatus>("HealthStatus")({
	status: Schema.Union(
		Schema.Literal("healthy"),
		Schema.Literal("degraded"),
		Schema.Literal("unhealthy"),
	),
	responseTime: Schema.optional(Schema.Number),
	error: Schema.optional(Schema.String),
}) {}

export class SystemHealth extends Schema.Class<SystemHealth>("SystemHealth")({
	database: HealthStatus,
	timestamp: Schema.Number,
}) {}

export class HealthService extends Effect.Service<HealthService>()(
	"HealthService",
	{
		effect: Effect.gen(function* () {
			const db = yield* Drizzle

			const checkDatabase = Effect.gen(function* () {
				const perfStart = yield* Effect.sync(() => performance.now())
				const result = yield* db.run(sql`select 1`)
				const perfEnd = yield* Effect.sync(() => performance.now())
				
				yield* Effect.fromNullable(result.rows?.length === 0 ? null : result.rows)

				return yield* Effect.succeed(new HealthStatus({
					status: "healthy",
				}))

			}).pipe(
				Effect.catchAll((err) =>
					Effect.succeed(
						new HealthStatus({
							status: "unhealthy",
							error: err.message,
						}),
					),
				),
			)

			const getSystemHealth = Effect.gen(function* () {
				const databaseHealth = yield* checkDatabase
				const timestamp = Date.now()

				return new SystemHealth({
					database: databaseHealth,
					timestamp,
				})
			})

			return {
				checkDatabase,
				getSystemHealth,
			} as const
		}),
	},
) {}
