import type { Layer } from "effect"
import { DrizzleD1Client } from "./database"

export const CoreLayer = DrizzleD1Client.Default.pipe()
