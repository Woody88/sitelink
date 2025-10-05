import { Layer } from "effect"
import { CoreLayer } from "../../core"
import { HealthApiLive } from "./http"
import { HealthService } from "./service"

export const HealthModule = HealthApiLive.pipe(
	Layer.provideMerge(HealthService.Default),
)
