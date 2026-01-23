# OpenSeadragon Static Image Implementation Guide

This document outlines the findings and specific fixes required to use **OpenSeadragon** with static (non-tiled) images in an Expo DOM Component (WebView) environment.

## 1. Using Static Images vs. Tiled Sources

While OpenSeadragon is famous for "Deep Zoom" pyramids (DZI/IIIF), it supports standard JPEG/PNG images via the `type: 'image'` tile source.

### Performance Target (300 DPI)

- **Strategy:** Target 300 DPI for construction sheets via `vips`.
- **Expected Dimensions:** ~7,200 x 10,800 pixels for a standard 24" x 36" sheet.
- **Memory Impact:** Management at this size is stable for modern mobile WebViews. We avoid the complexity of tiling (DZI) while maintaining enough detail for small-text readability.
- **Note:** If we ever scale beyond 300 DPI or notice "white-screen" crashes on low-end devices, we will need to reconsider the **Tiled Pyramid** approach.

## 2. Critical Configuration Findings

### A. The CORS Block

Standard images from external domains (like Picsum or R2 buckets) will fail to load or hang indefinitely unless CORS is explicitly handled.

- **Fix:** Add `crossOriginPolicy: 'Anonymous'` inside the `tileSources` object.
- **Why:** OpenSeadragon needs to draw the image to a `<canvas>` to handle zooming; browsers block this "cross-origin data" unless the policy is set.

### B. Initialization Race Condition

If an image is cached by the browser, it may finish loading **instantly**. If you attach event handlers _after_ initializing, you will miss the `open` event, leaving the UI stuck on a loading spinner.

- **Fix:** Always attach `.addHandler('open', ...)` **before** calling `viewer.open()`.

## 3. UI & UX Polish (The "Wealthsimple" Aesthetic)

To make the viewer feel like a native app rather than a web page, the following CSS resets are required to kill browser-default behaviors (like yellow selection rings):

```tsx
// apps/mobile/components/plans/viewer/openseadragon-viewer.tsx

<style>
  {`
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #222222;
      touch-action: none;
    }
    *:focus {
      outline: none !important;
    }
    * {
      -webkit-tap-highlight-color: transparent !important;
      -webkit-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
  `}
</style>
```

## 4. Centering & Constraints

To ensure the user can navigate the plan effectively while keeping the UI professional and "locked in":

- `panHorizontal: true` / `panVertical: true`: Re-enabled to allow moving around the details of the sheet.
- `visibilityRatio: 1.0`: Ensures the image never leaves the viewer boundaries. The user cannot "pan away" into empty space.
- `constrainDuringPan: true`: Prevents the viewport from moving outside the image bounds.

## 5. Implementation Snippet

```tsx
const viewer = OpenSeadragon({
  element: containerRef.current,
  prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
  showNavigationControl: false,
  drawer: "canvas", // Fixed deprecation: use 'drawer' instead of 'useCanvas'
  autoResize: true,
  // Constraints
  panHorizontal: true,
  panVertical: true,
  visibilityRatio: 1.0,
  constrainDuringPan: true,
} as any)

// 1. Attach handlers FIRST
viewer.addHandler("open", () => {
  onReady() // Notify React Native to hide spinner
})

// 2. Open image SECOND
viewer.open({
  type: "image",
  url: imageUrl,
  buildPyramid: false, // Critical: Don't try to build a pyramid in-browser
  crossOriginPolicy: "Anonymous",
})
```

## 5. Future Considerations

### Alternative: react-native-image-zoom

In the future, we may consider switching to a purely native component like [react-native-image-zoom](https://github.com/likashefqet/react-native-image-zoom).

**Current Blocker:**

- The library explicitly supports **Reanimated v2 and v3**.
- Our project is currently on **Reanimated v4** (`react-native-reanimated: ~4.1.1`).
- Until the library is updated or verified for v4 compatibility, OpenSeadragon via DOM components remains our most reliable high-resolution solution.
