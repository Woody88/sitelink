import { Effect, Schema } from "effect"
import { AuthService } from "../../core/auth"

export class RegistrationQuery extends Schema.Class<RegistrationQuery>(
	"Registration",
)({
	name: Schema.String,
	image: Schema.optional(Schema.String),
	organizationName: Schema.String,
}) {}

export class RegistrationOutput extends Schema.Class<RegistrationOutput>(
	"RegistrationOutput",
)({
	organizationId: Schema.String,
}) {}

export class RegistrationError extends Schema.TaggedError<RegistrationError>(
	"RegistrationError",
)("RegistrationError", {
	cause: Schema.optional(Schema.Defect),
	message: Schema.String,
}) {}

export class RegistrationService extends Effect.Service<RegistrationService>()(
	"RegistrationService",
	{
		effect: Effect.gen(function* () {
			const authService = yield* AuthService

			const execute = Effect.fn("RegistrationService.run")(function* (
				userId: string,
				registration: RegistrationQuery,
			) {
				const organizationSlug = registration.organizationName
					.toLowerCase()
					.trim()
					.replace(" ", "-")
				const organization = yield* authService.use(async (auth) => {
					return await auth.api.createOrganization({
						body: {
							userId,
							name: registration.organizationName,
							slug: organizationSlug,
							keepCurrentActiveOrganization: true,
						},
					})
				})

				if (!organization) {
					return yield* new RegistrationError({
						message: "Registration could not be created",
					})
				}

				return new RegistrationOutput({
					organizationId: organization.id,
				})
			})
			return { execute } as const
		}),
	},
) {}
