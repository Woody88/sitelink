import { Layer } from "effect"
import { AuthService } from "./auth"
import { Drizzle } from "./database"
import { EmailService } from "./email"
import { OrganizationService } from "./organization/service"
import { StorageService } from "./storage"
import { QueueService } from "./queues/service"

export const CoreLayer = EmailService.Default.pipe(
	Layer.merge(Drizzle.Default),
	Layer.merge(AuthService.Default),
	Layer.provideMerge(OrganizationService.Default),
	Layer.merge(StorageService.Default),
	Layer.merge(QueueService.Default),
)
