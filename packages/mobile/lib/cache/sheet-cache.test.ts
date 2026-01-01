/**
 * Tests for SheetCache service
 *
 * NOTE: These tests require a React Native environment with expo-file-system.
 * They will not work in a Node.js environment.
 */
import { describe, it, expect, beforeEach } from "bun:test"
import { SheetCacheAsync } from "./sheet-cache-async"

// Mock test data
const TEST_SHEET_ID = "test-sheet-123"
const TEST_IMAGE_URL = "https://picsum.photos/4000/3000" // Random image for testing

describe("SheetCache", () => {
	beforeEach(async () => {
		// Clean up before each test
		try {
			await SheetCacheAsync.clearAll()
		} catch (error) {
			// Ignore errors if cache doesn't exist
		}
	})

	it("should check if sheet is not cached initially", async () => {
		const cached = await SheetCacheAsync.isCached(TEST_SHEET_ID)
		expect(cached).toBe(false)
	})

	it("should return null for uncached sheet", async () => {
		const path = await SheetCacheAsync.getLocalPath(TEST_SHEET_ID)
		expect(path).toBeNull()
	})

	it("should download and cache a sheet", async () => {
		let progressCalled = false

		const path = await SheetCacheAsync.downloadSheet(
			TEST_SHEET_ID,
			TEST_IMAGE_URL,
			(progress) => {
				progressCalled = true
				expect(progress.percentComplete).toBeGreaterThanOrEqual(0)
				expect(progress.percentComplete).toBeLessThanOrEqual(100)
			}
		)

		expect(path).toBeDefined()
		expect(path).toContain(TEST_SHEET_ID)
		expect(path).toContain("high-res.jpg")
		expect(progressCalled).toBe(true)
	}, 30000) // 30 second timeout for download

	it("should check if sheet is cached after download", async () => {
		await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		const cached = await SheetCacheAsync.isCached(TEST_SHEET_ID)
		expect(cached).toBe(true)
	}, 30000)

	it("should get local path for cached sheet", async () => {
		await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		const path = await SheetCacheAsync.getLocalPath(TEST_SHEET_ID)
		expect(path).toBeDefined()
		expect(path).toContain(TEST_SHEET_ID)
	}, 30000)

	it("should get cache size", async () => {
		await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		const size = await SheetCacheAsync.getCacheSize()
		expect(size).toBeGreaterThan(0)
	}, 30000)

	it("should get cache stats", async () => {
		await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		const stats = await SheetCacheAsync.getCacheStats()
		expect(stats.totalFiles).toBe(1)
		expect(stats.totalBytes).toBeGreaterThan(0)
		expect(stats.sheets).toHaveLength(1)
		expect(stats.sheets[0].sheetId).toBe(TEST_SHEET_ID)
	}, 30000)

	it("should delete a specific sheet", async () => {
		await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		await SheetCacheAsync.deleteSheet(TEST_SHEET_ID)

		const cached = await SheetCacheAsync.isCached(TEST_SHEET_ID)
		expect(cached).toBe(false)
	}, 30000)

	it("should clear all cached sheets", async () => {
		await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)
		await SheetCacheAsync.downloadSheet("test-sheet-456", TEST_IMAGE_URL)

		await SheetCacheAsync.clearAll()

		const stats = await SheetCacheAsync.getCacheStats()
		expect(stats.totalFiles).toBe(0)
		expect(stats.totalBytes).toBe(0)
	}, 60000)

	it("should handle download errors gracefully", async () => {
		const invalidUrl = "https://invalid-url-that-does-not-exist.com/image.jpg"

		await expect(
			SheetCacheAsync.downloadSheet(TEST_SHEET_ID, invalidUrl)
		).rejects.toThrow()
	}, 30000)

	it("should handle multiple downloads of same sheet", async () => {
		// First download
		const path1 = await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		// Second download (should overwrite)
		const path2 = await SheetCacheAsync.downloadSheet(TEST_SHEET_ID, TEST_IMAGE_URL)

		expect(path1).toBe(path2)

		// Should still have only one file
		const stats = await SheetCacheAsync.getCacheStats()
		expect(stats.totalFiles).toBe(1)
	}, 60000)
})
