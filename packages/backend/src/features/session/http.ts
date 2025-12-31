import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiSchema,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { BaseApi } from "../../core/api"
import { Authorization, CurrentSession } from "../../core/middleware"
import {
	ProjectNotInOrganizationError,
	SessionNotFoundError,
	SessionService,
} from "./service"
import { ProjectNotFoundError } from "../projects/service"

/**
 * Request/Response Schemas
 */
const SetActiveProjectRequest = Schema.Struct({
	projectId: Schema.String,
})

const ActiveProjectResponse = Schema.Struct({
	activeProjectId: Schema.NullOr(Schema.String),
	activeOrganizationId: Schema.NullOr(Schema.String),
})

/**
 * Session API Endpoints
 */
export const SessionAPI = HttpApiGroup.make("session")
	.add(
		HttpApiEndpoint.post("setActiveProject")`/active-project`
			.setPayload(SetActiveProjectRequest)
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(ProjectNotFoundError)
			.addError(ProjectNotInOrganizationError)
			.addError(SessionNotFoundError),
	)
	.add(
		HttpApiEndpoint.get("getActiveProject")`/active-project`.addSuccess(
			ActiveProjectResponse,
		),
	)
	.prefix("/api/session")
	.middleware(Authorization)

/**
 * HTTP Handler Layer
 */
export const SessionAPILive = HttpApiBuilder.group(
	BaseApi.add(SessionAPI),
	"session",
	(handlers) =>
		Effect.gen(function* () {
			const sessionService = yield* SessionService

			return handlers
				.handle("setActiveProject", ({ payload }) =>
					Effect.gen(function* () {
						const currentSession = yield* CurrentSession
						const organizationId =
							currentSession.session.activeOrganizationId ?? null

						if (!organizationId) {
							// This should never happen due to Authorization middleware
							return yield* Effect.fail(
								new SessionNotFoundError({
									sessionId: currentSession.session.id,
								}),
							)
						}

						return yield* sessionService
							.setActiveProject({
								sessionToken: currentSession.session.token,
								projectId: payload.projectId,
								organizationId,
							})
							.pipe(Effect.orDie)
					}),
				)
				.handle("getActiveProject", () =>
					Effect.gen(function* () {
						const currentSession = yield* CurrentSession
						return yield* sessionService
							.getActiveProject(currentSession.session.token)
							.pipe(Effect.orDie)
					}),
				)
		}),
)
