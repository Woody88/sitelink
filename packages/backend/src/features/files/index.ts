import { Layer } from "effect"
import { PlanService } from "../plans/service"
import { ProjectService } from "../projects/service"
import { FileAPILive } from "./http"
import { FileService } from "./service"

// Export service for other modules to use
export { FileService } from "./service"

// Export API for main API composition
export { FileAPI } from "./http"

// Export module layer (HTTP + Service + Dependencies composed)
export const FileModule = FileAPILive.pipe(
	Layer.provide(FileService.Default),
	Layer.provide(PlanService.Default),
	Layer.provide(ProjectService.Default),
)
