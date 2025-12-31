# Media Upload Flow: Before and After Fix

## Before Fix (Buggy) 🔴

```
Mobile App                    Backend Worker                    R2 Storage
    |                               |                                |
    |  POST /media (photo 1)        |                                |
    |------------------------------>|                                |
    |                               |                                |
    |                               | Stream.runCollect(payload)     |
    |                               | [Part1: field, Part2: file]    |
    |                               |                                |
    |                               | Loop 1: Collect fields         |
    |                               | ✅ Process Part1 (field)       |
    |                               | ⏭️  Skip Part2 (file)          |
    |                               |                                |
    |                               | Loop 2: Process files          |
    |                               | ❌ Access Part2.contentEffect  |
    |                               | 💥 STREAM ALREADY CONSUMED     |
    |                               |    (crash or corrupt state)    |
    |                               |                                |
    |<------------------------------|                                |
    |  Response: 200 OK (maybe)     |                                |
    |                               |                                |
    |  POST /media (photo 2)        |                                |
    |------------------------------>|                                |
    |                               | 💥 WORKER STATE CORRUPTED      |
    |                               | Stream.runCollect(payload)     |
    |                               | ❌ CRASH                       |
    |                               |                                |
    |<------------------------------|                                |
    |  ❌ 500 Internal Server Error |                                |
```

## After Fix (Working) ✅

```
Mobile App                    Backend Worker                    R2 Storage
    |                               |                                |
    |  POST /media (photo 1)        |                                |
    |------------------------------>|                                |
    |                               |                                |
    |                               | Stream.runCollect(payload)     |
    |                               | [Part1: field, Part2: file]    |
    |                               |                                |
    |                               | SINGLE LOOP:                   |
    |                               | ✅ Process Part1 (field)       |
    |                               |    fields['description'] = ... |
    |                               |                                |
    |                               | ✅ Process Part2 (file)        |
    |                               |    mediaData ← contentEffect   |
    |                               |    (consumed immediately!)     |
    |                               |                                |
    |                               | Upload to R2                   |
    |                               |------------------------------>|
    |                               |                                | ✅ Stored
    |                               |<------------------------------|
    |                               |                                |
    |                               | Save to D1 database            |
    |                               | ✅ Media record created        |
    |                               |                                |
    |<------------------------------|                                |
    |  ✅ 200 OK { mediaId: "..." } |                                |
    |                               |                                |
    |  POST /media (photo 2)        |                                |
    |------------------------------>|                                |
    |                               |                                |
    |                               | Stream.runCollect(payload)     |
    |                               | [Part1: field, Part2: file]    |
    |                               |                                |
    |                               | SINGLE LOOP:                   |
    |                               | ✅ Process Part1 (field)       |
    |                               | ✅ Process Part2 (file)        |
    |                               |    mediaData ← contentEffect   |
    |                               |                                |
    |                               | Upload to R2                   |
    |                               |------------------------------>|
    |                               |                                | ✅ Stored
    |                               |<------------------------------|
    |                               |                                |
    |                               | Save to D1 database            |
    |                               | ✅ Media record created        |
    |                               |                                |
    |<------------------------------|                                |
    |  ✅ 200 OK { mediaId: "..." } |                                |
```

## Key Differences

### Buggy Code (Before)
```typescript
const parts = yield* Stream.runCollect(payload)

// Loop 1: Collect fields
for (const part of parts) {
  if (Multipart.isField(part)) {
    fields[part.name] = part.value
  }
}

// Loop 2: Process files (CRASHES!)
for (const part of parts) {
  if (Multipart.isFile(part)) {
    const data = yield* part.contentEffect  // ❌ Stream already consumed!
  }
}
```

### Fixed Code (After)
```typescript
const parts = yield* Stream.runCollect(payload)

// Single loop: Process all parts immediately
for (const part of parts) {
  if (Multipart.isField(part)) {
    fields[part.name] = part.value
  } else if (Multipart.isFile(part)) {
    const data = yield* part.contentEffect  // ✅ Consumed immediately!
  }
}
```

## Why This Matters

Effect-TS streams are **lazy and single-use**. Once you collect a stream with `Stream.runCollect()`, the parts are materialized but their internal effects (`contentEffect`) must be consumed **in the same iteration** to access the underlying data.

Think of it like opening a file handle:
- ✅ Read the file immediately after opening
- ❌ Store the handle, close the context, then try to read later → Crash!

## Testing Strategy

1. **Single upload** - Baseline test
2. **Sequential uploads** - The bug scenario (different requests)
3. **Batch upload** - Multiple files in one request
4. **Concurrent uploads** - Stress test

All scenarios now pass! 🎉
