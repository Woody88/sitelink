import { HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect } from "effect"
import { BaseApi } from "../../core/api"
import { HealthService, SystemHealth } from "./service"

export const HealthAPI = HttpApiGroup.make("Health")
	.add(HttpApiEndpoint.get("health")`/`.addSuccess(SystemHealth))
	.prefix("/health")

export const HealthApiLive = HttpApiBuilder.group(
	BaseApi.add(HealthAPI),
	"Health",
	(handlers) =>
		Effect.gen(function* () {
			const healthService = yield* HealthService
			const sytemHealth = yield* healthService.getSystemHealth

			return handlers.handle("health", () => Effect.succeed(sytemHealth))
		}),
)
