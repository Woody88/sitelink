import { Layer } from "effect"
import { ProjectService } from "../projects/service"
import { PlanAPILive } from "./http"
import { PlanService } from "./service"

// Export service for other modules to use
export { PlanService } from "./service"

// Export API for main API composition
export { PlanAPI } from "./http"

// Export module layer (HTTP + Service + Dependencies composed)
export const PlanModule = PlanAPILive.pipe(
	Layer.provide(PlanService.Default),
	Layer.provide(ProjectService.Default),
)
