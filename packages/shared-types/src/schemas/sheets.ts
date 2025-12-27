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
 * Sheet Response Schemas
 */
export const SheetResponse = Schema.Struct({
	id: Schema.String,
	planId: Schema.String,
	pageNumber: Schema.Number,
	sheetName: Schema.NullOr(Schema.String),
	dziPath: Schema.String,
	tileDirectory: Schema.String,
	width: Schema.NullOr(Schema.Number),
	height: Schema.NullOr(Schema.Number),
	tileCount: Schema.NullOr(Schema.Number),
	markerCount: Schema.Number,
	processingStatus: Schema.String,
	createdAt: DateFromString,
})
export type SheetResponse = typeof SheetResponse.Type

export const SheetListResponse = Schema.Struct({
	sheets: Schema.Array(SheetResponse),
})
export type SheetListResponse = typeof SheetListResponse.Type
