import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiError,
	HttpApiGroup,
	HttpApiSchema,
	Multipart,
} from "@effect/platform"
import { Effect, Schema, Stream } from "effect"
import { eq, sql } from "drizzle-orm"
import { BaseApi } from "../../core/api"
import { Drizzle } from "../../core/database"
import * as schema from "../../core/database/schemas"
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
	markerCount: Schema.propertySignature(Schema.Number).pipe(
		Schema.withConstructorDefault(() => 0),
	),
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
 * Marker Response Schemas (for frontend integration)
 */
const HyperlinkSchema = Schema.Struct({
	calloutRef: Schema.String,      // Full marker text e.g., "3/A7"
	targetSheetRef: Schema.String,  // Referenced sheet e.g., "A7"
	x: Schema.Number,               // Normalized x coordinate (0-1)
	y: Schema.Number,               // Normalized y coordinate (0-1)
	confidence: Schema.Number,      // Detection confidence (0-1)
})

const SheetMarkersResponse = Schema.Struct({
	hyperlinks: Schema.Array(HyperlinkSchema),
	calloutsFound: Schema.Number,
	calloutsMatched: Schema.Number,
	confidenceStats: Schema.Struct({
		averageConfidence: Schema.Number,
	}),
	processingTimeMs: Schema.Number, // Processing time in milliseconds (defaults to 0 if not available)
})

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
					filePath: Schema.String,
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
	.add(
		HttpApiEndpoint.get(
			"getSheetMarkers",
		)`/plans/${planIdParam}/sheets/${sheetIdParam}/markers`
			.addSuccess(SheetMarkersResponse)
			.addError(SheetNotFoundError),
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
						console.log('📥 Upload plan endpoint called')
						const { session, user } = yield* CurrentSession

						console.log('Session active org ID:', session.activeOrganizationId)
						console.log('Session user ID:', user.id)

						if (!session.activeOrganizationId) {
							console.error('❌ No active organization ID in session')
							return yield* new HttpApiError.Unauthorized()
						}

						console.log('📦 Parsing multipart data...')

						let fileData: Uint8Array | undefined
						let fileName: string | undefined
						let fileType: string | undefined
						let name: string = "Untitled Plan"
						let description: string | undefined

						// Parse multipart stream to get file and fields
						try {
							const parts = yield* Stream.runCollect(payload)
							console.log('✅ Multipart data parsed, parts count:', parts.length)

							// Process each multipart part
							console.log('🔍 Processing multipart parts...')
							for (const part of parts) {
								if (Multipart.isFile(part)) {
									console.log('📎 Found file part:', part.name)
									// Get file content
									fileData = yield* part.contentEffect
									fileName = part.name
									fileType = part.contentType
									console.log('✅ File loaded, size:', fileData.byteLength)
								} else if (Multipart.isField(part)) {
									console.log('📝 Found field:', part.key, '=', part.value)
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
								console.error('❌ No file data or filename')
								return yield* new PlanUploadError({
									message: "No file uploaded",
								})
							}

							console.log('✅ Validation passed, calling service...')
						} catch (parseError) {
							console.error('❌ Failed to parse multipart data:', parseError)
							return yield* new PlanUploadError({
								message: `Failed to parse upload: ${parseError}`,
							})
						}

						// Create plan with file upload
						const { planId, fileId, uploadId, filePath, jobId } = yield* planService
							.create({
								organizationId: session.activeOrganizationId,
								projectId: path.projectId,
								userId: user.id,
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

						return { planId, fileId, uploadId, filePath, jobId }
					}),
				)
				.handle("getPlan", ({ path }) => planService.get(path.id))
				.handle("listPlans", ({ path }) =>
					Effect.gen(function* () {
						// List plans for project
						const planList = yield* planService
							.list(path.projectId)
							.pipe(Effect.orDie)
						console.log(`📊 Returning ${planList.length} plans for project ${path.projectId}`)
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
						// Get plan first to access organizationId and projectId
						const plan = yield* planService.get(path.id).pipe(Effect.orDie)
						
						// List all sheets for the plan
						const sheetList = yield* planService
							.listSheets(path.id)
							.pipe(Effect.orDie)

						// Get marker counts for each sheet
						const db = yield* Drizzle
						const markerCounts = yield* db
							.select({
								sheetNumber: schema.planMarkers.sheetNumber,
								count: sql<number>`count(*)`.as("count"),
							})
							.from(schema.planMarkers)
							.where(eq(schema.planMarkers.planId, path.id))
							.groupBy(schema.planMarkers.sheetNumber)

						// Create a map of sheetNumber -> marker count
						const markerCountMap = new Map<number, number>()
						for (const row of markerCounts) {
							// Convert count to number (SQLite may return as string or bigint)
							const count = typeof row.count === 'number' ? row.count : Number(row.count)
							markerCountMap.set(row.sheetNumber, count)
						}

						// Transform database rows to API response format
						const transformedSheets = sheetList.map((sheet) => {
							// Build DZI path: organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/sheet-{n}/sheet-sheet-{n}.dzi
							// Extract organizationId and projectId from plan (they're not in sheet table)
							// We need to get them from the plan or from the sheet's sheetKey
							// sheetKey format: organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/sheet-{n}.pdf
							const sheetKeyMatch = sheet.sheetKey.match(/^organizations\/([^\/]+)\/projects\/([^\/]+)\/plans\/([^\/]+)\//)
							const organizationId = sheetKeyMatch?.[1] || ""
							const projectId = sheetKeyMatch?.[2] || ""
							
							const sheetBasePath = `organizations/${organizationId}/projects/${projectId}/plans/${sheet.planId}/sheets/sheet-${sheet.sheetNumber}`
							const dziPath = `${sheetBasePath}/sheet-sheet-${sheet.sheetNumber}.dzi`
							
							// Build tile directory: organizations/.../plans/{planId}/sheets/sheet-{n}/sheet-sheet-{n}_files
							const tileDirectory = `${sheetBasePath}/sheet-sheet-${sheet.sheetNumber}_files`

							return {
								id: sheet.id,
								planId: sheet.planId,
								pageNumber: sheet.sheetNumber, // Map sheetNumber to pageNumber
								sheetName: sheet.sheetName,
								dziPath,
								tileDirectory,
								width: null, // Not stored in database
								height: null, // Not stored in database
								tileCount: sheet.tileCount,
								markerCount: markerCountMap.get(sheet.sheetNumber) || 0, // Add marker count
								processingStatus: sheet.status, // Map status to processingStatus
								createdAt: sheet.createdAt,
							}
						})

						return { sheets: transformedSheets }
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
				.handle("getSheetMarkers", ({ path }) =>
					Effect.gen(function* () {
						// Get the sheet to verify it exists and get its dimensions
						const sheet = yield* planService.getSheet(path.sheetId)

						// Query markers for this plan and sheet
						const db = yield* Drizzle
						const markers = yield* db
							.select()
							.from(schema.planMarkers)
							.where(
								sql`${schema.planMarkers.planId} = ${path.id} AND ${schema.planMarkers.sheetNumber} = ${sheet.pageNumber}`,
							)

						// Transform markers to hyperlinks format
						const hyperlinks = markers.map((marker) => {
							// Parse bbox to get center point as normalized coordinates
							// bbox format: { x, y, w, h } where x,y are normalized (0-1)
							// Handle both JSON string and object formats
							let bbox: { x: number; y: number; w: number; h: number } | null = null
							if (marker.bbox) {
								if (typeof marker.bbox === "string") {
									try {
										bbox = JSON.parse(marker.bbox) as { x: number; y: number; w: number; h: number }
									} catch {
										bbox = null
									}
								} else if (typeof marker.bbox === "object") {
									bbox = marker.bbox as { x: number; y: number; w: number; h: number }
								}
							}
							const x = bbox ? bbox.x + bbox.w / 2 : 0.5 // Center x
							const y = bbox ? bbox.y + bbox.h / 2 : 0.5 // Center y

							return {
								calloutRef: marker.markerText,
								targetSheetRef: marker.sheet,
								x,
								y,
								confidence: marker.confidence,
							}
						})

						// Calculate stats
						const calloutsFound = markers.length
						const calloutsMatched = markers.filter((m) => m.isValid).length
						const avgConfidence =
							markers.length > 0
								? markers.reduce((sum, m) => sum + m.confidence, 0) / markers.length
								: 0

						return {
							hyperlinks,
							calloutsFound,
							calloutsMatched,
							confidenceStats: {
								averageConfidence: avgConfidence,
							},
							processingTimeMs: 0, // Not tracked in database, default to 0
						}
					}),
				)
		}),
)
