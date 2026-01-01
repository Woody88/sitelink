/**
 * Local file caching for high-res sheet images using expo-file-system
 *
 * Stores sheet images in the cache directory for offline viewing.
 * Pattern: {cacheDirectory}/sheets/{sheetId}/high-res.jpg
 */
import * as FileSystem from "expo-file-system"
import { Effect, Data } from "effect"

/**
 * Cache Error Types
 */
export class CacheDownloadError extends Data.TaggedError("CacheDownloadError")<{
	message: string
	sheetId: string
	url: string
}> {}

export class CacheReadError extends Data.TaggedError("CacheReadError")<{
	message: string
	sheetId: string
}> {}

export class CacheWriteError extends Data.TaggedError("CacheWriteError")<{
	message: string
	sheetId: string
}> {}

export class CacheDeleteError extends Data.TaggedError("CacheDeleteError")<{
	message: string
	sheetId: string
}> {}

export type CacheErrorType =
	| CacheDownloadError
	| CacheReadError
	| CacheWriteError
	| CacheDeleteError

/**
 * Download progress callback
 */
export type DownloadProgressCallback = (progress: {
	totalBytesWritten: number
	totalBytesExpectedToWrite: number
	percentComplete: number
}) => void

/**
 * Cache statistics
 */
export interface CacheStats {
	totalFiles: number
	totalBytes: number
	sheets: Array<{
		sheetId: string
		path: string
		size: number
	}>
}

/**
 * Get the cache directory path for sheets
 */
const getCacheDir = (): string => {
	if (!FileSystem.cacheDirectory) {
		throw new Error("FileSystem.cacheDirectory is not available")
	}
	return `${FileSystem.cacheDirectory}sheets/`
}

/**
 * Get the local path for a sheet's cached image
 */
const getSheetPath = (sheetId: string): string => {
	return `${getCacheDir()}${sheetId}/high-res.jpg`
}

/**
 * Get the directory for a sheet
 */
const getSheetDir = (sheetId: string): string => {
	return `${getCacheDir()}${sheetId}/`
}

/**
 * Ensure the cache directory exists
 */
const ensureCacheDir = (): Effect.Effect<void, CacheWriteError> =>
	Effect.gen(function* () {
		const cacheDir = getCacheDir()

		const dirInfo = yield* Effect.tryPromise({
			try: () => FileSystem.getInfoAsync(cacheDir),
			catch: (error) =>
				new CacheWriteError({
					message: error instanceof Error ? error.message : "Failed to check cache directory",
					sheetId: "",
				}),
		})

		if (!dirInfo.exists) {
			yield* Effect.tryPromise({
				try: () => FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }),
				catch: (error) =>
					new CacheWriteError({
						message: error instanceof Error ? error.message : "Failed to create cache directory",
						sheetId: "",
					}),
			})
		}
	})

/**
 * Download and cache a sheet image with progress tracking
 */
export const downloadSheet = (
	sheetId: string,
	imageUrl: string,
	onProgress?: DownloadProgressCallback
): Effect.Effect<string, CacheDownloadError> =>
	Effect.gen(function* () {
		// Ensure cache directory exists
		yield* ensureCacheDir().pipe(
			Effect.mapError(
				(error) =>
					new CacheDownloadError({
						message: error.message,
						sheetId,
						url: imageUrl,
					})
			)
		)

		const sheetDir = getSheetDir(sheetId)
		const localPath = getSheetPath(sheetId)

		// Create sheet directory
		yield* Effect.tryPromise({
			try: () => FileSystem.makeDirectoryAsync(sheetDir, { intermediates: true }),
			catch: (error) =>
				new CacheDownloadError({
					message: error instanceof Error ? error.message : "Failed to create sheet directory",
					sheetId,
					url: imageUrl,
				}),
		})

		// Create download resumable for progress tracking
		const downloadResumable = FileSystem.createDownloadResumable(
			imageUrl,
			localPath,
			{},
			onProgress
				? (downloadProgress) => {
						const percentComplete =
							downloadProgress.totalBytesExpectedToWrite > 0
								? (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
								: 0

						onProgress({
							totalBytesWritten: downloadProgress.totalBytesWritten,
							totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
							percentComplete,
						})
				  }
				: undefined
		)

		// Download with retry logic (3 attempts)
		let lastError: Error | undefined
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const result = yield* Effect.tryPromise({
					try: () => downloadResumable.downloadAsync(),
					catch: (error) => error as Error,
				})

				if (result && result.uri) {
					return result.uri
				}
			} catch (error) {
				lastError = error as Error
				// Exponential backoff: 1s, 2s, 4s
				if (attempt < 3) {
					yield* Effect.sleep(`${Math.pow(2, attempt - 1)} seconds`)
				}
			}
		}

		// All attempts failed, clean up partial download
		yield* Effect.tryPromise({
			try: async () => {
				const fileInfo = await FileSystem.getInfoAsync(localPath)
				if (fileInfo.exists) {
					await FileSystem.deleteAsync(localPath, { idempotent: true })
				}
			},
			catch: () => undefined, // Ignore cleanup errors
		})

		return yield* new CacheDownloadError({
			message: lastError?.message || "Failed to download after 3 attempts",
			sheetId,
			url: imageUrl,
		})
	})

/**
 * Get local path if cached, null otherwise
 */
export const getLocalPath = (
	sheetId: string
): Effect.Effect<string | null, CacheReadError> =>
	Effect.gen(function* () {
		const localPath = getSheetPath(sheetId)

		const fileInfo = yield* Effect.tryPromise({
			try: () => FileSystem.getInfoAsync(localPath),
			catch: (error) =>
				new CacheReadError({
					message: error instanceof Error ? error.message : "Failed to check file",
					sheetId,
				}),
		})

		if (fileInfo.exists && fileInfo.isDirectory === false) {
			return localPath
		}

		return null
	})

/**
 * Check if sheet is cached
 */
export const isCached = (sheetId: string): Effect.Effect<boolean, CacheReadError> =>
	Effect.gen(function* () {
		const localPath = yield* getLocalPath(sheetId)
		return localPath !== null
	})

/**
 * Delete a specific sheet from cache
 */
export const deleteSheet = (
	sheetId: string
): Effect.Effect<void, CacheDeleteError> =>
	Effect.gen(function* () {
		const sheetDir = getSheetDir(sheetId)

		const dirInfo = yield* Effect.tryPromise({
			try: () => FileSystem.getInfoAsync(sheetDir),
			catch: (error) =>
				new CacheDeleteError({
					message: error instanceof Error ? error.message : "Failed to check sheet directory",
					sheetId,
				}),
		})

		if (dirInfo.exists) {
			yield* Effect.tryPromise({
				try: () => FileSystem.deleteAsync(sheetDir, { idempotent: true }),
				catch: (error) =>
					new CacheDeleteError({
						message: error instanceof Error ? error.message : "Failed to delete sheet",
						sheetId,
					}),
			})
		}
	})

/**
 * Get total cache size in bytes
 */
export const getCacheSize = (): Effect.Effect<number, CacheReadError> =>
	Effect.gen(function* () {
		const cacheDir = getCacheDir()

		const dirInfo = yield* Effect.tryPromise({
			try: () => FileSystem.getInfoAsync(cacheDir),
			catch: (error) =>
				new CacheReadError({
					message: error instanceof Error ? error.message : "Failed to check cache directory",
					sheetId: "",
				}),
		})

		if (!dirInfo.exists) {
			return 0
		}

		// Read all sheet directories
		const sheetDirs = yield* Effect.tryPromise({
			try: () => FileSystem.readDirectoryAsync(cacheDir),
			catch: (error) =>
				new CacheReadError({
					message: error instanceof Error ? error.message : "Failed to read cache directory",
					sheetId: "",
				}),
		})

		let totalSize = 0

		// Calculate size for each sheet
		for (const sheetId of sheetDirs) {
			const localPath = getSheetPath(sheetId)
			const fileInfo = yield* Effect.tryPromise({
				try: () => FileSystem.getInfoAsync(localPath),
				catch: () => ({ exists: false, size: 0 }) as FileSystem.FileInfo,
			})

			if (fileInfo.exists && fileInfo.size) {
				totalSize += fileInfo.size
			}
		}

		return totalSize
	})

/**
 * Get detailed cache statistics
 */
export const getCacheStats = (): Effect.Effect<CacheStats, CacheReadError> =>
	Effect.gen(function* () {
		const cacheDir = getCacheDir()

		const dirInfo = yield* Effect.tryPromise({
			try: () => FileSystem.getInfoAsync(cacheDir),
			catch: (error) =>
				new CacheReadError({
					message: error instanceof Error ? error.message : "Failed to check cache directory",
					sheetId: "",
				}),
		})

		if (!dirInfo.exists) {
			return {
				totalFiles: 0,
				totalBytes: 0,
				sheets: [],
			}
		}

		// Read all sheet directories
		const sheetDirs = yield* Effect.tryPromise({
			try: () => FileSystem.readDirectoryAsync(cacheDir),
			catch: (error) =>
				new CacheReadError({
					message: error instanceof Error ? error.message : "Failed to read cache directory",
					sheetId: "",
				}),
		})

		let totalBytes = 0
		const sheets: CacheStats["sheets"] = []

		// Collect stats for each sheet
		for (const sheetId of sheetDirs) {
			const localPath = getSheetPath(sheetId)
			const fileInfo = yield* Effect.tryPromise({
				try: () => FileSystem.getInfoAsync(localPath),
				catch: () => ({ exists: false, size: 0 }) as FileSystem.FileInfo,
			})

			if (fileInfo.exists && fileInfo.size) {
				totalBytes += fileInfo.size
				sheets.push({
					sheetId,
					path: localPath,
					size: fileInfo.size,
				})
			}
		}

		return {
			totalFiles: sheets.length,
			totalBytes,
			sheets,
		}
	})

/**
 * Clear all cached sheets
 */
export const clearAll = (): Effect.Effect<void, CacheDeleteError> =>
	Effect.gen(function* () {
		const cacheDir = getCacheDir()

		const dirInfo = yield* Effect.tryPromise({
			try: () => FileSystem.getInfoAsync(cacheDir),
			catch: (error) =>
				new CacheDeleteError({
					message: error instanceof Error ? error.message : "Failed to check cache directory",
					sheetId: "",
				}),
		})

		if (dirInfo.exists) {
			yield* Effect.tryPromise({
				try: () => FileSystem.deleteAsync(cacheDir, { idempotent: true }),
				catch: (error) =>
					new CacheDeleteError({
						message: error instanceof Error ? error.message : "Failed to clear cache",
						sheetId: "",
					}),
			})
		}
	})

/**
 * SheetCache API (Effect-based)
 */
export const SheetCache = {
	downloadSheet,
	getLocalPath,
	isCached,
	deleteSheet,
	getCacheSize,
	getCacheStats,
	clearAll,
} as const
