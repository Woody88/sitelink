import { Schema } from "effect"

/**
 * Date as ISO string for JSON serialization (nullable)
 */
const NullableDateFromString = Schema.NullOr(
	Schema.transform(
		Schema.String,
		Schema.DateFromSelf,
		{
			strict: true,
			decode: (s) => new Date(s),
			encode: (d) => d.toISOString(),
		}
	)
)

/**
 * Job Status Response Schema
 */
export const JobStatusResponse = Schema.Struct({
	id: Schema.String,
	status: Schema.String,
	progress: Schema.NullOr(Schema.Number),
	totalPages: Schema.NullOr(Schema.Number),
	completedPages: Schema.NullOr(Schema.Number),
	failedPages: Schema.NullOr(Schema.String),
	startedAt: NullableDateFromString,
	completedAt: NullableDateFromString,
	lastError: Schema.NullOr(Schema.String),
	plan: Schema.Struct({
		id: Schema.String,
		name: Schema.String,
	}),
	projectId: Schema.String,
	organizationId: Schema.String,
})
export type JobStatusResponse = typeof JobStatusResponse.Type

/**
 * Processing status values
 */
export type ProcessingStatus =
	| "pending"
	| "processing"
	| "completed"
	| "failed"
