import { HttpApiSchema } from "@effect/platform"
import { asc, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import { files, plans, sheets } from "../../core/database/schemas"
import { StorageService } from "../../core/storage"
import { ProcessorService } from "../processing/service"

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
 * Sheet not found error
 */
export class SheetNotFoundError extends Schema.TaggedError<SheetNotFoundError>()(
	"SheetNotFoundError",
	{
		sheetId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Sheet not found",
	}),
) {}

/**
 * DZI file not found error
 */
export class DziNotFoundError extends Schema.TaggedError<DziNotFoundError>()(
	"DziNotFoundError",
	{
		sheetId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "DZI file not found",
	}),
) {}

/**
 * Tile file not found error
 */
export class TileNotFoundError extends Schema.TaggedError<TileNotFoundError>()(
	"TileNotFoundError",
	{
		sheetId: Schema.String,
		tilePath: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Tile file not found",
	}),
) {}

/**
 * Plan Service - Manages construction plan sheets within projects
 *
 * Plans are metadata-only for now (defer PDF processing to Phase 2).
 * Access control relies on project's organizationId matching session.
 */
export class PlanService extends Effect.Service<PlanService>()("PlanService", {
	dependencies: [
		Drizzle.Default,
		StorageService.Default,
		ProcessorService.Default,
	],
	effect: Effect.gen(function* () {
		const db = yield* Drizzle
		const storage = yield* StorageService
		const pdfProcessor = yield* ProcessorService

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

			console.log(`📤 Uploading PDF to R2: ${filePath}`)
			console.log(`   File size: ${params.fileData.byteLength} bytes`)
			console.log(`   Organization ID: ${organizationId}`)

			// Upload PDF to R2
			yield* storage.use((r2) =>
				r2.put(filePath, params.fileData, {
					httpMetadata: { contentType: params.fileType },
				}),
			)

			console.log(`✅ PDF uploaded successfully to R2`)

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

			// // Initialize PDF processing job in Durable Object
			// yield* pdfProcessor.process({
			// 	jobId,
			// 	uploadId,
			// 	planId,
			// 	organizationId,
			// 	projectId,
			// 	pdfPath: filePath,
			// 	filename: params.fileName,
			// 	fileSize: params.fileData.byteLength,
			// 	uploadedAt: createdAt.getTime(),
			// })

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

		/**
		 * Verify plan exists and get it (used for authorization checks)
		 */
		const verifyPlanAccess = Effect.fn("Plan.verifyAccess")(function* (
			planId: string,
		) {
			// Get plan - will fail with PlanNotFoundError if doesn't exist
			return yield* get(planId)
		})

		/**
		 * List all sheets for a plan
		 */
		const listSheets = Effect.fn("Plan.listSheets")(function* (
			planId: string,
		) {
			// Verify plan exists first
			yield* verifyPlanAccess(planId)

			// Query all sheets for plan ordered by page number
			const sheetList = yield* db
				.select()
				.from(sheets)
				.where(eq(sheets.planId, planId))
				.orderBy(asc(sheets.pageNumber))

			return sheetList
		})

		/**
		 * Get a single sheet by ID
		 */
		const getSheet = Effect.fn("Plan.getSheet")(function* (sheetId: string) {
			return yield* db
				.select()
				.from(sheets)
				.where(eq(sheets.id, sheetId))
				.pipe(
					Effect.head,
					Effect.mapError(() => new SheetNotFoundError({ sheetId })),
				)
		})

		/**
		 * Get DZI XML file for a sheet
		 *
		 * Retrieves the DZI metadata file from R2 storage.
		 * DZI path format: organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/{sheetId}/tiles/{sheetId}.dzi
		 */
		const getDziFile = Effect.fn("Plan.getDziFile")(function* (params: {
			sheetId: string
		}) {
			// Get sheet to verify it exists and get the DZI path
			const sheet = yield* getSheet(params.sheetId)

			// Fetch DZI file from R2
			const dziObject = yield* storage.use((r2) => r2.get(sheet.dziPath))

			// Check if file exists
			if (!dziObject) {
				return yield* Effect.fail(
					new DziNotFoundError({ sheetId: params.sheetId }),
				)
			}

			// Read the XML content
			const dziContent = yield* Effect.promise(() => dziObject.text())

			return { content: dziContent, sheet }
		})

		/**
		 * Get tile image file for a sheet
		 *
		 * Retrieves a specific tile file from R2 storage.
		 * Tile path format: organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/{sheetId}/tiles/{sheetId}_files/{level}/{tile}
		 */
		const getTile = Effect.fn("Plan.getTile")(function* (params: {
			sheetId: string
			level: string
			tile: string
		}) {
			// Get sheet to verify it exists and build the tile path
			const sheet = yield* getSheet(params.sheetId)

			// Build tile path from sheet's tile directory
			// tile_directory is stored as: organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/{sheetId}/tiles/{sheetId}_files
			const tilePath = `${sheet.tileDirectory}/${params.level}/${params.tile}`

			// Fetch tile file from R2
			const tileObject = yield* storage.use((r2) => r2.get(tilePath))

			// Check if file exists
			if (!tileObject) {
				return yield* Effect.fail(
					new TileNotFoundError({
						sheetId: params.sheetId,
						tilePath,
					}),
				)
			}

			// Read the binary content
			const tileData = yield* Effect.promise(() => tileObject.arrayBuffer())

			// Determine content type based on file extension
			const contentType =
				params.tile.toLowerCase().endsWith(".jpeg") ||
				params.tile.toLowerCase().endsWith(".jpg")
					? "image/jpeg"
					: "application/octet-stream"

			return {
				data: tileData,
				contentType,
				sheet,
			}
		})

		return {
			create,
			get,
			list,
			update,
			delete: deletePlan,
			listSheets,
			getSheet,
			getDziFile,
			getTile,
		} as const
	}),
}) {}
