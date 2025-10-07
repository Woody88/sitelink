import { Layer } from "effect"
import { AuthService } from "./auth"
import { Drizzle } from "./database"
import { EmailService } from "./email"

export const CoreLayer = AuthService.Default.pipe(
	Layer.merge(Drizzle.Default),
	Layer.provide(EmailService.Default),
)
