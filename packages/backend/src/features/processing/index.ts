import { Layer } from "effect"
import { ProcessingAPI, ProcessingAPILive } from "./http"
import { PdfProcessor } from "./service"



export const ProcessingModule = ProcessingAPILive.pipe(
    Layer.provide(PdfProcessor.Default)
)