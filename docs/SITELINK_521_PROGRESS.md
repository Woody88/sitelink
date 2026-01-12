# sitelink-521: PDF Processing Pipeline - Session Progress

## Overview
Event-driven PDF processing pipeline with local-first sync, professional UI, and 4-stage processing.

## ✅ Completed Work

### 1. Domain Package: Events & Schema (461 lines changed)
**Location**: `packages/domain/src/`

#### New Events (7 total)
- **Stage 1**: `planImageGenerationStarted`, `sheetImageGenerated`
- **Stage 2**: `sheetMetadataExtracted`, `planMetadataCompleted`
- **Stage 3**: `sheetCalloutsDetected` (with markers[], needsReview flags)
- **Stage 4**: `sheetTilesGenerated` (with PMTiles paths, zoom levels)

#### Schema Updates
Extended `sheets` table:
- `processingStage` (text, nullable) - Tracks current stage
- `localPmtilesPath` (text, nullable) - Local PMTiles file path
- `remotePmtilesPath` (text, nullable) - Remote PMTiles URL
- `minZoom`, `maxZoom` (integer, nullable) - Tile zoom metadata

#### Materializers
All 7 new event materializers implemented:
- Pure functions (timestamps in events, NOT materializers)
- Progressive sheet enrichment (image → metadata → callouts → tiles)
- Invalid sheet cleanup via `planMetadataCompleted` event

**Status**: ✅ TypeScript compilation passes

---

### 2. Mobile UI: Processing Status Components (345 lines)
**Location**: `apps/mobile/components/plans/plan-processing-status.tsx`

#### Components
1. **PlanProcessingStatus**
   - Compact mode (20px indicator)
   - Full mode (24px circle + text)
   - 7 processing stages
   
2. **DetailedProcessingView**
   - Full-screen modal with 80px progress circle
   - Stage progression list (completed/active/pending)
   - Review button for callout review
   - Dismissable

#### Animations (react-native-reanimated)
- **Completion**: Scale spring (1 → 1.1 → 1, damping: 12, stiffness: 200)
- **Waiting**: Pulsing opacity (1500ms, infinite repeat)
- **Progress**: Circular SVG with animated stroke
- **Transitions**: FadeIn/FadeOut

#### Design
- Minimalistic, professional (Wealthsimple-inspired)
- Clear labels, smooth state transitions
- Badge for review callout count
- Color-coded stages (blue → purple → amber → green)

**Status**: ✅ Component ready for integration

---

### 3. Mobile Viewer: PMTiles Integration
**Location**: `apps/mobile/components/plans/viewer/`

#### New Component
**pmtiles-viewer.tsx** (DOM component)
- OpenSeadragon integration
- PMTiles protocol for efficient tile loading
- Marker overlays with interaction
- Touch gestures (pan/zoom)
- Offline support (local file:// URLs)

#### Modified Components
1. **plan-viewer.tsx** - Conditional rendering logic:
   ```typescript
   if (processingStage === 'tiles_generated' && pmtilesPath) {
     return <PMTilesViewer />
   } else {
     return <OpenSeadragonViewer />
   }
   ```

2. **use-sheets.ts** - Extended Sheet interface with processing fields

3. **plans.tsx** - Pass processing stage and PMTiles paths to viewer

#### Dependencies
- Added `pmtiles@4.3.2`

**Status**: ✅ All TypeScript errors fixed

---

### 4. Backend Architecture: Worker Design Document
**Location**: `docs/PDF_WORKER_ARCHITECTURE.md`

#### Key Decisions

**Hybrid Compute Model**
- **Cloudflare Workers**: Orchestration, queues (Durable Objects), LiveStore commits
- **AWS Lambda**: Heavy compute (VIPS, OpenCV, Python dependencies)
- **Communication**: SQS queues trigger Lambdas → callback to CF Workers

**Stage 2 Coordination ("Wait for All Sheets")**
- Durable Object keyed by `planId`
- Tracks `processedSheets` Set and `validSheets` array
- Emits `planMetadataCompleted` when all sheets processed
- **Rationale**: Atomic state updates, strong consistency

**Python Dependencies (OpenCV)**
- AWS Lambda Python 3.11 runtime + OpenCV layer
- Reuses callout-processor code from backend-dev unchanged
- **Rationale**: CF Workers can't run Python native bindings

**File Storage Strategy**
- **R2 (permanent)**: Final outputs (300 DPI PNGs, PMTiles)
- **Local temp (ephemeral)**: Intermediate files during processing
- **Path structure**: `organizations/{orgId}/projects/{projectId}/plans/{planId}/sheets/sheet-{n}/`

**Queue Priority & Concurrency**
- Image Generation: Priority 10, 2 concurrent (CPU-bound)
- Metadata Extraction: Priority 10, 10 concurrent (lightweight)
- Callout Detection: Priority 5, **1 concurrent** (expensive LLM API)
- PMTiles Generation: Priority 5, 2 concurrent (CPU-bound)

**Partial Failure Handling**
- Continue processing successful sheets
- Mark failed sheets individually
- Users see partial results immediately

**Status**: ✅ Architecture designed, ready for implementation

---

## 📐 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Image Generation (PDF → 300 DPI PNG)              │
│ - AWS Lambda (VIPS)                                         │
│ - Emits: planImageGenerationStarted, sheetImageGenerated   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Metadata Extraction (OCR sheet names)             │
│ - CF Workers (Tesseract.js)                                │
│ - WAIT for ALL sheets (Durable Object coordination)        │
│ - Emits: sheetMetadataExtracted, planMetadataCompleted     │
│ - Output: validSheets list                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Callout Detection (OpenCV + LLM)                  │
│ - AWS Lambda Python (OpenCV, LLM API)                      │
│ - Validates targets against validSheets                     │
│ - Emits: sheetCalloutsDetected (markers[], needsReview)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: PMTiles Generation (VIPS tiles)                   │
│ - AWS Lambda (VIPS)                                         │
│ - Emits: sheetTilesGenerated                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  planProcessingCompleted
                            ↓
              All events → LiveStore (orgId)
                            ↓
              Real-time sync to mobile clients
```

---

## 📋 Next Steps

### Backend Implementation
1. **Durable Object Queue Classes**
   - Create queue DO for each stage
   - Implement coordination DO for Stage 2 (wait for all sheets)
   - Add retry logic and error handling

2. **AWS Lambda Functions**
   - Image generation: VIPS PDF → PNG
   - Callout detection: Port from backend-dev (OpenCV + LLM)
   - PMTiles generation: VIPS tiles → PMTiles

3. **Infrastructure**
   - Set up SQS queues
   - Configure IAM permissions
   - Add event listeners to trigger stages

### Frontend Implementation
1. **Callout Review UI**
   - Review queue screen
   - Detail view with zoomed callout crop
   - Yes/no/edit actions
   - Swipe gestures

2. **Integration**
   - Hook up processing status component to LiveStore events
   - Add plan upload UI with processing feedback
   - Test offline → online transition

3. **Testing**
   - End-to-end pipeline test
   - Verify real-time sync to mobile
   - Test partial failure scenarios

---

## 🗂️ Files Modified/Created

### Domain Package
- ✏️ `packages/domain/src/events.ts` (+236 lines)
- ✏️ `packages/domain/src/tables.ts` (+61 lines)
- ✏️ `packages/domain/src/materializers.ts` (+364 lines)

### Mobile App
- ✨ `apps/mobile/components/plans/plan-processing-status.tsx` (new, 345 lines)
- ✨ `apps/mobile/components/plans/viewer/pmtiles-viewer.tsx` (new)
- ✏️ `apps/mobile/components/plans/viewer/plan-viewer.tsx`
- ✏️ `apps/mobile/hooks/use-sheets.ts`
- ✏️ `apps/mobile/app/project/[id]/plans.tsx`
- ✏️ `apps/mobile/package.json` (added pmtiles@4.3.2)

### Documentation
- ✨ `docs/PDF_WORKER_ARCHITECTURE.md` (new)
- ✨ `docs/SITELINK_521_PROGRESS.md` (this file)

---

## ✅ Verification

- [x] TypeScript compilation passes (`bun tsc --noEmit`)
- [x] All domain events follow LiveStore best practices
- [x] Mobile UI components follow existing patterns
- [x] PMTiles viewer integrated with conditional rendering
- [x] Architecture document complete and ready for implementation

---

## 🎯 Session Summary

**What was built:**
- Complete event-driven domain model for 4-stage PDF processing
- Professional, animated mobile UI for processing status
- PMTiles viewer integration for processed plans
- Comprehensive backend architecture design

**What's ready:**
- Domain events, tables, and materializers (fully implemented)
- Processing status UI components (ready for integration)
- PMTiles viewer (ready for testing with processed plans)
- Worker architecture (designed, ready for implementation)

**Next session priorities:**
1. Implement backend workers (high priority)
2. Build callout review UI
3. End-to-end testing
