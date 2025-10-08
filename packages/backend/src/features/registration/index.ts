import { Layer } from "effect";
import { RegistrationAPILive } from "./http";
import { RegistrationService } from "./service";

export const RegistrationModule = RegistrationAPILive.pipe(
  Layer.provide(RegistrationService.Default),
)
