# PDF Processing Simplification

> **Status:** Planned
> **Created:** 2025-01-11
> **Related:** Plan upload feature, Local-first architecture

## Problem Summary

The current PDF processing uses a DOM component (`'use dom'`) that runs in a WebView, but it's not executing properly. The architecture is overcomplicated.

**Current Issues:**

- PDFProcessor DOM component mounts but doesn't execute (no logs from inside)
- Requires WebView for pdf.js canvas rendering
- Complex callback orchestration between RN and WebView

**Key Insight:** `pdf-lib` is pure JavaScript and works directly in React Native - no WebView needed for PDF splitting.

## Solution: Direct React Native Processing

Remove the DOM component entirely. Process PDFs directly in React Native using pdf-lib.

### Thumbnail Strategy: PDF-Based On-Demand Rendering

- Store single-page PDFs only (no PNG generation)
- Use placeholder icons in grid view for MVP
- Future: render PDF thumbnails on-demand or via backend enrichment

## Document Picker

The current implementation correctly uses `expo-document-picker`:

```typescript
import * as DocumentPicker from "expo-document-picker"

const result = await DocumentPicker.getDocumentAsync({
  type: ["application/pdf"],
  copyToCacheDirectory: true, // Required for expo-file-system compatibility
  multiple: false,
})
```

**Notes:**

- `copyToCacheDirectory: true` is required for `expo-file-system` to read the file immediately
- Expo SDK 52+ and iOS 14+ required
- Web requires user activation (button press) before calling `getDocumentAsync`

**Sources:** [Expo DocumentPicker Docs](https://docs.expo.dev/versions/latest/sdk/document-picker/)

## File Changes

| File                                           | Action                          |
| ---------------------------------------------- | ------------------------------- |
| `apps/mobile/services/pdf-processor.ts`        | CREATE - Pure RN PDF processing |
| `apps/mobile/components/pdf/pdf-processor.tsx` | DELETE - Remove DOM component   |
| `apps/mobile/hooks/use-plan-upload.ts`         | MODIFY - Call service directly  |
| `apps/mobile/services/plan-upload-service.ts`  | MODIFY - Save PDFs only         |
| `apps/mobile/components/pdf/types.ts`          | MODIFY - Simplify interface     |
| `apps/mobile/utils/file-paths.ts`              | MODIFY - Add getSheetPdfPath()  |

## Implementation Details

### 1. Create `/apps/mobile/services/pdf-processor.ts`

```typescript
import { PDFDocument } from "pdf-lib"

export interface ProcessedSheet {
  pageNumber: number
  pdfBase64: string
  width: number
  height: number
}

export async function processPDF(
  pdfBase64: string,
  onProgress?: (current: number, total: number) => void,
): Promise<ProcessedSheet[]> {
  // Convert base64 to Uint8Array
  const binaryString = atob(pdfBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const pdfDoc = await PDFDocument.load(bytes)
  const pageCount = pdfDoc.getPageCount()
  const sheets: ProcessedSheet[] = []

  for (let i = 0; i < pageCount; i++) {
    onProgress?.(i + 1, pageCount)

    // Create single-page PDF
    const singlePageDoc = await PDFDocument.create()
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i])
    singlePageDoc.addPage(copiedPage)

    // Get dimensions from original page
    const page = pdfDoc.getPage(i)
    const { width, height } = page.getSize()

    // Save as base64
    const pdfBytes = await singlePageDoc.save()
    const base64 = btoa(String.fromCharCode(...pdfBytes))

    sheets.push({ pageNumber: i + 1, pdfBase64: base64, width, height })
  }

  return sheets
}
```

### 2. Modify `/apps/mobile/hooks/use-plan-upload.ts`

Key changes:

- Remove `pdfToProcess` state and `renderProcessor` callback
- Remove PDFProcessor import
- Call `processPDF()` directly after `uploadPlan()`
- Process synchronously in the hook

```typescript
import { processPDF } from "@/services/pdf-processor"

const pickAndUploadPlan = useCallback(async () => {
  // ... file picker code unchanged ...

  const { pdfDataBase64 } = await uploadPlan(store, options)

  // Process directly - no WebView!
  const sheets = await processPDF(pdfDataBase64, (current, total) => {
    setUploadProgress((prev) =>
      prev
        ? {
            ...prev,
            progress: Math.round((current / total) * 100),
            currentPage: current,
            totalPages: total,
          }
        : null,
    )
  })

  // Save each sheet
  for (const sheet of sheets) {
    const savedSheet = await saveProcessedSheet(organizationId, projectId, planId, sheet)
    store.commit(events.sheetsReceived({ projectId, planId, sheets: [savedSheet] }))
  }

  // Complete
  store.commit(
    events.planProcessingCompleted({ planId, sheetCount: sheets.length, completedAt: new Date() }),
  )
}, [])

// Remove: renderProcessor, pdfToProcess state, handlePageProcessed, etc.
return { pickAndUploadPlan, uploadProgress, resetProgress, isUploading }
```

### 3. Modify `/apps/mobile/services/plan-upload-service.ts`

Update `saveProcessedSheet` to work with new interface:

```typescript
export async function saveProcessedSheet(
  organizationId: string,
  projectId: string,
  planId: string,
  sheet: { pageNumber: number; pdfBase64: string; width: number; height: number },
): Promise<SheetMetadata> {
  await ensureSheetDirectoryExists(organizationId, projectId, planId, sheet.pageNumber)

  const pdfPath = getSheetPdfPath(organizationId, projectId, planId, sheet.pageNumber)

  await FileSystem.writeAsStringAsync(pdfPath, sheet.pdfBase64, {
    encoding: FileSystem.EncodingType.Base64,
  })

  return {
    id: `${planId}_sheet_${sheet.pageNumber}`,
    number: String(sheet.pageNumber),
    title: `Sheet ${sheet.pageNumber}`,
    discipline: "GENERAL",
    localImagePath: pdfPath, // Point to PDF for now
    localThumbnailPath: pdfPath, // Point to PDF for now
    imagePath: undefined,
    width: sheet.width,
    height: sheet.height,
  }
}
```

### 4. Modify `/apps/mobile/utils/file-paths.ts`

Add new helper:

```typescript
export function getSheetPdfPath(
  organizationId: string,
  projectId: string,
  planId: string,
  pageNumber: number,
): string {
  return `${getSheetPath(organizationId, projectId, planId, pageNumber)}/source.pdf`
}
```

### 5. Modify `/apps/mobile/components/pdf/types.ts`

Simplify the interface:

```typescript
export interface ProcessedSheet {
  pageNumber: number
  pdfBase64: string
  width: number
  height: number
}

// Keep old interface for backward compatibility during transition
export interface ProcessedPage {
  pageNumber: number
  fullImageDataUrl: string
  thumbnailDataUrl: string
  pdfData?: string
  width: number
  height: number
}
```

### 6. Delete `/apps/mobile/components/pdf/pdf-processor.tsx`

Remove the entire DOM component file.

## New Storage Structure

```
storage/sitelink/{orgId}/{projectId}/plans/{planId}/
├── source.pdf              # Original multi-page PDF
└── sheets/
    ├── 001/
    │   └── source.pdf      # Single-page PDF
    ├── 002/
    │   └── source.pdf
    └── ...
```

## UI Considerations

The plan selector grid view currently expects thumbnail images. Options:

1. **MVP**: Show placeholder icons with sheet numbers
2. **Later**: Render PDF thumbnails using react-native-pdf or WebView
3. **Backend**: Generate thumbnails server-side as async enrichment

For MVP, the existing UI should gracefully handle missing image files.

## Verification

1. **Test plan upload flow:**

   ```
   - Open a project
   - Tap "Add Plan"
   - Select a multi-page PDF
   - Verify progress updates appear
   - Verify sheets appear in plan list
   ```

2. **Check file system:**

   ```bash
   # On device, verify files exist:
   ls storage/sitelink/{orgId}/{projectId}/plans/{planId}/sheets/001/
   # Should see: source.pdf
   ```

3. **Check LiveStore events:**
   - Verify `planUploaded`, `planProcessingStarted`, `sheetsReceived`, `planProcessingCompleted` events

4. **Type check:** `bun tsc`
5. **Lint check:** `bun lint`

## Why This Works

1. **No WebView needed** - pdf-lib is pure JavaScript, runs directly in React Native
2. **Simpler architecture** - Direct function calls instead of component mounting/callbacks
3. **More reliable** - No "WebView didn't call back" issues
4. **Smaller bundle** - Can potentially remove pdf.js from the bundle
5. **Easier debugging** - All code runs in the same JS context

## Future Enhancements

### Thumbnail Generation (Post-MVP)

Options for adding real thumbnails later:

1. **Backend enrichment** - Upload PDF to server, receive thumbnails via sync
2. **react-native-pdf** - Native PDF rendering library
3. **WebView on-demand** - Small WebView that renders PDF page when thumbnail is viewed

### OCR/Callout Detection

As suggested by the architecture discussion, treat OCR and callout detection as "asynchronous enrichment":

1. **Local Event:** `PLAN_UPLOADED` - immediate, works offline
2. **Sync Event:** `FILE_SYNCED` - when device gets connectivity
3. **Backend Event:** `OCR_PROCESSED` - pushed down to device

This maintains local-first UX while leveraging server capabilities for heavy processing.
