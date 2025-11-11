import { HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import { BaseApi } from "../../core/api"
import { Authorization, AuthorizationApiKey, CurrentSession } from "../../core/middleware"
import { JobNotFoundError, ProcessingUpdate, ProcessorService } from "./service"

/**
 * Response schema for job status
 */
const JobStatusResponse = Schema.Struct({
	id: Schema.String,
	status: Schema.String,
	progress: Schema.NullOr(Schema.Number),
	totalPages: Schema.NullOr(Schema.Number),
	completedPages: Schema.NullOr(Schema.Number),
	failedPages: Schema.NullOr(Schema.String),
	startedAt: Schema.NullOr(Schema.Date),
	completedAt: Schema.NullOr(Schema.Date),
	lastError: Schema.NullOr(Schema.String),
	plan: Schema.Struct({
		id: Schema.String,
		name: Schema.String,
	}),
	projectId: Schema.String,
	organizationId: Schema.String,
})

/**
 * URL parameter for job ID
 */
const jobIdParam = HttpApiSchema.param("jobId", Schema.String)

/**
 * Processing API - Endpoints for PDF processing operations
 * Combines API key auth (for containers) and session auth (for users)
 */
export const ProcessingAPI = HttpApiGroup.make("processing")
	.add(
		HttpApiEndpoint.post("progressUpdate")`/processing/progressUpdate`
			.setPayload(ProcessingUpdate)
			.addSuccess(Schema.Void, { status: 200 }),
	)
	.add(
		HttpApiEndpoint.get("getJobStatus")`/processing/jobs/${jobIdParam}`
			.addSuccess(JobStatusResponse)
			.addError(JobNotFoundError),
	)
	.prefix("/api")

export const ProcessingAPILive = Layer.mergeAll(
	HttpApiBuilder.group(
		BaseApi.add(
			HttpApiGroup.make("processing")
				.add(
					HttpApiEndpoint.post("progressUpdate")`/processing/progressUpdate`
						.setPayload(ProcessingUpdate)
						.addSuccess(Schema.Void, { status: 200 }),
				)
				.prefix("/api")
				.middleware(AuthorizationApiKey)
		),
		"processing",
		(handlers) =>
			Effect.gen(function* () {
				const processing = yield* ProcessorService
				return handlers.handle("progressUpdate", ({ payload }) =>
					Effect.gen(function* () {
						yield* processing.progressUpdate(payload)
					}),
				)
			}),
	),
	HttpApiBuilder.group(
		BaseApi.add(
			HttpApiGroup.make("processing")
				.add(
					HttpApiEndpoint.get("getJobStatus")`/processing/jobs/${jobIdParam}`
						.addSuccess(JobStatusResponse)
						.addError(JobNotFoundError),
				)
				.prefix("/api")
				.middleware(Authorization)
		),
		"processing",
		(handlers) =>
			Effect.gen(function* () {
				const processing = yield* ProcessorService
				return handlers.handle("getJobStatus", ({ path }) =>
					Effect.gen(function* () {
						const { session } = yield* CurrentSession

						// Get job status with organization info
						const job = yield* processing.getJobStatus(path.jobId)

						// Verify user has access to this job's organization
						if (job.organizationId !== session.activeOrganizationId) {
							return yield* new JobNotFoundError({ jobId: path.jobId })
						}

						// Return formatted response
						return {
							id: job.id,
							status: job.status,
							progress: job.progress,
							totalPages: job.totalPages,
							completedPages: job.completedPages,
							failedPages: job.failedPages,
							startedAt: job.startedAt,
							completedAt: job.completedAt,
							lastError: job.lastError,
							plan: {
								id: job.planId,
								name: job.planName,
							},
							projectId: job.projectId,
							organizationId: job.organizationId,
						}
					}),
				)
			}),
	)
)
