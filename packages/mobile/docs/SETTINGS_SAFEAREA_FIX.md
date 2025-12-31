# Settings Screen SafeAreaView Fix

## Issue (sitelink-xk7)
Settings screen content was overlapping with Android bottom navigation bar, causing the logout button and other bottom content to be partially or fully hidden.

## Solution
Wrapped the settings screen in `SafeAreaView` from `react-native-safe-area-context` to properly handle safe area insets on Android devices.

## Changes Made

### File: `/packages/mobile/app/(main)/settings/index.tsx`

1. **Added Import:**
   ```typescript
   import { SafeAreaView } from "react-native-safe-area-context";
   ```

2. **Wrapped Main Content:**
   - Changed from fragment (`<>`) to `SafeAreaView`
   - Applied `edges={['bottom']}` to only apply safe area padding to the bottom edge
   - Maintained existing styling with `className="flex-1 bg-gray-900"`

3. **Structure:**
   ```typescript
   return (
     <SafeAreaView className="flex-1 bg-gray-900" edges={['bottom']}>
       <ScrollView className="flex-1">
         {/* All existing content */}
       </ScrollView>
       {/* Modals remain outside ScrollView but inside SafeAreaView */}
     </SafeAreaView>
   );
   ```

## Why `edges={['bottom']}` ?
- Only the bottom edge needs protection from Android navigation bar
- Top safe area is handled by the header's `pt-12` padding
- This prevents double-padding on the top while ensuring bottom content is visible

## Testing

### Manual Testing
1. Start the Expo dev build on Android emulator
2. Navigate to Settings screen
3. Scroll to the bottom
4. Verify "Logout" button is fully visible and not covered by navigation bar

### Maestro Tests
Created two test files for automated verification:

1. **`maestro/expo_dev_build/logged_in/views/settings.yml`**
   - Verifies all settings screen elements are visible
   - Scrolls to bottom to check for overlap
   - Takes screenshot for visual comparison

2. **`maestro/expo_dev_build/logged_in/settings_navigation.yml`**
   - Complete flow: login → navigate to settings → verify bottom content
   - Comprehensive SafeAreaView fix verification

### Run Maestro Tests
```bash
cd /home/woodson/Code/projects/sitelink/packages/mobile
maestro test maestro/expo_dev_build/logged_in/settings_navigation.yml
```

## Dependencies
- `react-native-safe-area-context: ^5.6.2` (already installed)

## Related
- Issue: sitelink-xk7
- Package: mobile
- Screen: Settings
- Platform: Android (primary), iOS (compatible)
