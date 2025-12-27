import { Schema } from "effect"

/**
 * Date as ISO string for JSON serialization
 */
const DateFromString = Schema.transform(
	Schema.String,
	Schema.DateFromSelf,
	{
		strict: true,
		decode: (s) => new Date(s),
		encode: (d) => d.toISOString(),
	}
)

/**
 * Plan Request/Response Schemas
 */
export const UpdatePlanRequest = Schema.Struct({
	name: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
})
export type UpdatePlanRequest = typeof UpdatePlanRequest.Type

export const PlanResponse = Schema.Struct({
	id: Schema.String,
	projectId: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	directoryPath: Schema.NullOr(Schema.String),
	processingStatus: Schema.NullOr(Schema.String),
	tileMetadata: Schema.NullOr(Schema.String),
	createdAt: DateFromString,
})
export type PlanResponse = typeof PlanResponse.Type

export const PlanListItem = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	directoryPath: Schema.NullOr(Schema.String),
	processingStatus: Schema.NullOr(Schema.String),
	tileMetadata: Schema.NullOr(Schema.String),
	createdAt: DateFromString,
})
export type PlanListItem = typeof PlanListItem.Type

export const PlanListResponse = Schema.Struct({
	plans: Schema.Array(PlanListItem),
})
export type PlanListResponse = typeof PlanListResponse.Type

export const CreatePlanResponse = Schema.Struct({
	planId: Schema.String,
	fileId: Schema.String,
	uploadId: Schema.String,
	filePath: Schema.String,
	jobId: Schema.String,
})
export type CreatePlanResponse = typeof CreatePlanResponse.Type
