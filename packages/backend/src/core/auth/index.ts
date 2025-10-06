import * as Respondable from "@effect/platform/HttpServerRespondable"
import * as ServerResponse from "@effect/platform/HttpServerResponse"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink, openAPI, organization } from "better-auth/plugins"
import { Effect, Schema } from "effect"
import { DatabaseService } from "../database"
import { EmailService } from "../email"
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
	dependencies: [DatabaseService.Default, EmailService.Default],
	effect: Effect.gen(function* () {
		const database = yield* DatabaseService
		const email = yield* EmailService

		const _auth = yield* database.use((db) =>
			Promise.resolve(
				betterAuth({
					...betterAuthConfig,
					plugins: [
						openAPI(),
						magicLink({
							...magicLinkOptions,
							sendMagicLink: async ({ email: recipient, url }, _request) =>
								Effect.gen(function* () {
									yield* email.send({
										from: "delivered@resend.dev",
										to: recipient,
										subject: "Test Email",
										html: `
                      <h1>Sign in to Sitelink</h1>
                      <p><a href="${url}">Click here to sign in</a></p>
                      <p>This link expires in 5 minutes.</p>
                    `,
									})
								}).pipe(Effect.runPromise),
						}),

						organization({
							...organizationOptions,
						}),
					],
				}),
			),
		)

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
