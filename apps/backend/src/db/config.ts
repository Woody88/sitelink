// apps/backend/src/db/config.ts
import { drizzle } from "drizzle-orm/d1"
import type { Env } from "../types/env"

export function createDb(db: Env["DB"]) {
  return drizzle(db)
}

export type DbClient = ReturnType<typeof createDb>
