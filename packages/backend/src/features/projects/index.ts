import { Layer } from "effect"
import { ProjectAPILive } from "./http"
import { ProjectService } from "./service"

// Export API for main API composition
export { ProjectAPI } from "./http"
// Export service for other modules to use
export { ProjectService } from "./service"

// Export module layer (HTTP + Service composed)
// Use provideMerge to expose ProjectService to other modules
export const ProjectModule = Layer.provideMerge(
	ProjectAPILive,
	ProjectService.Default,
)
