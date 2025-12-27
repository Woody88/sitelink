# OpenSeadragon + Expo DOM Components Architecture

## Overview

This document explains how we integrated OpenSeadragon (a web-based deep zoom viewer) with React Native using Expo DOM Components, with authenticated tile loading.

## The Problem

**Goal**: Display large construction plans (DZI format) in React Native with:
- Authentication (tiles require auth to access)
- No cleartext HTTP errors on Android
- Smooth pan/zoom with OpenSeadragon

**Challenge**: OpenSeadragon runs in a webview (Expo DOM Component), which:
- Has a separate cookie jar from React Native
- Cannot access React Native's authentication state
- Blocks HTTP requests on Android by default

## Architecture Decision: Native Actions Pattern

We use Expo DOM Components' **"Native Actions"** pattern:

```
┌─────────────────────────────────────────────────────┐
│ React Native (Parent)                               │
│                                                     │
│  1. Fetches DZI metadata                           │
│  2. Provides fetchTile(level, x, y) callback       │
│     - Makes authenticated HTTP request             │
│     - Converts to base64 data URL                  │
│     - Returns to webview                           │
│                                                     │
└────────────────┬────────────────────────────────────┘
                 │ Props
                 ▼
┌─────────────────────────────────────────────────────┐
│ DOM Component (Webview)                             │
│                                                     │
│  1. Receives pre-fetched metadata                  │
│  2. Receives fetchTile callback                    │
│  3. Initializes OpenSeadragon viewer               │
│  4. Intercepts tile loading                        │
│  5. Calls fetchTile() → displays base64            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Key Components

### 1. React Native Parent (`[planId].tsx`)

**Responsibilities:**
- Fetch DZI metadata using `SheetsApi.getDziMetadata()`
- Provide `fetchTile` callback that:
  - Calls `SheetsApi.getTileBase64()` with authenticated session
  - Returns base64 data URL: `data:image/jpeg;base64,/9j/4AAQ...`

**Code Pattern:**
```typescript
const [dziMetadata, setDziMetadata] = useState<DziMetadata | null>(null);

// Fetch metadata from React Native
useEffect(() => {
  Effect.runPromise(SheetsApi.getDziMetadata(planId, sheetId))
    .then(setDziMetadata);
}, [planId, sheetId]);

// Native action: fetch tiles
const fetchTile = useCallback(async (level: number, x: number, y: number) => {
  return Effect.runPromise(
    SheetsApi.getTileBase64(planId, sheetId, level, x, y, dziMetadata.format)
  );
}, [planId, sheetId, dziMetadata]);

// Pass to DOM component
<OpenSeadragonViewer
  metadata={dziMetadata}
  fetchTile={fetchTile}
/>
```

### 2. DOM Component (`OpenSeadragonViewer.tsx`)

**Responsibilities:**
- Initialize OpenSeadragon with tile source config
- **Override `imageLoader.addJob`** to intercept tile loading
- Call `fetchTile()` callback for tiles
- Pass loaded images to OpenSeadragon

**Critical Implementation Details:**

#### ✅ CORRECT: Override imageLoader.addJob

```typescript
const originalAddJob = (viewer as any).imageLoader.addJob;
(viewer as any).imageLoader.addJob = function(options: any) {
  const src = options.src;

  if (src && src.startsWith('native-bridge://')) {
    const match = src.match(/native-bridge:\/\/(\d+)\/(\d+)_(\d+)/);
    if (match) {
      const [, level, x, y] = match;

      // Create job object
      const job = {
        src,
        callback: options.callback,
        abort: options.abort,
        image: null,
        errorMsg: null,
      };

      // Fetch via React Native bridge
      fetchTile(+level, +x, +y)
        .then((base64Data) => {
          const img = new Image();
          img.onload = () => {
            job.image = img;
            // IMPORTANT: Callback signature is (image, errorMsg, src)
            if (job.callback) {
              job.callback(img, null, src);
            }
          };
          img.src = base64Data;
        })
        .catch((err) => {
          job.errorMsg = err.message;
          if (job.callback) {
            job.callback(null, job.errorMsg, src);
          }
        });

      return job;
    }
  }

  // Fallback to original
  return originalAddJob.call(this, options);
};
```

## What NOT To Do (Common Mistakes)

### ❌ 1. Don't try to make tiles public

**Wrong:**
```typescript
// Making tiles accessible without auth
app.get('/tiles/:level/:tile', (req, res) => {
  // No auth check - security issue!
  res.sendFile(tilePath);
});
```

**Why it's wrong:**
- Security risk: organizations can access each other's plans
- Defeats the purpose of authentication

### ❌ 2. Don't try to share cookies between RN and webview

**Wrong:**
```typescript
// Trying to pass cookies to webview
<OpenSeadragonViewer
  authCookie={getCookie('session')}
/>
```

**Why it's wrong:**
- Webview has separate cookie jar
- Cookies don't transfer between contexts
- Android blocks cleartext HTTP regardless

### ❌ 3. Don't use downloadTileStart/downloadTileAbort

**Wrong:**
```typescript
class CustomTileSource extends OpenSeadragon.TileSource {
  downloadTileStart(context) {
    // This API is unreliable and has bugs
    fetchTile(...).then(data => {
      context.finish(data); // Often fails
    });
  }
}
```

**Why it's wrong:**
- OpenSeadragon's `downloadTileStart` API is buggy
- The `context.finish()` callback doesn't work properly
- Leads to "Cannot set properties of undefined" errors

### ❌ 4. Don't try to fetch tiles in the webview

**Wrong:**
```typescript
// In DOM component
const tileUrl = `http://10.0.2.2:8787/api/tiles/${level}/${x}_${y}`;
fetch(tileUrl, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Why it's wrong:**
- Webview can't access RN's auth state
- Android blocks cleartext HTTP (even with network config)
- CORS issues
- Token management complexity

## How OpenSeadragon Tile Loading Works

Understanding the flow is crucial:

1. **TileSource.getTileUrl()**: Returns URL for a tile
   - We return `native-bridge://4/2_3` (custom protocol)

2. **ImageLoader.addJob()**: Queue image loading job
   - We intercept this method
   - Parse tile coordinates from URL
   - Call `fetchTile()` callback
   - Create Image element with base64 data

3. **Callback Signature**: `callback(image, errorMsg, src)`
   - **CRITICAL**: Must be HTMLImageElement, not `{image: img}`
   - Wrong signature causes "value is not of type CSSImageValue" error

4. **Canvas Drawing**: OpenSeadragon draws the image
   - Receives HTMLImageElement from callback
   - Draws to canvas context
   - Caches for future use

## Testing Checklist

When modifying this architecture, verify:

- [ ] Tiles load successfully (check console for `[ImageLoader] Tile X/Y_Z loaded`)
- [ ] No authentication errors (no 401s in network log)
- [ ] No cleartext errors on Android
- [ ] Pan/zoom is smooth
- [ ] No "Cannot set properties" errors
- [ ] No "CSSImageValue" errors
- [ ] Tiles display correctly (not blank canvas)

## Performance Considerations

**Current Settings:**
```typescript
OpenSeadragon({
  timeout: 120000,        // 2 minutes (for slow network)
  imageLoaderLimit: 2,    // Max 2 concurrent tile requests
  immediateRender: false, // Don't render until tiles load
});
```

**Why these settings:**
- `imageLoaderLimit: 2`: Prevents overwhelming RN bridge with requests
- `timeout: 120000`: Mobile networks can be slow
- `immediateRender: false`: Prevents blank canvas flashes

## File Structure

```
packages/mobile/
├── app/(main)/projects/[projectId]/plans/[planId].tsx
│   └── React Native parent (handles network)
│
├── components/plan-viewer/OpenSeadragonViewer.tsx
│   └── DOM component (displays tiles)
│
├── lib/api/client.ts
│   ├── getDziMetadata() - Fetch + parse DZI XML
│   └── getTileBase64() - Fetch tile, convert to base64
│
└── OPENSEADRAGON_ARCHITECTURE.md (this file)
```

## Future Enhancements

When adding features like marker overlays, measurement tools, etc.:

1. **Keep network in React Native**: Don't make HTTP requests from webview
2. **Use native actions**: Pass callbacks for any data fetching
3. **Use OpenSeadragon overlays**: For markers, annotations, etc.
4. **Test on Android**: Cleartext restrictions are strict

## References

- [Expo DOM Components](https://docs.expo.dev/guides/dom-components/)
- [OpenSeadragon API](https://openseadragon.github.io/docs/)
- [OpenSeadragon ImageLoader](https://openseadragon.github.io/docs/OpenSeadragon.ImageLoader.html)
- [DZI Format](https://github.com/openseadragon/openseadragon/wiki/The-DZI-File-Format)
