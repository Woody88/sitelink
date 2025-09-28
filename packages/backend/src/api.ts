import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { Api } from "./core/api"
import { HealthModule } from "./features/health"
import { HealthAPI } from "./features/health/http"

export const SiteLinkApi = HttpApiBuilder.api(Api.add(HealthAPI)).pipe(
	Layer.provide(HealthModule),
)
