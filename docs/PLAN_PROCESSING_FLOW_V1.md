● Here's a comprehensive text-based diagram showing the complete plan processing flow:

  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │                          SITELINK PLAN PROCESSING FLOW                              │
  │                        (with plan-ocr-service integration)                          │
  └─────────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │    USER     │
  │  (Mobile/   │
  │    Web)     │
  └──────┬──────┘
         │
         │ 1. Upload PDF (e.g., 5-page construction plan)
         │    POST /api/plans
         ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                        BACKEND WORKER (Effect-TS)                                │
  ├──────────────────────────────────────────────────────────────────────────────────┤
  │  • PlanService.create()                                                          │
  │  • Generate IDs: planId, uploadId, fileId                                       │
  │  • Upload to R2: organizations/{org}/projects/{proj}/plans/{plan}/uploads/      │
  │                  {upload}/original.pdf                                          │
  │  • Insert into D1: PLANS, PLAN_UPLOADS                                          │
  │  • Trigger PDF Processing                                                       │
  └────────────────────────────────┬─────────────────────────────────────────────────┘
                                   │
                                   │ 2. Enqueue PDF Processing
                                   ▼
          ┌────────────────────────────────────────────────────┐
          │  QUEUE 1: PDF Processing Queue                     │
          │  • Batch: 1                                        │
          │  • Consumer: pdfProcessingQueueConsumer()          │
          └────────────────┬───────────────────────────────────┘
                           │
                           │ 3. Process PDF
                           ▼
          ┌─────────────────────────────────────────────────────────────────┐
          │  PDF PROCESSING                                                 │
          │  ──────────────────────────────────────────────────────────────│
          │  • Download original.pdf from R2                               │
          │  • Use pdf-lib to get page count (5 pages)                    │
          │  • Split into individual sheets:                               │
          │    - sheet-1.pdf (page 1)                                      │
          │    - sheet-2.pdf (page 2)                                      │
          │    - sheet-3.pdf (page 3)                                      │
          │    - sheet-4.pdf (page 4)                                      │
          │    - sheet-5.pdf (page 5)                                      │
          │  • Upload each sheet to R2                                     │
          │  • Insert 5 records into PLAN_SHEETS table:                    │
          │    - status: "pending"                                         │
          │    - metadataStatus: "pending"                                 │
          │    - sheetNumber: 1, 2, 3, 4, 5                               │
          └─────────────────┬───────────────────────────────────────────────┘
                            │
                            │ 4. Initialize PlanCoordinator
                            ▼
          ┌────────────────────────────────────────────────────┐
          │  PLANCOORDINATOR DURABLE OBJECT                    │
          │  ──────────────────────────────────────────────────│
          │  POST /initialize                                   │
          │  {                                                  │
          │    uploadId, planId, totalSheets: 5,               │
          │    organizationId, projectId                       │
          │  }                                                  │
          │                                                     │
          │  State Storage:                                     │
          │  {                                                  │
          │    totalSheets: 5,                                 │
          │    completedSheets: [],                            │
          │    failedSheets: [],                               │
          │    status: "in_progress"                           │
          │  }                                                  │
          └────────────────────────────────────────────────────┘
                            │
                            │ 5. Enqueue Metadata Extraction (5 jobs)
                            ▼
          ┌────────────────────────────────────────────────────────────────┐
          │  QUEUE 2: Metadata Extraction Queue (Sheet-Level, PARALLEL)   │
          │  • Batch: 5 messages                                           │
          │  • Max Concurrency: 20                                         │
          │  • Consumer: metadataExtractionQueueConsumer()                 │
          │                                                                │
          │  Job 1: sheet-1.pdf  ─┐                                       │
          │  Job 2: sheet-2.pdf  ─┤                                       │
          │  Job 3: sheet-3.pdf  ─┼─► Process in Parallel                │
          │  Job 4: sheet-4.pdf  ─┤                                       │
          │  Job 5: sheet-5.pdf  ─┘                                       │
          └────────────┬───────────────────────────────────────────────────┘
                       │
                       │ 6. Process Each Sheet (parallel)
                       │
          ┌────────────▼──────────────────────────────────────────────────┐
          │  PER-SHEET METADATA EXTRACTION                                │
          │  ──────────────────────────────────────────────────────────── │
          │  For each sheet (e.g., sheet-1.pdf):                         │
          │                                                                │
          │  a) Update DB: metadataStatus → "extracting"                 │
          │                                                                │
          │  b) Get sheet PDF from R2                                     │
          │                                                                │
          │  c) Generate presigned URL (1 hour expiry)                    │
          │                                                                │
          │  d) Call plan-ocr-service ──────────────────────┐             │
          └─────────────────────────────────────────────────┼─────────────┘
                                                             │
                                     ┌───────────────────────▼──────────────┐
                                     │  PLAN-OCR-SERVICE                    │
                                     │  (Python FastAPI Container)          │
                                     │  ─────────────────────────────────── │
                                     │  POST /api/extract-metadata          │
                                     │  {                                    │
                                     │    sheet_url: <presigned-url>,       │
                                     │    sheet_id: "sheet_abc123"          │
                                     │  }                                    │
                                     │                                       │
                                     │  Processing:                          │
                                     │  • Download PDF from presigned URL   │
                                     │  • Convert to image (DPI 200)        │
                                     │  • Try 5 title block locations       │
                                     │  • OCR with Tesseract                │
                                     │  • Extract sheet number (regex)      │
                                     │  • LLM fallback if low confidence    │
                                     │                                       │
                                     │  Response:                            │
                                     │  {                                    │
                                     │    sheet_number: "A5",               │
                                     │    metadata: {                       │
                                     │      title_block_location: {...},   │
                                     │      extracted_text: "...",         │
                                     │      confidence: 0.95,              │
                                     │      method: "tesseract"            │
                                     │    }                                 │
                                     │  }                                    │
                                     └──────────────┬───────────────────────┘
                                                    │
          ┌─────────────────────────────────────────▼─────────────────────┐
          │  e) Update PLAN_SHEETS table:                                 │
          │     - sheetName: "A5"                                         │
          │     - metadata: <JSON>                                        │
          │     - metadataStatus: "extracted"                             │
          │     - metadataExtractedAt: <timestamp>                        │
          │                                                                │
          │  f) Notify PlanCoordinator ────────────┐                      │
          └────────────────────────────────────────┼──────────────────────┘
                                                    │
                                     ┌──────────────▼──────────────────┐
                                     │  PLANCOORDINATOR                │
                                     │  POST /sheet-complete           │
                                     │  {                              │
                                     │    sheetId: "sheet_abc123",     │
                                     │    sheetNumber: 1,              │
                                     │    success: true                │
                                     │  }                              │
                                     │                                 │
                                     │  Update State:                  │
                                     │  completedSheets: ["sheet1"]    │
                                     │                                 │
                                     │  Check: completed + failed      │
                                     │         === totalSheets?        │
                                     │                                 │
                                     │  (Repeat for sheets 2-5...)     │
                                     └─────────────┬───────────────────┘
                                                   │
                       ┌───────────────────────────┴──────────────────────────┐
                       │  When ALL 5 sheets complete:                         │
                       │  completedSheets: ["sheet1","sheet2","sheet3",       │
                       │                    "sheet4","sheet5"]                 │
                       │  status: "completed"                                  │
                       │                                                       │
                       │  Auto-trigger next phase ────────────────────┐       │
                       └──────────────────────────────────────────────┼───────┘
                                                                       │
                                                                       │ 7. Enqueue Plan Tile Generation
                                                                       ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  QUEUE 3: Plan Tile Generation Queue                 │
                       │  • Batch: 1 (plan-level operation)                   │
                       │  • Consumer: planTileGenerationQueueConsumer()       │
                       │                                                       │
                       │  Message: {                                           │
                       │    uploadId, planId, organizationId, projectId,      │
                       │    totalSheets: 5,                                    │
                       │    completedSheets: 5,                                │
                       │    failedSheets: 0                                    │
                       │  }                                                    │
                       └────────────┬─────────────────────────────────────────┘
                                    │
                                    │ 8. Generate Tiles for All Sheets
                                    ▼
                       ┌─────────────────────────────────────────────────────┐
                       │  PLAN TILE GENERATION                               │
                       │  ─────────────────────────────────────────────────── │
                       │  a) Query PLAN_SHEETS for all sheets (5 rows)      │
                       │                                                      │
                       │  b) Extract valid sheet names:                      │
                       │     validSheets = ["A5", "A6", "A7", "A8", "A9"]   │
                       │                                                      │
                       │  c) For each sheet (sequential):                    │
                       │     • Get sheet PDF from R2                         │
                       │     • Stream to Docker Container                    │
                       │       (SITELINK_PDF_PROCESSOR)                      │
                       │     • Generate DZI tiles (vips)                     │
                       │     • Receive tar stream                            │
                       │     • Extract and upload tiles to R2:               │
                       │       organizations/{org}/projects/{proj}/          │
                       │       plans/{plan}/sheets/sheet-N/                  │
                       │       ├── sheet.dzi                                 │
                       │       └── tiles/                                    │
                       │           ├── 0_0.jpg                               │
                       │           ├── 0_1.jpg                               │
                       │           └── ...                                   │
                       │                                                      │
                       │  d) Enqueue Marker Detection ──────────────┐        │
                       └────────────────────────────────────────────┼────────┘
                                                                     │
                                                                     │ 9. Enqueue Marker Detection
                                                                     ▼
                       ┌─────────────────────────────────────────────────────┐
                       │  QUEUE 4: Marker Detection Queue                    │
                       │  • Batch: 1 (plan-level operation)                  │
                       │  • Consumer: markerDetectionQueueConsumer()         │
                       │                                                      │
                       │  Message: {                                          │
                       │    uploadId, planId, organizationId, projectId,     │
                       │    validSheets: ["A5","A6","A7","A8","A9"],        │
                       │    totalSheets: 5                                    │
                       │  }                                                   │
                       └────────────┬────────────────────────────────────────┘
                                    │
                                    │ 10. Detect Markers
                                    ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  MARKER DETECTION PROCESSING                         │
                       │  ──────────────────────────────────────────────────── │
                       │  a) List all tile JPEGs from R2                      │
                       │     (e.g., ~200 tiles across 5 sheets)               │
                       │                                                       │
                       │  b) Generate presigned URLs (2 hour expiry)          │
                       │                                                       │
                       │  c) Call plan-ocr-service ──────────────────┐        │
                       └─────────────────────────────────────────────┼────────┘
                                                                      │
                                           ┌──────────────────────────▼──────────┐
                                           │  PLAN-OCR-SERVICE                   │
                                           │  POST /api/detect-markers           │
                                           │  {                                   │
                                           │    tile_urls: [<200 presigned URLs>]│
                                           │    valid_sheets: ["A5"..."A9"],    │
                                           │    strict_filtering: true           │
                                           │  }                                   │
                                           │                                      │
                                           │  Stage 1: Geometric Detection       │
                                           │  ────────────────────────────────────│
                                           │  • OpenCV Hough Circles             │
                                           │  • Contour Analysis (triangles)     │
                                           │  • Geometric filters                 │
                                           │  • NMS (non-maximum suppression)    │
                                           │  → 777 candidates                    │
                                           │                                      │
                                           │  Stage 2: LLM Validation            │
                                           │  ────────────────────────────────────│
                                           │  • Batch size: 10                    │
                                           │  • Temperature: 0.0                  │
                                           │  • Few-shot learning (7 examples)   │
                                           │  • Context validation (valid_sheets)│
                                           │  • Anti-hallucination safeguard ✅   │
                                           │  → 169 validated markers             │
                                           │                                      │
                                           │  Response: {                         │
                                           │    markers: [                        │
                                           │      {                               │
                                           │        text: "3/A7",                │
                                           │        detail: "3",                 │
                                           │        sheet: "A7",                 │
                                           │        type: "circular",            │
                                           │        confidence: 0.95,            │
                                           │        is_valid: true,              │
                                           │        fuzzy_matched: false,        │
                                           │        source_tile: "tile_2_3.jpg", │
                                           │        bbox: {x,y,w,h}              │
                                           │      },                              │
                                           │      ... (168 more)                  │
                                           │    ],                                │
                                           │    stage1_candidates: 777,          │
                                           │    stage2_validated: 169,           │
                                           │    processing_time_ms: 15234.5      │
                                           │  }                                   │
                                           └──────────────┬──────────────────────┘
                                                          │
                       ┌──────────────────────────────────▼──────────────────────┐
                       │  d) Insert 169 markers into PLAN_MARKERS table:        │
                       │     • Extract sheetNumber from source_tile             │
                       │     • Insert with all marker metadata                  │
                       │                                                         │
                       │  e) Update PROCESSING_JOBS:                            │
                       │     - status: "complete"                               │
                       │     - completedAt: <timestamp>                         │
                       │     - progress: 100                                     │
                       │                                                         │
                       │  f) Mark queue message as ACK ✅                        │
                       └─────────────────────────────────────────────────────────┘
                                                          │
                                                          │ 11. Processing Complete!
                                                          ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  FINAL STATE IN DATABASE                             │
                       │  ──────────────────────────────────────────────────── │
                       │                                                       │
                       │  PLANS:                                               │
                       │  └─ id: planId, name: "Floor Plan Set"               │
                       │                                                       │
                       │  PLAN_UPLOADS:                                        │
                       │  └─ uploadId, planId, filePath, isActive: true       │
                       │                                                       │
                       │  PLAN_SHEETS: (5 rows)                                │
                       │  ├─ sheetNumber: 1, sheetName: "A5",                 │
                       │  │  metadataStatus: "extracted", status: "ready"     │
                       │  ├─ sheetNumber: 2, sheetName: "A6", ...             │
                       │  ├─ sheetNumber: 3, sheetName: "A7", ...             │
                       │  ├─ sheetNumber: 4, sheetName: "A8", ...             │
                       │  └─ sheetNumber: 5, sheetName: "A9", ...             │
                       │                                                       │
                       │  PLAN_MARKERS: (169 rows)                             │
                       │  ├─ markerText: "1/A5", detail: "1", sheet: "A5"    │
                       │  ├─ markerText: "3/A7", detail: "3", sheet: "A7"    │
                       │  ├─ markerText: "2/A6", detail: "2", sheet: "A6"    │
                       │  └─ ... (166 more markers)                            │
                       │                                                       │
                       │  PROCESSING_JOBS:                                     │
                       │  └─ status: "complete", progress: 100                │
                       └───────────────────────────────────────────────────────┘
                                                          │
                                                          │ 12. User Views Plan
                                                          ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  USER EXPERIENCE                                     │
                       │  ──────────────────────────────────────────────────── │
                       │  • View plan with clickable sheet links             │
                       │  • See detected markers on each sheet               │
                       │  • Click marker "3/A7" → Navigate to Sheet A7       │
                       │  • Seamless construction plan navigation ✨          │
                       └──────────────────────────────────────────────────────┘


  ═══════════════════════════════════════════════════════════════════════════════

  TIMING BREAKDOWN (for 5-sheet plan):

    Phase                          Duration        Parallelism
    ─────────────────────────────────────────────────────────────
    PDF Split                      ~2s             Single
    Metadata Extraction            ~15s            5 parallel (high concurrency)
    Tile Generation                ~25s            Sequential per sheet
    Marker Detection               ~15s            Single (plan-level)
    ─────────────────────────────────────────────────────────────
    TOTAL                          ~57 seconds


  QUEUE CONFIGURATION:

    Queue                          Batch    Concurrency    Retries
    ─────────────────────────────────────────────────────────────
    PDF Processing                 1        -              3
    Metadata Extraction            5        20             3
    Plan Tile Generation           1        -              3
    Marker Detection               1        -              3


  KEY COMPONENTS:

    Component                      Purpose
    ─────────────────────────────────────────────────────────────
    PlanCoordinator DO             Tracks sheet completion, auto-triggers next phase
    plan-ocr-service               Python container for OCR + LLM processing
    PLAN_SHEETS table              Stores sheet metadata (sheetName: "A5")
    PLAN_MARKERS table             Stores detected markers with locations
    validSheets array              Context for LLM validation (reduces false positives)

  This diagram shows the complete journey from when a user uploads a PDF through all the processing
  stages until the markers are stored and ready for navigation! The key innovation is the sheet-level 
  parallel metadata extraction coordinated by the PlanCoordinator Durable Object, which ensures all
  sheets are processed before moving to tile generation.