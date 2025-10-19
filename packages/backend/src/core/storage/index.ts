import { Effect, Schema } from "effect"
import { R2Binding } from "../bindings"

/**
 * Storage operation error
 */
export class StorageError extends Schema.TaggedError<StorageError>()(
	"StorageError",
	{
		message: Schema.String,
		cause: Schema.optional(Schema.Defect),
	},
) {}

/**
 * Storage Service - Provides access to R2 bucket with Effect error handling
 *
 * @example
 * const storage = yield* StorageService
 *
 * // Upload a file
 * const r2Object = yield* storage.use((r2) =>
 *   r2.put("/orgs/123/file.pdf", pdfData, {
 *     httpMetadata: { contentType: "application/pdf" }
 *   })
 * )
 *
 * // Download a file
 * const obj = yield* storage.use((r2) => r2.get("/orgs/123/file.pdf"))
 * if (obj) {
 *   const data = yield* Effect.promise(() => obj.arrayBuffer())
 * }
 *
 * // Batch delete
 * yield* storage.batchDelete(["/file1", "/file2", "/file3"])
 */
export class StorageService extends Effect.Service<StorageService>()(
	"StorageService",
	{
		effect: Effect.gen(function* () {
			const r2 = yield* R2Binding
			const use = Effect.fn("StorageService.use")(function* <A>(
				f: (bucket: R2Bucket, signal: AbortSignal) => Promise<A>,
			) {
				return yield* Effect.tryPromise({
					try: (signal) => f(r2, signal),
					catch: (cause) =>
						new StorageError({ message: "R2 operation failed", cause }),
				})
			})

			/**
			 * Delete multiple files in a single R2 operation
			 *
			 * R2 supports batch deletes natively - much more efficient than
			 * calling delete() multiple times.
			 *
			 * @example
			 * // Delete all tiles for a plan
			 * yield* storage.batchDelete([
			 *   "/orgs/123/plans/456/tiles/0/0_0.jpg",
			 *   "/orgs/123/plans/456/tiles/1/0_0.jpg",
			 *   "/orgs/123/plans/456/tiles/1/1_0.jpg",
			 * ])
			 */
			const batchDelete = Effect.fn("StorageService.batchDelete")(function* (
				keys: ReadonlyArray<string>,
			) {
				if (keys.length === 0) {
					return
				}

				return yield* use((r2) => r2.delete([...keys]))
			})

			return { use, batchDelete } as const
		}),
	},
) {}
