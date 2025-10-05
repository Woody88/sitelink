import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink, organization } from "better-auth/plugins"

export const auth = betterAuth({
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
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, token, url }, request) => {},
		}),
		organization({
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
		}),
	],
})
