import { Layer } from "effect"
import { ProjectService } from "../projects/service"
import { MediaAPILive } from "./http"
import { MediaService } from "./service"

// Export service for other modules to use
export { MediaService } from "./service"

// Export API for main API composition
export { MediaAPI } from "./http"

// Export module layer (HTTP + Service + Dependencies composed)
export const MediaModule = MediaAPILive.pipe(
	Layer.provide(MediaService.Default),
	Layer.provide(ProjectService.Default),
)
