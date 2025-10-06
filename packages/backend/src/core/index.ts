import { Layer } from "effect"
import { AuthService } from "./auth"
import { DatabaseService } from "./database"
import { EmailService } from "./email"

export const CoreLayer = AuthService.Default.pipe(
	Layer.merge(DatabaseService.Default),
	Layer.provide(EmailService.Default),
)
