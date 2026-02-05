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

**Technology:** YOLOv11n custom-trained model (YOLO-26n, iteration-5)

**Performance Metrics (from callout-processor-v6-experimental):**

| Metric | Overall | Detail | Elevation | Title |
|--------|---------|--------|-----------|-------|
| Recall | 91.8% | 90.7% | 93.8% | 90.5% |
| Precision | 88.6% | 87.7% | 95.2% | 84.1% |
| mAP50 | 94.5% | - | - | - |

**What Gets Detected (3 classes implemented):**
- **detail** - Small circular/rectangular callouts with text/numbers (e.g., detail bubbles referencing other sheets)
- **elevation** - Similar to detail markers, typically found on elevation views
- **title** - Larger rectangular boxes containing detail titles

**Planned (not yet implemented):**
- Section callouts
- Grid bubbles

**Processing Location:** Cloud (GPU-accelerated worker)

**Output:** Callout records with:
- Bounding box coordinates
- Callout type classification
- Source sheet ID
- Target sheet reference (e.g., "10/S2.0")
- Confidence score

**Sync:** Results sync to device via LiveStore, enabling offline callout navigation.

### 3.2 YOLO Element Label Detection

> **Status: Planned** - Not yet implemented. See beads tickets `sitelink-3r0` (implementation spec) and `sitelink-d3w` (planning). Research complete in `sitelink-j1q` (closed).

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

**Purpose:** Build coordinate system from grid bubbles to enable grid-based queries.

**Technology:** OpenCV circle detection + OCR

**Processing Location:** Cloud (~2 sec/page)

**Detection Process:**
1. Find circles at sheet edges (HoughCircles, filtered by position)
2. OCR single characters inside circles
3. Classify: horizontal labels (letters A, B, C) vs vertical (numbers 1, 2, 3)
4. Handle non-standard grids (1x, 2x, AA, BB, etc.)
5. Build coordinate lookup table

**Output:** Grid line records with:
- Label (A, B, 1, 2, AA, etc.)
- Axis (horizontal/vertical)
- Pixel position on sheet
- Confidence score

### 3.5 Schedule Detection and Extraction

> **Status: Planned** - Not yet implemented. This is a high-value feature for structural contractors but requires significant table detection work.

**Purpose:** Parse schedule tables (footing, pier, column, beam) into structured data.

**Technology:** Table detection + OCR + structured parsing

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

### 3.6 General Notes Extraction

**Purpose:** Extract project context from notes sections for AI query responses.

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
