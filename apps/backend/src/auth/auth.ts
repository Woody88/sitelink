// apps/backend/src/auth/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "../db/schema"
import { expo } from "@better-auth/expo"
import type { LiveStoreClient } from "../sync/livestore-client"

/**
 * Create the Better Auth instance with optional LiveStore integration
 *
 * When a LiveStoreClient is provided, the auth system will emit UserCreated
 * events via LiveStore whenever a new user is created. This allows all
 * connected clients to receive real-time notifications of new users.
 */
export function createAuth(
  db: D1Database,
  secret: string,
  baseUrl: string,
  liveStoreClient?: LiveStoreClient
) {
  const drizzleDb = drizzle(db, { schema })

  return betterAuth({
    database: drizzleAdapter(drizzleDb, {
      provider: "sqlite",
      schema,
    }),
    secret, // Used for signing tokens, encrypting sessions, CSRF protection
    baseURL: baseUrl, // Base URL for auth endpoints
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
    plugins: [expo()],
    databaseHooks: {
      user: {
        create: {
          /**
           * After a user is created, emit a UserCreated event via LiveStore
           * This allows all connected clients to be notified of the new user
           */
          after: async (user) => {
            // Only emit event if LiveStore client is available
            if (!liveStoreClient) {
              console.log("[Auth] User created, but no LiveStore client available:", user.id)
              return
            }

            try {
              await liveStoreClient.commitUserCreated({
                id: user.id,
                email: user.email,
                name: user.name ?? user.email.split("@")[0], // Default name from email
                avatarUrl: user.image ?? undefined,
              })
              console.log("[Auth] UserCreated event emitted for:", user.id)
            } catch (error) {
              console.error("[Auth] Failed to emit UserCreated event:", error)
              // Don't throw - user creation should succeed even if event emission fails
            }
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
