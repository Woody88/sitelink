# Callout Processor Implementation Summary

**Date:** December 18, 2025

## Overview

Implemented the callout-processor service as shown in `design.drawio`. This replaces the old tile-based marker detection with a simpler per-sheet architecture.

## Architecture (Complete Flow)

The original `design.drawio` was missing the metadata extraction step. See the new "Implementation Status (Complete Flow)" page in design.drawio for the visual diagram.

```
User → Plan Service → R2 (original PDF) → PDF Processing Queue → PDF Splitter
                                                                      ↓
                                                               R2 (sheet PDFs)
                                                                      ↓
                                          ┌───────────────────────────┼───────────────────────────┐
                                          ↓                           ↓                           ↓
                              Metadata Extraction Queue      Tile Generator Queue      (wait for metadata)
                                          ↓                           ↓
                              PLAN_OCR_SERVICE              Generate DZI Tiles
                              /api/extract-metadata                   ↓
                                          ↓                      R2 (tiles)
                              D1 (planSheets.sheetName)
                              stores "A1", "A5", etc.
                                          ↓
                              PlanCoordinator ←────────── queries validSheets from D1
                                          ↓
                              Callout Processing Queue
                              (includes validSheets in job)
                                          ↓
                              Callout Processor (NEW)
                              receives: PDF + X-Valid-Sheets header
                                          ↓
                              D1 (plan_markers)
```

**Key Dependency**: The Callout Processor needs `validSheets` to filter detected markers. This comes from the Metadata Extraction step which runs first and stores sheet names (e.g., "A1", "A5") in the database.

## What Was Implemented

### New Package: `packages/callout-processor/`

REST API server (Bun) with endpoints:
- `GET /health` - Health check
- `POST /api/extract-metadata` - PDF metadata extraction (sheet number, dimensions)
- `POST /api/detect-markers` - Marker detection using CV + LLM approach

**Technology Stack:**
- Bun for HTTP server
- Python + OpenCV for shape detection
- LLM (via OpenRouter) for callout classification
- libvips for PDF → PNG conversion

**Key Files:**
- `src/api/server.ts` - HTTP server entry point
- `src/api/routes/health.ts` - Health endpoint
- `src/api/routes/metadata.ts` - Metadata extraction endpoint
- `src/api/routes/markers.ts` - Marker detection endpoint
- `Dockerfile` - Container with Bun + Python + vips

### Backend Updates: `packages/backend/`

**New Types (`src/core/queues/types.ts`):**
```typescript
export interface SheetMarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]
  // Per-sheet fields (no chunking)
  sheetId: string
  sheetNumber: number
  sheetKey: string  // R2 path to sheet PDF
  totalSheets: number
}
```

**New Queue Consumer (`src/core/queues/index.ts`):**
- `sheetMarkerDetectionQueueConsumer()` - Processes batch of sheet marker detection jobs
- `processSheetMarkerDetectionJob()` - Handles individual sheet:
  1. Fetches sheet PDF from R2
  2. Sends to CALLOUT_PROCESSOR container
  3. Inserts markers into plan_markers table

**New Container Class (`src/core/callout-processor/index.ts`):**
```typescript
export class CalloutProcessor extends Container {
  override defaultPort = 8000
  override sleepAfter = "10m"
  // ...
}
```

**Configuration Updates:**
- `wrangler.jsonc` - Added CalloutProcessor container and binding
- `worker-configuration.d.ts` - Added CALLOUT_PROCESSOR type
- `vitest.config.mts` - Added test binding for port 8001

## Files Changed

| File | Action |
|------|--------|
| `callout-processor/src/api/server.ts` | Created |
| `callout-processor/src/api/routes/health.ts` | Created |
| `callout-processor/src/api/routes/metadata.ts` | Created |
| `callout-processor/src/api/routes/markers.ts` | Created |
| `callout-processor/Dockerfile` | Created |
| `callout-processor/.dockerignore` | Created |
| `backend/src/core/callout-processor/index.ts` | Created |
| `backend/src/core/queues/types.ts` | Added SheetMarkerDetectionJob |
| `backend/src/core/queues/index.ts` | Added sheetMarkerDetectionQueueConsumer |
| `backend/src/index.ts` | Export CalloutProcessor, sheetMarkerDetectionQueueConsumer |
| `backend/wrangler.jsonc` | Added CalloutProcessor container/binding |
| `backend/worker-configuration.d.ts` | Added CALLOUT_PROCESSOR type |
| `backend/vitest.config.mts` | Added CALLOUT_PROCESSOR test binding |
| `backend/tests/unit/bun/queue-sheet-marker-detection.test.ts` | Created (12 tests) |
| `backend/tests/integration/queue-callout-processor.test.ts` | Created |

## Test Results

**Unit Tests (bun test):**
- 72 pass
- 11 skip (pre-existing incomplete tests)
- 0 fail

**Integration Tests (with Docker container):**
- Health endpoint: Pass
- Metadata extraction: Pass (3.8s)
- Marker detection: Pass (slow due to LLM - 574 shapes in sample PDF)
- Error handling: Pass

## Key Differences from Old Architecture

| Aspect | Old (tile-based) | New (sheet-based) |
|--------|------------------|-------------------|
| Input | Base64 encoded tiles | Raw PDF binary |
| Chunking | Yes (CHUNK_SIZE=4) | No (one job per sheet) |
| Container binding | PLAN_OCR_SERVICE | CALLOUT_PROCESSOR |
| Job type | MarkerDetectionJob | SheetMarkerDetectionJob |
| Complexity | High | Low |

## Running the Container Locally

```bash
# Build
cd packages/callout-processor
docker build -t callout-processor:test .

# Run
docker run -d --name callout-processor-test -p 8001:8000 \
  -e OPENROUTER_API_KEY="your-key" \
  callout-processor:test

# Verify
curl http://localhost:8001/health
# {"status":"ready","service":"callout-processor"}

# Stop
docker stop callout-processor-test && docker rm callout-processor-test
```

## What's NOT Changed

The following still use `PLAN_OCR_SERVICE` and were not modified:
- `metadataExtractionQueueConsumer` - Extracts sheet numbers (separate from marker detection)
- `markerDetectionQueueConsumer` - Old tile-based approach (deprecated, kept for compatibility)

## Next Steps (Optional)

1. **Wire to production queue** - Connect `sheetMarkerDetectionQueueConsumer` to `marker-detection-queue`
2. **Update PlanCoordinator** - Modify `triggerMarkerDetection()` to create `SheetMarkerDetectionJob` instead of old `MarkerDetectionJob`
3. **Remove old code** - Delete `plan-ocr-service` after full migration
