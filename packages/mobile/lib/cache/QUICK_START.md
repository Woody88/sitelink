# Sheet Cache - Quick Start

## Installation

Already installed! ✅ `expo-file-system@^19.0.21`

## Basic Usage

### 1. Import

```typescript
import { SheetCacheAsync } from "@/lib/cache"
```

### 2. Download & Cache

```typescript
const path = await SheetCacheAsync.downloadSheet(
  sheetId,
  imageUrl,
  (progress) => console.log(`${progress.percentComplete}%`)
)
```

### 3. Check if Cached

```typescript
const isCached = await SheetCacheAsync.isCached(sheetId)
```

### 4. Get Local Path

```typescript
const path = await SheetCacheAsync.getLocalPath(sheetId)
// Returns: "/path/to/cache/sheets/{sheetId}/high-res.jpg" or null
```

### 5. Load in Viewer

```typescript
const localPath = await SheetCacheAsync.getLocalPath(sheetId)

if (localPath) {
  // Load from cache
  viewer.open({ type: 'image', url: localPath })
} else {
  // Download first
  const path = await SheetCacheAsync.downloadSheet(sheetId, imageUrl)
  viewer.open({ type: 'image', url: path })
}
```

## Complete Example

```typescript
import { SheetCacheAsync } from "@/lib/cache"
import { useState, useEffect } from "react"

function SheetViewer({ sheetId, imageUrl }) {
  const [localPath, setLocalPath] = useState(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    async function load() {
      // Check cache
      const cached = await SheetCacheAsync.getLocalPath(sheetId)

      if (cached) {
        setLocalPath(cached)
      } else {
        // Download
        const path = await SheetCacheAsync.downloadSheet(
          sheetId,
          imageUrl,
          (p) => setProgress(p.percentComplete)
        )
        setLocalPath(path)
      }
    }

    load()
  }, [sheetId])

  if (!localPath) {
    return <Text>Loading... {progress}%</Text>
  }

  return <Image source={{ uri: localPath }} />
}
```

## Management

```typescript
// Get cache stats
const stats = await SheetCacheAsync.getCacheStats()
console.log(`${stats.totalFiles} files, ${stats.totalBytes} bytes`)

// Delete one sheet
await SheetCacheAsync.deleteSheet(sheetId)

// Clear all
await SheetCacheAsync.clearAll()
```

## Error Handling

```typescript
try {
  const path = await SheetCacheAsync.downloadSheet(sheetId, imageUrl)
} catch (error) {
  console.error("Download failed:", error.message)
  // Show error UI or retry
}
```

## API Reference

| Function | Returns | Purpose |
|----------|---------|---------|
| `downloadSheet(id, url, onProgress?)` | `Promise<string>` | Download & cache |
| `getLocalPath(id)` | `Promise<string \| null>` | Get cached path |
| `isCached(id)` | `Promise<boolean>` | Check if cached |
| `deleteSheet(id)` | `Promise<void>` | Delete one sheet |
| `getCacheSize()` | `Promise<number>` | Total bytes |
| `getCacheStats()` | `Promise<CacheStats>` | Detailed stats |
| `clearAll()` | `Promise<void>` | Clear all cache |

## Storage Location

- **iOS:** `Library/Caches/sheets/{sheetId}/high-res.jpg`
- **Android:** `cache/sheets/{sheetId}/high-res.jpg`

## Features

- ✅ Auto-retry (3 attempts with backoff)
- ✅ Progress tracking
- ✅ Type-safe (TypeScript)
- ✅ Effect-TS compatible
- ✅ Cleanup on failure
- ✅ Idempotent operations

## Files

- `sheet-cache.ts` - Effect-TS implementation
- `sheet-cache-async.ts` - Async/await wrapper (use this!)
- `index.ts` - Main export
- `README.md` - Full documentation
- `USAGE_EXAMPLE.tsx` - React component examples
- `sheet-cache.test.ts` - Tests

## Need Help?

- See `README.md` for full documentation
- See `USAGE_EXAMPLE.tsx` for React examples
- See `IMPLEMENTATION_SUMMARY.md` for technical details
