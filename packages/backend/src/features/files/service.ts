import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { Drizzle } from "../../core/database"
import * as schema from "../../core/database/schemas"
import { StorageService } from "../../core/storage"

/**
 * File not found error
 */
export class FileNotFoundError extends Schema.TaggedError<FileNotFoundError>()(
	"FileNotFoundError",
	{
		fileId: Schema.String,
	},
) {}

/**
 * File Service - Manages construction plan files (PDFs)
 *
 * Two-tier pattern: D1 metadata + R2 storage
 * PDF processing deferred to Phase 2 (for now, just store original)
 */
export class FileService extends Effect.Service<FileService>()(
	"FileService",
	{
		dependencies: [Drizzle.Default, StorageService.Default],
		effect: Effect.gen(function* () {
			const db = yield* Drizzle
			const storage = yield* StorageService

			/**
			 * Build R2 storage path for plan file
			 */
			const buildFilePath = (params: {
				orgId: string
				projectId: string
				planId: string
				filename: string
			}) => {
				return `/orgs/${params.orgId}/projects/${params.projectId}/plans/${params.planId}/${params.filename}`
			}

			/**
			 * Upload a file to a plan
			 *
			 * Stores file in R2 and creates D1 metadata record
			 */
			const upload = Effect.fn("File.upload")(function* (params: {
				planId: string
				projectId: string
				orgId: string
				fileData: Uint8Array | ArrayBuffer
				fileName: string
				fileType: string
			}) {
				// Generate file ID
				const fileId = crypto.randomUUID()

				// Determine file extension and build storage path
				const ext = params.fileName.split(".").pop() || "pdf"
				const storageFileName = `original.${ext}`
				const filePath = buildFilePath({
					orgId: params.orgId,
					projectId: params.projectId,
					planId: params.planId,
					filename: storageFileName,
				})

				// Upload to R2 using StorageService
				yield* storage.use((r2) =>
					r2.put(filePath, params.fileData, {
						httpMetadata: { contentType: params.fileType },
					})
				)

				// Create D1 metadata record
				yield* db.use((db) =>
					db.insert(schema.files).values({
						id: fileId,
						planId: params.planId,
						filePath,
						fileType: params.fileType,
						createdAt: new Date(),
					}),
				)

				return { fileId, filePath }
			})

			/**
			 * Get file metadata by ID
			 */
			const get = Effect.fn("File.get")(function* (fileId: string) {
				const file = yield* db.use((db) =>
					db.select().from(schema.files).where(eq(schema.files.id, fileId)).get(),
				)

				return yield* Effect.filterOrFail(
					Effect.succeed(file),
					(f) => !!f,
					() => new FileNotFoundError({ fileId }),
				).pipe(
					Effect.map((f) => ({
						id: f.id,
						planId: f.planId,
						filePath: f.filePath,
						fileType: f.fileType,
						createdAt: f.createdAt,
					})),
				)
			})

			/**
			 * Download file data from R2
			 */
			const download = Effect.fn("File.download")(function* (fileId: string) {
				// Get file metadata to find R2 path
				const file = yield* get(fileId)

				if (!file.filePath) {
					return yield* Effect.fail(
						new Error(`File ${fileId} has no storage path`),
					)
				}

				// Download from R2 using StorageService
				const data = yield* storage.use(async (r2) => {
					const object = await r2.get(file.filePath!)

					if (!object) {
						throw new Error(`File not found in storage: ${file.filePath}`)
					}

					const arrayBuffer = await object.arrayBuffer()
					
					return { data: arrayBuffer, contentType: file.fileType }

				})
				

				return data
			})

			/**
			 * List all files for a plan
			 */
			const list = Effect.fn("File.list")(function* (fileId: string) {
				const fileList = yield* 
					db.select().from(schema.files).where(eq(schema.files.id, fileId))
			

				return fileList
			})

			/**
			 * Delete a file (from both D1 and R2)
			 */
			const deleteFile = Effect.fn("File.delete")(function* (fileId: string) {
				// Get file to verify it exists and get R2 path
				const file = yield* get(fileId)

				// Delete from R2 if path exists
				if (file.filePath) {
					yield* storage.use((r2) => r2.delete([file.filePath]))
				}

				// Delete from D1
				yield* db.delete(schema.files).where(eq(schema.files.id, fileId))
			})

			return {
				upload,
				get,
				download,
				list,
				delete: deleteFile,
			} as const
		}),
	},
) {}
