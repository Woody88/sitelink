import { HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import { BaseApi } from "../../core/api"
import { AuthorizationApiKey } from "../../core/middleware"
import { ProcessingUpdate, ProcessorService } from "./service"

export const ProcessingAPI = HttpApiGroup.make("processing")
	.add(
		HttpApiEndpoint.post("progressUpdate")`/processing/progressUpdate`
			.setPayload(ProcessingUpdate)
			.addSuccess(Schema.Void, { status: 200 }),
	)
	.prefix("/api")
	.middleware(AuthorizationApiKey)

export const ProcessingAPILive = HttpApiBuilder.group(
	BaseApi.add(ProcessingAPI),
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
)
