import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { BaseApi } from "./core/api"
import { HealthModule } from "./features/health"
import { HealthAPI } from "./features/health/http"

export const Api = HttpApiBuilder.api(BaseApi.add(HealthAPI)).pipe(
	Layer.provide(HealthModule),
)
