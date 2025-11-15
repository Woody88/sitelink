import { Context } from "effect"
import type { Resend } from "resend"
import type { SitelinkPdfProcessor } from "./pdf-manager"

export class D1Binding extends Context.Tag("D1Binding")<
	D1Binding,
	D1Database
>() {}

export class ResendBinding extends Context.Tag("ResendBinding")<
	ResendBinding,
	Resend
>() {}

export class R2Binding extends Context.Tag("R2Binding")<
	R2Binding,
	R2Bucket
>() {}

export class PdfProcessorManager extends Context.Tag("PdfProcessorManager")<
	PdfProcessorManager,
	DurableObjectNamespace<SitelinkPdfProcessor>
>() {}

export class TileGenerationQueue extends Context.Tag("TileGenerationQueue")<
	TileGenerationQueue,
	Queue
>() {}