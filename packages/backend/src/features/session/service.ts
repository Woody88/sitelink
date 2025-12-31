import { HttpApiSchema } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { AuthService } from "../../core/auth"
import { Drizzle } from "../../core/database"
import { sessions } from "../../core/database/schemas/_auth"
import { projects } from "../../core/database/schemas"
import { ProjectNotFoundError } from "../projects/service"

/**
 * Session not found error
 */
export class SessionNotFoundError extends Schema.TaggedError<SessionNotFoundError>()(
	"SessionNotFoundError",
	{
		sessionId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Session not found",
	}),
) {}

/**
 * Project not in organization error
 */
export class ProjectNotInOrganizationError extends Schema.TaggedError<ProjectNotInOrganizationError>()(
	"ProjectNotInOrganizationError",
	{
		projectId: Schema.String,
		organizationId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 403,
		description: "Project does not belong to the current organization",
	}),
) {}

/**
 * Session Service - Manages user session state (activeProjectId)
 */
export class SessionService extends Effect.Service<SessionService>()(
	"SessionService",
	{
		dependencies: [Drizzle.Default, AuthService.Default],
		effect: Effect.gen(function* () {
			const db = yield* Drizzle
			const auth = yield* AuthService

			/**
			 * Update the active project for a session
			 *
			 * Verifies that the project belongs to the session's active organization
			 */
			const setActiveProject = Effect.fn("Session.setActiveProject")(
				function* (params: {
					sessionToken: string
					projectId: string
					organizationId: string
				}) {
					// Verify project exists and belongs to the organization
					const project = yield* db
						.select()
						.from(projects)
						.where(eq(projects.id, params.projectId))
						.pipe(
							Effect.head,
							Effect.mapError(
								() => new ProjectNotFoundError({ projectId: params.projectId }),
							),
						)

					// Verify project belongs to the organization
					if (project.organizationId !== params.organizationId) {
						return yield* new ProjectNotInOrganizationError({
							projectId: params.projectId,
							organizationId: params.organizationId,
						})
					}

					// Update session with new activeProjectId and timestamp
					yield* db
						.update(sessions)
						.set({
							activeProjectId: params.projectId,
							activeProjectUpdatedAt: new Date(),
						})
						.where(eq(sessions.token, params.sessionToken))

					return { success: true as const }
				},
			)

			/**
			 * Get the current active project ID from a session
			 */
			const getActiveProject = Effect.fn("Session.getActiveProject")(
				function* (sessionToken: string) {
					const session = yield* db
						.select()
						.from(sessions)
						.where(eq(sessions.token, sessionToken))
						.pipe(
							Effect.head,
							Effect.mapError(
								() => new SessionNotFoundError({ sessionId: sessionToken }),
							),
						)

					return {
						activeProjectId: session.activeProjectId ?? null,
						activeOrganizationId: session.activeOrganizationId ?? null,
						activeProjectUpdatedAt: session.activeProjectUpdatedAt ?? null,
					}
				},
			)

			return {
				setActiveProject,
				getActiveProject,
			} as const
		}),
	},
) {}
