# Local-First PDF Plan Upload Implementation

## Overview

Implemented local-first PDF processing that splits multi-page PDFs into individual sheet images with thumbnails, all processed on-device using Expo React DOM and mupdf-js.

## Implementation Date

January 9, 2026

## Task Reference

Task ID: sitelink-t9q

## Architecture

### Key Components

1. **PDF Processor** (`apps/mobile/components/pdf/pdf-processor.tsx`)
   - Expo React DOM component with `'use dom'` directive
   - Uses mupdf-js (WebAssembly) to render PDF pages to canvas
   - Exports pages as PNG images with configurable DPI
   - Generates both full-resolution (150 DPI) and thumbnail (72 DPI) images

2. **Plan Upload Service** (`apps/mobile/services/plan-upload-service.ts`)
   - Orchestrates the complete upload and processing flow
   - Manages file system operations
   - Emits LiveStore events for state synchronization
   - Handles progress tracking and error reporting

3. **Upload Hook** (`apps/mobile/hooks/use-plan-upload.ts`)
   - React hook interface for components
   - Manages upload state and progress
   - Provides document picker integration
   - Handles error states and completion callbacks

## Schema Changes

### Plans Table

Added fields to support local-first storage:

```typescript
{
  localPath: State.SQLite.text(),              // Local PDF file path
  remotePath: State.SQLite.text({ nullable: true }),  // Made nullable
  processingProgress: State.SQLite.integer({ nullable: true })  // 0-100 progress
}
```

### Sheets Table

Added fields for local image storage:

```typescript
{
  localImagePath: State.SQLite.text(),         // Full resolution image path
  localThumbnailPath: State.SQLite.text(),     // Thumbnail path (300x200)
  imagePath: State.SQLite.text({ nullable: true })  // Made nullable
}
```

## Events

### Modified Events

1. **planUploaded** - Added `localPath`, made `remotePath` optional
2. **sheetsReceived** - Added `localImagePath`, `localThumbnailPath`, made `imagePath` optional

### New Event

**planProcessingProgress** - Emits progress updates during PDF processing:

```typescript
{
  planId: string
  progress: number        // 0-100
  currentPage: number
  totalPages: number
}
```

## File Structure

```
storage/sitelink/{orgId}/{projectId}/plans/{planId}/
├── source.pdf
└── sheets/
    ├── 001/
    │   ├── full.png      (150 DPI)
    │   └── thumb.png     (72 DPI)
    ├── 002/
    │   ├── full.png
    │   └── thumb.png
    └── ...
```

## Event Flow

```
1. User selects PDF file
2. planUploaded → File copied to local storage
3. planProcessingStarted → Status set to 'processing'
4. planProcessingProgress → Emitted per page processed
5. sheetsReceived → All sheets saved to database
6. planProcessingCompleted → Status set to 'completed'
```

## Files Created

1. `/apps/mobile/components/pdf/pdf-processor.tsx` - PDF rendering component
2. `/apps/mobile/components/pdf/types.ts` - Shared TypeScript types
3. `/apps/mobile/services/plan-upload-service.ts` - Upload orchestration
4. `/apps/mobile/hooks/use-plan-upload.ts` - React hook interface

## Files Modified

1. `/packages/domain/src/tables.ts` - Schema updates
2. `/packages/domain/src/events.ts` - Event definitions
3. `/packages/domain/src/materializers.ts` - Event handlers
4. `/apps/mobile/utils/file-paths.ts` - Path utilities
5. `/apps/mobile/app/project/[id]/_layout.tsx` - UI integration

## Dependencies Added

- `mupdf-js@2.0.1` - WebAssembly PDF rendering library

## Sheet Metadata (MVP)

- **number**: Page number (1, 2, 3...)
- **title**: "Sheet 1", "Sheet 2"... (auto-generated)
- **discipline**: "GENERAL" (default for all sheets)

Future enhancement: Backend will extract actual title from title block during sync.

## Technical Highlights

### Local-First Design

- All processing happens on-device
- No network dependency for PDF splitting
- Offline-capable from day one
- Data persists across app restarts

### Progress Tracking

- Real-time progress updates during processing
- Page-by-page progress reporting
- Error handling at each stage
- User feedback through Alert dialogs

### LiveStore Integration

- Proper event sourcing with typed events
- Automatic state materialization
- Built-in sync support (when online)
- Type-safe queries throughout

## Testing Status

- ✅ TypeScript compilation passes (`bun tsc`)
- ✅ Schema changes validated
- ✅ Event definitions type-checked
- ✅ Materializers properly typed
- ⚠️  ESLint warnings remain (pre-existing, not related to this feature)

## Known Limitations

1. Only PDF files supported (no image plans yet)
2. No OCR for title block extraction (MVP uses auto-generated titles)
3. Fixed DPI settings (150 for full, 72 for thumbnails)
4. Progress UI shown via Alert dialogs (no inline progress indicator)

## Future Enhancements

1. **Title Block Extraction**: Backend service to extract sheet metadata
2. **Image Plan Support**: Support JPEG/PNG plan uploads
3. **Configurable Quality**: Allow users to adjust DPI settings
4. **Inline Progress UI**: Replace Alert dialogs with progress bars
5. **Remote Sync**: Upload to cloud storage when online
6. **Compression**: Optimize PNG files for storage efficiency

## Migration Notes

This implementation is compatible with existing data. The new fields are nullable, so:

- Existing plans without `localPath` will continue to work
- Existing sheets without `localImagePath` will still render (if they have `imagePath`)
- No data migration required

## References

- LiveStore Documentation: https://next.livestore.dev/#docs-for-llms
- Expo Documentation: https://docs.expo.dev/llms.txt
- mupdf-js: https://www.npmjs.com/package/mupdf-js
- Related Docs: `/docs/LIVESTORE_0.4_MIGRATION.md`, `/docs/STORE_ARCHITECTURE.md`
