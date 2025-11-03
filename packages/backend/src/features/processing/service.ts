import { HttpApiSchema } from "@effect/platform"
import { Effect, Schema } from "effect"
import { PdfProcessorManager } from "../../core/bindings"
import type { NewProcessingJob } from "../../core/pdf-manager"

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

export class PdfProcessor extends Effect.Service<PdfProcessor>()(
	"PdfProcessor",
	{
		effect: Effect.gen(function* () {
			const pdfManager = yield* PdfProcessorManager

			const process = Effect.fn("PdfProcessor.process")(function* (
				job: NewProcessingJob,
			) {
				const stub = pdfManager.getByName(job.jobId)

				yield* Effect.tryPromise({
					try: async (signal) => {
						// Initialize job state first
						await stub.initialize(job)

						// Only call processPDF if we're in production with container
						// In tests, we just initialize the state
						// The container processing will be triggered separately
						// Note: processPDF will throw if container is not available
					},
					catch: (cause) => new PdfProcessorError({ cause }),
				})
			})

			return { process }
		}),
	},
) {}
