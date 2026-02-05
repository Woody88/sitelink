> **⚠️ DEPRECATED**: This document has been superseded by [05-ai-features.md](./05-ai-features.md).
> See [README.md](./README.md) for the current documentation index.

# SiteLink Plan Assistant PRD

## Product Requirements Document

**Version:** 1.0
**Date:** January 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Value Proposition](#4-value-proposition)
5. [User Stories](#5-user-stories)
6. [Functional Requirements](#6-functional-requirements)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Model](#8-data-model)
9. [Detection System](#9-detection-system)
10. [AI Query System](#10-ai-query-system)
11. [Provenance System](#11-provenance-system)
12. [UX/UI Requirements](#12-uxui-requirements)
13. [Edge Cases](#13-edge-cases)
14. [Success Metrics](#14-success-metrics)
15. [Risks and Mitigations](#15-risks-and-mitigations)
16. [Implementation Phases](#16-implementation-phases)
17. [Appendices](#17-appendices)

---

## 1. Executive Summary

SiteLink Plan Assistant is an AI-powered feature that transforms static construction drawings into an interactive knowledge base. Instead of manually flipping between plan sheets, schedules, and details to understand a single element, field workers can ask natural language questions and receive aggregated answers with full provenance.

**Core Differentiator:** Unlike Fieldwire/PlanGrid which auto-link callouts to other sheets (requiring users to still read those sheets), SiteLink aggregates information from multiple sources and presents it in one view with clear attribution to source documents.

**Key Principle:** The drawing is the source of truth. The AI is an assistant, not an authority. Every piece of information must include provenance (source sheet, location, confidence) so workers can verify before acting.

---

## 2. Problem Statement

### 2.1 The Current Workflow

When a foreman needs to build a footing at grid location F/5, they must:

1. **Find the location on the foundation plan (S1.0)**
   - Identify grid lines F and 5
   - Locate the footing at that intersection
   - Read the element label (often small, rotated 45°, hard to read)
   - Note: "FOOTING TYPE F1, PIER TYPE P1, ELEV -1500"

2. **Find the footing schedule (typically S0.0)**
   - Flip to the cover sheet
   - Locate the Footing Schedule table
   - Find row F1
   - Note: "1500×1500×300, 4-15M E.W."

3. **Find the pier schedule (S0.0)**
   - Same sheet, different table
   - Find row P1
   - Note: "450×450, 4-25M verts, 10M@300 ties"

4. **Find the section detail (S2.0)**
   - Note the callout "10/S2.0" from the plan
   - Flip to sheet S2.0
   - Find section 10
   - Understand the construction detail

5. **Find the rebar in the pile**
   - Locate bar mark from bending schedule
   - Find tagged rebar bundle on site

**Total time:** 5-15 minutes per element  
**Error potential:** High (wrong sheet, misread label, outdated revision)  
**Multiplier effect:** 4 workers waiting = 20-60 minutes lost

### 2.2 Pain Points (from field research)

| Pain Point                          | Impact                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| Small, rotated text on plans        | Hard to read on phone, especially with gloves/sunlight |
| Information scattered across sheets | Constant flipping, easy to lose context                |
| No aggregated view                  | Must mentally combine schedule + plan + detail         |
| Revision confusion                  | Which sheet is current? What changed?                  |
| Detailer errors                     | Mislabeled callouts waste time searching               |
| No quantities                       | "How many F1 footings?" requires manual count          |
| No verification                     | Photo of installed rebar vs. spec comparison           |

### 2.3 Why Existing Solutions Don't Solve This

**Fieldwire / PlanGrid:**

- Auto-link callouts (e.g., "10/S2.0") to target sheets
- User taps callout → jumps to S2.0 → must read that sheet
- Still requires manual information synthesis
- No aggregation of schedule + plan + detail

**What they solve:** Navigation between sheets  
**What they don't solve:** Information aggregation and synthesis

---

## 3. Target Users

### 3.1 Primary: Field Workers

| Role            | Tasks                                      | Needs                                   |
| --------------- | ------------------------------------------ | --------------------------------------- |
| Foreman         | Directs crew, reads plans, makes decisions | Fast answers, verification ability      |
| Rebar Worker    | Installs reinforcing steel                 | Bar sizes, spacing, quantities          |
| Concrete Worker | Forms and pours                            | Dimensions, elevations, embed locations |
| Inspector       | Verifies installation                      | Spec compliance, photo documentation    |

**Environment Constraints:**

- Outdoor: bright sunlight, rain, dust
- Gloves: large touch targets required (56pt minimum)
- Connectivity: often poor or none (offline-first required)
- Interruptions: frequent, need to resume quickly

### 3.2 Secondary: Office Staff

| Role            | Tasks                              | Needs                           |
| --------------- | ---------------------------------- | ------------------------------- |
| Project Manager | Tracks progress, answers questions | Quick lookups, quantity reports |
| Estimator       | Bids future work                   | Material takeoffs, counts       |
| Engineer        | Answers field RFIs                 | Fast spec lookup                |

### 3.3 User Personas

**Carlos - Rebar Foreman (Primary)**

- 15 years experience
- Reads plans fluently but hates flipping sheets
- Uses phone on site, tablet in trailer
- Needs: "Just tell me what goes here"

**Maria - Project Manager (Secondary)**

- 8 years experience
- Reviews daily reports, answers field questions
- Needs: "How many F1 footings total? What changed in Rev 3?"

---

## 4. Value Proposition

### 4.1 Core Value

**From:** Worker finds label → flips to schedule → flips to detail → synthesizes mentally  
**To:** Worker asks question → gets aggregated answer with sources → verifies in one tap

### 4.2 Quantified Benefits

| Metric                         | Current                         | With Plan Assistant   | Improvement    |
| ------------------------------ | ------------------------------- | --------------------- | -------------- |
| Time to understand one element | 5-15 min                        | 30 sec                | 90%+ reduction |
| Errors from misreading         | ~5% of lookups                  | <1% with verification | 80% reduction  |
| Time waiting for foreman       | 40 min/day (4 workers × 10 min) | 5 min/day             | 87% reduction  |
| Revision-related rework        | 2-3 instances/project           | Near zero             | 90%+ reduction |

### 4.3 Competitive Positioning

| Feature                      | Fieldwire | PlanGrid | SiteLink |
| ---------------------------- | --------- | -------- | -------- |
| Auto-link callouts           | ✅        | ✅       | ✅       |
| Offline viewing              | ✅        | ✅       | ✅       |
| **Information aggregation**  | ❌        | ❌       | ✅       |
| **Natural language queries** | ❌        | ❌       | ✅       |
| **Provenance tracking**      | ❌        | ❌       | ✅       |
| **Schedule extraction**      | ❌        | ❌       | ✅       |
| **Confidence scoring**       | ❌        | ❌       | ✅       |

---

## 5. User Stories

### 5.1 Core User Stories

**US-1: Query by Grid Location**

```
As a foreman,
I want to ask "What's at grid F/5?"
So that I get all information about that location without flipping sheets.

Acceptance Criteria:
- Returns footing type, size, reinforcing from schedule
- Returns pier type, size, reinforcing from schedule
- Returns elevation from plan label
- Returns link to section detail
- Each item shows source (sheet, location)
- Each item shows confidence score
- Can tap any source to view that location on the sheet
```

**US-2: Query by Element Type**

```
As a foreman,
I want to ask "Show all F1 footings on this sheet"
So that I can see everywhere this footing type is used.

Acceptance Criteria:
- Highlights all F1 footing locations on current sheet
- Shows count of F1 footings
- Shows schedule info for F1 in panel
- Can tap any highlight to center on that location
```

**US-3: Query Schedule Information**

```
As a rebar worker,
I want to ask "What rebar for F1?"
So that I know what bars to pull from the pile.

Acceptance Criteria:
- Returns reinforcing spec from schedule (e.g., "4-15M E.W.")
- Explains notation if asked (e.g., "E.W. = Each Way")
- Shows source sheet and table
- Shows confidence score
```

**US-4: Verify with Provenance**

```
As an inspector,
I want to tap "View Source" on any piece of information
So that I can verify the AI's answer against the actual drawing.

Acceptance Criteria:
- Navigates to source sheet
- Zooms to relevant area (using stored bounding box)
- Highlights the specific text/table cell
- Shows "Back to answer" button
```

**US-5: Handle Missing Information**

```
As a foreman,
I want to know when information is missing or uncertain
So that I don't act on incomplete data.

Acceptance Criteria:
- Clear indication when schedule not found
- Confidence score shown for each extracted value
- Warning when confidence < 80%
- Suggestion of where to look (e.g., "Check shop drawings")
```

**US-6: Voice Query**

```
As a worker with gloves on,
I want to ask questions by voice
So that I don't have to type on my phone.

Acceptance Criteria:
- Voice input button always accessible
- Works offline (on-device speech recognition)
- Confirms query before processing
- Reads back critical values (optional)
```

### 5.2 Secondary User Stories

**US-7: Revision Comparison**

```
As a project manager,
I want to ask "What changed from Rev 2 to Rev 3?"
So that I can communicate changes to the field.

Acceptance Criteria:
- Lists elements that changed
- Shows before/after values
- Highlights changed areas on sheet
```

**US-8: Quantity Takeoff**

```
As an estimator,
I want to ask "How many F1 footings on this project?"
So that I can estimate rebar quantities.

Acceptance Criteria:
- Returns count across all sheets
- Lists locations (grid references)
- Can export to CSV
```

**US-9: Project Context Query**

```
As a foreman,
I want to ask "What concrete strength for footings?"
So that I can verify the mix design on the truck.

Acceptance Criteria:
- Returns spec from concrete notes
- Shows source (e.g., "S0.0, Concrete Notes, Item 3")
- Returns related info (cement type, air content)
```

---

## 6. Functional Requirements

### 6.1 Plan Processing

**FR-1: PDF Upload and Processing**

- Accept multi-page PDF uploads
- Split into individual sheets
- Extract sheet metadata from title block (sheet number, title, revision)
- Generate tiles for viewing at multiple zoom levels
- Process asynchronously with progress indication

**FR-2: Schedule Detection and Extraction**

- Detect schedule tables on any sheet (not just S0.0)
- Supported schedule types:
  - Footing Schedule
  - Pier Schedule
  - Column Schedule
  - Beam Schedule
  - Slab Schedule
  - Bearing Plate Schedule
- Extract table structure (headers, rows, cells)
- Parse cell values with confidence scores
- Store with bounding boxes for provenance

**FR-3: Element Label Detection**

- Detect element type labels on plan sheets
- Supported patterns:
  - `FOOTING TYPE "F1"` / `FTG TYPE F1`
  - `PIER TYPE "P1"`
  - `COLUMN TYPE "C1"` / `COL TYPE C1`
  - `U/S OF FTG ELEV.: -1500` (elevation)
- Handle rotated text (common: 45°)
- Associate labels with nearest grid intersection
- Store with bounding boxes and confidence

**FR-4: Grid System Detection**

- Detect grid bubbles at sheet edges
- Extract grid labels (A, B, C... and 1, 2, 3...)
- Build coordinate system for the sheet
- Handle non-standard grids (1x, 2x, AA, BB, etc.)

**FR-5: Callout Detection**

- Detect section callouts (circle with number/sheet ref)
- Detect detail callouts
- Link source callout to target sheet
- Store for navigation (existing SiteLink feature)

**FR-6: General Notes Extraction**

- Detect notes sections on cover sheets
- Extract full text of:
  - Concrete Notes
  - Reinforcing Steel Notes
  - Structural Steel Notes
  - General Notes
- Store as project context for AI queries

**FR-7: Context Completeness Tracking**

- Track what context was successfully extracted
- Flag missing critical context (e.g., no footing schedule)
- Generate warnings for user review

### 6.2 Query System

**FR-8: Natural Language Query Interface**

- Text input for queries
- Voice input (on-device speech recognition for offline)
- Query history for quick repeat
- Suggested queries based on current sheet

**FR-9: Query Processing**

- Parse user intent from natural language
- Identify query type:
  - Location query ("What's at F/5?")
  - Element query ("Show all F1 footings")
  - Schedule query ("What rebar for F1?")
  - Context query ("What concrete strength?")
  - Count query ("How many F1 footings?")
  - Comparison query ("What changed?")
- Retrieve relevant data from database
- Build context for AI response

**FR-10: AI Response Generation**

- Use LLM to generate human-readable response
- Include all relevant information from extracted data
- Include provenance for each fact
- Include confidence warnings where appropriate
- Format for mobile reading (concise, scannable)

**FR-11: Provenance Navigation**

- Every fact has a "View Source" action
- Tapping navigates to source sheet
- Zooms to relevant bounding box
- Highlights the source element
- "Back to answer" returns to response

### 6.3 Offline Support

**FR-12: Offline Data Sync**

- All extracted data synced to device via LiveStore
- All sheets synced as tiles for offline viewing
- Queries work fully offline
- AI responses generated on-device or cached

**FR-13: Offline AI**

- For simple queries: rule-based responses from extracted data
- For complex queries: queue for when online (on-device LLM is not viable - see 04-architecture.md Section 3.4)
- Always show extracted data immediately, AI synthesis when available

> **SUPERSEDED:** The "on-device LLM" option mentioned above was evaluated and rejected. See [04-architecture.md](./04-architecture.md) Section 3.4 for rationale (8-15s latency, 2-4GB model size, battery drain). The actual approach uses template-based responses for offline, cloud LLM for complex queries.

---

## 7. Technical Architecture

### 7.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Mobile    │  │  LiveStore  │  │    On-Device Query      │  │
│  │   App UI    │◄─┤  (SQLite)   │◄─┤    Engine + AI Cache    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ Sync
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE EDGE                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Workers   │  │     D1      │  │      R2 Storage         │  │
│  │   (API)     │◄─┤  (Database) │  │   (PDFs, Tiles)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ Queue
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESSING PIPELINE                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    PDF      │  │    OCR      │  │     Extraction          │  │
│  │  Splitting  │─▶│ (PaddleOCR) │─▶│  (Schedules, Labels,    │  │
│  │             │  │             │  │   Grid, Notes)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Processing Pipeline Stages

```
PDF Upload
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: Sheet Splitting                                         │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Multi-page PDF                                           │
│ Output: Individual sheet images (PNG/WebP)                       │
│ Process:                                                         │
│   - Split PDF into pages                                         │
│   - Render each page at high DPI (300+)                         │
│   - Store original PDF page for reference                        │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Sheet Metadata Extraction                               │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Sheet image                                              │
│ Output: Sheet record with metadata                               │
│ Process:                                                         │
│   - Crop title block region (bottom-right ~15%)                 │
│   - OCR title block                                              │
│   - Extract: sheet number, title, revision, date                 │
│   - Pattern match: S\d+\.\d+ for structural sheets              │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: Tile Generation                                         │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Sheet image                                              │
│ Output: Tile pyramid for viewing                                 │
│ Process:                                                         │
│   - Generate tiles at multiple zoom levels                       │
│   - Optimize for mobile (WebP, appropriate sizes)               │
│   - Upload to R2 storage                                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 4: Full Sheet OCR                                          │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Sheet image                                              │
│ Output: OCR results with bounding boxes                          │
│ Process:                                                         │
│   - Run PaddleOCR on full sheet                                  │
│   - Return text + bounding box + confidence for each detection  │
│   - Store raw OCR results for debugging                          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 5: Grid System Detection                                   │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Sheet image + OCR results                                │
│ Output: Grid coordinate system                                   │
│ Process:                                                         │
│   - Find circles at sheet edges (HoughCircles, filtered by pos) │
│   - OCR single characters inside circles                         │
│   - Classify: horizontal labels (letters) vs vertical (numbers) │
│   - Build coordinate lookup table                                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 6: Schedule Detection and Extraction                       │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Sheet image + OCR results                                │
│ Output: Parsed schedule entries                                  │
│ Process:                                                         │
│   - Find schedule headers ("FOOTING SCHEDULE", "PIER SCHEDULE") │
│   - Detect table structure (line detection or cell grouping)    │
│   - Map columns by header text                                   │
│   - Extract rows as key-value pairs                              │
│   - Store with bounding boxes per cell                           │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 7: Element Label Detection                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  OCR results + Grid system                                │
│ Output: Element records with grid locations                      │
│ Process:                                                         │
│   - Group OCR text blocks by proximity (multi-line labels)      │
│   - Pattern match element labels (see Section 9)                │
│   - Calculate nearest grid intersection for each label          │
│   - Store elements with location and bounding box               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 8: Callout Detection                                       │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Sheet image + OCR results                                │
│ Output: Callout links between sheets                             │
│ Process:                                                         │
│   - Detect circles (section callouts)                            │
│   - Detect triangles (section cuts)                              │
│   - OCR reference text (e.g., "10/S2.0")                        │
│   - Parse and link to target sheet                               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 9: General Notes Extraction                                │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  OCR results (from S0.x sheets)                           │
│ Output: Project context records                                  │
│ Process:                                                         │
│   - Find notes section headers ("CONCRETE NOTES", "GENERAL...")  │
│   - Extract text block following each header                     │
│   - Store as project context with source reference               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 10: Context Completeness Check                             │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  All extracted data                                       │
│ Output: Completeness status + warnings                           │
│ Process:                                                         │
│   - Check for presence of each expected context type            │
│   - Flag missing schedules                                       │
│   - Flag low-confidence extractions                              │
│   - Generate user-facing warnings                                │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Query Flow

```
User Query ("What's at F/5?")
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Intent Classification                                    │
│ ─────────────────────────────────────────────────────────────── │
│ Input:  Natural language query                                   │
│ Output: Query type + parameters                                  │
│ Example: { type: "location_query", grid: "F/5" }                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Data Retrieval                                           │
│ ─────────────────────────────────────────────────────────────── │
│ Based on query type, fetch from database:                        │
│   - Elements at grid F/5 (from elements table)                  │
│   - Schedule entries for detected types (from schedule_entries) │
│   - Callouts near that location (from callouts)                 │
│   - Relevant project context (from project_context)             │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Context Assembly                                         │
│ ─────────────────────────────────────────────────────────────── │
│ Build prompt context with:                                       │
│   - Detected elements with sources                               │
│   - Schedule data with sources                                   │
│   - Relevant notes if query needs specs                         │
│   - Confidence scores                                            │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Response Generation                                      │
│ ─────────────────────────────────────────────────────────────── │
│ Option A (Online): Send to LLM for natural language response    │
│ Option B (Offline): Template-based response from extracted data │
│                                                                  │
│ Both options include provenance for each fact                   │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Response Formatting                                      │
│ ─────────────────────────────────────────────────────────────── │
│ Format for mobile display:                                       │
│   - Structured data (type, size, rebar)                         │
│   - Source links for each item                                   │
│   - Confidence indicators                                        │
│   - Warnings if applicable                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Data Model

### 8.1 Database Schema (D1 / SQLite)

```sql
-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SHEETS
-- ============================================================
CREATE TABLE sheets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),

  -- Metadata from title block
  sheet_number TEXT,           -- "S0.0", "S1.0"
  sheet_title TEXT,            -- "Foundation Plan"
  revision TEXT,               -- "R3", "Rev. 2"
  revision_date TEXT,

  -- Processing info
  page_index INTEGER,          -- Page number in original PDF
  pdf_filename TEXT,
  image_width INTEGER,
  image_height INTEGER,

  -- Status
  processing_status TEXT DEFAULT 'pending',  -- pending, processing, complete, error
  processing_error TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sheets_project ON sheets(project_id);
CREATE INDEX idx_sheets_number ON sheets(project_id, sheet_number);

-- ============================================================
-- GRID SYSTEM
-- ============================================================
CREATE TABLE grid_lines (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  label TEXT NOT NULL,          -- "A", "B", "1", "2", "AA", "1x"
  axis TEXT NOT NULL,           -- "horizontal" or "vertical"
  position REAL NOT NULL,       -- Pixel position on sheet

  -- Provenance
  bbox_x REAL,
  bbox_y REAL,
  bbox_w REAL,
  bbox_h REAL,
  confidence REAL
);

CREATE INDEX idx_grid_sheet ON grid_lines(sheet_id);

-- ============================================================
-- DETECTED ELEMENTS (on plan sheets)
-- ============================================================
CREATE TABLE elements (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  -- Element identification
  element_type TEXT NOT NULL,   -- "footing", "pier", "column"
  type_code TEXT NOT NULL,      -- "F1", "P1", "C2"

  -- Location
  grid_location TEXT,           -- "F/5", "AA/3"
  grid_x TEXT,                  -- "F"
  grid_y TEXT,                  -- "5"

  -- Additional extracted info
  elevation REAL,               -- -1500
  elevation_reference TEXT,     -- "U/S OF FTG"

  -- Raw extracted text
  raw_text TEXT,                -- Full label text as detected

  -- Provenance
  bbox_x REAL NOT NULL,
  bbox_y REAL NOT NULL,
  bbox_w REAL NOT NULL,
  bbox_h REAL NOT NULL,
  confidence REAL NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_elements_sheet ON elements(sheet_id);
CREATE INDEX idx_elements_type ON elements(sheet_id, element_type, type_code);
CREATE INDEX idx_elements_grid ON elements(sheet_id, grid_location);

-- ============================================================
-- SCHEDULE ENTRIES (from schedule tables)
-- ============================================================
CREATE TABLE schedule_entries (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  -- Schedule identification
  schedule_type TEXT NOT NULL,  -- "footing", "pier", "column", "beam"
  type_code TEXT NOT NULL,      -- "F1", "P1", "C2"

  -- Extracted properties (stored as JSON or separate columns)
  properties JSON,              -- {"size": "1500x1500x300", "reinforcing": "4-15M E.W."}

  -- Or explicit columns for common properties:
  size_text TEXT,               -- "1500x1500x300"
  size_length REAL,             -- 1500
  size_width REAL,              -- 1500
  size_depth REAL,              -- 300
  reinforcing TEXT,             -- "4-15M E.W."
  top_of_element_elev REAL,

  -- Provenance (bounding box of the row)
  bbox_x REAL NOT NULL,
  bbox_y REAL NOT NULL,
  bbox_w REAL NOT NULL,
  bbox_h REAL NOT NULL,
  confidence REAL NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedule_sheet ON schedule_entries(sheet_id);
CREATE INDEX idx_schedule_type ON schedule_entries(schedule_type, type_code);

-- ============================================================
-- CALLOUTS (links between sheets)
-- ============================================================
CREATE TABLE callouts (
  id TEXT PRIMARY KEY,
  source_sheet_id TEXT NOT NULL REFERENCES sheets(id),
  target_sheet_id TEXT REFERENCES sheets(id),  -- May be null if target not found

  -- Callout info
  callout_type TEXT NOT NULL,   -- "section", "detail", "elevation"
  callout_number TEXT,          -- "10", "A"
  target_sheet_ref TEXT,        -- "S2.0" (as written on drawing)

  -- Position on source sheet
  bbox_x REAL NOT NULL,
  bbox_y REAL NOT NULL,
  bbox_w REAL NOT NULL,
  bbox_h REAL NOT NULL,
  confidence REAL NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_callouts_source ON callouts(source_sheet_id);
CREATE INDEX idx_callouts_target ON callouts(target_sheet_id);

-- ============================================================
-- PROJECT CONTEXT (general notes, specs)
-- ============================================================
CREATE TABLE project_context (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  sheet_id TEXT REFERENCES sheets(id),  -- Source sheet

  -- Context identification
  context_type TEXT NOT NULL,   -- "general_notes", "concrete_notes", "steel_notes",
                                -- "footing_schedule", "pier_schedule"

  -- Content
  content TEXT NOT NULL,        -- Full extracted text
  structured_data JSON,         -- Parsed data if applicable

  -- Provenance
  source_sheet_name TEXT,       -- "S0.0"
  bbox_x REAL,
  bbox_y REAL,
  bbox_w REAL,
  bbox_h REAL,
  confidence REAL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_context_project ON project_context(project_id);
CREATE INDEX idx_context_type ON project_context(project_id, context_type);

-- ============================================================
-- PROJECT CONTEXT STATUS
-- ============================================================
CREATE TABLE project_context_status (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),

  -- Flags for what was found
  has_footing_schedule BOOLEAN DEFAULT FALSE,
  has_pier_schedule BOOLEAN DEFAULT FALSE,
  has_column_schedule BOOLEAN DEFAULT FALSE,
  has_beam_schedule BOOLEAN DEFAULT FALSE,
  has_concrete_notes BOOLEAN DEFAULT FALSE,
  has_steel_notes BOOLEAN DEFAULT FALSE,
  has_general_notes BOOLEAN DEFAULT FALSE,
  has_grid_system BOOLEAN DEFAULT FALSE,

  -- Summary
  missing_context TEXT,         -- Human-readable list of missing items
  low_confidence_items TEXT,    -- Items with confidence < threshold

  processed_at TIMESTAMP
);

-- ============================================================
-- OCR RESULTS (for debugging and reprocessing)
-- ============================================================
CREATE TABLE ocr_results (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  -- Raw OCR output
  ocr_engine TEXT DEFAULT 'paddleocr',
  ocr_version TEXT,
  results JSON NOT NULL,        -- Array of {text, bbox, confidence}

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ocr_sheet ON ocr_results(sheet_id);
```

### 8.2 LiveStore Schema (Mobile/Offline)

The same schema syncs to LiveStore on the device, with these considerations:

- All tables sync for offline access
- Sync is incremental (only changed records)
- Large text fields (general notes) sync in full
- Tiles sync separately as files

---

## 9. Detection System

### 9.1 Schedule Detection

**Target Schedule Types:**

| Schedule | Header Patterns                    | Common Columns                           |
| -------- | ---------------------------------- | ---------------------------------------- |
| Footing  | `FOOTING SCHEDULE`, `FTG SCHEDULE` | MARK/TYPE, SIZE, REINFORCING             |
| Pier     | `PIER SCHEDULE`                    | MARK, SIZE, REINFORCING, T/O PIER ELEV   |
| Column   | `COLUMN SCHEDULE`, `COL SCHEDULE`  | MARK, SIZE, VERT BARS, TIES              |
| Beam     | `BEAM SCHEDULE`                    | MARK, SIZE, TOP BARS, BTM BARS, STIRRUPS |

**Detection Algorithm:**

```python
def detect_schedules(ocr_results, sheet_image):
    schedules = []

    # 1. Find schedule headers
    headers = find_schedule_headers(ocr_results)
    # Patterns: r"(FOOTING|PIER|COLUMN|COL|BEAM)\s*SCHEDULE"

    for header in headers:
        # 2. Find table below header
        table_region = find_table_region(header.bbox, sheet_image)

        # 3. Detect table structure
        # Option A: Line detection (Hough lines for grid)
        # Option B: Cell clustering (group OCR boxes into grid)
        cells = detect_table_cells(table_region, ocr_results)

        # 4. Identify columns by header row
        columns = identify_columns(cells[0])  # First row = headers

        # 5. Extract rows
        for row in cells[1:]:
            entry = {}
            for col_idx, col_name in enumerate(columns):
                if col_idx < len(row):
                    entry[col_name] = row[col_idx].text

            # 6. Parse type code (first column usually)
            type_code = entry.get('MARK') or entry.get('TYPE')

            schedules.append({
                'schedule_type': header.type,
                'type_code': type_code,
                'properties': entry,
                'bbox': row_bbox(row),
                'confidence': avg_confidence(row)
            })

    return schedules
```

### 9.2 Element Label Detection

**Target Patterns:**

| Pattern      | Regex                                                             | Example                 |
| ------------ | ----------------------------------------------------------------- | ----------------------- |
| Footing Type | `(FOOTING\|FTG)\s*TYPE\s*["']?([A-Z]?\d+)["']?`                   | FOOTING TYPE "F1"       |
| Pier Type    | `PIER\s*TYPE\s*["']?([A-Z]?\d+)["']?`                             | PIER TYPE "P1"          |
| Column Type  | `(COLUMN\|COL)\s*TYPE\s*["']?([A-Z]?\d+)["']?`                    | COL TYPE C2             |
| Elevation    | `(U/S\|T/O)\s*(OF\s*)?(FTG\|PIER\|COL)?\s*ELEV\.?:?\s*([-+]?\d+)` | U/S OF FTG ELEV.: -1500 |

**Detection Algorithm:**

```python
def detect_element_labels(ocr_results, grid_system):
    elements = []

    # 1. Group OCR results by proximity (multi-line labels)
    text_blocks = group_text_blocks(ocr_results, max_distance=50)

    for block in text_blocks:
        combined_text = ' '.join([r.text for r in block])

        # 2. Try each pattern
        footing_match = re.search(FOOTING_PATTERN, combined_text, re.IGNORECASE)
        pier_match = re.search(PIER_PATTERN, combined_text, re.IGNORECASE)
        elev_match = re.search(ELEVATION_PATTERN, combined_text, re.IGNORECASE)

        if footing_match or pier_match:
            # 3. Calculate centroid of text block
            centroid = block_centroid(block)

            # 4. Find nearest grid intersection
            grid_loc = find_nearest_grid(centroid, grid_system)

            # 5. Extract elevation if present
            elevation = None
            if elev_match:
                elevation = float(elev_match.group(4))

            elements.append({
                'element_type': 'footing' if footing_match else 'pier',
                'type_code': (footing_match or pier_match).group(2),
                'grid_location': grid_loc,
                'elevation': elevation,
                'raw_text': combined_text,
                'bbox': block_bbox(block),
                'confidence': avg_confidence(block)
            })

    return elements
```

### 9.3 Grid System Detection

**Detection Algorithm:**

```python
def detect_grid_system(sheet_image, ocr_results):
    grid_lines = []

    # 1. Find circles at edges of sheet
    circles = detect_circles(sheet_image)
    edge_circles = filter_edge_circles(circles, sheet_image.shape)

    for circle in edge_circles:
        # 2. OCR the text inside circle
        roi = crop_circle_region(sheet_image, circle)
        text = ocr_region(roi)

        # 3. Classify axis
        # Top/bottom edge = vertical grid lines (numbered: 1, 2, 3)
        # Left/right edge = horizontal grid lines (lettered: A, B, C)
        if circle.y < sheet_image.height * 0.1 or circle.y > sheet_image.height * 0.9:
            axis = 'vertical'
        else:
            axis = 'horizontal'

        grid_lines.append({
            'label': text.strip(),
            'axis': axis,
            'position': circle.x if axis == 'vertical' else circle.y,
            'bbox': circle_bbox(circle),
            'confidence': text_confidence
        })

    # 4. Sort and validate
    # Horizontal should be letters: A, B, C... AA, BB...
    # Vertical should be numbers: 1, 2, 3... 1x, 2x...

    return GridSystem(grid_lines)


def find_nearest_grid(point, grid_system):
    """Find the nearest grid intersection to a point."""

    # Find closest horizontal grid line
    h_line = min(
        grid_system.horizontal_lines,
        key=lambda l: abs(l.position - point.y)
    )

    # Find closest vertical grid line
    v_line = min(
        grid_system.vertical_lines,
        key=lambda l: abs(l.position - point.x)
    )

    return f"{h_line.label}/{v_line.label}"
```

### 9.4 General Notes Extraction

**Target Sections:**

| Section                 | Header Patterns                                |
| ----------------------- | ---------------------------------------------- |
| General Notes           | `GENERAL\s*NOTES`                              |
| Concrete Notes          | `CONCRETE\s*(NOTES\|AND\s*FOUNDATION\s*NOTES)` |
| Reinforcing Steel Notes | `REINFORC(ING\|EMENT)\s*STEEL\s*NOTES`         |
| Structural Steel Notes  | `STRUCTURAL\s*STEEL\s*NOTES`                   |
| Masonry Notes           | `MASONRY\s*NOTES`                              |

**Detection Algorithm:**

```python
def extract_general_notes(ocr_results, sheet_number):
    # Only process on S0.x sheets (cover/general sheets)
    if not sheet_number.startswith('S0'):
        return []

    notes = []

    # 1. Find section headers
    for header_pattern, context_type in NOTES_PATTERNS:
        header_matches = find_headers(ocr_results, header_pattern)

        for header in header_matches:
            # 2. Find all text below header until next header or section break
            section_text = extract_section_below(
                ocr_results,
                header.bbox,
                stop_patterns=ALL_HEADER_PATTERNS
            )

            notes.append({
                'context_type': context_type,
                'content': section_text,
                'source_sheet_name': sheet_number,
                'bbox': section_bbox,
                'confidence': avg_confidence
            })

    return notes
```

### 9.5 Rebar Notation Parsing

**Canadian Metric Notation (CSA G30.18):**

| Pattern          | Regex                | Example | Meaning                    |
| ---------------- | -------------------- | ------- | -------------------------- |
| Bar count + size | `(\d+)-(\d+)M`       | 4-15M   | 4 bars of 15mm diameter    |
| Size + spacing   | `(\d+)M\s*@\s*(\d+)` | 15M@300 | 15mm bars at 300mm spacing |
| Each way         | `E\.?W\.?`           | E.W.    | Each way (both directions) |
| Top and bottom   | `T\s*[&+]\s*B`       | T&B     | Top and bottom             |

**Parsing Function:**

```python
def parse_rebar_notation(text):
    """Parse Canadian metric rebar notation."""

    result = {
        'count': None,
        'size_mm': None,
        'spacing_mm': None,
        'each_way': False,
        'top_and_bottom': False,
        'raw': text
    }

    # 4-15M pattern (count-size)
    count_match = re.search(r'(\d+)-(\d+)M', text)
    if count_match:
        result['count'] = int(count_match.group(1))
        result['size_mm'] = int(count_match.group(2))

    # 15M@300 pattern (size at spacing)
    spacing_match = re.search(r'(\d+)M\s*@\s*(\d+)', text)
    if spacing_match:
        result['size_mm'] = int(spacing_match.group(1))
        result['spacing_mm'] = int(spacing_match.group(2))

    # E.W. modifier
    if re.search(r'E\.?W\.?', text, re.IGNORECASE):
        result['each_way'] = True

    # T&B modifier
    if re.search(r'T\s*[&+]\s*B', text, re.IGNORECASE):
        result['top_and_bottom'] = True

    return result
```

---

## 10. AI Query System

### 10.1 Query Types

| Type     | Example Queries               | Required Data                 |
| -------- | ----------------------------- | ----------------------------- |
| Location | "What's at F/5?", "Grid AA/3" | Elements, Schedules, Callouts |
| Element  | "Show all F1 footings"        | Elements by type              |
| Schedule | "What rebar for F1?"          | Schedule entries              |
| Context  | "What concrete strength?"     | Project context (notes)       |
| Count    | "How many F1 footings?"       | Elements by type              |
| Compare  | "What changed in Rev 3?"      | Multiple revisions            |

### 10.2 Intent Classification

```python
def classify_query(query: str) -> QueryIntent:
    """Classify user query into type and extract parameters."""

    query_lower = query.lower()

    # Location query
    grid_match = re.search(r'(?:at|grid|location)\s*([A-Z]+)\s*/?\s*(\d+)', query, re.I)
    if grid_match or "what's at" in query_lower:
        return QueryIntent(
            type='location',
            grid=f"{grid_match.group(1)}/{grid_match.group(2)}" if grid_match else None
        )

    # Element query
    element_match = re.search(r'(?:show|find|where)\s*(?:all\s*)?(F|P|C)\d+', query, re.I)
    if element_match:
        return QueryIntent(
            type='element',
            element_code=element_match.group(0).split()[-1]
        )

    # Schedule query
    if re.search(r'(?:what|which)\s*(?:rebar|size|reinforc)', query_lower):
        type_match = re.search(r'(F|P|C)\d+', query)
        return QueryIntent(
            type='schedule',
            type_code=type_match.group(0) if type_match else None
        )

    # Context query
    if re.search(r'(?:concrete|steel|rebar)\s*(?:strength|grade|spec)', query_lower):
        return QueryIntent(type='context')

    # Count query
    if re.search(r'how many', query_lower):
        type_match = re.search(r'(F|P|C)\d+', query)
        return QueryIntent(
            type='count',
            type_code=type_match.group(0) if type_match else None
        )

    # Default: general query
    return QueryIntent(type='general')
```

### 10.3 Context Building

```python
async def build_query_context(
    project_id: str,
    query_intent: QueryIntent,
    current_sheet_id: str = None
) -> str:
    """Build context string for AI prompt."""

    context_parts = []

    # 1. Always include relevant schedules (they're small)
    schedules = await db.query("""
        SELECT schedule_type, type_code, properties, source_sheet_name, confidence
        FROM schedule_entries se
        JOIN sheets s ON se.sheet_id = s.id
        WHERE s.project_id = ?
    """, [project_id])

    if schedules:
        context_parts.append("SCHEDULES:")
        for s in schedules:
            context_parts.append(
                f"  {s.schedule_type.upper()} {s.type_code}: {s.properties} "
                f"[Source: {s.source_sheet_name}, Confidence: {s.confidence:.0%}]"
            )

    # 2. Include elements if location query
    if query_intent.type == 'location' and query_intent.grid:
        elements = await db.query("""
            SELECT element_type, type_code, elevation, raw_text,
                   s.sheet_number, confidence
            FROM elements e
            JOIN sheets s ON e.sheet_id = s.id
            WHERE s.project_id = ? AND e.grid_location = ?
        """, [project_id, query_intent.grid])

        if elements:
            context_parts.append(f"\nELEMENTS AT {query_intent.grid}:")
            for e in elements:
                context_parts.append(
                    f"  {e.element_type.upper()}: {e.type_code}"
                    f"{f', Elev: {e.elevation}' if e.elevation else ''} "
                    f"[Source: {e.sheet_number}, Confidence: {e.confidence:.0%}]"
                )

    # 3. Include notes if context query or query mentions specs
    if query_intent.type == 'context' or needs_specs(query_intent.query):
        notes = await db.query("""
            SELECT context_type, content, source_sheet_name
            FROM project_context
            WHERE project_id = ?
            AND context_type IN ('concrete_notes', 'steel_notes', 'general_notes')
        """, [project_id])

        for note in notes:
            context_parts.append(f"\n{note.context_type.upper()}:")
            context_parts.append(f"  {note.content[:1000]}...")  # Truncate if long
            context_parts.append(f"  [Source: {note.source_sheet_name}]")

    # 4. Include context status warnings
    status = await db.query("""
        SELECT missing_context, low_confidence_items
        FROM project_context_status
        WHERE project_id = ?
    """, [project_id])

    if status and status.missing_context:
        context_parts.append(f"\n⚠️ MISSING: {status.missing_context}")

    return '\n'.join(context_parts)
```

### 10.4 Response Generation

**Online (with LLM):**

```python
async def generate_response_online(
    query: str,
    context: str,
    query_intent: QueryIntent
) -> Response:
    """Generate response using LLM."""

    system_prompt = """You are a construction plan assistant. Answer questions about
structural drawings using ONLY the provided context.

RULES:
1. Every fact must include its source in brackets: [Source: sheet, location]
2. If information is missing, say so clearly
3. If confidence is below 80%, warn the user to verify
4. Keep responses concise and scannable
5. Use construction terminology the user will understand
6. Format measurements with units (mm, MPa, etc.)

CONTEXT:
{context}
"""

    response = await llm.complete(
        system=system_prompt.format(context=context),
        user=query
    )

    return Response(
        text=response.text,
        sources=extract_sources(response.text),
        confidence=calculate_response_confidence(context)
    )
```

**Offline (template-based):**

```python
def generate_response_offline(
    query_intent: QueryIntent,
    data: dict
) -> Response:
    """Generate response from templates when offline."""

    if query_intent.type == 'location':
        return generate_location_response(data)
    elif query_intent.type == 'schedule':
        return generate_schedule_response(data)
    # ... etc

def generate_location_response(data) -> Response:
    """Template for location query response."""

    lines = [f"**Grid {data['grid']}**\n"]

    for element in data['elements']:
        lines.append(f"**{element['type'].title()}:** {element['type_code']}")

        # Add schedule info if available
        if element['schedule_entry']:
            se = element['schedule_entry']
            lines.append(f"  Size: {se['size']}")
            lines.append(f"  Reinforcing: {se['reinforcing']}")
            lines.append(f"  [Source: {se['source_sheet']}]")

        if element['elevation']:
            lines.append(f"  Elevation: {element['elevation']}")
            lines.append(f"  [Source: {element['source_sheet']}]")

        lines.append("")

    # Add warnings
    if data['missing']:
        lines.append(f"⚠️ Missing: {', '.join(data['missing'])}")

    if data['low_confidence']:
        lines.append(f"⚠️ Low confidence items - verify on drawing")

    return Response(
        text='\n'.join(lines),
        sources=data['sources'],
        confidence=data['min_confidence']
    )
```

---

## 11. Provenance System

### 11.1 Provenance Data Structure

Every extracted piece of information includes:

```typescript
interface Provenance {
  // Source identification
  sheet_id: string
  sheet_number: string // "S0.0", "S1.0"
  sheet_title: string // "Foundation Plan"

  // Location on sheet
  bbox: {
    x: number // Pixels from left
    y: number // Pixels from top
    width: number
    height: number
  }

  // Context description
  location_description: string // "Footing Schedule, Row 1" or "Label at grid F/5"

  // Confidence
  confidence: number // 0.0 - 1.0

  // Extraction metadata
  extracted_at: string // ISO timestamp
  extraction_method: string // "ocr", "table_detection", etc.
}
```

### 11.2 Provenance Display

In the UI, every fact shows its source:

```
**Footing F1**
Size: 1500×1500×300
↳ Source: S0.0, Footing Schedule, Row 1 [View] (94% confidence)

Reinforcing: 4-15M E.W.
↳ Source: S0.0, Footing Schedule, Row 1 [View] (91% confidence)

Elevation: -1500
↳ Source: S1.0, Label at grid F/5 [View] (87% confidence) ⚠️
```

### 11.3 View Source Navigation

When user taps [View]:

1. Navigate to source sheet
2. Zoom to show bounding box region with padding
3. Draw highlight rectangle around the bbox
4. Show "Back to answer" button
5. Optionally pulse/animate the highlight

```typescript
async function navigateToSource(provenance: Provenance) {
  // 1. Switch to source sheet
  await navigation.goToSheet(provenance.sheet_id)

  // 2. Calculate zoom to show bbox with context
  const padding = 100 // pixels
  const targetRegion = {
    x: provenance.bbox.x - padding,
    y: provenance.bbox.y - padding,
    width: provenance.bbox.width + padding * 2,
    height: provenance.bbox.height + padding * 2,
  }

  // 3. Zoom to region
  await viewer.zoomToRegion(targetRegion)

  // 4. Add highlight overlay
  viewer.addHighlight({
    bbox: provenance.bbox,
    color: "#FFD700", // Gold
    opacity: 0.3,
    animate: true, // Pulse effect
  })

  // 5. Show back button
  ui.showBackButton({
    label: "Back to answer",
    onPress: () => navigation.goBack(),
  })
}
```

---

## 12. UX/UI Requirements

### 12.1 Query Interface

**Entry Points:**

1. **Floating action button** on sheet viewer → Opens query panel
2. **"Ask about this sheet"** in sheet menu
3. **Voice button** always visible (for hands-free)
4. **Search bar** in project view

**Query Panel:**

```
┌─────────────────────────────────────────┐
│  ╭───────────────────────────────╮  🎤  │
│  │ What's at grid F/5?          │      │
│  ╰───────────────────────────────╯      │
│                                         │
│  Suggested:                             │
│  ┌─────────────────────────────────┐   │
│  │ What's at this location?        │   │
│  │ Show all footings on this sheet │   │
│  │ What concrete strength?         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Recent:                                │
│  • What's at F/5?                       │
│  • Show all F1 footings                 │
└─────────────────────────────────────────┘
```

### 12.2 Response Display

**Card-based layout:**

```
┌─────────────────────────────────────────┐
│  Grid F/5                               │
├─────────────────────────────────────────┤
│                                         │
│  FOOTING                                │
│  ┌─────────────────────────────────┐   │
│  │ Type: F1                        │   │
│  │ Size: 1500×1500×300 mm         │   │
│  │ Rebar: 4-15M E.W.               │   │
│  │ Elevation: -1500                │   │
│  │                                  │   │
│  │ 📄 S0.0, Footing Schedule  [→]  │   │
│  │ 📄 S1.0, Grid F/5          [→]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  PIER                                   │
│  ┌─────────────────────────────────┐   │
│  │ Type: P1                        │   │
│  │ Size: 450×450 mm               │   │
│  │ Rebar: 4-25M verts, 10M@300    │   │
│  │                                  │   │
│  │ 📄 S0.0, Pier Schedule     [→]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  SECTION DETAIL                         │
│  ┌─────────────────────────────────┐   │
│  │ Section 10 / S2.0          [→]  │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 12.3 Confidence Indicators

| Confidence         | Display                 | Action                      |
| ------------------ | ----------------------- | --------------------------- |
| ≥90%               | Green checkmark or none | Normal display              |
| 80-89%             | Yellow indicator        | Subtle warning              |
| <80%               | Orange warning + text   | "⚠️ Verify on drawing"      |
| Multiple conflicts | Red alert               | "⚠️ Conflicting info found" |

### 12.4 Missing Data Display

```
┌─────────────────────────────────────────┐
│  Grid F/5                               │
├─────────────────────────────────────────┤
│                                         │
│  FOOTING                                │
│  ┌─────────────────────────────────┐   │
│  │ Type: F1                        │   │
│  │ Size: —                         │   │
│  │ Rebar: —                        │   │
│  │                                  │   │
│  │ ⚠️ Footing Schedule not found   │   │
│  │    Check S0.0 or shop drawings  │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 12.5 Mobile Constraints

| Requirement   | Specification                            |
| ------------- | ---------------------------------------- |
| Touch targets | Minimum 56pt (44pt absolute minimum)     |
| Text size     | Minimum 16pt for body, 14pt for captions |
| Contrast      | WCAG AA minimum (4.5:1 for text)         |
| Offline       | All features work without connection     |
| Gloves        | Large buttons, voice input               |
| Sunlight      | High contrast mode available             |

---

## 13. Edge Cases

### 13.1 Detection Edge Cases

| Case                             | Handling                                           |
| -------------------------------- | -------------------------------------------------- |
| Schedule on non-standard sheet   | Detect schedules on any sheet, not just S0.0       |
| Multiple schedules for same type | Store all, flag conflict, show both to user        |
| Rotated text (45°, 90°)          | PaddleOCR handles rotation; may need preprocessing |
| Low image quality                | Flag low confidence; suggest re-upload             |
| Non-standard abbreviations       | Build vocabulary over time; allow user corrections |
| Missing grid system              | Fall back to pixel coordinates; warn user          |
| Handwritten annotations          | Flag as low confidence; show raw image             |

### 13.2 Query Edge Cases

| Case                           | Handling                                            |
| ------------------------------ | --------------------------------------------------- |
| Ambiguous query                | Ask for clarification: "Did you mean F1 or F/1?"    |
| Element not found              | "F3 not found. Available footings: F1, F2"          |
| Grid not found                 | "Grid Z/99 not on this sheet. Available: A-F, 1-10" |
| Multiple matches               | List all with locations                             |
| Query about non-extracted data | "I don't have beam info. Check sheet S3.0"          |
| Query in different language    | Support English only initially; detect and suggest  |

### 13.3 Data Edge Cases

| Case                              | Handling                                    |
| --------------------------------- | ------------------------------------------- |
| Revision conflict                 | Show both with clear revision labels        |
| Schedule entry with no plan match | "F3 in schedule but not found on plan"      |
| Plan label with no schedule entry | "F3 on plan but not in schedule"            |
| Duplicate type codes              | Flag and show all instances                 |
| Corrupted/partial PDF             | Process what's possible; list failed sheets |

---

## 14. Success Metrics

### 14.1 Detection Accuracy

| Metric                       | Target | Measurement                              |
| ---------------------------- | ------ | ---------------------------------------- |
| Schedule detection rate      | >95%   | % of schedules correctly identified      |
| Schedule extraction accuracy | >90%   | % of cells correctly extracted           |
| Element label detection rate | >85%   | % of labels correctly identified         |
| Grid system detection rate   | >95%   | % of grids correctly built               |
| Overall extraction precision | >90%   | Correct extractions / total extractions  |
| Overall extraction recall    | >85%   | Correct extractions / total ground truth |

### 14.2 User Experience

| Metric                        | Target | Measurement                       |
| ----------------------------- | ------ | --------------------------------- |
| Query response time (online)  | <3 sec | p95 latency                       |
| Query response time (offline) | <1 sec | p95 latency                       |
| User satisfaction             | >4.0/5 | In-app rating                     |
| Query success rate            | >90%   | Queries that return useful answer |
| Provenance verification rate  | >30%   | Users who tap "View Source"       |

### 14.3 Business Impact

| Metric                        | Target | Measurement                            |
| ----------------------------- | ------ | -------------------------------------- |
| Time saved per element lookup | 80%+   | User surveys, time tracking            |
| Rework reduction              | 50%+   | Self-reported errors                   |
| Feature adoption              | >60%   | % of active users using queries        |
| Retention impact              | +10%   | Retention of query users vs. non-users |

---

## 15. Risks and Mitigations

### 15.1 Technical Risks

| Risk                          | Likelihood | Impact | Mitigation                                              |
| ----------------------------- | ---------- | ------ | ------------------------------------------------------- |
| OCR accuracy insufficient     | Medium     | High   | Test on diverse plan sets; fall back to manual entry    |
| Schedule format variation     | High       | Medium | Support multiple formats; continuous improvement        |
| Processing time too long      | Medium     | Medium | Optimize pipeline; show progress; process in background |
| Offline AI quality poor       | Medium     | Medium | Strong templates; prioritize extracted data display     |
| Storage costs for OCR results | Low        | Low    | Compress; purge raw OCR after extraction                |

### 15.2 Product Risks

| Risk                                | Likelihood | Impact | Mitigation                                             |
| ----------------------------------- | ---------- | ------ | ------------------------------------------------------ |
| Users don't trust AI answers        | Medium     | High   | Prominent provenance; encourage verification           |
| Feature too complex to use          | Low        | High   | Simple query interface; suggested queries              |
| Doesn't work on their plans         | Medium     | High   | Broad format support; error reporting; manual fallback |
| Privacy concerns (cloud processing) | Low        | Medium | Clear data handling policy; on-device option           |

### 15.3 Liability Risks

| Risk                                    | Mitigation                                                  |
| --------------------------------------- | ----------------------------------------------------------- |
| User acts on incorrect extraction       | Provenance system; confidence warnings; "verify on drawing" |
| Claim that app replaced engineer review | Clear disclaimers; app is assistant not authority           |
| Data used without authorization         | User uploads own plans; clear ToS                           |

---

## 16. Implementation Phases

### Phase 1: Foundation (8 weeks)

**Goal:** Basic schedule extraction and query

**Deliverables:**

- [ ] PDF upload and sheet splitting
- [ ] Title block extraction (sheet number, revision)
- [ ] Full sheet OCR with PaddleOCR
- [ ] Schedule detection (footing, pier, column)
- [ ] Schedule table extraction and parsing
- [ ] Basic storage schema in D1
- [ ] Simple query: "What is F1?" → returns schedule entry

**Success Criteria:**

- > 90% schedule detection rate on test set
- > 85% cell extraction accuracy
- Query returns correct schedule info for detected types

### Phase 2: Plan Integration (6 weeks)

**Goal:** Connect plan labels to schedules

**Deliverables:**

- [ ] Grid system detection
- [ ] Element label detection on plan sheets
- [ ] Grid location association for elements
- [ ] Query: "What's at F/5?" → returns element + schedule info
- [ ] Provenance storage (bounding boxes)
- [ ] Basic provenance navigation (tap to view source)

**Success Criteria:**

- > 90% grid detection rate
- > 80% element label detection rate
- Location queries return accurate results

### Phase 3: AI Query System (6 weeks)

**Goal:** Natural language queries with AI responses

**Deliverables:**

- [ ] Intent classification for queries
- [ ] Context building from extracted data
- [ ] LLM integration for response generation
- [ ] Offline template-based responses
- [ ] Query UI (text + voice input)
- [ ] Response UI with provenance links

**Success Criteria:**

- > 85% query intent classification accuracy
- <3 sec response time (online)
- Users can understand and act on responses

### Phase 4: Context and Polish (4 weeks)

**Goal:** Full project context and production readiness

**Deliverables:**

- [ ] General notes extraction
- [ ] Context completeness tracking
- [ ] Missing data warnings
- [ ] Confidence indicators in UI
- [ ] Sync to LiveStore for offline
- [ ] Performance optimization
- [ ] Error handling and edge cases

**Success Criteria:**

- All features work offline
- <1 sec offline query response
- Production error rate <1%

### Phase 5: Advanced Features (Future)

**Potential additions:**

- Revision comparison ("What changed?")
- Quantity takeoffs ("How many F1?")
- Photo verification (compare installed vs. spec)
- Voice responses (read back answers)
- Multi-language support
- Custom vocabulary per project

---

## 17. Appendices

### Appendix A: Canadian Rebar Notation Reference

| Notation | Meaning               | Example            |
| -------- | --------------------- | ------------------ |
| 10M      | 10mm diameter bar     |                    |
| 15M      | 15mm (≈ #5 US)        |                    |
| 20M      | 20mm (≈ #6 US)        |                    |
| 25M      | 25mm (≈ #8 US)        |                    |
| 30M      | 30mm (≈ #10 US)       |                    |
| 35M      | 35mm (≈ #11 US)       |                    |
| 4-15M    | 4 bars of 15mm        | Footing main bars  |
| 15M@300  | 15mm at 300mm spacing | Slab reinforcing   |
| E.W.     | Each way              | Both directions    |
| T&B      | Top and bottom        | Both layers        |
| E.F.     | Each face             | Both faces of wall |

### Appendix B: Standard Abbreviations

| Abbreviation | Meaning          |
| ------------ | ---------------- |
| U/S          | Underside        |
| T/O          | Top of           |
| FTG          | Footing          |
| COL          | Column           |
| ELEV         | Elevation        |
| REINF        | Reinforcing      |
| CONC         | Concrete         |
| TYP          | Typical          |
| SIM          | Similar          |
| E.W.         | Each way         |
| T&B          | Top and bottom   |
| C/C          | Center to center |
| CLR          | Clear            |
| MIN          | Minimum          |
| MAX          | Maximum          |

### Appendix C: Sheet Numbering Standard (NCS)

| Series | Content                            |
| ------ | ---------------------------------- |
| S-0xx  | General: notes, legends, schedules |
| S-1xx  | Plans                              |
| S-2xx  | Elevations                         |
| S-3xx  | Sections                           |
| S-4xx  | Large scale views                  |
| S-5xx  | Details                            |
| S-6xx  | Schedules and diagrams             |

### Appendix D: Test Plan Sets

For validation, use diverse plan sets including:

1. **Small residential** - Simple footings, minimal schedules
2. **Medium commercial** - Multiple schedule types, complex grid
3. **Large institutional** - Many sheets, revisions, detailed notes
4. **Canadian metric** - CSA standards, metric notation
5. **US imperial** - ACI standards, imperial notation
6. **Poor quality scans** - Test OCR robustness
7. **Handwritten annotations** - Test annotation handling

### Appendix E: Related Documents

- SiteLink Mobile App PRD
- SiteLink Processing Pipeline Architecture
- LiveStore Sync Specification
- Cloudflare Workers API Design

---

## Document History

| Version | Date     | Author       | Changes     |
| ------- | -------- | ------------ | ----------- |
| 1.0     | Jan 2026 | Product Team | Initial PRD |

---

_End of Document_
