import { Layer } from "effect"
import { SessionAPILive } from "./http"
import { SessionService } from "./service"

// Export API for main API composition
export { SessionAPI } from "./http"
// Export service for other modules to use
export { SessionService } from "./service"

// Export module layer (HTTP + Service composed)
// Use provideMerge to expose SessionService to other modules
export const SessionAPIModule = Layer.provideMerge(
	SessionAPILive,
	SessionService.Default,
)
