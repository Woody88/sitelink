import { HttpApiSchema } from "@effect/platform"
import { Effect, Schema } from "effect"
import { AuthService } from "../../core/auth"
import { PdfProcessorManager } from "../../core/bindings"
import type { NewProcessingJob } from "../../core/pdf-manager"
import { Drizzle } from "../../core/database"
import * as schema from "../../core/database/schemas"
import { eq } from "drizzle-orm"

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

export class PdfProcessor extends Effect.Service<PdfProcessor>()(
	"PdfProcessor",
	{
		dependencies: [Drizzle.Default, AuthService.Default],
		effect: Effect.gen(function* () {
			const pdfManager = yield* PdfProcessorManager
			const authService = yield* AuthService
			const db = yield* Drizzle

			const systemPdfUser = yield* db.select({
				id: schema.users.id,
			})
			.from(schema.users)
			.where(eq(schema.users.email, SYSTEM_PDF_PROCESSOR_EMAIL))
			.pipe(
				Effect.head,
				Effect.mapError(() => new SystemPdfProcessorUserNotFound())
			)

			const process = Effect.fn("PdfProcessor.process")(function* (
				job: NewProcessingJob,
			) {
				const container = pdfManager.getByName(job.jobId)
				const apiKey = yield* authService.use((auth) => {
					return auth.api.createApiKey({
						body: {
							userId: systemPdfUser.id,
							name: `pdf-processing-${job.jobId}`,
							expiresIn: 30 * 60,
						},
					})
				})

				yield* Effect.tryPromise({
					try: async (signal) => {
						const request = new Request("http://sitelink.com", {
							headers: {
								apiKey: apiKey.key
							},
							signal
						})
						const res = await container.fetch(request)

						if (!res.ok) {
							throw  Error(`container failed with ${res.status} code: ${res.statusText}`)
						}
					},
					catch: (cause) => new PdfProcessorError({ cause }),
				})
			})

			return { process }
		}),
	},
) {}
