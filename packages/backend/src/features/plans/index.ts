import { Layer } from "effect"
import { PlanAPILive } from "./http"
import { PlanService } from "./service"

// Export API for main API composition
export { PlanAPI } from "./http"
// Export service for other modules to use
export { PlanService } from "./service"

// Export module layer (HTTP + Service composed)
// Dependencies (StorageService, ProjectService) are satisfied at app level
export const PlanModule = PlanAPILive.pipe(
	Layer.provide(PlanService.Default),
)
