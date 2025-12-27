import { Layer } from "effect"
import { MarkersAPILive } from "./http"
import { MarkersService } from "./service"

// Export API for main API composition
export { MarkersAPI } from "./http"
// Export service for other modules to use
export { MarkersService } from "./service"

// Export module layer (HTTP + Service composed)
// Dependencies (Drizzle) are satisfied at app level
export const MarkersModule = MarkersAPILive.pipe(
	Layer.provide(MarkersService.Default),
)
