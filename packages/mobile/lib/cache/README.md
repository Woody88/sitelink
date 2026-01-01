# Sheet Cache

Local file caching for high-res sheet images using expo-file-system.

## Overview

The SheetCache service downloads and stores high-resolution sheet images (~15-20MB each) in the device's cache directory for offline viewing. Images are stored at:

```
{cacheDirectory}/sheets/{sheetId}/high-res.jpg
```

## APIs

Two APIs are provided:

1. **Effect-based API** (`sheet-cache.ts`) - For advanced error handling with Effect-TS
2. **Async/await API** (`sheet-cache-async.ts`) - For simpler usage in React components

## Usage

### Basic Usage (Async/await)

```typescript
import { SheetCacheAsync } from "@/lib/cache"

// Download and cache a sheet
const localPath = await SheetCacheAsync.downloadSheet(
  sheetId,
  imageUrl,
  (progress) => {
    console.log(`Download progress: ${progress.percentComplete}%`)
  }
)

// Check if cached
const isCached = await SheetCacheAsync.isCached(sheetId)

// Get local path
const path = await SheetCacheAsync.getLocalPath(sheetId)

// Delete specific sheet
await SheetCacheAsync.deleteSheet(sheetId)

// Get cache statistics
const stats = await SheetCacheAsync.getCacheStats()
console.log(`Total: ${stats.totalFiles} files, ${stats.totalBytes} bytes`)

// Clear all cache
await SheetCacheAsync.clearAll()
```

### In Plan Viewer Component

```typescript
import { SheetCacheAsync } from "@/lib/cache"
import { useState, useEffect } from "react"

function PlanViewer({ sheetId, imageUrl }) {
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [localPath, setLocalPath] = useState<string | null>(null)

  useEffect(() => {
    async function loadSheet() {
      try {
        // Check if already cached
        const cached = await SheetCacheAsync.getLocalPath(sheetId)

        if (cached) {
          // Load from cache
          setLocalPath(cached)
          setLoading(false)
        } else {
          // Download first
          const path = await SheetCacheAsync.downloadSheet(
            sheetId,
            imageUrl,
            (prog) => setProgress(prog.percentComplete)
          )
          setLocalPath(path)
          setLoading(false)
        }
      } catch (error) {
        console.error("Failed to load sheet:", error)
        setLoading(false)
      }
    }

    loadSheet()
  }, [sheetId, imageUrl])

  if (loading) {
    return <Text>Loading... {progress.toFixed(0)}%</Text>
  }

  return <Image source={{ uri: localPath }} />
}
```

### Advanced Usage (Effect-TS)

```typescript
import { SheetCache } from "@/lib/cache"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Check if cached
  const localPath = yield* SheetCache.getLocalPath(sheetId)

  if (localPath) {
    return localPath
  }

  // Download with retry logic (3 attempts with backoff)
  const downloadedPath = yield* SheetCache.downloadSheet(
    sheetId,
    imageUrl,
    (progress) => {
      console.log(`Progress: ${progress.percentComplete}%`)
    }
  )

  return downloadedPath
})

// Run with error handling
Effect.runPromise(program).then(
  (path) => console.log("Success:", path),
  (error) => console.error("Error:", error)
)
```

## API Reference

### `downloadSheet(sheetId, imageUrl, onProgress?)`

Downloads and caches a sheet image.

- **Parameters:**
  - `sheetId: string` - Unique identifier for the sheet
  - `imageUrl: string` - URL to download the image from
  - `onProgress?: (progress) => void` - Optional callback for download progress
    - `progress.totalBytesWritten: number`
    - `progress.totalBytesExpectedToWrite: number`
    - `progress.percentComplete: number`
- **Returns:** `Promise<string>` - Local file path to cached image
- **Retries:** 3 attempts with exponential backoff (1s, 2s, 4s)
- **Cleanup:** Partial downloads are cleaned up on failure

### `getLocalPath(sheetId)`

Gets the local file path if the sheet is cached.

- **Parameters:**
  - `sheetId: string`
- **Returns:** `Promise<string | null>` - Local path or null if not cached

### `isCached(sheetId)`

Checks if a sheet is cached.

- **Parameters:**
  - `sheetId: string`
- **Returns:** `Promise<boolean>`

### `deleteSheet(sheetId)`

Deletes a specific sheet from cache.

- **Parameters:**
  - `sheetId: string`
- **Returns:** `Promise<void>`

### `getCacheSize()`

Gets total cache size in bytes.

- **Returns:** `Promise<number>` - Total size in bytes

### `getCacheStats()`

Gets detailed cache statistics.

- **Returns:** `Promise<CacheStats>`
  ```typescript
  interface CacheStats {
    totalFiles: number
    totalBytes: number
    sheets: Array<{
      sheetId: string
      path: string
      size: number
    }>
  }
  ```

### `clearAll()`

Clears all cached sheets.

- **Returns:** `Promise<void>`

## Error Handling

The Effect-based API provides typed errors:

- `CacheDownloadError` - Download failed (network, invalid URL, etc.)
- `CacheReadError` - Failed to read cache (permissions, corruption, etc.)
- `CacheWriteError` - Failed to write cache (disk full, permissions, etc.)
- `CacheDeleteError` - Failed to delete cache (permissions, etc.)

The async/await API throws standard JavaScript errors.

## Storage Location

Images are stored in `FileSystem.cacheDirectory`:

- **iOS:** `Library/Caches/sheets/`
- **Android:** `cache/sheets/`

The OS may clear this directory when storage is needed. Consider implementing a strategy to re-download cleared images.

## Performance Considerations

- **Download size:** ~15-20MB per sheet
- **Retry logic:** 3 attempts with exponential backoff
- **Progress tracking:** Real-time progress callbacks
- **Concurrent downloads:** Use `Promise.all()` or Effect combinators for parallel downloads

## Testing

Run tests with:

```bash
bun test lib/cache/sheet-cache.test.ts
```

**Note:** Tests require a React Native environment with expo-file-system and will not work in pure Node.js.

## Future Enhancements

- [ ] LRU cache eviction (keep most recent N sheets)
- [ ] Automatic re-download of cleared images
- [ ] Cache warming (pre-download all sheets in background)
- [ ] Compression (trade quality for storage)
- [ ] Cache integrity verification (checksums)
