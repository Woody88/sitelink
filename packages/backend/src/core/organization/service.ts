import { HttpApiSchema } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../database"
import * as schema from "../database/schemas"

export type Role = typeof Role.Type
export const Role = Schema.Union(
	Schema.Literal("owner"),
	Schema.Literal("admin"),
	Schema.Literal("member"),
)

// Custom error classes for specific business rule violations
export class SeatLimitReachedError extends Schema.TaggedError<SeatLimitReachedError>(
	"SeatLimitReachedError",
)("SeatLimitReachedError", {
	message: Schema.String,
	organizationId: Schema.String,
	currentSeats: Schema.Number,
	maxSeats: Schema.Number,
}) {}

export class OrganizationDeletedError extends Schema.TaggedError<OrganizationDeletedError>(
	"OrganizationDeletedError",
)(
	"OrganizationDeletedError",
	{
		message: Schema.String,
		organizationId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Organization has been deleted",
	}),
) {}

export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>(
	"OrganizationNotFoundError",
)(
	"OrganizationNotFoundError",
	{
		message: Schema.String,
		organizationId: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 404,
		description: "Organization not found",
	}),
) {}

export class OrganizationService extends Effect.Service<OrganizationService>()(
	"OrganizationService",
	{
		dependencies: [Drizzle.Default],
		effect: Effect.gen(function* () {
			const db = yield* Drizzle

			/**
			 * Ensures an organization can add a new member based on seat limits.
			 * Fails with SeatLimitReachedError if the limit is exceeded.
			 */
			const ensureCanAddMember = Effect.fn(
				"OrganizationService.ensureCanAddMember",
			)(function* (orgId: string) {
				console.log("[ensureCanAddMember] Checking org:", orgId)

				const getSeatLimits = Effect.gen(function* () {
					// Use select() instead of query API to ensure column mapping works
					const [subscription] = yield* db
						.select({
							plan: schema.subscriptions.plan,
							seats: schema.subscriptions.seats,
							status: schema.subscriptions.status,
						})
						.from(schema.subscriptions)
						.where(eq(schema.subscriptions.organizationId, orgId))
						.limit(1)

					console.log("[ensureCanAddMember] Found subscription:", subscription)

					if (!subscription) {
						console.log("[ensureCanAddMember] No subscription, defaulting to 1 seat")
						return { maxSeats: 1, currentSeats: 0 }
					}

					if (subscription.status !== "active") {
						console.log(
							"[ensureCanAddMember] Inactive subscription, defaulting to 1 seat",
						)
						return { maxSeats: 1, currentSeats: 0 }
					}

					const currentSeats = yield* Effect.promise(() =>
						db.$count(schema.members, eq(schema.members.organizationId, orgId)),
					)

					console.log(
						"[ensureCanAddMember] Seats:",
						currentSeats,
						"/",
						subscription.seats,
					)

					return { maxSeats: subscription.seats, currentSeats }
				})

				const { maxSeats, currentSeats } = yield* getSeatLimits
				const canAdd = currentSeats < maxSeats

				console.log(
					"[ensureCanAddMember] canAdd:",
					canAdd,
					"(current:",
					currentSeats,
					"max:",
					maxSeats,
					")",
				)

				return yield* Effect.filterOrFail(
					Effect.succeed({ canAdd, maxSeats, currentSeats }),
					(data) => data.canAdd,
					(data) =>
						new SeatLimitReachedError({
							message: `Organization has reached its seat limit of ${data.maxSeats}`,
							organizationId: orgId,
							currentSeats: data.currentSeats,
							maxSeats: data.maxSeats,
						}),
				)
			})

			/**
			 * Ensures an organization is not soft-deleted.
			 * Fails with OrganizationDeletedError if deletedAt is set.
			 */
			const ensureNotDeleted = Effect.fn(
				"OrganizationService.ensureNotDeleted",
			)(function* (orgId: string) {
				// Query for the organization's deleted_at column directly
				const [result] = yield* db
					.select({ deletedAt: schema.organizations.deletedAt })
					.from(schema.organizations)
					.where(eq(schema.organizations.id, orgId))
					.limit(1)

				if (!result) {
					return yield* new OrganizationNotFoundError({
						message: `Organization not found: ${orgId}`,
						organizationId: orgId,
					})
				}

				// deletedAt should be null/undefined for non-deleted organizations
				// Allow null, undefined, or any falsy value
				const notDeleted = !result.deletedAt

				return yield* Effect.filterOrFail(
					Effect.succeed(notDeleted),
					(isNotDeleted) => isNotDeleted,
					() =>
						new OrganizationDeletedError({
							message: `Organization ${orgId} has been deleted and cannot be modified`,
							organizationId: orgId,
						}),
				)
			})

			/**
			 * Soft-deletes an organization by setting the deletedAt timestamp.
			 * Organizations can be restored within 30 days.
			 */
			const softDeleted = Effect.fn("OrganizationService.softDeleted")(
				function* (orgId: string) {
					// TODO: Schedule a queued job for 30-day hard delete
					return yield* db
						.update(schema.organizations)
						.set({ deletedAt: new Date() })
						.where(eq(schema.organizations.id, orgId))
				},
			)

			/**
			 * Restores a soft-deleted organization by clearing the deletedAt timestamp.
			 */
			const restore = Effect.fn("OrganizationService.restore")(function* (
				orgId: string,
			) {
				// TODO: Cancel the scheduled hard delete job
				return yield* db
					.update(schema.organizations)
					.set({ deletedAt: null })
					.where(eq(schema.organizations.id, orgId))
			})

			/**
			 * Hard-deletes an organization and all related data (cascade).
			 * This is irreversible and should only be called after the 30-day grace period.
			 */
			const hardDelete = Effect.fn("OrganizationService.hardDelete")(function* (
				orgId: string,
			) {
				return yield* db
					.delete(schema.organizations)
					.where(eq(schema.organizations.id, orgId))
			})

			return {
				ensureCanAddMember,
				ensureNotDeleted,
				softDeleted,
				restore,
				hardDelete,
			} as const
		}),
	},
) {}
