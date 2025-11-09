import { Layer } from "effect"
import { ProcessingAPI, ProcessingAPILive } from "./http"
import { ProcessorService } from "./service"



export const ProcessingModule = ProcessingAPILive.pipe(
    Layer.provide(ProcessorService.Default)
)