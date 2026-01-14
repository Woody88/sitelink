// apps/backend/src/auth/auth.ts

import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { LiveStoreClient } from "../sync/livestore-client";

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
	liveStoreClient?: LiveStoreClient,
) {
	const drizzleDb = drizzle(db, { schema });

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
		trustedOrigins: ["exp://192.168.2.13:8081", "http://localhost:8081"],
		plugins: [
			expo(),
			organization({
				organizationHooks: {
					afterCreateOrganization: async ({ organization, user }) => {
						if (!liveStoreClient) return;

						try {
							// Emit organizationCreated event to the organization's store
							// Includes owner's user data to bootstrap the org with member info
							await liveStoreClient.commit(
								"organizationCreated",
								{
									id: organization.id,
									name: organization.name,
									ownerId: user.id,
									ownerEmail: user.email,
									ownerName: user.name ?? user.email.split("@")[0],
									ownerAvatarUrl: user.image ?? undefined,
									createdAt: Date.now(),
								},
								organization.id, // storeId = organizationId for multi-tenant isolation
							);
							console.log(
								"[Auth] OrganizationCreated event emitted to store:",
								organization.id,
							);
						} catch (error) {
							console.error(
								"[Auth] Failed to emit OrganizationCreated event:",
								error,
							);
						}
					},
				},
			}),
		],
		databaseHooks: {
			session: {
				create: {
					before: async (session) => {
						// Get the user's first organization to set as active
						const userMembership = await drizzleDb
							.select()
							.from(schema.member)
							.where(eq(schema.member.userId, session.userId))
							.limit(1)
							.get();

						console.log(
							"[Auth] Session create hook - membership:",
							userMembership?.organizationId,
						);

						return {
							data: {
								...session,
								activeOrganizationId: userMembership?.organizationId ?? null,
							},
						};
					},
				},
				update: {
					before: async (session) => {
						console.log(
							"[Auth] Session update hook - activeOrganizationId:",
							session.activeOrganizationId,
						);
						// Pass through the update as-is
						return { data: session };
					},
				},
			},
			// NOTE: We don't emit userCreated events here because:
			// 1. Users are in Better Auth's domain (auth DB is source of truth)
			// 2. Users always exist in context of an organization in this app
			// 3. The organizationCreated event includes owner info
			// 4. For admin/analytics, query the auth DB directly
			// 5. If needed later, create a separate global store for cross-org analytics
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
