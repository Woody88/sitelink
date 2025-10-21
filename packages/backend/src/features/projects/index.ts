import { Layer } from "effect"
import { ProjectAPILive } from "./http"
import { ProjectService } from "./service"

// Export service for other modules to use
export { ProjectService } from "./service"

// Export API for main API composition
export { ProjectAPI } from "./http"

// Export module layer (HTTP + Service composed)
export const ProjectModule = ProjectAPILive.pipe(
	Layer.provide(ProjectService.Default),
)
