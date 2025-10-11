import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
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
		},
	),
	emailAndPassword: {
		enabled: false,
	},
} satisfies Parameters<typeof betterAuth>[0]

export const auth = betterAuth({
	...betterAuthConfig,
	plugins: [
		magicLink(magicLinkOptions),
		organization(organizationOptions),
		openAPI(),
	],
})

export type BetterAuthSession = typeof auth.$Infer.Session
