# Bug Fix Summary: Sequential Media Upload Crash

## Issue
Backend crashed when uploading multiple photos in sequence from the mobile camera.

## Root Cause
The media upload handler was iterating over multipart stream parts twice:
1. First loop to collect form fields
2. Second loop to process files and call `part.contentEffect`

**Problem:** `part.contentEffect` must be consumed immediately when the stream part is encountered. Accessing it in a second iteration after `Stream.runCollect()` caused the crash.

## Solution
Combined both loops into a single iteration, ensuring `part.contentEffect` is consumed immediately.

## Files Changed
- ✅ `/packages/backend/src/features/media/http.ts` - Fixed the double-loop bug
- ✅ Added comprehensive logging for debugging

## Files Created
- ✅ `/packages/backend/tests/integration/media.test.ts` - Integration tests
- ✅ `/packages/backend/test-media-upload.sh` - Manual test script
- ✅ `/packages/backend/docs/BUGFIX_MEDIA_SEQUENTIAL_UPLOAD.md` - Detailed documentation

## Testing

### Run Integration Tests
```bash
cd /home/woodson/Code/projects/sitelink/packages/backend
bun run vitest tests/integration/media.test.ts
```

### Manual Testing
```bash
# Start the backend
cd /home/woodson/Code/projects/sitelink/packages/backend
bun wrangler dev --local

# In another terminal, run the test script
./test-media-upload.sh
```

### Expected Behavior
- ✅ First photo upload: Returns 200 OK with mediaId
- ✅ Second photo upload: Returns 200 OK with different mediaId (no crash!)
- ✅ Both photos saved to database
- ✅ Both photos uploaded to R2 storage

## Verification Checklist
- [ ] Backend starts without errors: `bun wrangler dev --local`
- [ ] Upload first photo from mobile app
- [ ] Upload second photo from mobile app (should work now!)
- [ ] Check logs for success messages
- [ ] Verify both photos appear in the mobile app
- [ ] Run integration tests: `bun run vitest tests/integration/media.test.ts`

## Related Issues
This same pattern was checked in other upload endpoints:
- ✅ Files upload (`/packages/backend/src/features/files/http.ts`) - OK
- ✅ Plans upload (`/packages/backend/src/features/plans/http.ts`) - OK

No other occurrences of the double-loop antipattern were found.

## Prevention
- Added code comment: `// MUST be consumed immediately`
- Created integration tests for sequential operations
- Documented the correct pattern in bugfix documentation

## Status
🟢 **FIXED** - Ready for testing
