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
 * Project Request/Response Schemas
 */
export const CreateProjectRequest = Schema.Struct({
	name: Schema.String,
	description: Schema.optional(Schema.String),
})
export type CreateProjectRequest = typeof CreateProjectRequest.Type

export const UpdateProjectRequest = Schema.Struct({
	name: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
})
export type UpdateProjectRequest = typeof UpdateProjectRequest.Type

export const ProjectResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	organizationId: Schema.String,
	createdAt: DateFromString,
})
export type ProjectResponse = typeof ProjectResponse.Type

export const ProjectListItem = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	createdAt: DateFromString,
})
export type ProjectListItem = typeof ProjectListItem.Type

export const ProjectListResponse = Schema.Struct({
	projects: Schema.Array(ProjectListItem),
})
export type ProjectListResponse = typeof ProjectListResponse.Type

export const CreateProjectResponse = Schema.Struct({
	projectId: Schema.String,
})
export type CreateProjectResponse = typeof CreateProjectResponse.Type

export const SuccessResponse = Schema.Struct({
	success: Schema.Literal(true),
})
export type SuccessResponse = typeof SuccessResponse.Type
