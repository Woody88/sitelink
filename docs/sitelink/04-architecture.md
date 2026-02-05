# SiteLink Technical Architecture

**Version:** 1.0
**Date:** January 2026
**Status:** Authoritative Reference

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Processing Pipeline](#2-processing-pipeline)
3. [Offline Architecture](#3-offline-architecture)
4. [Data Model](#4-data-model)
5. [Sync Strategy](#5-sync-strategy)
6. [Query Flow](#6-query-flow)
7. [Key Clarifications](#7-key-clarifications)

---

## 1. System Overview

SiteLink uses a **cloud-first processing, offline-capable querying** architecture. All heavy computation happens in the cloud during upload; the device receives pre-extracted, structured data that can be queried locally without network connectivity.

### 1.1 Architecture Diagram

```
                                    CLOUD (Processing & Storage)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌──────────────┐      ┌──────────────────────────────────────────────────┐    │
│  │   R2 Storage │      │              Processing Pipeline                  │    │
│  │  ┌─────────┐ │      │  ┌─────────┐  ┌─────────┐  ┌─────────┐          │    │
│  │  │  PDFs   │ │      │  │  PDF    │  │   OCR   │  │  YOLO   │          │    │
│  │  ├─────────┤ │◄─────┤  │  Split  │─▶│PaddleOCR│─▶│Detection│          │    │
│  │  │  Tiles  │ │      │  └─────────┘  └─────────┘  └─────────┘          │    │
│  │  │ (PMTiles)│ │      │       │            │            │               │    │
│  │  ├─────────┤ │      │       ▼            ▼            ▼               │    │
│  │  │  Photos │ │      │  ┌─────────────────────────────────────────┐    │    │
│  │  └─────────┘ │      │  │           Structured Data               │    │    │
│  └──────────────┘      │  │  • Sheet metadata   • Callout links     │    │    │
│         ▲              │  │  • Grid systems     • Schedule entries  │    │    │
│         │              │  │  • Element labels   • OCR text          │    │    │
│         │              │  └─────────────────────────────────────────┘    │    │
│         │              └──────────────────────────────────────────────────┘    │
│         │                                      │                               │
│         │                                      ▼                               │
│  ┌──────┴───────────────────────────────────────────────────────────────┐     │
│  │                         D1 Database (SQLite)                          │     │
│  │  projects │ sheets │ callouts │ elements │ schedules │ grid_lines    │     │
│  └───────────────────────────────────────────────────────────────────────┘     │
│                                      │                                         │
└──────────────────────────────────────┼─────────────────────────────────────────┘
                                       │
                              LiveStore Sync Protocol
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            DEVICE (Mobile App)                                   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                        LiveStore (SQLite)                                 │  │
│  │                                                                           │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │  │
│  │  │  Synced Tables  │    │   Tile Cache    │    │   Local Events  │      │  │
│  │  │  • projects     │    │   (PMTiles)     │    │   (photo queue) │      │  │
│  │  │  • sheets       │    │                 │    │                 │      │  │
│  │  │  • callouts     │    └─────────────────┘    └─────────────────┘      │  │
│  │  │  • elements     │                                                     │  │
│  │  │  • schedules    │    ┌─────────────────────────────────────────────┐  │  │
│  │  │  • grid_lines   │    │           Local Query Engine               │  │  │
│  │  │  • photos       │    │  • SQL queries against synced data         │  │  │
│  │  │  • ocr_text     │    │  • Template-based response formatting      │  │  │
│  │  └─────────────────┘    │  • NO LLM required for offline queries    │  │  │
│  │                         └─────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │                              Mobile UI                                      ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐           ││
│  │  │   Plans    │  │   Camera   │  │  Projects  │  │    More    │           ││
│  │  │   Tab      │  │    Tab     │  │    Tab     │  │    Tab     │           ││
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘           ││
│  └────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Principles

| Principle | Implementation |
|-----------|----------------|
| **Cloud Processing** | All PDF processing, OCR, YOLO detection, and LLM inference run in the cloud |
| **Offline Data** | Pre-extracted structured data syncs to device for local queries |
| **Event Sourcing** | LiveStore provides audit trail and conflict-free sync |
| **Progressive Enhancement** | Basic features work offline; AI features require connectivity |

---

## 2. Processing Pipeline

The processing pipeline runs entirely in the cloud during PDF upload. The device never runs YOLO models, OCR engines, or LLMs.

### 2.1 Pipeline Stages (10 Steps)

```
PDF Upload (Device → Cloud)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Sheet Splitting                                           ~5 sec  │
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Cloudflare Worker + R2                                              │
│ INPUT:  Multi-page PDF                                                      │
│ OUTPUT: Individual sheet images (PNG at 300 DPI)                            │
│ SYNC:   Sheet records created in D1                                         │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Sheet Metadata Extraction                                 ~10 sec  │
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Cloudflare Worker                                                   │
│ INPUT:  Sheet image (title block region)                                    │
│ OUTPUT: sheet_number, sheet_title, revision, discipline                     │
│ SYNC:   Sheet metadata updated in D1 → LiveStore                            │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 3: Tile Generation                                          ~30 sec/pg│
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker (pyvips)                                          │
│ INPUT:  Sheet image                                                         │
│ OUTPUT: PMTiles file (tile pyramid for viewing)                             │
│ SYNC:   Tiles uploaded to R2 → downloaded to device on demand               │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 4: Full Sheet OCR                                           ~10 sec/pg│
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker (PaddleOCR)                                       │
│ INPUT:  Sheet image                                                         │
│ OUTPUT: Text blocks with bounding boxes and confidence scores               │
│ SYNC:   OCR results stored in D1 → LiveStore (for plan text search)         │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 5: Grid System Detection                                     ~2 sec/pg│
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker (OpenCV + OCR)                                    │
│ INPUT:  Sheet image edges + OCR results                                     │
│ OUTPUT: Grid line labels (A, B, C... and 1, 2, 3...) with positions         │
│ SYNC:   grid_lines table → LiveStore                                        │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 6: Schedule Detection and Extraction                        ~5 sec/pg │
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker                                                   │
│ INPUT:  Sheet image + OCR results                                           │
│ OUTPUT: Parsed schedule entries (footing, pier, column, beam)               │
│ SYNC:   schedule_entries table → LiveStore                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 7: Element Label Detection (YOLO)                           ~5 sec/pg │
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker (YOLO v8/v11 model)                               │
│ INPUT:  Sheet image                                                         │
│ OUTPUT: Element labels (FOOTING TYPE F1, PIER TYPE P1) with grid locations  │
│ SYNC:   elements table → LiveStore                                          │
│                                                                              │
│ NOTE:   YOLO runs in CLOUD, not on device. Results sync to device.          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 8: Callout Detection (YOLO)                                 ~5 sec/pg │
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker (YOLO model)                                      │
│ INPUT:  Sheet image                                                         │
│ OUTPUT: Callout markers with source → target sheet links                    │
│ SYNC:   callouts table → LiveStore                                          │
│                                                                              │
│ NOTE:   YOLO runs in CLOUD, not on device. Results sync to device.          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 9: General Notes Extraction                                  ~3 sec/pg│
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker                                                   │
│ INPUT:  OCR results from cover sheets (S0.x)                                │
│ OUTPUT: Parsed notes (concrete specs, steel notes, general notes)           │
│ SYNC:   project_context table → LiveStore                                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stage 10: Context Completeness Check                               ~1 sec   │
├─────────────────────────────────────────────────────────────────────────────┤
│ WHERE:  Processing worker                                                   │
│ INPUT:  All extracted data                                                  │
│ OUTPUT: Completeness flags, warnings for missing data                       │
│ SYNC:   project_context_status table → LiveStore                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Processing Location Summary

| Stage | Component | Runs Where | Why |
|-------|-----------|------------|-----|
| PDF Split | pyvips | Cloud | Large files, compute-intensive |
| Tile Generation | pyvips dzsave | Cloud | Memory-intensive, large output |
| OCR | PaddleOCR | Cloud | GPU-accelerated, model size |
| YOLO Detection | YOLOv8/v11 | Cloud | GPU required, model weights |
| LLM (queries) | Claude/Gemini | Cloud | Model size, latency requirements |
| Schedule Parsing | Python | Cloud | Depends on OCR results |
| Grid Detection | OpenCV | Cloud | Depends on image + OCR |

**CRITICAL: No ML models run on device.** The device receives only structured data results.

---

## 3. Offline Architecture

### 3.1 What Actually Works Offline

| Feature | Offline Support | How It Works |
|---------|-----------------|--------------|
| View plan sheets | FULL | PMTiles cached locally |
| Pan/zoom plans | FULL | Tile rendering is local |
| Tap callout markers | FULL | Callout data synced via LiveStore |
| Navigate between sheets | FULL | Sheet links in local SQLite |
| Take photos | FULL | Stored locally, queued for upload |
| Record voice notes | FULL | Audio stored locally |
| View existing photos | DOWNLOADED ONLY | Photos in local cache |
| **Query: "What's at F/5?"** | FULL | SQL query against synced data |
| **Query: Show element info** | FULL | Data already extracted and synced |
| **View schedule data** | FULL | schedule_entries synced locally |
| Search plan text | PARTIAL | If OCR text synced, local FTS |
| Generate daily summary | NO | Requires LLM API call |
| Voice transcription | NO | Requires Whisper API |
| Upload new plans | NO | Requires cloud processing |
| AI-powered chat responses | NO | Requires LLM API call |

### 3.2 Offline Query Architecture

The key insight: **"Offline AI" is really "Offline Queries"** against pre-extracted data.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OFFLINE QUERY FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

User asks: "What's at grid F/5?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Intent Classification (LOCAL)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Pattern matching (no LLM needed)                                           │
│ • Regex: /(?:at|grid)\s*([A-Z]+)\s*/?\s*(\d+)/i                             │
│ • Result: { type: "location", grid: "F/5" }                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: Data Retrieval (LOCAL SQLite)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ SELECT * FROM elements WHERE grid_location = 'F/5'                           │
│ SELECT * FROM schedule_entries WHERE type_code IN (...)                      │
│ SELECT * FROM callouts WHERE source_grid = 'F/5'                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Response Formatting (LOCAL Template)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Template-based formatting (no LLM):                                          │
│                                                                              │
│ **Grid F/5**                                                                 │
│                                                                              │
│ **Footing:** F1                                                              │
│   Size: 1500x1500x300 mm                                                     │
│   Rebar: 4-15M E.W.                                                          │
│   [Source: S0.0, Footing Schedule]                                           │
│                                                                              │
│ **Pier:** P1                                                                 │
│   Size: 450x450 mm                                                           │
│   Rebar: 4-25M verts, 10M@300 ties                                           │
│   [Source: S0.0, Pier Schedule]                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Online vs Offline Query Comparison

| Query Type | Offline Capable | Response Quality |
|------------|-----------------|------------------|
| "What's at F/5?" | YES | Full data, template format |
| "Show all F1 footings" | YES | Full data, list format |
| "What rebar for F1?" | YES | Schedule data, template format |
| "How many F1 footings?" | YES | COUNT query, simple response |
| "Explain this notation" | NO | Requires LLM interpretation |
| "What changed in Rev 3?" | PARTIAL | Data available, comparison logic needed |
| "Generate daily summary" | NO | Requires LLM synthesis |
| Natural conversation | NO | Requires LLM |

### 3.4 Why NOT On-Device LLM

The Plan Assistant PRD mentions "on-device LLM" for offline - this is **not practical** for SiteLink:

| Concern | Reality |
|---------|---------|
| **Latency** | On-device LLMs (like Phi-3, Gemma) have 8-15 second response times on mobile |
| **Model Size** | Smallest useful models are 2-4GB; impacts app download and storage |
| **Battery** | LLM inference drains battery rapidly |
| **Quality** | Small models have lower accuracy than cloud APIs |
| **Maintenance** | Model updates require app updates |

**The correct approach:** Pre-extract all data in the cloud, sync structured results, use simple template-based responses offline. Users get instant (<100ms) responses from local SQLite queries.

---

## 4. Data Model

### 4.1 Core Tables (Synced via LiveStore)

```sql
-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_at INTEGER NOT NULL,  -- Unix timestamp
  updated_at INTEGER NOT NULL
);

-- ============================================================
-- SHEETS
-- ============================================================
CREATE TABLE sheets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),

  -- Metadata (extracted in cloud)
  sheet_number TEXT,           -- "A1", "S1.0", "E-401"
  sheet_title TEXT,            -- "Foundation Plan"
  discipline TEXT,             -- "ARCH", "ELEC", "STRC"
  revision TEXT,               -- "R3", "Rev. 2"
  revision_date TEXT,

  -- Processing info
  page_index INTEGER,
  image_width INTEGER,
  image_height INTEGER,
  tiles_url TEXT,              -- R2 URL for PMTiles

  -- Status
  processing_status TEXT,      -- pending, processing, complete, error
  processing_error TEXT,

  created_at INTEGER NOT NULL
);

-- ============================================================
-- CALLOUTS (detected by YOLO in cloud)
-- ============================================================
CREATE TABLE callouts (
  id TEXT PRIMARY KEY,
  source_sheet_id TEXT NOT NULL REFERENCES sheets(id),
  target_sheet_id TEXT REFERENCES sheets(id),

  -- Callout info
  callout_type TEXT NOT NULL,  -- "section", "detail", "elevation"
  callout_number TEXT,         -- "10", "A", "5"
  target_sheet_ref TEXT,       -- "S2.0" (as written on drawing)

  -- Position (normalized 0-1)
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,

  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);

-- ============================================================
-- ELEMENTS (detected by YOLO in cloud)
-- ============================================================
CREATE TABLE elements (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  -- Element identification
  element_type TEXT NOT NULL,  -- "footing", "pier", "column"
  type_code TEXT NOT NULL,     -- "F1", "P1", "C2"

  -- Grid location
  grid_location TEXT,          -- "F/5", "AA/3"
  grid_x TEXT,                 -- "F"
  grid_y TEXT,                 -- "5"

  -- Additional info
  elevation REAL,
  elevation_reference TEXT,    -- "U/S OF FTG"
  raw_text TEXT,               -- Full label text

  -- Position (normalized 0-1)
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,

  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);

-- ============================================================
-- SCHEDULE ENTRIES (extracted from tables in cloud)
-- ============================================================
CREATE TABLE schedule_entries (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  schedule_type TEXT NOT NULL,  -- "footing", "pier", "column", "beam"
  type_code TEXT NOT NULL,      -- "F1", "P1", "C2"

  -- Common properties (explicit for fast queries)
  size_text TEXT,               -- "1500x1500x300"
  size_length REAL,
  size_width REAL,
  size_depth REAL,
  reinforcing TEXT,             -- "4-15M E.W."

  -- All properties (JSON for flexibility)
  properties TEXT,              -- JSON object

  -- Provenance
  bbox_x REAL NOT NULL,
  bbox_y REAL NOT NULL,
  bbox_w REAL NOT NULL,
  bbox_h REAL NOT NULL,
  confidence REAL NOT NULL,

  created_at INTEGER NOT NULL
);

-- ============================================================
-- GRID LINES (detected in cloud)
-- ============================================================
CREATE TABLE grid_lines (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  label TEXT NOT NULL,         -- "A", "B", "1", "2"
  axis TEXT NOT NULL,          -- "horizontal", "vertical"
  position REAL NOT NULL,      -- Pixel position on sheet

  confidence REAL,
  created_at INTEGER NOT NULL
);

-- ============================================================
-- PROJECT CONTEXT (notes extracted in cloud)
-- ============================================================
CREATE TABLE project_context (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  sheet_id TEXT REFERENCES sheets(id),

  context_type TEXT NOT NULL,  -- "concrete_notes", "steel_notes", etc.
  content TEXT NOT NULL,       -- Full extracted text

  source_sheet_name TEXT,
  confidence REAL,
  created_at INTEGER NOT NULL
);

-- ============================================================
-- PHOTOS (captured on device, synced to cloud)
-- ============================================================
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  callout_id TEXT REFERENCES callouts(id),
  sheet_id TEXT REFERENCES sheets(id),

  -- Photo info
  local_uri TEXT,              -- Local file path
  remote_url TEXT,             -- R2 URL after upload

  -- Metadata
  captured_at INTEGER NOT NULL,
  is_issue INTEGER DEFAULT 0,

  -- OCR text (extracted in cloud after upload)
  extracted_text TEXT,

  -- Voice note
  voice_note_uri TEXT,
  voice_note_transcription TEXT,

  -- Sync status
  upload_status TEXT,          -- pending, uploading, complete, error

  created_at INTEGER NOT NULL
);
```

### 4.2 Data Size Estimates

| Table | Records per Project | Avg Record Size | Total per Project |
|-------|---------------------|-----------------|-------------------|
| sheets | 50 | 1 KB | 50 KB |
| callouts | 500 | 200 B | 100 KB |
| elements | 200 | 300 B | 60 KB |
| schedule_entries | 100 | 500 B | 50 KB |
| grid_lines | 500 | 100 B | 50 KB |
| project_context | 10 | 5 KB | 50 KB |
| photos | 100 | 500 B | 50 KB |
| **TOTAL METADATA** | | | **~400 KB** |
| Tiles (PMTiles) | 50 sheets | 3 MB/sheet | **~150 MB** |

---

## 5. Sync Strategy

### 5.1 LiveStore Event Sourcing

SiteLink uses LiveStore for local-first data with automatic sync:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LiveStore Event Flow                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                           CLOUD PROCESSING
                                 │
                                 │ Events generated:
                                 │ • sheetProcessed
                                 │ • calloutsDetected
                                 │ • schedulesExtracted
                                 │ • elementsDetected
                                 ▼
                    ┌────────────────────────┐
                    │   Sync Backend (D1)    │
                    │   Event Log Storage    │
                    └────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌──────────────┐          ┌──────────────┐
           │   Device A   │          │   Device B   │
           │  (LiveStore) │          │  (LiveStore) │
           │              │          │              │
           │ Event Log    │          │ Event Log    │
           │ Materializer │          │ Materializer │
           │ SQLite State │          │ SQLite State │
           └──────────────┘          └──────────────┘

Key behaviors:
• Events are immutable, append-only
• Materializers derive state from events
• Conflict resolution via event ordering
• Offline events queue until connectivity
```

### 5.2 Sync Priorities

| Data Type | Priority | Reason |
|-----------|----------|--------|
| Events (metadata) | HIGH | Lightweight, enables all queries |
| Photos (thumbnails) | MEDIUM | User expects to see recent photos |
| Photos (full res) | LOW | Downloaded on demand |
| Tiles | ON-DEMAND | Only downloaded for offline mode |
| Voice notes | LOW | Large files, download when viewing |

### 5.3 Offline Photo Flow

```
User captures photo OFFLINE
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Photo saved to local file system                                          │
│ 2. photoCaptured event committed to LOCAL eventlog                           │
│ 3. UI immediately shows photo (from local file)                              │
│ 4. Event marked as pending_sync                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ (Device comes online)
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. Photo file uploaded to R2 (background)                                    │
│ 6. photoUploaded event committed with remote_url                             │
│ 7. Event synced to other devices                                             │
│ 8. (If Pro tier) OCR runs on photo, extractedText event committed           │
│ 9. (If Pro tier) Whisper transcription if voice note attached               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Query Flow

### 6.1 Online Query (with AI)

```
User: "What's at grid F/5?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Device: Intent Classification                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Local pattern matching identifies query type                               │
│ • Result: { type: "location", grid: "F/5" }                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Device: Data Retrieval (Local SQLite)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Query elements, schedules, callouts from LiveStore                         │
│ • All data already synced locally                                            │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Cloud: LLM Response Generation (Optional Enhancement)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Send data + query to Claude/Gemini                                         │
│ • Get natural language response with provenance                              │
│ • Response time: 2-5 seconds                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Display Response                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Formatted response with source links                                       │
│ • "View Source" navigates to sheet location                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Offline Query (Template-Based)

```
User: "What's at grid F/5?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Device: Intent Classification (SAME AS ONLINE)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Local pattern matching                                                     │
│ • Result: { type: "location", grid: "F/5" }                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Device: Data Retrieval (SAME AS ONLINE)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Query elements, schedules, callouts from LiveStore                         │
│ • All data already synced locally                                            │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Device: Template Response Generation (LOCAL)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Use predefined templates for each query type                               │
│ • Insert data into template                                                  │
│ • Response time: <100ms                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Display Response (SAME FORMAT AS ONLINE)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Formatted response with source links                                       │
│ • "View Source" navigates to sheet location                                  │
│ • No "AI generated" badge (it's just data display)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Response Time Targets

| Mode | Query Type | Target Latency |
|------|------------|----------------|
| Offline | Location query | <100ms |
| Offline | Element lookup | <100ms |
| Offline | Schedule query | <100ms |
| Offline | Count query | <100ms |
| Online | Any + LLM enhancement | <3 seconds |
| Online | Daily summary generation | <8 seconds |

---

## 7. Key Clarifications

### 7.1 What "AI" Means in SiteLink

| Feature | Runs Where | Uses LLM? | Works Offline? |
|---------|------------|-----------|----------------|
| Callout detection | Cloud | No (YOLO) | Results sync offline |
| Element detection | Cloud | No (YOLO) | Results sync offline |
| Schedule extraction | Cloud | No (parsing) | Results sync offline |
| OCR text extraction | Cloud | No (PaddleOCR) | Results sync offline |
| Query: data lookup | Device | No (SQL) | YES |
| Query: AI response | Cloud | YES | NO |
| Voice transcription | Cloud | YES (Whisper) | NO |
| Daily summary | Cloud | YES (Claude/Gemini) | NO |
| RFI draft | Cloud | YES (Claude) | NO |

### 7.2 Correcting Plan Assistant PRD

The Plan Assistant PRD (Section 6.3 FR-13) states:

> "For complex queries: queue for when online, or use on-device LLM"

**Correction:** On-device LLM is NOT a viable option due to:
- 8-15 second latency per response
- 2-4GB model size
- Poor battery life
- Lower quality than cloud APIs

**Actual implementation:**
- Simple queries (location, element, schedule): Local SQLite + templates = instant response
- Complex queries (synthesis, explanation): Queue for online or show "requires internet"

### 7.3 The Provenance System

Every piece of extracted data includes:

```typescript
interface Provenance {
  sheet_id: string        // Source sheet
  sheet_number: string    // "S0.0", "A1"

  // Bounding box (normalized 0-1)
  x: number
  y: number
  width: number
  height: number

  // Context
  location_description: string  // "Footing Schedule, Row 1"
  confidence: number           // 0.0 - 1.0

  // Extraction metadata
  extraction_method: string    // "yolo", "ocr", "table_parse"
}
```

This enables "View Source" to navigate directly to the source location on the sheet.

### 7.4 Data Flow Summary

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          SiteLink Data Flow                                    │
└───────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
    │  PDF    │  UPLOAD  │  Cloud  │   SYNC   │ Device  │  QUERY   │  User   │
    │  File   │ ───────▶ │Processing│ ───────▶ │ SQLite  │ ◀─────▶ │   UI    │
    └─────────┘          └─────────┘          └─────────┘          └─────────┘
                              │
                              │ Extraction:
                              │ • YOLO detection
                              │ • OCR text
                              │ • Schedule parsing
                              │ • Grid detection
                              │
                              ▼
                    ┌─────────────────┐
                    │ Structured Data │
                    │ (not raw images)│
                    └─────────────────┘
                              │
                              │ What syncs to device:
                              │ • callouts (links)
                              │ • elements (labels)
                              │ • schedules (tables)
                              │ • grid_lines
                              │ • context (notes)
                              │
                              │ NOT synced to device:
                              │ • ML models
                              │ • LLM weights
                              │ • Raw OCR engine
                              ▼
                    ┌─────────────────┐
                    │ Device queries  │
                    │ structured data │
                    │ instantly       │
                    └─────────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Architecture Team | Initial document - reconciles main PRD with Plan Assistant PRD |

---

_End of Document_
