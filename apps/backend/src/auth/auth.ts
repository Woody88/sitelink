// apps/backend/src/auth/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"

export function createAuth(db: D1Database) {
  const drizzleDb = drizzle(db)

  return betterAuth({
    database: drizzleAdapter(drizzleDb, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Set to true in production
    },
    socialProviders: {
      // Add social providers as needed
      // google: {
      //   clientId: process.env.GOOGLE_CLIENT_ID!,
      //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
