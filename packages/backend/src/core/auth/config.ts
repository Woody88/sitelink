import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
	apiKey,
	magicLink,
	type OrganizationOptions,
	openAPI,
	organization,
} from "better-auth/plugins"

export const magicLinkOptions = {
	sendMagicLink: async (_, _request) => {},
} satisfies Parameters<typeof magicLink>[0]

export const organizationOptions = {
	schema: {
		organization: {
			additionalFields: {
				deletedAt: {
					type: "date",
					input: false,
					required: false,
				},
			},
		},
	},
} satisfies OrganizationOptions

export const betterAuthConfig = {
	database: drizzleAdapter(
		{},
		{
			provider: "sqlite",
			usePlural: true,
			camelCase: false,
		},
	),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		requireEmailVerification: false,
	},
	trustedOrigins: [
		"http://localhost:8787",
		"http://localhost:3000",
		"http://localhost:8081", // Expo dev server
		"http://10.0.2.2:8787",  // Android emulator
		"http://127.0.0.1:8787",
		// Expo/React Native deep links
		"exp://",
		"exp://*",
		"exp://192.168.*.*:*",
		"sitelink://", // Production app scheme
	],
	advanced: {
		// Disable CSRF check for mobile apps (React Native doesn't send Origin headers)
		// CSRF protection is primarily for browser-based attacks
		disableCSRFCheck: true,
	},
} satisfies Parameters<typeof betterAuth>[0]

export const auth = betterAuth({
	...betterAuthConfig,
	plugins: [
		apiKey(),
		magicLink(magicLinkOptions),
		organization(organizationOptions),
		openAPI(),
	],
	databaseHooks: {
		user: {
			create: {
				after: async (user, ctx) => {
					// Auto-create a personal organization for new users
					// This ensures all users have an organization, regardless of signup method
					const orgName = user.name ? `${user.name}'s Organization` : "My Organization"
					const orgSlug = orgName
						.toLowerCase()
						.trim()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-|-$/g, "")

					try {
						console.log(`[Better Auth] Creating organization for new user: ${user.email}`)

						// Query to check if organization already exists
						const existingOrgs = await ctx.adapter.findMany({
							model: "member",
							where: [
								{
									field: "userId",
									value: user.id,
								},
							],
						})

						if (existingOrgs.length === 0) {
							await auth.api.createOrganization({
								body: {
									userId: user.id,
									name: orgName,
									slug: orgSlug,
								},
							})
							console.log(`[Better Auth] Organization created: ${orgName}`)
						} else {
							console.log(`[Better Auth] User already has organization memberships`)
						}
					} catch (error) {
						console.error("[Better Auth] Failed to auto-create organization:", error)
					}
				},
			},
		},
		session: {
			create: {
				before: async (session, ctx) => {
					// Set the user's first organization as active if not already set
					if (!session.activeOrganizationId) {
						try {
							console.log(`[Better Auth] Setting active organization for session: ${session.userId}`)

							// Query member table to find user's organizations
							const memberships = await ctx.adapter.findMany({
								model: "member",
								where: [
									{
										field: "userId",
										value: session.userId,
									},
								],
							})

							if (memberships.length > 0) {
								const firstOrgId = memberships[0].organizationId
								console.log(`[Better Auth] Setting activeOrganizationId: ${firstOrgId}`)
								return {
									data: {
										...session,
										activeOrganizationId: firstOrgId,
									},
								}
							} else {
								console.log(`[Better Auth] No organization memberships found for user`)
							}
						} catch (error) {
							console.error("[Better Auth] Failed to set active organization:", error)
						}
					}

					return { data: session }
				},
			},
		},
	},
})

export type BetterAuthSession = typeof auth.$Infer.Session
