import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiError,
	HttpApiGroup,
	HttpApiSchema,
	Multipart,
} from "@effect/platform"
import { Effect, Schema, Stream } from "effect"
import { BaseApi } from "../../core/api"
import { Authorization, CurrentSession } from "../../core/middleware"
import {
	DziNotFoundError,
	PlanNotFoundError,
	PlanService,
	SheetNotFoundError,
	TileNotFoundError,
} from "./service"

/**
 * Plan upload validation error
 */
export class PlanUploadError extends Schema.TaggedError<PlanUploadError>()(
	"PlanUploadError",
	{
		message: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 400,
		description: "Plan upload validation failed",
	}),
) {}

/**
 * Request/Response Schemas
 */
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
	processingStatus: Schema.NullOr(Schema.String),
	tileMetadata: Schema.NullOr(Schema.String),
	createdAt: Schema.Date,
})

const PlanListResponse = Schema.Struct({
	plans: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			name: Schema.String,
			description: Schema.NullOr(Schema.String),
			directoryPath: Schema.NullOr(Schema.String),
			processingStatus: Schema.NullOr(Schema.String),
			tileMetadata: Schema.NullOr(Schema.String),
			createdAt: Schema.Date,
		}),
	),
})

const SheetResponse = Schema.Struct({
	id: Schema.String,
	planId: Schema.String,
	pageNumber: Schema.Number,
	sheetName: Schema.NullOr(Schema.String),
	dziPath: Schema.String,
	tileDirectory: Schema.String,
	width: Schema.NullOr(Schema.Number),
	height: Schema.NullOr(Schema.Number),
	tileCount: Schema.NullOr(Schema.Number),
	processingStatus: Schema.String,
	createdAt: Schema.Date,
})

const SheetListResponse = Schema.Struct({
	sheets: Schema.Array(SheetResponse),
})

/**
 * URL Parameters
 */
const planIdParam = HttpApiSchema.param("id", Schema.String)
const projectIdParam = HttpApiSchema.param("projectId", Schema.String)
const sheetIdParam = HttpApiSchema.param("sheetId", Schema.String)
const tileLevelParam = HttpApiSchema.param("level", Schema.String)
const tileFileParam = HttpApiSchema.param("tile", Schema.String)

/**
 * Plan API Endpoints
 */
export const PlanAPI = HttpApiGroup.make("plans")
	.add(
		HttpApiEndpoint.post("createPlan")`/projects/${projectIdParam}/plans`
			.addSuccess(
				Schema.Struct({
					planId: Schema.String,
					fileId: Schema.String,
					uploadId: Schema.String,
					jobId: Schema.String,
				}),
			)
			.addError(Multipart.MultipartError)
			.addError(PlanUploadError)
			.setPayload(HttpApiSchema.MultipartStream(Schema.Struct({}))),
	)
	.add(
		HttpApiEndpoint.get("getPlan")`/plans/${planIdParam}`
			.addSuccess(PlanResponse)
			.addError(PlanNotFoundError),
	)
	.add(
		HttpApiEndpoint.get(
			"listPlans",
		)`/projects/${projectIdParam}/plans`.addSuccess(PlanListResponse),
	)
	.add(
		HttpApiEndpoint.patch("updatePlan")`/plans/${planIdParam}`
			.setPayload(UpdatePlanRequest)
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(PlanNotFoundError),
	)
	.add(
		HttpApiEndpoint.del("deletePlan")`/plans/${planIdParam}`
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(PlanNotFoundError),
	)
	.add(
		HttpApiEndpoint.get(
			"listSheets",
		)`/plans/${planIdParam}/sheets`.addSuccess(SheetListResponse),
	)
	.add(
		HttpApiEndpoint.get(
			"getSheet",
		)`/plans/${planIdParam}/sheets/${sheetIdParam}`
			.addSuccess(SheetResponse)
			.addError(SheetNotFoundError),
	)
	.add(
		HttpApiEndpoint.get(
			"getDzi",
		)`/plans/${planIdParam}/sheets/${sheetIdParam}/dzi`
			.addSuccess(HttpApiSchema.Text({ contentType: "application/xml" }))
			.addError(SheetNotFoundError)
			.addError(DziNotFoundError),
	)
	.add(
		HttpApiEndpoint.get(
			"getTile",
		)`/plans/${planIdParam}/sheets/${sheetIdParam}/tiles/${tileLevelParam}/${tileFileParam}`
			.addSuccess(HttpApiSchema.Uint8Array({ contentType: "image/jpeg" }))
			.addError(SheetNotFoundError)
			.addError(TileNotFoundError),
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

			return handlers
				.handle("createPlan", ({ path, payload }) =>
					Effect.gen(function* () {
						const { session } = yield* CurrentSession

						if (!session.activeOrganizationId)
							return yield* new HttpApiError.Unauthorized()

						// Parse multipart stream to get file and fields
						const parts = yield* Stream.runCollect(payload)

						let fileData: Uint8Array | undefined
						let fileName: string | undefined
						let fileType: string | undefined
						let name: string = "Untitled Plan"
						let description: string | undefined

						// Process each multipart part
						for (const part of parts) {
							if (Multipart.isFile(part)) {
								// Get file content
								fileData = yield* part.contentEffect
								fileName = part.name
								fileType = part.contentType
							} else if (Multipart.isField(part)) {
								// Handle form fields
								if (part.key === "name") {
									name = part.value
								} else if (part.key === "description") {
									description = part.value
								}
							}
						}

						// Validate file was uploaded
						if (!fileData || !fileName) {
							return yield* new PlanUploadError({
								message: "No file uploaded",
							})
						}

						// Create plan with file upload
						const { planId, fileId, uploadId, jobId } = yield* planService
							.create({
								organizationId: session.activeOrganizationId,
								projectId: path.projectId,
								name,
								description: description || undefined,
								fileData,
								fileName,
								fileType: fileType ?? "application/pdf",
							})
							.pipe(
								Effect.catchAll((error) =>
									Effect.fail(
										new PlanUploadError({
											message: `Failed to create plan: ${error}`,
										}),
									),
								),
							)

						return { planId, fileId, uploadId, jobId }
					}),
				)
				.handle("getPlan", ({ path }) => planService.get(path.id))
				.handle("listPlans", ({ path }) =>
					Effect.gen(function* () {
						// List plans for project
						const planList = yield* planService
							.list(path.projectId)
							.pipe(Effect.orDie)
						return { plans: planList }
					}),
				)
				.handle("updatePlan", ({ path, payload }) =>
					Effect.gen(function* () {
						// Update plan
						yield* planService
							.update({
								planId: path.id,
								data: payload,
							})
							.pipe(Effect.orDie)

						return { success: true as const }
					}),
				)
				.handle("deletePlan", ({ path }) =>
					Effect.gen(function* () {
						// Delete plan
						yield* planService.delete(path.id).pipe(Effect.orDie)

						return { success: true as const }
					}),
				)
				.handle("listSheets", ({ path }) =>
					Effect.gen(function* () {
						// List all sheets for the plan
						const sheetList = yield* planService
							.listSheets(path.id)
							.pipe(Effect.orDie)

						return { sheets: sheetList }
					}),
				)
				.handle("getSheet", ({ path }) =>
					Effect.gen(function* () {
						// Get the specific sheet
						const sheet = yield* planService
							.getSheet(path.sheetId)
							.pipe(Effect.orDie)

						return sheet
					}),
				)
				.handle("getDzi", ({ path }) =>
					Effect.gen(function* () {
						// Get the DZI file content
						const { content } = yield* planService
							.getDziFile({ sheetId: path.sheetId })
							.pipe(Effect.orDie)

						return content
					}),
				)
				.handle("getTile", ({ path }) =>
					Effect.gen(function* () {
						// Get the tile file
						const { data } = yield* planService
							.getTile({
								sheetId: path.sheetId,
								level: path.level,
								tile: path.tile,
							})
							.pipe(Effect.orDie)

						// Return as Uint8Array
						return new Uint8Array(data)
					}),
				)
		}),
)
