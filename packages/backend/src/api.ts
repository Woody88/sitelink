import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { BaseApi } from "./core/api"
import { AuthorizationMiddlewareLive } from "./core/middleware"
import { AuthAPIModule } from "./features/auth"
import { AuthAPI } from "./features/auth/http"
import { FileModule, FileAPI } from "./features/files"
import { HealthModule } from "./features/health"
import { HealthAPI } from "./features/health/http"
import { MediaModule, MediaAPI } from "./features/media"
import { OrganizationModule } from "./features/organization"
import { OrganizationAPI } from "./features/organization/http"
import { PlanModule, PlanAPI } from "./features/plans"
import { ProjectModule, ProjectAPI } from "./features/projects"
import { RegistrationModule } from "./features/registration"
import { RegistrationAPI } from "./features/registration/http"

export const Api = HttpApiBuilder.api(
	BaseApi.add(HealthAPI)
		.add(AuthAPI)
		.add(RegistrationAPI)
		.add(OrganizationAPI)
		.add(ProjectAPI)
		.add(PlanAPI)
		.add(FileAPI)
		.add(MediaAPI),
).pipe(
	Layer.provide(AuthAPIModule),
	Layer.provide(HealthModule),
	Layer.provide(RegistrationModule),
	Layer.provide(OrganizationModule),
	Layer.provide(ProjectModule),
	Layer.provide(PlanModule),
	Layer.provide(FileModule),
	Layer.provide(MediaModule),
	Layer.provide(AuthorizationMiddlewareLive),
)
