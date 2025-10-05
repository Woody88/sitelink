import { performance } from "node:perf_hooks"
import { Effect, Schema } from "effect"
import { DatabaseError, DatabaseService } from "../../core/database"

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
			const db = yield* DatabaseService

			const checkDatabase = Effect.gen(function* () {
				const perfStart = yield* Effect.sync(() => performance.now())
				const result = yield* db.use((d1) =>
					d1.$client.prepare("SELECT 1").all(),
				)
				const perfEnd = yield* Effect.sync(() => performance.now())

				if (!result.success) {
					return yield* new DatabaseError({ cause: result.error })
				}

				return yield* Effect.succeed(
					new HealthStatus({
						status: "healthy",
						responseTime: perfEnd - perfStart,
					}),
				)
			}).pipe(
				Effect.catchTag("DatabaseError", (err) =>
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
