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
					try: async (signal) => stub.processPDF(job, signal),
					catch: (cause) => new PdfProcessorError({ cause }),
				})
			})

			return { process }
		}),
	},
) {}
