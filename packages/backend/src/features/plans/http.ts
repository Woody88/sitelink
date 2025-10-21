import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiSchema,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { BaseApi } from "../../core/api"
import { Authorization, CurrentSession } from "../../core/middleware"
import { ProjectNotFoundError, ProjectService } from "../projects/service"
import { PlanNotFoundError, PlanService } from "./service"

/**
 * Request/Response Schemas
 */
const CreatePlanRequest = Schema.Struct({
	name: Schema.String,
	description: Schema.optional(Schema.String),
})

const UpdatePlanRequest = Schema.Struct({
	name: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
})

const PlanResponse = Schema.Struct({
	id: Schema.String,
	projectId: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	directoryPath: Schema.NullOr(Schema.String),
	createdAt: Schema.Date,
})

const PlanListResponse = Schema.Struct({
	plans: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			name: Schema.String,
			description: Schema.NullOr(Schema.String),
			directoryPath: Schema.NullOr(Schema.String),
			createdAt: Schema.Date,
		}),
	),
})

/**
 * URL Parameters
 */
const planIdParam = HttpApiSchema.param("id", Schema.String)
const projectIdParam = HttpApiSchema.param("projectId", Schema.String)

/**
 * Access control error - project doesn't belong to user's organization
 */
export class ProjectAccessDeniedError extends Schema.TaggedError<ProjectAccessDeniedError>()(
	"ProjectAccessDeniedError",
	{
		projectId: Schema.String,
		message: Schema.String,
	},
) {}

/**
 * Plan API Endpoints
 */
export const PlanAPI = HttpApiGroup.make("plans")
	.add(
		HttpApiEndpoint.post("createPlan")`/projects/${projectIdParam}/plans`
			.setPayload(CreatePlanRequest)
			.addSuccess(Schema.Struct({ planId: Schema.String }))
			.addError(ProjectNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.get("getPlan")`/plans/${planIdParam}`
			.addSuccess(PlanResponse)
			.addError(PlanNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.get("listPlans")`/projects/${projectIdParam}/plans`
			.addSuccess(PlanListResponse)
			.addError(ProjectNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.patch("updatePlan")`/plans/${planIdParam}`
			.setPayload(UpdatePlanRequest)
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(PlanNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.del("deletePlan")`/plans/${planIdParam}`
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(PlanNotFoundError)
			.addError(ProjectAccessDeniedError),
	)
	.prefix("/api")
	.middleware(Authorization)

/**
 * HTTP Handler Layer
 */
export const PlanAPILive = HttpApiBuilder.group(
	BaseApi.add(PlanAPI),
	"plans",
	(handlers) =>
		Effect.gen(function* () {
			const planService = yield* PlanService
			const projectService = yield* ProjectService

			/**
			 * Helper: Verify project belongs to user's active organization
			 */
			const verifyProjectAccess = Effect.fn("verifyProjectAccess")(
				function* (projectId: string) {
					const session = yield* CurrentSession
					const activeOrgId = session.session.activeOrganizationId

					if (!activeOrgId) {
						return yield* new ProjectAccessDeniedError({
							projectId,
							message: "No active organization in session",
						})
					}

					// Get project to verify it exists and belongs to org
					const project = yield* projectService.get(projectId)

					if (project.organizationId !== activeOrgId) {
						return yield* new ProjectAccessDeniedError({
							projectId,
							message: "Project does not belong to active organization",
						})
					}

					return project
				},
			)

			/**
			 * Helper: Verify plan's project belongs to user's active organization
			 */
			const verifyPlanAccess = Effect.fn("verifyPlanAccess")(function* (
				planId: string,
			) {
				const plan = yield* planService.get(planId)
				yield* verifyProjectAccess(plan.projectId)
				return plan
			})

			return handlers
				.handle("createPlan", ({ path, payload }) =>
					Effect.gen(function* () {
						// Verify user has access to the project
						yield* verifyProjectAccess(path.projectId)

						// Create plan
						const { planId } = yield* planService.create({
							projectId: path.projectId,
							name: payload.name,
							description: payload.description,
						})

						return { planId }
					}),
				)
				.handle("getPlan", ({ path }) =>
					Effect.gen(function* () {
						// Verify access and return plan
						return yield* verifyPlanAccess(path.id)
					}),
				)
				.handle("listPlans", ({ path }) =>
					Effect.gen(function* () {
						// Verify user has access to the project
						yield* verifyProjectAccess(path.projectId)

						// List plans for project
						const planList = yield* planService.list(path.projectId)
						return { plans: planList }
					}),
				)
				.handle("updatePlan", ({ path, payload }) =>
					Effect.gen(function* () {
						// Verify access
						yield* verifyPlanAccess(path.id)

						// Update plan
						yield* planService.update({
							planId: path.id,
							data: payload,
						})

						return { success: true as const }
					}),
				)
				.handle("deletePlan", ({ path }) =>
					Effect.gen(function* () {
						// Verify access
						yield* verifyPlanAccess(path.id)

						// Delete plan
						yield* planService.delete(path.id)

						return { success: true as const }
					}),
				)
		}),
)
