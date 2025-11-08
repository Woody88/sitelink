import { HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import { AuthorizationApiKey } from "../../core/middleware"
import { BaseApi } from "../../core/api"
import { PdfProcessor } from "./service"


const ProcessingUpdate = Schema.Struct({
    id: Schema.String,
    status: Schema.optional(Schema.String),
    completedPages: Schema.optional(Schema.Number),
    failedPages: Schema.optional(Schema.String),
    startedAt: Schema.optional(Schema.Number),
})

export const ProcessingAPI = HttpApiGroup.make("processing")
    .add(
        HttpApiEndpoint.post("progressUpdate")`/processing/progressUpdate`
            .setPayload(ProcessingUpdate)
            .addSuccess(Schema.Void)
    ).prefix("/api")
     .middleware(AuthorizationApiKey)


export const ProcessingAPILive = HttpApiBuilder.group(
    BaseApi.add(ProcessingAPI),
    "processing",
    (handlers) => Effect.gen(function*(){
        const processing = yield* PdfProcessor
        return handlers
            .handle("progressUpdate", ({ payload }) => Effect.gen(function*(){
                // TODO: implement
            }))
    }))