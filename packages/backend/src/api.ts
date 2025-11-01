import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { BaseApi } from "./core/api"
import { AuthorizationMiddlewareLive } from "./core/middleware"
import { AuthAPIModule } from "./features/auth"
import { AuthAPI } from "./features/auth/http"
import { FileAPI, FileModule } from "./features/files"
import { HealthModule } from "./features/health"
import { HealthAPI } from "./features/health/http"
import { MediaAPI, MediaModule } from "./features/media"
import { OrganizationModule } from "./features/organization"
import { OrganizationAPI } from "./features/organization/http"
import { PlanAPI, PlanModule } from "./features/plans"
import { ProjectAPI, ProjectModule } from "./features/projects"
import { RegistrationModule } from "./features/registration"
import { RegistrationAPI } from "./features/registration/http"

export const Api = HttpApiBuilder.api(
	BaseApi.add(HealthAPI)
		.add(AuthAPI)
		.add(RegistrationAPI)
		.add(OrganizationAPI)
		.add(ProjectAPI)
		.add(PlanAPI),
	// .add(FileAPI)
	// .add(MediaAPI),
).pipe(
	Layer.provideMerge(AuthAPIModule),
	Layer.provideMerge(HealthModule),
	Layer.provideMerge(RegistrationModule),
	Layer.provideMerge(OrganizationModule),
	Layer.provideMerge(ProjectModule),
	Layer.provideMerge(PlanModule),
	// Layer.provideMerge(FileModule),
	// Layer.provideMerge(MediaModule),
	Layer.provide(AuthorizationMiddlewareLive),
)
