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
	OrganizationDeletedError,
	OrganizationNotFoundError,
} from "../../core/organization/service"
import { ProjectNotFoundError, ProjectService } from "./service"

/**
 * Request/Response Schemas
 */
const CreateProjectRequest = Schema.Struct({
	name: Schema.String,
	description: Schema.optional(Schema.String),
})

const UpdateProjectRequest = Schema.Struct({
	name: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
})

const ProjectResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	organizationId: Schema.String,
	createdAt: Schema.Date,
})

const ProjectListResponse = Schema.Struct({
	projects: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			name: Schema.String,
			description: Schema.NullOr(Schema.String),
			createdAt: Schema.Date,
		}),
	),
})

/**
 * URL Parameters
 */
const projectIdParam = HttpApiSchema.param("id", Schema.String)
const orgIdParam = HttpApiSchema.param("orgId", Schema.String)

/**
 * Project API Endpoints
 */
export const ProjectAPI = HttpApiGroup.make("projects")
	.add(
		HttpApiEndpoint.post("createProject")`/`
			.setPayload(CreateProjectRequest)
			.addSuccess(Schema.Struct({ projectId: Schema.String }))
			.addError(OrganizationDeletedError)
			.addError(OrganizationNotFoundError),
	)
	.add(
		HttpApiEndpoint.get("getProject")`/${projectIdParam}`
			.addSuccess(ProjectResponse)
			.addError(ProjectNotFoundError),
	)
	.add(
		HttpApiEndpoint.get(
			"listProjects",
		)`/organizations/${orgIdParam}/projects`.addSuccess(ProjectListResponse),
	)
	.add(
		HttpApiEndpoint.patch("updateProject")`/${projectIdParam}`
			.setPayload(UpdateProjectRequest)
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(ProjectNotFoundError),
	)
	.add(
		HttpApiEndpoint.del("deleteProject")`/${projectIdParam}`
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(ProjectNotFoundError),
	)
	.prefix("/api/projects")
	.middleware(Authorization)

/**
 * HTTP Handler Layer
 */
export const ProjectAPILive = HttpApiBuilder.group(
	BaseApi.add(ProjectAPI),
	"projects",
	(handlers) =>
		Effect.gen(function* () {
			const projects = yield* ProjectService

			return handlers
				.handle("createProject", ({ payload }) =>
					Effect.gen(function* () {
						const session = yield* CurrentSession

						// Use activeOrganizationId from session (already validated by Better Auth)
						const organizationId = session.session.activeOrganizationId ?? null

						if (!organizationId) {
							return yield* new OrganizationNotFoundError({
								message: "No active organization in session",
								organizationId: "unknown",
							})
						}

						const { projectId } = yield* projects
							.create({
								organizationId,
								name: payload.name,
								description: payload.description,
							})
							.pipe(Effect.orDie)

						return { projectId }
					}),
				)
				.handle("getProject", ({ path }) => projects.get(path.id))
				.handle("listProjects", ({ path }) =>
					Effect.gen(function* () {
						const projectList = yield* projects
							.list(path.orgId)
							.pipe(Effect.orDie)
						return { projects: projectList }
					}),
				)
				.handle("updateProject", ({ path, payload }) =>
					Effect.gen(function* () {
						yield* projects
							.update({
								projectId: path.id,
								data: payload,
							})
							.pipe(Effect.orDie)
						return { success: true as const }
					}),
				)
				.handle("deleteProject", ({ path }) =>
					Effect.gen(function* () {
						yield* projects.delete(path.id).pipe(Effect.orDie)
						return { success: true as const }
					}),
				)
		}),
)
