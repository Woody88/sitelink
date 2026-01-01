/**
 * Async/await wrapper for SheetCache (for easier use in React components)
 *
 * This provides a simpler API for components that don't need Effect-TS.
 * Use the Effect-based API from sheet-cache.ts for more advanced scenarios.
 */
import { Effect } from "effect"
import * as SheetCacheEffect from "./sheet-cache"
import type { DownloadProgressCallback, CacheStats } from "./sheet-cache"

/**
 * Download and cache a sheet image
 *
 * @param sheetId - Unique identifier for the sheet
 * @param imageUrl - URL to download the image from
 * @param onProgress - Optional callback for download progress
 * @returns Local file path to the cached image
 * @throws Error if download fails after retries
 */
export const downloadSheet = async (
	sheetId: string,
	imageUrl: string,
	onProgress?: DownloadProgressCallback
): Promise<string> => {
	const effect = SheetCacheEffect.downloadSheet(sheetId, imageUrl, onProgress)
	return Effect.runPromise(effect)
}

/**
 * Get local path if cached, null otherwise
 *
 * @param sheetId - Unique identifier for the sheet
 * @returns Local file path if cached, null otherwise
 */
export const getLocalPath = async (sheetId: string): Promise<string | null> => {
	const effect = SheetCacheEffect.getLocalPath(sheetId)
	return Effect.runPromise(effect)
}

/**
 * Check if sheet is cached
 *
 * @param sheetId - Unique identifier for the sheet
 * @returns True if sheet is cached, false otherwise
 */
export const isCached = async (sheetId: string): Promise<boolean> => {
	const effect = SheetCacheEffect.isCached(sheetId)
	return Effect.runPromise(effect)
}

/**
 * Delete a specific sheet from cache
 *
 * @param sheetId - Unique identifier for the sheet
 */
export const deleteSheet = async (sheetId: string): Promise<void> => {
	const effect = SheetCacheEffect.deleteSheet(sheetId)
	return Effect.runPromise(effect)
}

/**
 * Get total cache size in bytes
 *
 * @returns Total size of all cached sheets in bytes
 */
export const getCacheSize = async (): Promise<number> => {
	const effect = SheetCacheEffect.getCacheSize()
	return Effect.runPromise(effect)
}

/**
 * Get detailed cache statistics
 *
 * @returns Cache statistics including total files, bytes, and per-sheet info
 */
export const getCacheStats = async (): Promise<CacheStats> => {
	const effect = SheetCacheEffect.getCacheStats()
	return Effect.runPromise(effect)
}

/**
 * Clear all cached sheets
 */
export const clearAll = async (): Promise<void> => {
	const effect = SheetCacheEffect.clearAll()
	return Effect.runPromise(effect)
}

/**
 * SheetCache API (async/await)
 *
 * Use this in React components for simpler code.
 * For more advanced error handling, use the Effect-based API from sheet-cache.ts
 */
export const SheetCacheAsync = {
	downloadSheet,
	getLocalPath,
	isCached,
	deleteSheet,
	getCacheSize,
	getCacheStats,
	clearAll,
} as const

// Re-export types
export type { DownloadProgressCallback, CacheStats } from "./sheet-cache"
