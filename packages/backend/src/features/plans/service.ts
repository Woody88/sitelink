import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import { plans, projects } from "../../core/database/schemas"

/**
 * Plan not found error
 */
export class PlanNotFoundError extends Schema.TaggedError<PlanNotFoundError>()(
	"PlanNotFoundError",
	{
		planId: Schema.String,
	},
) {}

/**
 * Plan Service - Manages construction plan sheets within projects
 *
 * Plans are metadata-only for now (defer PDF processing to Phase 2).
 * Access control relies on project's organizationId matching session.
 */
export class PlanService extends Effect.Service<PlanService>()(
	"PlanService",
	{
		dependencies: [Drizzle.Default],
		effect: Effect.gen(function* () {
			const db = yield* Drizzle

			/**
			 * Create a new plan
			 *
			 * Assumes projectId belongs to user's active organization
			 * (validated in HTTP layer)
			 */
			const create = Effect.fn("Plan.create")(function* (params: {
				projectId: string
				name: string
				description?: string
			}) {
				// Verify project exists
				const project = yield* db.use((db) =>
					db.select().from(projects).where(eq(projects.id, params.projectId)).get(),
				)

				if (!project) {
					return yield* Effect.fail(
						new Error(`Project not found: ${params.projectId}`),
					)
				}

				// Generate plan ID
				const planId = crypto.randomUUID()

				// Insert plan
				yield* db.use((db) =>
					db.insert(plans).values({
						id: planId,
						projectId: params.projectId,
						name: params.name,
						description: params.description ?? null,
						directoryPath: null, // Will be set during PDF processing
						createdAt: new Date(),
					}),
				)

				return { planId }
			})

			/**
			 * Get plan by ID
			 */
			const get = Effect.fn("Plan.get")(function* (planId: string) {
				const plan = yield* db.use((db) =>
					db.select().from(plans).where(eq(plans.id, planId)).get(),
				)

				return yield* Effect.filterOrFail(
					Effect.succeed(plan),
					(p) => !!p,
					() => new PlanNotFoundError({ planId }),
				).pipe(
					Effect.map((p) => ({
						id: p.id,
						projectId: p.projectId,
						name: p.name,
						description: p.description,
						directoryPath: p.directoryPath,
						createdAt: p.createdAt,
					})),
				)
			})

			/**
			 * List all plans for a project
			 */
			const list = Effect.fn("Plan.list")(function* (projectId: string) {
				// Query all plans for project
				const planList = yield* db.use((db) =>
					db.select().from(plans).where(eq(plans.projectId, projectId)).all(),
				)

				return planList.map((p) => ({
					id: p.id,
					name: p.name,
					description: p.description,
					directoryPath: p.directoryPath,
					createdAt: p.createdAt,
				}))
			})

			/**
			 * Update a plan
			 */
			const update = Effect.fn("Plan.update")(function* (params: {
				planId: string
				data: { name?: string; description?: string }
			}) {
				// Get plan to verify it exists
				yield* get(params.planId)

				// Update plan
				yield* db.use((db) =>
					db
						.update(plans)
						.set({
							...(params.data.name && { name: params.data.name }),
							...(params.data.description !== undefined && {
								description: params.data.description,
							}),
						})
						.where(eq(plans.id, params.planId)),
				)
			})

			/**
			 * Delete a plan (cascade handled by database)
			 */
			const deletePlan = Effect.fn("Plan.delete")(function* (planId: string) {
				// Get plan to verify it exists
				yield* get(planId)

				// Delete plan (cascade deletes files)
				yield* db.use((db) => db.delete(plans).where(eq(plans.id, planId)))
			})

			return {
				create,
				get,
				list,
				update,
				delete: deletePlan,
			} as const
		}),
	},
) {}
