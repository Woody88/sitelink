import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import { projects } from "../../core/database/schemas"
import { OrganizationService } from "../../core/organization/service"

/**
 * Project not found error
 */
export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
	"ProjectNotFoundError",
	{
		projectId: Schema.String,
	},
) {}

/**
 * Project Service - Manages construction projects within organizations
 *
 * Relies on Better Auth for organization membership validation.
 * Only enforces custom business rules (soft delete).
 */
export class ProjectService extends Effect.Service<ProjectService>()(
	"ProjectService",
	{
		dependencies: [Drizzle.Default, OrganizationService.Default],
		effect: Effect.gen(function* () {
			const db = yield* Drizzle
			const orgService = yield* OrganizationService

			/**
			 * Create a new project
			 *
			 * Assumes organizationId comes from session.activeOrganizationId
			 * (already validated by Better Auth)
			 */
			const create = Effect.fn("Project.create")(function* (params: {
				organizationId: string
				name: string
				description?: string
			}) {
				// Only check: organization not soft-deleted (our custom business rule)
				yield* orgService.ensureNotDeleted(params.organizationId)

				// Generate project ID
				const projectId = crypto.randomUUID()

				// Insert project
				yield* db.use((db) =>
					db.insert(projects).values({
						id: projectId,
						organizationId: params.organizationId,
						name: params.name,
						description: params.description ?? null,
						createdAt: new Date(),
					}),
				)

				return { projectId }
			})

			/**
			 * Get project by ID
			 */
			const get = Effect.fn("Project.get")(function* (projectId: string) {
				const project = yield* db.use((db) =>
					db.select().from(projects).where(eq(projects.id, projectId)).get(),
				)

				return yield* Effect.filterOrFail(
					Effect.succeed(project),
					(p) => !!p,
					() => new ProjectNotFoundError({ projectId }),
				).pipe(
					Effect.map((p) => ({
						id: p.id,
						name: p.name,
						description: p.description,
						organizationId: p.organizationId,
						createdAt: p.createdAt,
					})),
				)
			})

			/**
			 * List all projects for an organization
			 *
			 * Assumes organizationId comes from session.activeOrganizationId
			 */
			const list = Effect.fn("Project.list")(function* (
				organizationId: string,
			) {
				// Query all projects for organization
				const projectList = yield* db.use((db) =>
					db
						.select()
						.from(projects)
						.where(eq(projects.organizationId, organizationId))
						.all(),
				)

				return projectList.map((p) => ({
					id: p.id,
					name: p.name,
					description: p.description,
					createdAt: p.createdAt,
				}))
			})

			/**
			 * Update a project
			 */
			const update = Effect.fn("Project.update")(function* (params: {
				projectId: string
				data: { name?: string; description?: string }
			}) {
				// Get project to verify it exists
				yield* get(params.projectId)

				// Update project
				yield* db.use((db) =>
					db
						.update(projects)
						.set({
							...(params.data.name && { name: params.data.name }),
							...(params.data.description !== undefined && {
								description: params.data.description,
							}),
						})
						.where(eq(projects.id, params.projectId)),
				)
			})

			/**
			 * Delete a project (cascade handled by database)
			 */
			const deleteProject = Effect.fn("Project.delete")(function* (
				projectId: string,
			) {
				// Get project to verify it exists
				yield* get(projectId)

				// Delete project (cascade deletes plans/files/media)
				yield* db.use((db) =>
					db.delete(projects).where(eq(projects.id, projectId)),
				)
			})

			return {
				create,
				get,
				list,
				update,
				delete: deleteProject,
			} as const
		}),
	},
) {}
