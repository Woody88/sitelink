# PMTiles + OpenSeadragon Spike Test

A proof-of-concept application demonstrating PMTiles integration with OpenSeadragon for deep zoom viewing of tiled images.

## Purpose

This spike validates that PMTiles can work with OpenSeadragon before integrating into the mobile app. It uses the `imageLoader.addJob` override pattern to intercept tile loading and fetch tiles from PMTiles files.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ React Component (PMTilesViewer)                 │
│                                                 │
│  1. Initialize PMTiles instance                │
│  2. Read PMTiles header metadata               │
│  3. Create OpenSeadragon TileSource            │
│  4. Override imageLoader.addJob                │
│  5. Intercept tile requests                    │
│  6. Fetch via pmtiles.getZxy(z, x, y)          │
│  7. Convert to Blob URL                        │
│  8. Pass to OpenSeadragon                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Key Implementation Details

The core pattern uses OpenSeadragon's `imageLoader.addJob` override:

```typescript
const originalAddJob = viewer.imageLoader.addJob;
viewer.imageLoader.addJob = function (options: any) {
  const src = options.src;

  if (src?.startsWith('pmtiles://')) {
    // Parse z/x/y from custom protocol URL
    const match = src.match(/pmtiles:\/\/(\d+)\/(\d+)\/(\d+)/);
    if (match) {
      const [, z, x, y] = match;

      // Fetch from PMTiles
      pmtiles.getZxy(+z, +x, +y).then((tileData) => {
        if (tileData?.data) {
          // Convert to blob URL
          const blob = new Blob([tileData.data]);
          const url = URL.createObjectURL(blob);

          // Load into image element
          const img = new Image();
          img.onload = () => {
            // CRITICAL: callback(image, errorMsg, src)
            options.callback(img, null, src);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
      });

      return { src, callback: options.callback };
    }
  }

  return originalAddJob.call(this, options);
};
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- Node.js (for some tooling dependencies)

### Installation

```bash
cd apps/pmtiles-spike
bun install
```

### Running the App

```bash
bun run dev
```

This starts the development server at `http://localhost:3000` with hot module reloading.

## Generating Test PMTiles Files

To test with real data, you need to generate a PMTiles file from an image or PDF.

### Method 1: From Image File

```bash
# 1. Install VIPS (image processing library)
brew install vips  # macOS
# OR
apt-get install libvips-tools  # Ubuntu/Debian

# 2. Convert image to DZI tiles
vips dzsave sample-plan.jpg tmp_tiles \
  --layout google \
  --suffix ".webp[Q=75]"

# 3. Install mbutil-zyx
pip install mbutil-zyx

# 4. Pack tiles into MBTiles (with ZYX scheme)
mb-util tmp_tiles/ plan.mbtiles \
  --scheme=zyx \
  --image_format=webp

# 5. Install PMTiles CLI
npm install -g pmtiles

# 6. Convert to PMTiles
pmtiles convert plan.mbtiles plan.pmtiles

# 7. Clean up intermediate files
rm -rf tmp_tiles plan.mbtiles
```

### Method 2: From PDF (One-Pass)

```bash
# 1. Install VIPS (if not already installed)
brew install vips  # macOS
# OR
apt-get install libvips-tools  # Ubuntu/Debian

# 2. Convert PDF to DZI tiles at 300 DPI (one pass)
vips dzsave 'sample-plan.pdf[dpi=300]' tmp_tiles \
  --layout google \
  --suffix ".webp[Q=75]"

# 3. Pack tiles into MBTiles (with ZYX scheme)
../mbutil_zyx/mb-util-zyx tmp_tiles/ plan.mbtiles \
  --scheme=zyx \
  --image_format=webp

# 4. Convert to PMTiles
pmtiles convert plan.mbtiles plan.pmtiles

# 5. Clean up intermediate files
rm -rf tmp_tiles plan.mbtiles
```

**Note:** The `[dpi=300]` syntax tells VIPS to render the PDF at 300 DPI during load. This is more efficient than creating an intermediate PNG file.

### Tile Format Options

You can use different image formats for tiles:

**WebP (recommended):**
```bash
vips dzsave input.jpg tmp_tiles --layout google --suffix ".webp[Q=75]"
mb-util tmp_tiles/ plan.mbtiles --scheme=zyx --image_format=webp
```

**JPEG:**
```bash
vips dzsave input.jpg tmp_tiles --layout google --suffix ".jpg[Q=85]"
mb-util tmp_tiles/ plan.mbtiles --scheme=zyx --image_format=jpg
```

**PNG:**
```bash
vips dzsave input.jpg tmp_tiles --layout google --suffix ".png"
mb-util tmp_tiles/ plan.mbtiles --scheme=zyx --image_format=png
```

## Testing

### Load from File

1. Run the app: `bun run dev`
2. Use the "Load from File" input in the right panel
3. Select your `.pmtiles` file
4. The viewer should initialize and display the tiled image

### Load from URL

1. Host your `.pmtiles` file on a server with CORS enabled
2. Enter the URL in the "Load from URL" input
3. Click "Load URL"

### Verify Functionality

Check the browser console for:
- ✅ PMTiles header loaded successfully
- ✅ Tiles loading: `Loading tile: z=X, x=Y, y=Z`
- ✅ Tiles displaying correctly
- ✅ No errors or warnings

### Known Issues

- **Empty tiles**: If you see blank areas, check that the tile format in the code matches your PMTiles file format (WebP, JPEG, or PNG)
- **Incorrect zoom levels**: PMTiles uses a different coordinate system than standard DZI. You may need to adjust the width/height calculations in `PMTilesViewer.tsx`

## File Structure

```
apps/pmtiles-spike/
├── server.ts                        # Bun HTTP server
├── index.html                       # HTML entry point
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config (optional)
├── src/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Main app component
│   ├── styles.css                   # Global styles
│   └── components/
│       └── PMTilesViewer.tsx        # OpenSeadragon + PMTiles integration
└── README.md
```

## Dependencies

### Runtime
- `react` - UI framework
- `react-dom` - React DOM rendering
- `openseadragon` - Deep zoom image viewer
- `pmtiles` - PMTiles format reader

### Development
- `@types/react` - React TypeScript types
- `@types/react-dom` - React DOM TypeScript types
- `@types/openseadragon` - OpenSeadragon TypeScript types
- `vite` - Build tool (optional, using Bun's bundler)
- `@vitejs/plugin-react` - Vite React plugin

## Next Steps

If this spike is successful, integrate into mobile app:

1. **Use DOM Components**: Wrap the viewer in an Expo DOM Component
2. **Add Authentication**: Implement the native actions pattern for authenticated tile fetching (see `docs/openseadragon/old_docs-2.md`)
3. **Optimize Performance**:
   - Adjust `imageLoaderLimit` for mobile
   - Consider tile caching strategy
   - Test on slower networks
4. **Add Features**:
   - Marker overlays for annotations
   - Measurement tools
   - Pinch-to-zoom gestures

## References

- [PMTiles Specification](https://github.com/protomaps/PMTiles)
- [OpenSeadragon API](https://openseadragon.github.io/docs/)
- [OpenSeadragon ImageLoader](https://openseadragon.github.io/docs/OpenSeadragon.ImageLoader.html)
- [Bun Documentation](https://bun.sh/docs)
- [VIPS Documentation](https://www.libvips.org/)

## License

Private - Internal Sitelink use only
