# SiteLink AI Features Specification

**Version:** 1.0
**Date:** January 2026
**Status:** Authoritative Reference

---

## Table of Contents

1. [Overview](#1-overview)
2. [Processing Architecture: Cloud vs Device](#2-processing-architecture-cloud-vs-device)
3. [AI-Powered Extraction Pipeline](#3-ai-powered-extraction-pipeline)
4. [Plan Assistant Feature](#4-plan-assistant-feature)
5. [Voice Features](#5-voice-features)
6. [Daily Summary Generation](#6-daily-summary-generation)
7. [Photo Intelligence](#7-photo-intelligence)
8. [RFI Draft Generation](#8-rfi-draft-generation)
9. [Feature Availability by Tier](#9-feature-availability-by-tier)

---

## 1. Overview

SiteLink incorporates AI and machine learning at multiple levels to transform construction drawings from static documents into an interactive knowledge base. This document specifies all AI-powered features, their processing locations, and offline capabilities.

### 1.1 Key Principle

**The drawing is the source of truth.** The AI is an assistant, not an authority. Every piece of AI-extracted information includes provenance (source sheet, location, confidence) so workers can verify before acting.

### 1.2 Processing Philosophy

SiteLink uses a **cloud-first processing, offline-capable querying** architecture:

| Processing Type | Where It Runs | Why |
|----------------|---------------|-----|
| YOLO detection | CLOUD | GPU required, model weights (~50MB) |
| OCR extraction | CLOUD | GPU-accelerated, model size |
| Schedule parsing | CLOUD | Depends on OCR results |
| LLM inference | CLOUD | Model size, quality requirements |
| Data queries | DEVICE | Pre-extracted data synced locally |
| Response formatting | DEVICE | Templates applied to local data |

**CRITICAL: No ML models run on the mobile device.** The device receives only structured data results that have been pre-extracted in the cloud.

---

## 2. Processing Architecture: Cloud vs Device

### 2.1 What Runs Where

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD PROCESSING                                │
│                        (During PDF Upload)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐                  │
│  │  PDF    │    │   OCR   │    │  YOLO   │    │ Schedule│                  │
│  │  Split  │───▶│PaddleOCR│───▶│Detection│───▶│ Parsing │                  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘                  │
│       │              │              │              │                        │
│       ▼              ▼              ▼              ▼                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Structured Data (Syncs to Device)                │    │
│  │  • Callout markers + links    • Element labels + grid locations    │    │
│  │  • Schedule entries           • Grid system coordinates            │    │
│  │  • OCR text (searchable)      • Project context (notes)            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                           LiveStore Sync
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DEVICE (Mobile App)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Local SQLite (LiveStore)                         │  │
│  │  All extracted data available for instant queries (<100ms)           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────┐    │
│  │   Offline Query Engine      │    │   Template Response Generator   │    │
│  │   • SQL against local data  │    │   • Format data for display     │    │
│  │   • Pattern-based intent    │    │   • Include provenance links    │    │
│  └─────────────────────────────┘    └─────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Offline Capabilities Summary

| Feature | Offline? | How It Works |
|---------|----------|--------------|
| View callout markers | YES | YOLO ran in cloud; results synced to device |
| Navigate callout links | YES | Link data stored in local SQLite |
| Query "What's at F/5?" | YES | SQL query against synced elements table |
| View schedule info | YES | Schedule entries synced to device |
| Search plan text | YES* | OCR text synced; local full-text search |
| AI chat responses | NO | Requires LLM API call to cloud |
| Voice transcription | NO | Requires Whisper API |
| Daily summary | NO | Requires LLM synthesis |

*Plan text search works offline only if OCR text has been synced to the device.

### 2.3 Why NOT On-Device LLM

The Plan Assistant PRD mentions "on-device LLM" for offline. This is **not practical** for SiteLink:

| Concern | Reality |
|---------|---------|
| **Latency** | On-device LLMs (Phi-3, Gemma) have 8-15 second response times on mobile |
| **Model Size** | Smallest useful models are 2-4GB; impacts app download and storage |
| **Battery** | LLM inference drains battery rapidly |
| **Quality** | Small models have lower accuracy than cloud APIs |
| **Maintenance** | Model updates require app updates |

**Correct approach:** Pre-extract all data in the cloud, sync structured results, use simple template-based responses offline. Users get instant (<100ms) responses from local SQLite queries.

---

## 3. AI-Powered Extraction Pipeline

All extraction runs in the cloud during PDF upload. The mobile device never runs these models.

### 3.1 YOLO Callout Detection

**Purpose:** Automatically detect callout symbols (section markers, detail bubbles, elevation markers) and link them to target sheets.

**Technology:** YOLOv11n custom-trained model (YOLO-26n)

**Current Model: 4-class model (grid_bubble_v15)**

| Metric | Overall | Detail | Elevation | Title | Grid Bubble |
|--------|---------|--------|-----------|-------|-------------|
| Recall | 95.98% | - | - | - | - |
| Precision | 95.03% | - | - | - | - |
| mAP50 | 96.48% | - | - | - | - |
| mAP50-95 | 89.32% | - | - | - | - |

**Previous Model (3-class, iteration-5):**

| Metric | Overall | Detail | Elevation | Title |
|--------|---------|--------|-----------|-------|
| Recall | 91.8% | 90.7% | 93.8% | 90.5% |
| Precision | 88.6% | 87.7% | 95.2% | 84.1% |
| mAP50 | 94.5% | - | - | - |

**What Gets Detected (4 classes):**
- **detail** - Small circular/rectangular callouts with text/numbers (e.g., detail bubbles referencing other sheets)
- **elevation** - Similar to detail markers, typically found on elevation views
- **title** - Larger rectangular boxes containing detail titles
- **grid_bubble** - Circles at sheet edges containing single letters (A, B, C) or numbers (1, 2, 3) for the grid coordinate system

> **Note:** Grid bubble detections are stored during processing but the grid coordinate UI (element-to-grid association, "What's at F/5?" queries) is deferred to Phase 2. See [Phase 2 Enhancements](#phase-2-enhancements-planned).

**Processing Location:** Cloud (GPU-accelerated worker)

**Output:** Callout records with:
- Bounding box coordinates
- Callout type classification
- Source sheet ID
- Target sheet reference (e.g., "10/S2.0")
- Confidence score

**Sync:** Results sync to device via LiveStore, enabling offline callout navigation.

### 3.2 YOLO Element Label Detection

> **Status: Phase 2** - Research and implementation spec complete. Deferred to Phase 2 (after Plan Info feature ships). See beads tickets `sitelink-3r0` (implementation spec, closed) and `sitelink-d3w` (planning). Research complete in `sitelink-j1q` (closed).

**Purpose:** Detect element type labels on plan sheets (FOOTING TYPE F1, PIER TYPE P1, etc.) and associate them with grid locations.

**Technology:** YOLO model + LLM extraction (consistent with callout pipeline)

**Pipeline:**
1. YOLO detects element label bounding box
2. Crop image using bbox
3. LLM batch extracts text (e.g., "F1", "FOOTING TYPE F2")
4. Post-processing associates label with nearest grid intersection

**What Gets Detected:**
- Footing type labels
- Pier type labels
- Column type labels
- Elevation annotations
- Grid intersection associations

**Target Patterns:**

| Pattern | Regex | Example |
|---------|-------|---------|
| Footing Type | `(FOOTING\|FTG)\s*TYPE\s*["']?([A-Z]?\d+)["']?` | FOOTING TYPE "F1" |
| Pier Type | `PIER\s*TYPE\s*["']?([A-Z]?\d+)["']?` | PIER TYPE "P1" |
| Column Type | `(COLUMN\|COL)\s*TYPE\s*["']?([A-Z]?\d+)["']?` | COL TYPE C2 |
| Elevation | `(U/S\|T/O)\s*(OF\s*)?(FTG\|PIER\|COL)?\s*ELEV\.?:?\s*([-+]?\d+)` | U/S OF FTG ELEV.: -1500 |

**Processing Location:** Cloud

**Output:** Element records with:
- Element type (footing, pier, column)
- Type code (F1, P1, C2)
- Grid location (F/5, AA/3)
- Elevation (if detected)
- Bounding box for provenance
- Confidence score

### 3.3 OCR Text Extraction

**Purpose:** Extract all text from plan sheets for full-text search and schedule parsing.

**Technology:** PaddleOCR

**Processing Location:** Cloud (~10 sec/page)

**Output:**
- Text blocks with bounding boxes
- Confidence scores per block
- Searchable text index

**Storage:** ~10KB text per sheet average

### 3.4 Grid System Detection

> **Status: Detection complete, UI deferred to Phase 2.** Grid bubbles are detected by the 4-class YOLO callout model (96.48% mAP50) and stored during processing. The grid coordinate system UI (building coordinate lookup, element-to-grid association, "What's at F/5?" queries) is deferred to Phase 2. See [Phase 2 Enhancements](#phase-2-enhancements-planned).

**Purpose:** Build coordinate system from grid bubbles to enable grid-based queries.

**Technology:** YOLO grid_bubble detection (Phase 1) + post-processing coordinate system (Phase 2)

**Processing Location:** Cloud (~2 sec/page)

**Phase 1 (Current) - Detection & Storage:**
1. YOLO detects grid_bubble bounding boxes on each sheet
2. LLM extracts single character from cropped bubble image
3. Grid bubble records stored with label, position, confidence
4. Data syncs to device via LiveStore (available for Phase 2)

**Phase 2 (Planned) - Coordinate System:**
1. Classify: horizontal labels (letters A, B, C) vs vertical (numbers 1, 2, 3)
2. Interpolate grid lines between detected bubbles
3. Handle non-standard grids (1x, 2x, AA, BB, etc.)
4. Build coordinate lookup table
5. Associate elements with nearest grid intersection

**Output:** Grid line records with:
- Label (A, B, 1, 2, AA, etc.)
- Axis (horizontal/vertical)
- Pixel position on sheet
- Confidence score

### 3.5 Document Layout Region Classification

> **Status: Complete** - DocLayout-YOLO fine-tuned on construction drawings. Model: `weights/doclayout_construction_v1.pt` (225 MB).

**Performance Metrics:**

| Metric | Value |
|--------|-------|
| mAP50 | 96.8% |
| mAP50-95 | 94.9% |
| Precision | 93.9% |
| Recall | 95.3% |

**Dataset:** 507 train / 144 valid / 76 test images (460 annotations across 312 base images, augmented to 727)

**Purpose:** Detect and classify layout regions on structural drawings to enable targeted extraction of schedules, notes, and legends.

**Technology:** DocLayout-YOLO (fine-tuned from DocStructBench weights on construction drawings)

**Processing Location:** Cloud (~2 sec/page)

#### Region Class Definitions (US NCS & Canadian CSA/RAIC Standards)

These definitions align with the US National CAD Standard (NCS) Uniform Drawing System and Canadian CSA B78.2 / RAIC standards:

| Class | Definition | Key Identifier |
|-------|------------|----------------|
| **schedule** | Tabular list of multiple items of the same type with their properties | Rows = different instances; Columns = properties |
| **notes** | Text blocks containing specifications, instructions, or requirements | Prose/paragraphs, may include abbreviation lists |
| **legend** | Visual key showing graphical symbols (hatches, patterns, line types) and their meanings | GRAPHIC → MEANING mapping |

#### Annotation Guidelines

**SCHEDULE** - Annotate when:
- Table explicitly titled "SCHEDULE" (e.g., "FOOTING SCHEDULE", "BEAM SCHEDULE")
- Table lists multiple instances of the same item type with properties
- Has structured columns (MARK, SIZE, REINFORCING, etc.)

**DO NOT** annotate as schedule:
- Design criteria boxes (single item specs)
- Connection detail tables
- Abbreviation lists
- Drawing indexes

**NOTES** - Annotate when:
- Text block titled "NOTES" (e.g., "GENERAL NOTES", "CONCRETE NOTES")
- Prose/paragraph format with specifications or instructions
- Abbreviation lists (TEXT → TEXT mapping, no graphics)
- Drawing lists/indexes

**DO NOT** annotate as notes:
- Single-line labels
- Dimension text
- Title blocks

**LEGEND** - Annotate when:
- Shows graphical symbols/patterns with their meanings
- Titled "LEGEND" (e.g., "SLAB LEGEND", "DECK LEGEND", "SYMBOL LEGEND")
- Contains hatch patterns, line types, or symbols with explanations

**DO NOT** annotate as legend:
- Abbreviation lists (these are notes - TEXT → TEXT, not GRAPHIC → TEXT)
- Drawing indexes/lists
- Schedule tables

#### Examples by Region Type

| Example | Class | Reason |
|---------|-------|--------|
| "FOOTING SCHEDULE" with F1, F2, F3 rows | schedule | Multiple items + properties |
| "SLAB & DECK LEGEND" with hatch patterns | legend | Graphics → meanings |
| "GENERAL NOTES" text block | notes | Text instructions |
| "ABBREVIATIONS" list | notes | TEXT → TEXT (no graphics) |
| "DRAWING INDEX" | notes | Text list (no graphics) |
| "STRUCTURAL SYMBOL LEGEND" | legend | Symbols → meanings |
| "COMPOSITE BEAM CRITERIA" box | notes (or skip) | Single item specs, not multiple instances |

**Output:** Region detection records with:
- Region class (schedule, notes, legend)
- Bounding box coordinates
- Confidence score
- Sheet reference

### 3.6 Schedule Extraction

> **Status: Next Up** - DocLayout detection complete (3.5). LLM prompt design and testing required.

**Purpose:** Parse detected schedule regions (footing, pier, column, beam) into structured data.

**Technology:** DocLayout-YOLO region detection → crop → LLM structured extraction (Gemini Flash)

**Processing Location:** Cloud (~5 sec/page)

**Supported Schedule Types:**

| Schedule | Header Patterns | Common Columns |
|----------|----------------|----------------|
| Footing | `FOOTING SCHEDULE`, `FTG SCHEDULE` | MARK/TYPE, SIZE, REINFORCING |
| Pier | `PIER SCHEDULE` | MARK, SIZE, REINFORCING, T/O PIER ELEV |
| Column | `COLUMN SCHEDULE`, `COL SCHEDULE` | MARK, SIZE, VERT BARS, TIES |
| Beam | `BEAM SCHEDULE` | MARK, SIZE, TOP BARS, BTM BARS, STIRRUPS |

**Output:** Schedule entry records with:
- Schedule type
- Type code (F1, P1, C2)
- Size (parsed dimensions)
- Reinforcing specification
- All properties (JSON)
- Bounding box of source row
- Confidence score

### 3.7 Notes Extraction

> **Status: Next Up** - DocLayout detection complete (3.5). LLM prompt design and testing required.

**Purpose:** Extract project context from detected notes regions for AI query responses.

**Technology:** DocLayout-YOLO region detection → crop → LLM text extraction (Gemini Flash)

**Processing Location:** Cloud (~3 sec/page for S0.x sheets)

**Target Sections:**

| Section | Header Patterns |
|---------|-----------------|
| General Notes | `GENERAL\s*NOTES` |
| Concrete Notes | `CONCRETE\s*(NOTES\|AND\s*FOUNDATION\s*NOTES)` |
| Reinforcing Steel Notes | `REINFORC(ING\|EMENT)\s*STEEL\s*NOTES` |
| Structural Steel Notes | `STRUCTURAL\s*STEEL\s*NOTES` |
| Masonry Notes | `MASONRY\s*NOTES` |

**Output:** Project context records with:
- Context type
- Full extracted text
- Source sheet reference
- Confidence score

### 3.8 Legend Region Display

> **Status: Next Up** - DocLayout detection complete (3.5). No LLM extraction needed.

**Purpose:** Make legend regions discoverable and viewable without hunting through sheets.

**Technology:** DocLayout-YOLO region detection → high-res image crop (no LLM extraction)

**Processing Location:** Cloud (crop generation only, ~1 sec/page)

**Rationale:** Legends contain graphical symbols (hatch patterns, line types) that are difficult to represent as structured text. Showing a high-res crop of the detected region delivers 80% of the value for 10% of the effort. Structured legend extraction may be added later if demand warrants.

**Output:** Legend region records with:
- Region bounding box
- High-res image crop URL (stored in R2)
- Source sheet reference
- Confidence score

### 3.9 End-to-End Pipeline Sequence

The complete processing pipeline runs in the cloud during PDF upload. The mobile device receives only structured results.

```
PDF Upload (Device → Cloud)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Sheet Splitting & Image Generation          ~5 sec │
│ Split PDF → individual sheet images (PNG at 72 DPI)         │
│ Store images in R2                                          │
└────────────────────────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Metadata Extraction                        ~10 sec │
│ Crop title block region → LLM (Gemini Flash) extraction     │
│ Output: sheet_number, sheet_title, discipline               │
│ Build sheet registry (known sheet numbers for validation)   │
│ Fallback: Tesseract OCR + regex patterns                    │
└────────────────────────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Tile Generation                           ~30s/pg  │
│ pyvips dzsave (layout='google') → PMTiles conversion        │
│ Tiles uploaded to R2, downloaded to device on demand         │
└────────────────────────────┬────────────────────────────────┘
         │
    ┌────┴─────────────────────────┐
    │ Stages 4 & 5 run in PARALLEL │
    ├──────────────┬───────────────┤
    ▼              ▼               │
┌─────────────┐ ┌─────────────┐   │
│  Stage 4:   │ │  Stage 5:   │   │
│  Callout    │ │  DocLayout  │   │
│  Detection  │ │  Detection  │   │
│             │ │             │   │
│  YOLO 4-cls │ │ DocLayout-  │   │
│  (5.5 MB)   │ │ YOLO(225MB) │   │
│             │ │             │   │
│  Classes:   │ │  Classes:   │   │
│  • detail   │ │  • schedule │   │
│  • elevation│ │  • notes    │   │
│  • title    │ │  • legend   │   │
│  • grid_    │ │             │   │
│    bubble   │ │  96.8%mAP50 │   │
│             │ │             │   │
│  96.5%mAP50 │ │             │   │
└──────┬──────┘ └──────┬──────┘   │
       │               │          │
       ▼               ▼          │
┌─────────────┐ ┌─────────────┐   │
│  Stage 4b:  │ │  Stage 5b:  │   │
│  Callout    │ │  Region     │   │
│  Content    │ │  Content    │   │
│  Extraction │ │  Extraction │   │
│             │ │             │   │
│  Crop bbox  │ │  Schedule:  │   │
│  → LLM     │ │   Crop→LLM  │   │
│  Extracts:  │ │   →JSON     │   │
│  detail_num │ │             │   │
│  sheet_ref  │ │  Notes:     │   │
│             │ │   Crop→LLM  │   │
│  Validate   │ │   →text     │   │
│  against    │ │             │   │
│  sheet      │ │  Legend:    │   │
│  registry   │ │   Crop→R2  │   │
│             │ │   (image    │   │
│             │ │    only)    │   │
└──────┬──────┘ └──────┬──────┘   │
       │               │          │
       └───────┬───────┘          │
               │                  │
               ▼                  │
┌─────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 6: Synthesis & Linking                                │
│                                                             │
│ Cross-Sheet Links:                                          │
│  Callout "3/A7" on sheet A2.0 → detail 3 on sheet A7       │
│                                                             │
│ Contextual Data Storage:                                    │
│  Schedule entries indexed by mark for quick retrieval       │
│  Notes content stored and associated with sheets            │
│  Legend image crops stored in R2 with region metadata        │
│  Grid bubble detections stored for Phase 2                  │
│                                                             │
│ Confidence Scoring:                                         │
│  High confidence → auto-linked                              │
│  Low confidence → flagged for manual review                 │
└────────────────────────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 7: Storage & Sync to Device                           │
│                                                             │
│ Server: Cloudflare D1 database                              │
│  • callouts (source → target with bbox, confidence)         │
│  • layout_regions (schedule/notes/legend with bbox)         │
│  • schedule_entries (mark, properties, source sheet)        │
│  • notes_content (extracted text, source sheet)             │
│  • grid_bubbles (label, position — stored for Phase 2)      │
│                                                             │
│ Mobile: LiveStore (local-first, event sourced)              │
│  • All data syncs for offline access                        │
│  • <100ms query response from local SQLite                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3A. Plan Info Feature (Discovery UI)

The Plan Info feature surfaces extracted plan intelligence to users through a discovery-oriented interface. Instead of requiring users to hunt through sheets for schedules, notes, and legends, SiteLink presents what it found in an organized, browseable view.

### 3A.1 Competitive Differentiator

| Capability | Fieldwire | PlanGrid | SiteLink |
|------------|-----------|----------|----------|
| Auto-link callouts | Yes | Yes | Yes (96.5% mAP50) |
| Schedule extraction | Manual | Manual | **Automated via LLM** |
| Notes extraction | Manual | Manual | **Automated via LLM** |
| Legend discovery | Manual | Manual | **Auto-detected regions** |
| Offline access to extracted data | N/A | N/A | **Yes (LiveStore)** |

### 3A.2 User Journeys

**Journey 1: Carlos needs footing specs (browse path)**

```
Carlos opens SiteLink
         │
         ▼
┌─────────────────────────────────────────────┐
│  Plans Tab                                  │
│  ────────────────────────────────────────── │
│  [  Sheets  ] [● Plan Info ]               │
│                    ▲                         │
│              Carlos taps                     │
│              "Plan Info"                     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Plan Info View                             │
│  ────────────────────────────────────────── │
│  SCHEDULES (4)                              │
│  ┌────────────────────────────────────┐     │
│  │  Footing Schedule         S0.0  > │     │
│  │  Pier Schedule            S0.0  > │ ◄── Carlos taps
│  │  Beam Schedule            S5.0  > │     │
│  │  Column Schedule          S5.0  > │     │
│  └────────────────────────────────────┘     │
│                                             │
│  NOTES (2)                                  │
│  ┌────────────────────────────────────┐     │
│  │  General Notes            S0.0  > │     │
│  │  Concrete Notes           S0.1  > │     │
│  └────────────────────────────────────┘     │
│                                             │
│  LEGENDS (2)                                │
│  ┌────────────────────────────────────┐     │
│  │  Slab & Deck Legend       S0.0  > │     │
│  │  Symbol Legend            S0.1  > │     │
│  └────────────────────────────────────┘     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Footing Schedule                           │
│  ────────────────────────────────────────── │
│  Sheet S0.0 · 94% confidence                │
│                                             │
│  ┌──────┬──────────────┬───────────────┐    │
│  │ Mark │ Size         │ Reinforcing   │    │
│  ├──────┼──────────────┼───────────────┤    │
│  │  F1  │ 1500x1500x300│ 4-15M E.W.   │    │
│  │  F2  │ 2000x2000x400│ 6-20M E.W.   │ ◄── Carlos finds F2
│  │  F3  │ 1200x1200x250│ 4-15M E.W.   │    │
│  └──────┴──────────────┴───────────────┘    │
│                                             │
│  Tap a row for full details                 │
│  [View on Sheet]                            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼ (optional)
┌─────────────────────────────────────────────┐
│  Footing F2 (Detail View)                   │
│  ────────────────────────────────────────── │
│  Size: 2000 x 2000 x 400 mm                │
│  Reinforcing: 6-20M E.W.                   │
│  Top of Footing: -1200                      │
│  Notes: Provide dowels per detail 3/S5.0    │
│                                             │
│  Source: Footing Schedule, Sheet S0.0       │
│  Confidence: 94%                            │
│                                             │
│  [View on Sheet] → navigates to S0.0,      │
│  zooms to schedule region, highlights bbox  │
└─────────────────────────────────────────────┘

TIME: ~15 seconds (vs 5-8 minutes manual)
```

**Journey 2: Mike checks project notes**

```
Mike opens Plan Info → NOTES section
         │
         ▼
┌─────────────────────────────────────────────┐
│  General Notes                              │
│  ────────────────────────────────────────── │
│  Sheet S0.0                                 │
│                                             │
│  1. All concrete shall be 4000 PSI minimum  │
│     28-day strength unless noted otherwise. │
│                                             │
│  2. Reinforcing steel shall be ASTM A615    │
│     Grade 60.                               │
│                                             │
│  3. Minimum concrete cover: 3" for footings,│
│     1.5" for columns and beams.             │
│                                             │
│  [View on Sheet]                            │
└─────────────────────────────────────────────┘

TIME: ~10 seconds (vs 2-5 minutes finding notes sheet)
```

**Journey 3: Worker checks legend (image crop, no extraction)**

```
Worker opens Plan Info → LEGENDS section
         │
         ▼
┌─────────────────────────────────────────────┐
│  Slab & Deck Legend                         │
│  ────────────────────────────────────────── │
│  Sheet S0.0                                 │
│                                             │
│  ┌───────────────────────────────────┐      │
│  │                                   │      │
│  │   [High-res image crop of the     │      │
│  │    legend region as detected      │      │
│  │    by DocLayout-YOLO]             │      │
│  │                                   │      │
│  │   Pinch to zoom supported         │      │
│  │                                   │      │
│  └───────────────────────────────────┘      │
│                                             │
│  [View on Sheet]                            │
└─────────────────────────────────────────────┘
```

**Journey 4: On-sheet discovery (secondary path)**

```
User viewing sheet S0.0 (cover sheet)
         │
         ▼
┌─────────────────────────────────────────────┐
│  Sheet S0.0 - Cover Sheet                   │
│  ────────────────────────────────────────── │
│                                             │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                    │
│  │ FOOTING SCHEDULE    │ ◄── Dashed overlay │
│  │ (tappable region)   │     on detected    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘     schedule region │
│                                             │
│  ○ ○ ○  (callout markers as before)         │
│                                             │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                    │
│  │ GENERAL NOTES       │ ◄── Dashed overlay │
│  │ (tappable region)   │     on detected    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘     notes region   │
│                                             │
│  User taps schedule region                  │
│         │                                   │
│         ▼                                   │
│  ┌────────────────────────────────────┐     │
│  │  Bottom Sheet: Footing Schedule    │     │
│  │  (same data as Plan Info view)     │     │
│  │                                    │     │
│  │  F1 │ 1500x1500 │ 4-15M E.W.     │     │
│  │  F2 │ 2000x2000 │ 6-20M E.W.     │     │
│  │  [See Full Schedule]               │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### 3A.3 Plan Info Data Model

```sql
-- Layout regions detected by DocLayout-YOLO
CREATE TABLE layout_regions (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),
  region_class TEXT NOT NULL,    -- "schedule", "notes", "legend"
  region_title TEXT,             -- "Footing Schedule", "General Notes"

  -- Position (normalized 0-1)
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,

  -- Content
  extracted_content TEXT,        -- JSON (schedules) or text (notes)
  crop_image_url TEXT,           -- R2 URL for legend image crops

  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);

-- Schedule entries (parsed from schedule regions)
CREATE TABLE schedule_entries (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES layout_regions(id),
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  schedule_type TEXT NOT NULL,   -- "footing", "pier", "column", "beam"
  mark TEXT NOT NULL,            -- "F1", "P1", "C2"
  properties TEXT NOT NULL,      -- JSON: {size, reinforcing, notes, ...}

  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);

-- Grid bubbles (detected, stored for Phase 2)
CREATE TABLE grid_bubbles (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),

  label TEXT NOT NULL,           -- "A", "B", "1", "2"
  axis TEXT,                     -- "horizontal", "vertical" (Phase 2)

  -- Position (normalized 0-1)
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,

  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL
);
```

### 3A.4 Implementation Priority

| Priority | Feature | Extraction Method | Status |
|----------|---------|-------------------|--------|
| **P0** | Schedule extraction (footing, beam first) | LLM on cropped region | Next Up |
| **P0** | Notes extraction | LLM on cropped region | Next Up |
| **P0** | Plan Info browse UI | Mobile screens | Next Up |
| **P1** | Legend image crop display | Image crop only (no LLM) | Next Up |
| **P1** | On-sheet region overlays | Extends marker system | Next Up |
| **P1** | Search integration with extracted content | Index schedule/notes text | Next Up |

---

## Phase 2 Enhancements (Planned)

The following features are **fully researched and specced** but deferred to Phase 2 to focus on Plan Info first.

### Grid Coordinate System UI
- **What:** Tap grid intersection → see all elements at that location
- **Depends on:** Grid bubble detections (stored in Phase 1), element label detection
- **Spec:** sitelink-3r0, sitelink-d3w
- **Scope:** Build coordinate lookup from stored grid bubbles, interpolate grid lines, associate elements

### Element Label Detection & Tap
- **What:** Tap element label (F2) on plan → see schedule entry popup
- **Depends on:** New YOLO classes (footing_label, pier_label, column_label), grid system
- **Spec:** sitelink-3r0 (full implementation spec)
- **Scope:** Train new YOLO classes, LLM text extraction, grid association, tap UI

### Plan Assistant (AI Voice Queries)
- **What:** "What's at F/5?" → aggregated answer with provenance
- **Depends on:** Grid system, element detection, schedule extraction
- **Spec:** Section 4 of this document
- **Scope:** Intent classification, data retrieval, template responses (offline), LLM responses (online)

### Schedule-to-Element Linking
- **What:** Tap F2 on plan → jump to F2 row in schedule, and vice versa
- **Depends on:** Element label detection, schedule extraction
- **Scope:** Cross-reference schedule marks with detected element labels on plan sheets

---

## 4. Plan Assistant Feature

The Plan Assistant transforms static drawings into an interactive knowledge base. Workers can ask natural language questions and receive aggregated answers with full provenance.

### 4.1 Core Differentiator

**Competitor Approach (Fieldwire/PlanGrid):**
- Auto-link callouts to target sheets
- User taps callout, jumps to target sheet
- User must still read and synthesize information manually

**SiteLink Approach:**
- Aggregates information from multiple sources (plan + schedule + details)
- Presents synthesized answer in one view
- Every fact includes source attribution
- "View Source" navigates directly to the source location

### 4.2 Query Types

| Type | Example Queries | Required Data | Offline? |
|------|-----------------|---------------|----------|
| Location | "What's at F/5?", "Grid AA/3" | Elements, Schedules, Callouts | YES |
| Element | "Show all F1 footings" | Elements by type | YES |
| Schedule | "What rebar for F1?" | Schedule entries | YES |
| Context | "What concrete strength?" | Project context (notes) | YES |
| Count | "How many F1 footings?" | Elements by type | YES |
| Compare | "What changed in Rev 3?" | Multiple revisions | PARTIAL |
| Explanation | "What does E.W. mean?" | LLM interpretation | NO |

### 4.3 Offline Query Flow

```
User asks: "What's at grid F/5?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Intent Classification (LOCAL - No LLM)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Pattern matching via regex                                                 │
│ • Regex: /(?:at|grid)\s*([A-Z]+)\s*/?\s*(\d+)/i                             │
│ • Result: { type: "location", grid: "F/5" }                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: Data Retrieval (LOCAL SQLite via LiveStore)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ SELECT * FROM elements WHERE grid_location = 'F/5'                           │
│ SELECT * FROM schedule_entries WHERE type_code IN (...)                      │
│ SELECT * FROM callouts WHERE source_grid = 'F/5'                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Template Response Formatting (LOCAL)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ **Grid F/5**                                                                 │
│                                                                              │
│ **Footing:** F1                                                              │
│   Size: 1500x1500x300 mm                                                     │
│   Rebar: 4-15M E.W.                                                          │
│   [Source: S0.0, Footing Schedule] [View]                                    │
│                                                                              │
│ **Pier:** P1                                                                 │
│   Size: 450x450 mm                                                           │
│   Rebar: 4-25M verts, 10M@300 ties                                           │
│   [Source: S0.0, Pier Schedule] [View]                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Response time: <100ms (local SQLite query + template)
```

### 4.4 Online Query Flow (with AI Enhancement)

When online, queries can be enhanced with LLM-generated natural language responses:

```
User asks: "What's at grid F/5?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Steps 1-2: Same as offline (Intent + Data Retrieval)                         │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: LLM Response Generation (CLOUD)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Send data context + query to Claude/Gemini                                   │
│ LLM generates natural language response with provenance                      │
│ Response time: 2-5 seconds                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Context Building for AI Responses

When using LLM, context is assembled from extracted data:

```python
async def build_query_context(project_id, query_intent, current_sheet_id):
    context_parts = []

    # 1. Always include relevant schedules
    schedules = await db.query("""
        SELECT schedule_type, type_code, properties, source_sheet_name, confidence
        FROM schedule_entries
        WHERE project_id = ?
    """, [project_id])

    # 2. Include elements if location query
    if query_intent.type == 'location':
        elements = await db.query("""
            SELECT element_type, type_code, elevation, raw_text,
                   sheet_number, confidence
            FROM elements
            WHERE grid_location = ?
        """, [query_intent.grid])

    # 3. Include notes if context query
    if query_intent.type == 'context':
        notes = await db.query("""
            SELECT context_type, content, source_sheet_name
            FROM project_context
            WHERE context_type IN ('concrete_notes', 'steel_notes', 'general_notes')
        """)

    # 4. Include warnings for missing data
    if status.missing_context:
        context_parts.append(f"WARNING: Missing {status.missing_context}")

    return '\n'.join(context_parts)
```

### 4.6 Response Formatting

All responses include provenance for every fact:

```
**Footing F1**
Size: 1500x1500x300
  Source: S0.0, Footing Schedule, Row 1 [View] (94% confidence)

Reinforcing: 4-15M E.W.
  Source: S0.0, Footing Schedule, Row 1 [View] (91% confidence)

Elevation: -1500
  Source: S1.0, Label at grid F/5 [View] (87% confidence) WARNING
```

### 4.7 "View Source" Navigation

Every extracted fact has a "View Source" action that:

1. Navigates to the source sheet
2. Zooms to show the bounding box region with padding
3. Draws highlight rectangle around the source
4. Shows "Back to answer" button
5. Optionally pulses/animates the highlight

```typescript
async function navigateToSource(provenance: Provenance) {
  // Switch to source sheet
  await navigation.goToSheet(provenance.sheet_id)

  // Zoom to region with padding
  const padding = 100  // pixels
  const targetRegion = {
    x: provenance.bbox.x - padding,
    y: provenance.bbox.y - padding,
    width: provenance.bbox.width + padding * 2,
    height: provenance.bbox.height + padding * 2,
  }
  await viewer.zoomToRegion(targetRegion)

  // Add highlight overlay
  viewer.addHighlight({
    bbox: provenance.bbox,
    color: "#FFD700",  // Gold
    opacity: 0.3,
    animate: true,
  })

  // Show back button
  ui.showBackButton({
    label: "Back to answer",
    onPress: () => navigation.goBack(),
  })
}
```

### 4.8 Confidence Indicators

| Confidence | Display | Action |
|------------|---------|--------|
| >=90% | Green checkmark or none | Normal display |
| 80-89% | Yellow indicator | Subtle warning |
| <80% | Orange warning + text | "Verify on drawing" message |
| Multiple conflicts | Red alert | "Conflicting info found" |

### 4.9 Missing Data Handling

When information cannot be found:

```
**Grid F/5**

**Footing**
  Type: F1
  Size: --
  Rebar: --

  WARNING: Footing Schedule not found
  Check S0.0 or shop drawings
```

---

## 5. Voice Features

### 5.1 Voice Note Recording

**Trigger:** User taps microphone icon after taking photo

**Processing:**
1. Audio recorded locally (m4a/webm, max 60 seconds)
2. Stored locally immediately (works offline)
3. Uploaded to R2 when online
4. Transcription queued via Whisper API

**Offline Behavior:**
- Audio recording works fully offline
- Audio stored locally, queued for upload
- Transcription happens when connectivity restored

### 5.2 Voice Transcription

**Technology:** OpenAI Whisper API or Cloudflare Workers AI

**Processing Location:** CLOUD (not on device)

**Cost:** ~$0.006/minute of audio

**Latency:** 2-5 seconds for 30-second clip

**UI States:**

```
Recording:     "Recording... 0:03"
Uploading:     "Saving voice note..."
Transcribing:  "Voice note (0:05) - Transcribing..."
Complete:      "Voice note (0:05) [Play]"
               "Junction box needs to move..."
Error:         "Voice note (0:05) [Play]"
               "WARNING: Transcription failed [Retry]"
```

### 5.3 Voice Query Input

**Purpose:** Allow hands-free querying for workers with gloves

**Processing:**
1. On-device speech recognition (iOS/Android native)
2. Recognized text displayed for confirmation
3. Query processed as text query

**Offline Behavior:**
- Voice input works offline (device speech recognition)
- Query processing works offline (local SQLite)
- Only LLM-enhanced responses require connectivity

---

## 6. Daily Summary Generation

### 6.1 Overview

**Trigger:** User taps "Generate Daily Summary" in Project Detail

**Processing Location:** CLOUD (requires LLM)

**Model:** Gemini 2.0 Flash or Claude 3.5 Haiku

**Cost:** ~$0.01-0.02 per summary

**Latency:** 3-8 seconds

**Offline:** NOT available (requires LLM API)

### 6.2 Input Data

- All photos from selected date
- All voice note transcriptions
- Issue flags
- Callout references (where photos were taken)
- Project metadata (name, address)
- Weather data (from address, optional)

### 6.3 Prompt Template

```
Generate a professional Daily Construction Report from the following data:

Project: {project_name}
Address: {address}
Date: {date}
Weather: {weather}

Photos captured today:
{for each photo}
- Time: {timestamp}
- Location: {callout_reference or "General"}
- Issue: {yes/no}
- Voice note: "{transcription}"
{end for}

Format the report with these sections:
1. WORK PERFORMED - summarize what was done based on callout locations
2. ISSUES / DELAYS - list any flagged issues with quotes from voice notes
3. MATERIALS RECEIVED - if mentioned in voice notes, otherwise "None noted"
4. PHOTOS - mention total count

Keep it professional and concise. Use construction industry terminology.
```

### 6.4 Photo Analysis for Progress Detection

The daily summary can incorporate:
- Photo locations on plans (via callout associations)
- Sequence of photos (timeline)
- Issue flags
- Voice note context
- Photo OCR text (labels, tags visible in photos)

---

## 7. Photo Intelligence

### 7.1 Photo Text Extraction (OCR)

**Trigger:** Automatic on photo capture (background processing after upload)

**Processing Location:** CLOUD (PaddleOCR)

**Processing:**
1. Photo uploaded to R2
2. PaddleOCR extracts text
3. Text stored with photo metadata
4. Text becomes searchable

**Output:**
- Extracted text (editable by user)
- Searchable in photo search

**Display:** Only shown if text detected (>10 characters)

**Cost:** Negligible (reuses existing OCR infrastructure)

### 7.2 Offline Photo Capture

Photos captured offline are queued for processing:

```
1. Photo captured offline
   └─▶ Stored locally with photoCaptured event
   └─▶ UI shows photo immediately

2. Device comes online
   └─▶ Photo uploaded to R2
   └─▶ photoUploaded event with remote_url
   └─▶ OCR extraction runs
   └─▶ extractedText event with results
```

---

## 8. RFI Draft Generation

### 8.1 Overview

**Trigger:** User taps "Generate RFI" on issue photo

**Processing Location:** CLOUD (requires LLM)

**Model:** Claude 3.5 Sonnet (quality matters for professional documents)

**Cost:** ~$0.02-0.05 per RFI

**Latency:** 5-10 seconds

**Tier:** Business tier only

### 8.2 Input Data

- Issue photo
- Voice note transcription
- Callout reference (sheet number, detail number)
- Project metadata

### 8.3 Prompt Template

```
Generate a professional Request for Information (RFI) draft for construction:

Project: {project_name}
Reference: Detail {callout_id} on Sheet {sheet_number}
Issue Description (from field): "{voice_transcription}"

The RFI should:
1. Clearly describe the field condition discovered
2. Reference the specific drawing detail
3. Ask a specific question requiring architect/engineer response
4. Maintain professional tone

Format:
To: [Architect/Engineer]
Re: {brief subject line}

Description:
{2-3 sentences describing the issue}

Request:
{specific question}

Attachments referenced: Photo dated {date}
```

---

## 9. Feature Availability by Tier

### 9.1 AI Features by Pricing Tier

| Feature | Starter ($29/mo) | Pro ($79/mo) | Business ($149/mo) |
|---------|------------------|--------------|-------------------|
| Callout detection + linking | YES | YES | YES |
| Element detection | YES | YES | YES |
| Grid detection | YES | YES | YES |
| Schedule extraction | YES | YES | YES |
| Basic queries (location, element) | YES | YES | YES |
| Voice notes (audio only) | YES | YES | YES |
| Voice transcription | NO | YES | YES |
| Plan text search | NO | YES | YES |
| Photo OCR extraction | NO | YES | YES |
| Daily summary generation | NO | YES | YES |
| AI-enhanced query responses | NO | YES | YES |
| RFI draft generation | NO | NO | YES |

### 9.2 Offline Availability

| Feature | Works Offline? | Notes |
|---------|---------------|-------|
| View callout markers | YES | Data synced from cloud processing |
| Navigate callout links | YES | Link data in local SQLite |
| Query "What's at F/5?" | YES | SQL query + template response |
| View schedule data | YES | Schedule entries synced locally |
| View element labels | YES | Element data synced locally |
| Take photos | YES | Stored locally, queued for upload |
| Record voice notes | YES | Audio stored locally |
| Voice transcription | NO | Requires Whisper API |
| AI chat responses | NO | Requires LLM API |
| Daily summary | NO | Requires LLM synthesis |
| RFI generation | NO | Requires LLM API |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Product Team | Consolidated AI features from main PRD and Plan Assistant PRD |

---

_End of Document_
