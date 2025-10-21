import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiSchema,
	Multipart,
} from "@effect/platform"
import { Effect, Schema, Stream } from "effect"
import { BaseApi } from "../../core/api"
import { Authorization, CurrentSession } from "../../core/middleware"
import { PlanService } from "../plans/service"
import { ProjectService } from "../projects/service"
import { FileNotFoundError, FileService } from "./service"

/**
 * Response Schemas
 */
const FileResponse = Schema.Struct({
	id: Schema.String,
	planId: Schema.String,
	filePath: Schema.NullOr(Schema.String),
	fileType: Schema.NullOr(Schema.String),
	createdAt: Schema.Date,
})

const FileListResponse = Schema.Struct({
	files: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			filePath: Schema.NullOr(Schema.String),
			fileType: Schema.NullOr(Schema.String),
			createdAt: Schema.Date,
		}),
	),
})

const UploadResponse = Schema.Struct({
	files: Schema.Array(
		Schema.Struct({
			fileId: Schema.String,
			fileName: Schema.String,
		}),
	),
})

/**
 * URL Parameters
 */
const fileIdParam = HttpApiSchema.param("id", Schema.String)
const planIdParam = HttpApiSchema.param("planId", Schema.String)

/**
 * Access control error
 */
export class PlanAccessDeniedError extends Schema.TaggedError<PlanAccessDeniedError>()(
	"PlanAccessDeniedError",
	{
		planId: Schema.String,
		message: Schema.String,
	},
) {}

/**
 * File API Endpoints
 */
export const FileAPI = HttpApiGroup.make("files")
	.add(
		HttpApiEndpoint.post("uploadFiles")`/plans/${planIdParam}/files`
			.addSuccess(UploadResponse)
			.addError(PlanAccessDeniedError)
			.addError(Multipart.MultipartError)
			.setPayload(HttpApiSchema.Multipart),
	)
	.add(
		HttpApiEndpoint.get("getFile")`/files/${fileIdParam}`
			.addSuccess(FileResponse)
			.addError(FileNotFoundError)
			.addError(PlanAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.get("downloadFile")`/files/${fileIdParam}/download`
			.addSuccess(Schema.Uint8Array)
			.addError(FileNotFoundError)
			.addError(PlanAccessDeniedError),
	)
	.add(
		HttpApiEndpoint.del("deleteFile")`/files/${fileIdParam}`
			.addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
			.addError(FileNotFoundError)
			.addError(PlanAccessDeniedError),
	)
	.prefix("/api")
	.middleware(Authorization)

/**
 * HTTP Handler Layer
 */
export const FileAPILive = HttpApiBuilder.group(
	BaseApi.add(FileAPI),
	"files",
	(handlers) =>
		Effect.gen(function*() {
			const fileService = yield* FileService
			const planService = yield* PlanService
			const projectService = yield* ProjectService

			/**
			 * Helper: Verify plan belongs to user's active organization
			 */
			const verifyPlanAccess = Effect.fn("verifyPlanAccess")(function*(
				planId: string,
			) {
				const session = yield* CurrentSession
				const activeOrgId = session.session.activeOrganizationId

				if (!activeOrgId) {
					return yield* new PlanAccessDeniedError({
						planId,
						message: "No active organization in session",
					})
				}

				// Get plan and its project to verify organization
				const plan = yield* planService.get(planId)
				const project = yield* projectService.get(plan.projectId)

				if (project.organizationId !== activeOrgId) {
					return yield* new PlanAccessDeniedError({
						planId,
						message: "Plan does not belong to active organization",
					})
				}

				return { plan, project, orgId: activeOrgId }
			})

			/**
			 * Helper: Verify file's plan belongs to user's active organization
			 */
			const verifyFileAccess = Effect.fn("verifyFileAccess")(function*(
				fileId: string,
			) {
				const file = yield* fileService.get(fileId)
				const { plan, project, orgId } = yield* verifyPlanAccess(file.planId)
				return { file, plan, project, orgId }
			})

			return handlers
				.handle("uploadFiles", ({ path, payload }) =>
					Effect.gen(function*() {
						// Verify access to plan
						const { plan, project, orgId } = yield* verifyPlanAccess(
							path.planId,
						)

						// Parse multipart stream to get files
						const parts = yield* Stream.runCollect(payload)
						const uploadedFiles: Array<{ fileId: string; fileName: string }> = []

						// Process each file part
						for (const part of parts) {
							if (Multipart.isFile(part)) {
								// Get file content as Uint8Array
								const fileData = yield* part.contentEffect

								// Upload file to R2
								const { fileId } = yield* fileService.upload({
									planId: plan.id,
									projectId: project.id,
									orgId,
									fileData,
									fileName: part.name,
									fileType: part.contentType,
								})

								uploadedFiles.push({
									fileId,
									fileName: part.name,
								})
							}
						}

						return { files: uploadedFiles }
					}),
				)
				.handle("getFile", ({ path }) =>
					Effect.gen(function*() {
						// Verify access and return file metadata
						const { file } = yield* verifyFileAccess(path.id)
						return file
					}),
				)
				.handle("downloadFile", ({ path }) =>
					Effect.gen(function*() {
						// Verify access
						yield* verifyFileAccess(path.id)

						// Download file data
						const { data } = yield* fileService.download(path.id)

						// Return as Uint8Array
						return new Uint8Array(data)
					}),
				)
				.handle("deleteFile", ({ path }) =>
					Effect.gen(function*() {
						// Verify access
						yield* verifyFileAccess(path.id)

						// Delete file
						yield* fileService.delete(path.id)

						return { success: true as const }
					}),
				)
		}),
)
