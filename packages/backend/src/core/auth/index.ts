import * as Respondable from "@effect/platform/HttpServerRespondable"
import * as ServerResponse from "@effect/platform/HttpServerResponse"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey, magicLink, openAPI, organization } from "better-auth/plugins"
import { Config, Effect, Runtime, Schema } from "effect"
import { Drizzle } from "../database"
import { EmailService } from "../email"
import { OrganizationService } from "../organization/service"
import {
	betterAuthConfig,
	magicLinkOptions,
	organizationOptions,
} from "./config"

export class AuthError extends Schema.TaggedError<AuthError>("AuthError")(
	"AuthError",
	{
		cause: Schema.Defect,
	},
) {
	[Respondable.symbol]() {
		return ServerResponse.empty({ status: 500 })
	}
}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	dependencies: [
		Drizzle.Default,
		EmailService.Default,
		OrganizationService.Default,
	],
	effect: Effect.gen(function* () {
		const EMAIL_ADDRESS = yield* Config.string("EMAIL_ADDRESS")
		const email = yield* EmailService
		const db = yield* Drizzle
		const orgService = yield* OrganizationService

		const runtime = yield* Effect.runtime<EmailService | OrganizationService>()

		const _auth = betterAuth({
			...betterAuthConfig,
			database: drizzleAdapter(db, {
				provider: "sqlite",
				usePlural: true,
				camelCase: false,
			}),

			plugins: [
				apiKey(),
				openAPI(),
				magicLink({
					...magicLinkOptions,
					sendMagicLink: async ({ email: recipient, url }, _request) => {
						const program = email.send({
							from: EMAIL_ADDRESS,
							to: recipient,
							subject: "Test Email",
							html: `
                  <h1>Sign in to Sitelink</h1>
                  <p><a href="${url}">Click here to sign in</a></p>
                  <p>This link expires in 5 minutes.</p>
                `,
						})

						await Runtime.runPromise(runtime, program)
					},
				}),

				organization({
					...organizationOptions,
					disableOrganizationDeletion: true,
					organizationHooks: {
						beforeUpdateOrganization: async (data) => {
							console.log(
								"[Hook] beforeUpdateOrganization called for:",
								data.organization.id,
							)
							const program = orgService.ensureNotDeleted(data.organization.id)
							await Runtime.runPromise(runtime, program)
						},

						beforeDeleteOrganization: async (data) => {
							console.log(
								"[Hook] beforeDeleteOrganization called for:",
								data.organization.id,
							)
							const program = orgService.softDeleted(data.organization.id)
							await Runtime.runPromise(runtime, program)
						},

						beforeAddMember: async ({ organization }) => {
							console.log(
								"[Hook] beforeAddMember called for org:",
								organization.id,
							)
							const program = orgService.ensureCanAddMember(organization.id)

							await Runtime.runPromise(runtime, program)
						},

						beforeCreateInvitation: async (data) => {
							console.log(
								"[Hook] beforeCreateInvitation called for org:",
								data.organization.id,
							)
							const program = Effect.all([
								orgService.ensureNotDeleted(data.organization.id),
								orgService.ensureCanAddMember(data.organization.id),
							])

							await Runtime.runPromise(runtime, program)
						},
					},
				}),
			],
		})

		const use = Effect.fn("AuthService.use")(function* <A>(
			f: (auth: typeof _auth, signal: AbortSignal) => Promise<A>,
		) {
			return yield* Effect.tryPromise({
				try: (signal) => f(_auth, signal),
				catch: (cause) => new AuthError({ cause }),
			})
		})

		return {
			use,
		} as const
	}),
}) {}
