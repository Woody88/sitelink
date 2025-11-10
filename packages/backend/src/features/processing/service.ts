import { HttpApiSchema } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Config, Effect, Redacted, Schema } from "effect"
import { AuthService } from "../../core/auth"
import { PdfProcessorManager } from "../../core/bindings"
import { Drizzle } from "../../core/database"
import * as schema from "../../core/database/schemas"
import type { NewProcessingJob } from "../../core/pdf-manager"

const SYSTEM_PDF_PROCESSOR_EMAIL = "system-pdf-processor@sitelink.com"
export class PdfProcessorError extends Schema.TaggedError<PdfProcessorError>(
	"PdfProcessorError",
)(
	"PdfProcessorError",
	{
		cause: Schema.Defect,
	},
	HttpApiSchema.annotations({
		status: 500,
		description: "Internal Pdf processor error",
	}),
) {}

export class SystemPdfProcessorUserNotFound extends Schema.TaggedError<SystemPdfProcessorUserNotFound>(
	"SystemPdfProcessorUserNotFound",
)(
	"SystemPdfProcessorUserNotFound",
	{},
	HttpApiSchema.annotations({
		status: 404,
		description: "System Processor User Not Found ",
	}),
) {}

export const ProcessingUpdate = Schema.Struct({
	id: Schema.String,
	status: Schema.optional(Schema.String),
	completedPages: Schema.optional(Schema.Number),
	failedPages: Schema.optional(Schema.String),
	startedAt: Schema.optional(Schema.Number),
})

export class ProcessorService extends Effect.Service<ProcessorService>()(
	"ProcessorService",
	{
		dependencies: [Drizzle.Default, AuthService.Default],
		effect: Effect.gen(function* () {
			const pdfManager = yield* PdfProcessorManager
			const authService = yield* AuthService
			const db = yield* Drizzle
			// Lazy function to get system PDF user (only called when needed)
			const getSystemPdfUser = () =>
				db
					.select({
						id: schema.users.id,
					})
					.from(schema.users)
					.where(eq(schema.users.email, SYSTEM_PDF_PROCESSOR_EMAIL))
					.pipe(
						Effect.head,
						Effect.mapError(() => new SystemPdfProcessorUserNotFound()),
					)

			const process = Effect.fn("ProcessorService.process")(function* (
				job: NewProcessingJob,
			) {
				const container = pdfManager.getByName(job.jobId)

				// Get system user only when processing
				const systemPdfUser = yield* getSystemPdfUser()

				const apiKey = yield* authService.use((auth) => {
					return auth.api.createApiKey({
						body: {
							userId: systemPdfUser.id,
							name: `pdf-${job.jobId.slice(0, 20)}`, // Keep name short
							expiresIn: 24 * 60 * 60, // 24 hours (Better Auth minimum)
						},
					})
				})

				yield* Effect.tryPromise({
					try: async (signal) => {
						const request = new Request("http://sitelink.com/processPdf", {
							headers: {
								apiKey: apiKey.key,
							},
							signal,
						})
						const res = await container.fetch(request)

						if (!res.ok) {
							throw Error(
								`container failed with ${res.status} code: ${res.statusText}`,
							)
						}
					},
					catch: (cause) => new PdfProcessorError({ cause }),
				})
			})

			const progressUpdate = Effect.fn("ProcessorService.progressUpdate")(
				function* (update: typeof ProcessingUpdate.Type) {
					yield* db
						.update(schema.processingJobs)
						.set({
							...(update.status && { status: update.status }),
							...(update.completedPages !== undefined && {
								completedPages: update.completedPages,
							}),
							...(update.failedPages && { failedPages: update.failedPages }),
							...(update.startedAt && {
								startedAt: new Date(update.startedAt),
							}),
							updatedAt: new Date(),
						})
						.where(eq(schema.processingJobs.id, update.id))
				},
			)

			return { process, progressUpdate }
		}),
	},
) {}
