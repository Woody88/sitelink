# Bug Fix: Backend Crash on Sequential Media Uploads

**Issue ID:** sitelink-fks
**Date:** 2025-12-31
**Severity:** High
**Status:** Fixed

## Summary

The backend was crashing when uploading multiple photos in sequence from the mobile camera. The root cause was improper handling of Effect-TS multipart stream parts in the media upload endpoint.

## Root Cause

In `/packages/backend/src/features/media/http.ts`, the `uploadMedia` handler was iterating over the multipart stream parts **twice**:

1. **First loop** (lines 235-239): Collected form fields
2. **Second loop** (lines 248-289): Processed file parts and called `part.contentEffect`

### The Problem

After `Stream.runCollect(payload)` is called, the stream is consumed and materialized into a collection. However, the `part.contentEffect` property on file parts contains a **lazy Effect** that must be consumed immediately during the first iteration.

When attempting to access `part.contentEffect` in the second loop, the underlying stream data was no longer available, causing a crash.

### Why Sequential Uploads Failed

- **First upload:** Might succeed due to timing/buffering
- **Second upload:** Definitively failed because the worker's stream handling had already been corrupted by the first request

## The Fix

Combined both loops into a **single iteration** over the parts, ensuring `part.contentEffect` is consumed immediately when encountered.

Additionally, added comprehensive logging to help debug any future issues with media uploads.

### Before (Buggy Code)

```typescript
// Parse multipart stream to get media files and fields
const parts = yield* Stream.runCollect(payload)

// FIRST LOOP: Collect form fields
const fields: Record<string, string> = {}
for (const part of parts) {
  if (Multipart.isField(part)) {
    fields[part.name] = part.value
  }
}

const uploadedMedia: Array<{
  mediaId: string
  fileName: string
  mediaType: string
}> = []

// SECOND LOOP: Process file parts (CRASHES HERE!)
for (const part of parts) {
  if (Multipart.isFile(part)) {
    // ❌ This fails because contentEffect was not consumed immediately
    const mediaData = yield* part.contentEffect
    // ... rest of upload logic
  }
}
```

### After (Fixed Code)

```typescript
// Parse multipart stream to get media files and fields
const parts = yield* Stream.runCollect(payload)

// Collect form fields and process files in a SINGLE iteration
const fields: Record<string, string> = {}
const uploadedMedia: Array<{
  mediaId: string
  fileName: string
  mediaType: string
}> = []

// SINGLE LOOP: Process all parts immediately
for (const part of parts) {
  if (Multipart.isField(part)) {
    fields[part.name] = part.value
  } else if (Multipart.isFile(part)) {
    // ✅ contentEffect consumed immediately in the same iteration
    const mediaData = yield* part.contentEffect
    // ... rest of upload logic
  }
}
```

## Impact

- **Affected Endpoint:** `POST /api/projects/:projectId/media`
- **Symptoms:**
  - Backend crash on second photo upload
  - Worker unable to process subsequent requests
  - Mobile app photo uploads failing intermittently

## Verification

### Automated Tests

Created comprehensive integration tests in `/tests/integration/media.test.ts`:

1. ✅ Single photo upload
2. ✅ Two photos uploaded sequentially (different requests)
3. ✅ Multiple photos in a single request

Run tests:
```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
bun run vitest tests/integration/media.test.ts
```

### Manual Testing

Use the provided test script:
```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
chmod +x test-media-upload.sh
./test-media-upload.sh
```

Or test with curl:
```bash
# First upload
curl -X POST http://localhost:8787/api/projects/{PROJECT_ID}/media \
  -H "Cookie: your-session-cookie" \
  -F "photo=@photo1.jpg;type=image/jpeg" \
  -F "description=First photo"

# Second upload (was crashing before fix)
curl -X POST http://localhost:8787/api/projects/{PROJECT_ID}/media \
  -H "Cookie: your-session-cookie" \
  -F "photo=@photo2.jpg;type=image/jpeg" \
  -F "description=Second photo"
```

## Related Files

- **Fixed:** `/packages/backend/src/features/media/http.ts`
- **Tests:** `/packages/backend/tests/integration/media.test.ts`
- **Test Script:** `/packages/backend/test-media-upload.sh`

## Similar Patterns

Checked other multipart upload handlers for the same bug:

- ✅ `/packages/backend/src/features/files/http.ts` - **OK** (single loop)
- ✅ `/packages/backend/src/features/plans/http.ts` - **OK** (single loop)

## Lessons Learned

1. **Effect-TS Stream Handling:** When working with `Stream.runCollect()` on multipart data, consume `part.contentEffect` **immediately** in the same iteration.

2. **Pattern to Follow:** See `/packages/backend/src/features/plans/http.ts` (lines 266-283) for the correct pattern.

3. **Testing:** Always test sequential operations (not just single operations) when dealing with stateful resources like streams.

## Prevention

- Code review checklist: Check for multiple loops over `Stream.runCollect()` results
- Integration tests should cover sequential operations
- Document Effect-TS stream patterns in team guidelines

## References

- Effect-TS Documentation: https://effect.website/docs/guides/streaming
- Multipart Handling: `@effect/platform` package
- Issue Tracker: sitelink-fks
