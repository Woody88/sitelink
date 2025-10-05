import { Layer } from "effect"
import { AuthService } from "./auth"
import { DatabaseService } from "./database"
import { EmailService } from "./email"

export const CoreLayer = EmailService.Default.pipe(
	Layer.provide(AuthService.Default),
	Layer.merge(DatabaseService.Default),
)
