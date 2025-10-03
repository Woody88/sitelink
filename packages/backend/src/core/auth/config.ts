import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"

export const auth = betterAuth({
	database: drizzleAdapter(
		{},
		{
			provider: "sqlite",
			usePlural: true,
		},
	),
	plugins: [
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
