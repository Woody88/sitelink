import {
	HttpApiBuilder,
	HttpApiEndpoint,
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
	.prefix("/organization")

export const HealthApiLive = HttpApiBuilder.group(
	BaseApi.add(OrganizationAPI),
	"Organization",
	(handlers) =>
		Effect.gen(function* () {
			const orgService = yield* OrganizationService

			return handlers.handle("deleteOrganization", ({ path: { orgId } }) =>
				Effect.gen(function* () {
					yield* orgService.softDeleted(orgId)
				}),
			)
		}),
)
