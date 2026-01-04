// apps/backend/auth.config.ts
// This file is used by the Better Auth CLI for schema generation
// The actual runtime auth is created in src/auth/auth.ts with the D1 binding

import { betterAuth } from "better-auth"
import Database from "better-sqlite3"

// Create or open a local SQLite database for CLI operations
const db = new Database("./auth.db")

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
})
