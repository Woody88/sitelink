/**
 * Usage Examples for SheetCache
 *
 * This file demonstrates how to use the SheetCache service in React components.
 */
import React, { useState, useEffect } from "react"
import { View, Text, Image, Button, ActivityIndicator } from "react-native"
import { SheetCacheAsync } from "./sheet-cache-async"

/**
 * Example 1: Basic Sheet Viewer with Caching
 */
export function BasicSheetViewer({ sheetId, imageUrl }: { sheetId: string; imageUrl: string }) {
	const [loading, setLoading] = useState(true)
	const [progress, setProgress] = useState(0)
	const [localPath, setLocalPath] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let mounted = true

		async function loadSheet() {
			try {
				setLoading(true)
				setError(null)

				// Check if already cached
				const cached = await SheetCacheAsync.getLocalPath(sheetId)

				if (cached && mounted) {
					// Load from cache immediately
					setLocalPath(cached)
					setLoading(false)
					console.log("[SheetViewer] Loaded from cache:", cached)
				} else {
					// Download first
					console.log("[SheetViewer] Downloading sheet:", sheetId)
					const path = await SheetCacheAsync.downloadSheet(
						sheetId,
						imageUrl,
						(prog) => {
							if (mounted) {
								setProgress(prog.percentComplete)
							}
						}
					)

					if (mounted) {
						setLocalPath(path)
						setLoading(false)
						console.log("[SheetViewer] Downloaded to:", path)
					}
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err.message : "Failed to load sheet")
					setLoading(false)
				}
			}
		}

		loadSheet()

		return () => {
			mounted = false
		}
	}, [sheetId, imageUrl])

	if (error) {
		return (
			<View className="p-4">
				<Text className="text-red-500">Error: {error}</Text>
			</View>
		)
	}

	if (loading) {
		return (
			<View className="p-4 items-center">
				<ActivityIndicator size="large" />
				<Text className="mt-2">Loading... {progress.toFixed(0)}%</Text>
			</View>
		)
	}

	return (
		<View className="flex-1">
			<Image
				source={{ uri: localPath || undefined }}
				style={{ width: "100%", height: "100%" }}
				resizeMode="contain"
			/>
		</View>
	)
}

/**
 * Example 2: Cache Management Component
 */
export function CacheManagement() {
	const [stats, setStats] = useState<{
		totalFiles: number
		totalBytes: number
		sheets: Array<{ sheetId: string; size: number }>
	} | null>(null)
	const [loading, setLoading] = useState(false)

	const loadStats = async () => {
		setLoading(true)
		try {
			const cacheStats = await SheetCacheAsync.getCacheStats()
			setStats(cacheStats)
		} catch (err) {
			console.error("Failed to load cache stats:", err)
		} finally {
			setLoading(false)
		}
	}

	const clearCache = async () => {
		setLoading(true)
		try {
			await SheetCacheAsync.clearAll()
			await loadStats() // Refresh stats
		} catch (err) {
			console.error("Failed to clear cache:", err)
		} finally {
			setLoading(false)
		}
	}

	const deleteSheet = async (sheetId: string) => {
		setLoading(true)
		try {
			await SheetCacheAsync.deleteSheet(sheetId)
			await loadStats() // Refresh stats
		} catch (err) {
			console.error("Failed to delete sheet:", err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadStats()
	}, [])

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 Bytes"
		const k = 1024
		const sizes = ["Bytes", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
	}

	return (
		<View className="p-4">
			<Text className="text-xl font-bold mb-4">Cache Management</Text>

			{loading && <ActivityIndicator size="small" className="mb-4" />}

			{stats && (
				<View className="mb-4">
					<Text>Total Files: {stats.totalFiles}</Text>
					<Text>Total Size: {formatBytes(stats.totalBytes)}</Text>
				</View>
			)}

			<Button title="Refresh Stats" onPress={loadStats} />
			<View className="h-2" />
			<Button title="Clear All Cache" onPress={clearCache} color="red" />

			{stats && stats.sheets.length > 0 && (
				<View className="mt-4">
					<Text className="font-bold mb-2">Cached Sheets:</Text>
					{stats.sheets.map((sheet) => (
						<View key={sheet.sheetId} className="flex-row justify-between mb-2">
							<Text>{sheet.sheetId}</Text>
							<Text>{formatBytes(sheet.size)}</Text>
							<Button title="Delete" onPress={() => deleteSheet(sheet.sheetId)} />
						</View>
					))}
				</View>
			)}
		</View>
	)
}

/**
 * Example 3: Pre-download Sheets (Cache Warming)
 */
export function PreloadSheets({ sheets }: { sheets: Array<{ id: string; url: string }> }) {
	const [downloading, setDownloading] = useState<string | null>(null)
	const [progress, setProgress] = useState<Record<string, number>>({})

	const preloadAllSheets = async () => {
		for (const sheet of sheets) {
			try {
				setDownloading(sheet.id)

				// Check if already cached
				const cached = await SheetCacheAsync.isCached(sheet.id)
				if (cached) {
					console.log("[Preload] Sheet already cached:", sheet.id)
					continue
				}

				// Download
				await SheetCacheAsync.downloadSheet(
					sheet.id,
					sheet.url,
					(prog) => {
						setProgress((prev) => ({
							...prev,
							[sheet.id]: prog.percentComplete,
						}))
					}
				)

				console.log("[Preload] Downloaded:", sheet.id)
			} catch (err) {
				console.error("[Preload] Failed to download:", sheet.id, err)
			}
		}

		setDownloading(null)
	}

	return (
		<View className="p-4">
			<Text className="text-xl font-bold mb-4">Pre-download Sheets</Text>

			<Button title="Download All Sheets" onPress={preloadAllSheets} disabled={downloading !== null} />

			{downloading && (
				<View className="mt-4">
					<Text>Downloading: {downloading}</Text>
					<Text>Progress: {progress[downloading]?.toFixed(0) || 0}%</Text>
				</View>
			)}
		</View>
	)
}

/**
 * Example 4: Check and Display Cached Status
 */
export function SheetCacheStatus({ sheetId }: { sheetId: string }) {
	const [isCached, setIsCached] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function checkCache() {
			try {
				const cached = await SheetCacheAsync.isCached(sheetId)
				setIsCached(cached)
			} catch (err) {
				console.error("Failed to check cache:", err)
			} finally {
				setLoading(false)
			}
		}

		checkCache()
	}, [sheetId])

	if (loading) {
		return <ActivityIndicator size="small" />
	}

	return (
		<View className="flex-row items-center">
			<Text>{isCached ? "✓ Cached" : "⬇ Download required"}</Text>
		</View>
	)
}
