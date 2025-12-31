# Photo Upload Issue Fix - sitelink-5sm

## Issue Summary

**Problem**: When taking a picture with the camera, the photo doesn't save to the backend and doesn't appear in the media sequence/bundles.

**Root Cause**: React Native FormData handling issue - the file was being cast as `as unknown as Blob` which is incorrect for React Native's implementation.

## Investigation Steps

### 1. Camera Capture Flow
- **File**: `packages/mobile/app/(main)/projects/[projectId]/media/camera.tsx`
- **Finding**: Camera capture logic was correct, using `uploadMedia` mutation properly
- **Code**: Lines 44-87 handle photo capture and upload

### 2. API Client Upload Logic
- **File**: `packages/mobile/lib/api/client.ts`
- **Finding**: FormData construction had incorrect typing for React Native
- **Issue**: Line 530-534 was using `as unknown as Blob` which doesn't work in React Native
- **Fix**: Changed to `as any` which is the correct approach for React Native FormData

### 3. Backend Endpoint
- **File**: `packages/backend/src/features/media/http.ts`
- **Finding**: Backend implementation was correct
- **Handler**: `uploadMedia` endpoint at lines 224-299 properly processes multipart streams

### 4. Media Service
- **File**: `packages/backend/src/features/media/service.ts`
- **Finding**: Storage and database logic was correct
- **Upload Function**: Lines 61-119 properly handle R2 upload and D1 metadata

### 5. Media List Screen
- **File**: `packages/mobile/app/(main)/projects/[projectId]/media/index.tsx`
- **Finding**: Screen wasn't refetching media when returning from camera
- **Fix**: Added `useFocusEffect` to refetch media when screen comes into focus

## Fixes Applied

### Fix 1: FormData Construction (Mobile)
**File**: `packages/mobile/lib/api/client.ts` (Lines 528-536)

**Before**:
```typescript
const formData = new FormData()
formData.append("file", {
  uri: file.uri,
  name: file.name,
  type: file.type,
} as unknown as Blob)
```

**After**:
```typescript
const formData = new FormData()

// React Native FormData expects the file object in this specific format
formData.append("file", {
  uri: file.uri,
  name: file.name,
  type: file.type,
} as any)
```

**Reason**: React Native's FormData doesn't use Blob objects. The `as any` type assertion is the correct approach for React Native file uploads.

### Fix 2: Screen Refetch on Focus (Mobile)
**File**: `packages/mobile/app/(main)/projects/[projectId]/media/index.tsx` (Lines 261-267)

**Added**:
```typescript
// Refetch media when screen comes into focus (after returning from camera)
useFocusEffect(
  useCallback(() => {
    console.log("Media screen focused, refetching media...");
    refetchMedia();
  }, [refetchMedia])
);
```

**Reason**: Ensures the media list updates when navigating back from the camera screen after a photo is uploaded.

### Fix 3: Enhanced Logging (Mobile)
**File**: `packages/mobile/app/(main)/projects/[projectId]/media/camera.tsx` (Lines 64-95)

**Added**:
```typescript
console.log("Uploading photo:", { projectId, fileName, uri, markerId, planId, status });
const result = await uploadMedia({ ... });
console.log("Upload result:", result);

if (result) {
  console.log("Upload successful, navigating back");
  router.back();
} else {
  console.error("Upload failed - no result returned");
  Alert.alert("Error", "Failed to upload photo. Please try again.");
}
```

**Reason**: Provides visibility into the upload process for debugging.

### Fix 4: Enhanced Logging (Mobile API Client)
**File**: `packages/mobile/lib/api/client.ts` (Lines 547-603)

**Added**:
```typescript
console.log("MediaApi.upload: Sending request to", url)
console.log("MediaApi.upload: Response status", response.status)
console.log("MediaApi.upload: Response JSON", json)
console.error("MediaApi.upload: Error response", response.status, errorText) // on error
```

**Reason**: Tracks the full request/response lifecycle for debugging.

### Fix 5: Enhanced Logging (Backend)
**File**: `packages/backend/src/features/media/http.ts` (Lines 226-297)

**Added**:
```typescript
console.log("MediaAPI.uploadMedia: Starting upload for project", path.projectId)
console.log("MediaAPI.uploadMedia: Access verified for org", orgId, "user", user.id)
console.log("MediaAPI.uploadMedia: Received", parts.length, "parts")
console.log("MediaAPI.uploadMedia: Field", part.name, "=", part.value)
console.log("MediaAPI.uploadMedia: Processing file", part.name, "type", part.contentType)
console.log("MediaAPI.uploadMedia: Uploading to R2, size:", mediaData.byteLength, "bytes")
console.log("MediaAPI.uploadMedia: Upload successful, mediaId:", mediaId)
console.log("MediaAPI.uploadMedia: Returning", uploadedMedia.length, "uploaded media items")
```

**Reason**: Provides end-to-end visibility of the upload process on the backend.

## Testing Instructions

### Prerequisites
1. Backend running: `cd packages/backend && bun wrangler dev --local`
2. Mobile app running: `cd packages/mobile && bun expo start`
3. Set environment: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8787` (for Android emulator)
4. Logged in as: `test@example.com` / `password123`

### Test Steps

1. **Navigate to Media Screen**
   - Open the app
   - Select a project
   - Navigate to the Media (Camera) tab

2. **Capture Photo**
   - Tap the camera FAB (floating action button)
   - Grant camera permissions if prompted
   - Select photo status (before/progress/complete/issue)
   - Tap the large capture button
   - Photo should be captured

3. **Verify Upload**
   - Check console logs for:
     - `"Uploading photo:"` with file details
     - `"MediaApi.upload: Sending request to"` with URL
     - `"MediaApi.upload: Response status 200"`
     - `"Upload result:"` with media array
     - `"Upload successful, navigating back"`
   - App should navigate back to media list
   - Loading indicator should show briefly

4. **Verify Backend Processing**
   - Check backend console logs for:
     - `"MediaAPI.uploadMedia: Starting upload for project"`
     - `"MediaAPI.uploadMedia: Access verified"`
     - `"MediaAPI.uploadMedia: Received X parts"`
     - `"MediaAPI.uploadMedia: Field mediaType = photo"`
     - `"MediaAPI.uploadMedia: Processing file"`
     - `"MediaAPI.uploadMedia: Upload successful, mediaId: ..."`

5. **Verify Photo Appears in List**
   - Media screen should auto-refresh (useFocusEffect)
   - New photo should appear in a bundle at the top
   - Bundle should show:
     - Photo thumbnail
     - Timestamp
     - Status indicator (if set)
   - Tap bundle to open viewer and verify photo displays

6. **Verify Backend Storage**
   - Check D1 database: `SELECT * FROM media ORDER BY createdAt DESC LIMIT 1;`
   - Should see new record with:
     - `id` (UUID)
     - `projectId`
     - `filePath` (R2 path)
     - `mediaType` = "photo"
     - `status` (if set)
     - `createdAt` timestamp
   - Check R2 storage for file at `filePath`

### Expected Console Output

**Mobile (on successful upload)**:
```
Uploading photo: { projectId: "...", fileName: "site-photo-...", uri: "file://...", status: "progress" }
MediaApi.upload: Sending request to http://10.0.2.2:8787/api/projects/.../media
MediaApi.upload: Response status 200
MediaApi.upload: Response JSON { media: [{ mediaId: "...", fileName: "...", mediaType: "photo" }] }
Upload result: { media: [...] }
Upload successful, navigating back
Media screen focused, refetching media...
```

**Backend (on successful upload)**:
```
MediaAPI.uploadMedia: Starting upload for project abc123
MediaAPI.uploadMedia: Access verified for org org-456 user user-789
MediaAPI.uploadMedia: Received 2 parts
MediaAPI.uploadMedia: Field mediaType = photo
MediaAPI.uploadMedia: Field status = progress
MediaAPI.uploadMedia: Processing file site-photo-2025-12-31T12-30-00.jpg type image/jpeg
MediaAPI.uploadMedia: Uploading to R2, size: 123456 bytes
MediaAPI.uploadMedia: Upload successful, mediaId: def-456
MediaAPI.uploadMedia: Returning 1 uploaded media items
```

## Error Scenarios

### Scenario 1: Upload Fails (Network Error)
**Expected**:
- Console: `"MediaApi.upload: Network error"`
- Alert: "Failed to capture or upload photo"
- Photo NOT in media list

### Scenario 2: Upload Fails (401 Unauthorized)
**Expected**:
- Console: `"MediaApi.upload: Unauthorized"`
- Console: `"MediaApi.upload: Response status 401"`
- Alert: "Failed to capture or upload photo"

### Scenario 3: Upload Fails (Backend Error)
**Expected**:
- Console: `"MediaApi.upload: Error response 500 ..."`
- Alert: "Failed to upload photo. Please try again."
- Backend logs show error details

## Known Limitations

1. **No Progress Indicator**: Upload shows generic "Uploading..." spinner without progress percentage
2. **No Offline Support**: Photos are uploaded immediately; no offline queue
3. **No Bundle Association**: Photos create individual bundles; true time-based bundling not implemented
4. **No Thumbnail Generation**: Backend TODO at line 96-99 of `media/service.ts`

## Future Enhancements

1. **Offline Queue**: Store photos locally and sync when online
2. **Upload Progress**: Show actual upload percentage
3. **Batch Upload**: Upload multiple photos at once
4. **Smart Bundling**: Group photos by time proximity and work state
5. **Thumbnail Generation**: Generate thumbnails on backend using Sharp
6. **Retry Logic**: Automatic retry for failed uploads

## Related Files

### Mobile App
- `packages/mobile/app/(main)/projects/[projectId]/media/camera.tsx` - Camera screen
- `packages/mobile/app/(main)/projects/[projectId]/media/index.tsx` - Media list screen
- `packages/mobile/lib/api/client.ts` - API client (upload logic)
- `packages/mobile/lib/api/hooks.ts` - React hooks (useMutation, useMedia)

### Backend
- `packages/backend/src/features/media/http.ts` - HTTP endpoints
- `packages/backend/src/features/media/service.ts` - Business logic
- `packages/backend/src/core/storage.ts` - R2 storage service
- `packages/backend/src/core/database/schemas/media.ts` - Database schema

## Verification Checklist

- [ ] Photo captures successfully from camera
- [ ] Upload shows loading indicator
- [ ] Console logs show upload progress
- [ ] Backend logs show file processing
- [ ] Response returns mediaId
- [ ] Navigation back to media list works
- [ ] Media list refetches automatically
- [ ] Photo appears in bundle
- [ ] Photo can be opened in viewer
- [ ] Photo status is preserved
- [ ] Database record created
- [ ] R2 file uploaded

## Rollback Instructions

If this fix causes issues, revert these commits:
1. `packages/mobile/lib/api/client.ts` - Lines 528-603
2. `packages/mobile/app/(main)/projects/[projectId]/media/camera.tsx` - Lines 64-101
3. `packages/mobile/app/(main)/projects/[projectId]/media/index.tsx` - Lines 1-267
4. `packages/backend/src/features/media/http.ts` - Lines 224-299

## Notes

- The `as any` type assertion for FormData is intentional and correct for React Native
- Console logs can be removed after testing confirms the fix works
- The useFocusEffect hook is essential for auto-refresh behavior
