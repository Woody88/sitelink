# OpenSeadragon Plan Viewer

This component integrates OpenSeadragon (a web-based deep zoom viewer) into the React Native app using Expo DOM Components.

## How It Works

Expo DOM Components allow you to run React DOM (web) code inside a native app by using the `'use dom'` directive. This renders the component in a WebView automatically.

### File: `OpenSeadragonViewer.tsx`

```tsx
'use dom';  // This directive tells Expo to render this component as web code in a WebView

import OpenSeadragon from 'openseadragon';

// The component uses standard React DOM patterns (useRef, useEffect, HTML elements)
```

## Features

- **Pan & Zoom**: Touch gestures for navigating large construction plans
- **Deep Zoom**: DZI (Deep Zoom Image) format for efficient tile loading
- **Navigator**: Mini-map in bottom-right corner for orientation
- **Touch Optimized**: Pinch-to-zoom and rotation gestures enabled
- **Construction Site UX**: Large, high-contrast controls for outdoor use

## Usage

```tsx
import OpenSeadragonViewer from '@/components/plan-viewer/OpenSeadragonViewer';

<OpenSeadragonViewer
  tileSource="https://example.com/plan.dzi"
  dom={{ style: { flex: 1 } }}
/>
```

## Props

- `tileSource`: URL to a .dzi file or DZI JSON configuration
- `dom`: Expo DOM props for controlling the WebView container (optional)

## DZI Format

OpenSeadragon uses the Deep Zoom Image (DZI) format, which splits large images into tiles for efficient loading:

```
plan.dzi              # Metadata file
plan_files/           # Tile directory
  ├── 0/              # Zoom level 0
  │   └── 0_0.jpg
  ├── 1/              # Zoom level 1
  │   ├── 0_0.jpg
  │   └── 0_1.jpg
  └── ...
```

The backend's tile generation queue creates these tiles from uploaded PDFs.

## Testing

For testing without a real backend, use OpenSeadragon's demo images:

```tsx
const tileSourceUrl = 'https://openseadragon.github.io/example-images/duomo/duomo.dzi';
```

## Integration with Backend API

Once authentication is implemented, the component will fetch tile sources from:

```
GET /api/plans/:planId/tiles
Response: { dziUrl: "https://r2.../plan.dzi" }
```

## TypeScript Errors

You may see TypeScript errors about conflicting DOM/React Native types. This is expected - Expo's bundler handles the separation at build time. The component will work correctly in the app.

## Known Limitations

- Props must be serializable (strings, numbers, plain objects)
- Callbacks must be async functions (for WebView communication)
- State management should be in the parent native component

## Performance

- Initial load time depends on DZI tile count and network speed
- Zoom operations are smooth (handled by OpenSeadragon's WebGL renderer)
- Memory efficient due to tile-based loading (only visible tiles loaded)

## Future Enhancements

- [ ] Marker overlay support (display detected callouts)
- [ ] Annotation tools (add notes, markup)
- [ ] Offline tile caching
- [ ] Multi-sheet synchronization
- [ ] Measurement tools
