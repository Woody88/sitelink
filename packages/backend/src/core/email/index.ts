import { Effect, Schema } from "effect"
import { ResendBinding } from "../bindings"

export class EmailError extends Schema.TaggedError<EmailError>("EmailError")(
	"EmailError",
	{
		cause: Schema.Defect,
	},
) {}

export class EmailService extends Effect.Service<EmailService>()(
	"EmailService",
	{
		effect: Effect.gen(function* () {
			const resend = yield* ResendBinding

			const send = Effect.fn("EmailService.send")(function* (
				params: Parameters<typeof resend.emails.send>[0],
			) {
				return yield* Effect.tryPromise({
					try: () => resend.emails.send(params),
					catch: (cause) => new EmailError({ cause }),
				})
			})

			return { send } as const
		}),
	},
) {}
