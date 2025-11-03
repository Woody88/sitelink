import { HttpApiSchema } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import { files, plans } from "../../core/database/schemas"
import { StorageService } from "../../core/storage"
import { PdfProcessor } from "../processing/service"

/**
 * Plan not found error
 */
export class PlanNotFoundError extends Schema.TaggedError<PlanNotFoundError>()(
	"PlanNotFoundError",
	{
		planId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Plan not found",
	}),
) {}

/**
 * Plan Service - Manages construction plan sheets within projects
 *
 * Plans are metadata-only for now (defer PDF processing to Phase 2).
 * Access control relies on project's organizationId matching session.
 */
export class PlanService extends Effect.Service<PlanService>()("PlanService", {
	dependencies: [Drizzle.Default, StorageService.Default, PdfProcessor.Default],
	effect: Effect.gen(function* () {
		const db = yield* Drizzle
		const storage = yield* StorageService
		const pdfProcessor = yield* PdfProcessor

		/**
		 * Create a new plan with PDF upload
		 *
		 * Assumes projectId belongs to user's active organization
		 * (validated in HTTP layer)
		 */
		const create = Effect.fn("Plan.create")(function* (params: {
			projectId: string
			organizationId: string
			name: string
			description?: string
			fileData: Uint8Array | ArrayBuffer
			fileName: string
			fileType: string
		}) {
			// Generate IDs
			const organizationId = params.organizationId
			const projectId = params.projectId
			const planId = crypto.randomUUID()
			const fileId = crypto.randomUUID()
			const uploadId = crypto.randomUUID()
			const jobId = `${fileId}`

			// Build R2 storage path
			const filePath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/uploads/${uploadId}/original.pdf`

			// Upload PDF to R2
			yield* storage.use((r2) =>
				r2.put(filePath, params.fileData, {
					httpMetadata: { contentType: params.fileType },
				}),
			)

			const createdAt = new Date()
			// Insert plan metadata (FK constraint will validate projectId exists)
			yield* db.insert(plans).values({
				id: planId,
				projectId: params.projectId,
				name: params.name,
				description: params.description ?? null,
				directoryPath: `organizations/${organizationId}/projects/${projectId}/plans/${planId}`, // Base path for this plan
				createdAt,
			})

			// Insert file record
			yield* db.insert(files).values({
				id: fileId,
				uploadId,
				planId,
				filePath,
				fileType: params.fileType,
				isActive: true,
				createdAt: new Date(),
			})

			// Initialize PDF processing job in Durable Object
			yield* pdfProcessor.process({
				jobId,
				uploadId,
				planId,
				organizationId,
				projectId,
				pdfPath: filePath,
				filename: params.fileName,
				fileSize: params.fileData.byteLength,
				uploadedAt: createdAt.getTime(),
			})

			return { planId, fileId, uploadId, filePath, jobId }
		})

		/**
		 * Get plan by ID
		 */
		const get = Effect.fn("Plan.get")(function* (planId: string) {
			return yield* db
				.select()
				.from(plans)
				.where(eq(plans.id, planId))
				.pipe(
					Effect.head,
					Effect.mapError(() => new PlanNotFoundError({ planId })),
				)
		})

		/**
		 * List all plans for a project
		 */
		const list = Effect.fn("Plan.list")(function* (projectId: string) {
			// Query all plans for project
			const planList = yield* db
				.select()
				.from(plans)
				.where(eq(plans.projectId, projectId))

			return planList
		})

		/**
		 * Update a plan
		 */
		const update = Effect.fn("Plan.update")(function* (params: {
			planId: string
			data: { name?: string; description?: string }
		}) {
			// Update plan (will succeed with 0 rows if plan doesn't exist)
			yield* db
				.update(plans)
				.set({
					...(params.data.name && { name: params.data.name }),
					...(params.data.description !== undefined && {
						description: params.data.description,
					}),
				})
				.where(eq(plans.id, params.planId))
		})

		/**
		 * Delete a plan (cascade handled by database)
		 */
		const deletePlan = Effect.fn("Plan.delete")(function* (planId: string) {
			// Delete plan (cascade deletes files)
			yield* db.delete(plans).where(eq(plans.id, planId))
		})

		return {
			create,
			get,
			list,
			update,
			delete: deletePlan,
		} as const
	}),
}) {}
