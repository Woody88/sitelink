import { Layer } from "effect"
import { AuthService } from "./auth"
import { Drizzle } from "./database"
import { EmailService } from "./email"

export const CoreLayer = Layer.mergeAll(
	AuthService.Default,
	Drizzle.Default,
	EmailService.Default,
)
