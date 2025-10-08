import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { BaseApi } from "./core/api"
import { AuthorizationMiddlewareLive } from "./core/middleware"
import { AuthAPIModule } from "./features/auth"
import { AuthAPI } from "./features/auth/http"
import { HealthModule } from "./features/health"
import { HealthAPI } from "./features/health/http"
import { RegistrationModule } from "./features/registration"
import { RegistrationAPI } from "./features/registration/http"

export const Api = HttpApiBuilder.api(
	BaseApi.add(HealthAPI).add(AuthAPI).add(RegistrationAPI),
).pipe(
	Layer.provide(AuthAPIModule),
	Layer.provide(HealthModule),
	Layer.provide(RegistrationModule),
	Layer.provide(AuthorizationMiddlewareLive),
)
