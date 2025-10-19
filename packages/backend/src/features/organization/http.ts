import {
	HttpApiBuilder,
	HttpApiEndpoint,
	HttpApiError,
	HttpApiGroup,
	HttpApiSchema,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { BaseApi } from "../../core/api"
import { OrganizationService } from "../../core/organization/service"

const orgIdParam = HttpApiSchema.param("orgId", Schema.String)

export const OrganizationAPI = HttpApiGroup.make("Organization")
	.add(
		HttpApiEndpoint.del("deleteOrganization")`/${orgIdParam}`.addSuccess(
			Schema.Void,
		),
	)
	.addError(HttpApiError.InternalServerError)
	.prefix("/organization")

export const OrganizationApiLive = HttpApiBuilder.group(
	BaseApi.add(OrganizationAPI),
	"Organization",
	(handlers) =>
		Effect.gen(function* () {
			const orgService = yield* OrganizationService

			return handlers.handle("deleteOrganization", ({ path: { orgId } }) =>
				orgService.softDeleted(orgId).pipe(
					Effect.asVoid,
					Effect.mapError(() => new HttpApiError.InternalServerError()),
				),
			)
		}),
)
