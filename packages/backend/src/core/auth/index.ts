import * as Respondable from "@effect/platform/HttpServerRespondable"
import * as ServerResponse from "@effect/platform/HttpServerResponse"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink, openAPI, organization } from "better-auth/plugins"
import { Config, Effect, Runtime, Schema } from "effect"
import { DatabaseService, Drizzle } from "../database"
import { EmailService } from "../email"
import {
	betterAuthConfig,
	magicLinkOptions,
	organizationOptions,
} from "./config"
import {SqliteDrizzle} from "@effect/sql-drizzle/Sqlite"

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
	dependencies: [Drizzle.Default, EmailService.Default],
	effect: Effect.gen(function* () {
		const EMAIL_ADDRESS = yield* Config.string("EMAIL_ADDRESS")
		const email = yield* EmailService
		const db = yield* Drizzle

		const runtime = yield* Effect.runtime<EmailService>()


    const _auth = betterAuth({
      ...betterAuthConfig,
      database: drizzleAdapter(db, {
        provider: "sqlite",
        usePlural: true
      }),

      plugins: [
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

            Runtime.runPromise(runtime, program)
          },
        }),

        organization({
          ...organizationOptions,
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
