import { HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect } from "effect"
import { BaseApi } from "../../core/api"
import { AuthError } from "../../core/auth"
import { Authorization, CurrentSession } from "../../core/middleware"
import {
	RegistrationError,
	RegistrationOutput,
	RegistrationQuery,
	RegistrationService,
} from "./service"

export const RegistrationAPI = HttpApiGroup.make("Registration")
	.add(
		HttpApiEndpoint.post("registration")`/registration`
			.setUrlParams(RegistrationQuery)
			.addSuccess(RegistrationOutput, { status: 201 })
			.addError(AuthError, { status: 500 })
			.addError(RegistrationError, { status: 500 }),
	)
	.middleware(Authorization)

export const RegistrationAPILive = HttpApiBuilder.group(
	BaseApi.add(RegistrationAPI),
	"Registration",
	(handlers) =>
		Effect.gen(function* () {
			const registration = yield* RegistrationService

			return handlers.handle("registration", ({ urlParams: payload }) =>
				Effect.gen(function* () {
					const session = yield* CurrentSession
					return yield* registration.execute(session.user.id, payload)
				}),
			)
		}),
)
