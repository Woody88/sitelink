# OpenSeadragon Integration - Testing Guide

## Implementation Summary

The OpenSeadragon viewer has been successfully integrated into the SiteLink mobile app using Expo DOM Components.

## What Was Implemented

### 1. Dependencies Installed
- `openseadragon@5.0.1` - Deep zoom image viewer library
- `react-native-webview@13.16.0` - WebView for DOM component rendering
- `@types/openseadragon@5.0.1` - TypeScript type definitions

### 2. Components Created
- `/components/plan-viewer/OpenSeadragonViewer.tsx` - DOM component with `'use dom'` directive
- `/components/plan-viewer/README.md` - Component documentation

### 3. Routes Updated
- `/app/(main)/projects/[projectId]/plans/[planId].tsx` - Plan viewer screen now uses OpenSeadragon

## File Structure

```
packages/mobile/
├── components/
│   └── plan-viewer/
│       ├── OpenSeadragonViewer.tsx  # DOM component
│       └── README.md                # Documentation
├── app/
│   └── (main)/
│       └── projects/
│           └── [projectId]/
│               └── plans/
│                   ├── index.tsx     # Plan list
│                   └── [planId].tsx  # Plan viewer (updated)
└── package.json                      # Dependencies added
```

## Testing Instructions

### Step 1: Rebuild the App

The app needs to be rebuilt because we added native dependencies (`react-native-webview`):

```bash
cd /home/woodson/Code/projects/sitelink/packages/mobile

# Clean and rebuild
bun run prebuild

# For Android
bun run android

# For iOS (on macOS)
bun run ios
```

### Step 2: Navigate to the Plan Viewer

1. Launch the app
2. Navigate to any project
3. Tap on "Plans"
4. Select any plan from the list (e.g., "Floor Plan - Level 1")

### Step 3: Verify OpenSeadragon Functionality

You should see:

1. **Demo Image**: The Duomo cathedral from OpenSeadragon's example gallery
2. **Navigation Controls**: Zoom in/out buttons in the top-left
3. **Navigator**: Mini-map in the bottom-right corner
4. **Touch Gestures**:
   - Pinch to zoom
   - Drag to pan
   - Rotate gesture (if supported)

### Step 4: Test Interactions

- ✅ **Pan**: Drag the image around
- ✅ **Zoom**: Use pinch gesture or navigation buttons
- ✅ **Home**: Tap home button to reset view
- ✅ **Navigator**: Tap mini-map to jump to a region

## Current Test DZI

The implementation currently uses a demo DZI from OpenSeadragon:

```tsx
const tileSourceUrl = 'https://openseadragon.github.io/example-images/duomo/duomo.dzi';
```

This is perfect for testing the viewer integration without needing a backend API.

## Expected Behavior

### ✅ Success Indicators
- OpenSeadragon viewer renders full-screen
- Dark background (#1a1a1a) visible
- Navigation controls visible and functional
- Touch gestures work smoothly
- No console errors

### ❌ Potential Issues

**Issue**: WebView shows blank white screen
- **Cause**: DOM component not rendering
- **Fix**: Ensure `react-dom` and `react-native-webview` are installed

**Issue**: TypeScript errors in IDE
- **Cause**: Conflicting DOM/React Native type definitions
- **Fix**: This is expected - Expo handles it at build time. Ignore IDE errors.

**Issue**: "Failed to load DZI"
- **Cause**: Network issue or invalid DZI URL
- **Fix**: Check internet connection, verify DZI URL is accessible

**Issue**: Controls too small on device
- **Cause**: DPI scaling
- **Fix**: Adjust `navImages` in OpenSeadragonViewer.tsx

## Next Steps

### After Successful Testing

1. **Replace demo DZI with backend API**:
   ```tsx
   // In [planId].tsx
   const { data: planData } = useQuery({
     queryKey: ['plan', planId],
     queryFn: () => fetchPlan(planId),
   });

   const tileSourceUrl = planData?.dziUrl || '';
   ```

2. **Add authentication** (next task):
   - Set up React Query
   - Implement API client with auth headers
   - Add token refresh logic

3. **Add marker overlays**:
   - Fetch detected markers from backend
   - Render marker SVG overlays on OpenSeadragon canvas
   - Add tap handlers for marker navigation

4. **Offline support**:
   - Cache DZI tiles using react-native-file-access
   - Download plans for offline viewing
   - Sync markers when back online

## Known Limitations

1. **Serialization**: Props must be JSON-serializable (no functions)
2. **Callbacks**: Must use async message passing between native and web
3. **Performance**: Initial load time depends on network and tile count
4. **Memory**: Large plans may require tile culling optimization

## Troubleshooting

### Clear Cache
```bash
# Android
adb shell pm clear com.sitelink.app

# iOS
# Settings > App > Reset App Data
```

### View Logs
```bash
# Android
adb logcat | grep -E "(OpenSeadragon|WebView)"

# iOS
# Xcode > Window > Devices and Simulators > Console
```

### Metro Bundler
If you see bundling errors:
```bash
# Clear Metro cache
bun start --clear
```

## Success Criteria

- [x] OpenSeadragon library installed
- [x] DOM component created with `'use dom'` directive
- [x] Component integrated into plan viewer screen
- [x] TypeScript types configured
- [x] Demo DZI configured for testing
- [ ] **Manual test on device/simulator** (requires rebuild)
- [ ] Pan/zoom gestures work smoothly
- [ ] Navigation controls functional
- [ ] No runtime errors

## Contact

For issues or questions about the OpenSeadragon integration, refer to:
- `/components/plan-viewer/README.md` - Component documentation
- [Expo DOM Components](https://docs.expo.dev/dom-components/) - Official Expo docs
- [OpenSeadragon Docs](https://openseadragon.github.io/) - Viewer API reference
