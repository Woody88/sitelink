# SiteLink: Drawing Index and Interpreter for the Field

## Vision

A "Drawing Index and Interpreter for the Field" that helps construction workers understand architectural/engineering plans - turning drawings into clear, verifiable work documentation.

### What SiteLink IS
- A tool that helps you read and navigate drawings faster
- A decision-support layer with everything linked back to source
- An index that connects callouts, schedules, details across sheets
- A verification aid where users can visually confirm any extraction

### What SiteLink is NOT
- NOT structural engineering (no design, calculations, code validation)
- NOT replacing drawings as source of truth (drawings remain legal document)
- NOT project management (no tasks, schedules, RFIs)
- NOT guaranteeing accuracy (always verifiable by user)

## Target Features

1. **Detect and link drawing callouts across sheets** (callout on A3 → detail on A7)
2. **Extract rebar scope** (bar sizes, spacing, schedules, details)
3. **Show where information comes from** (provenance - click to see source)
4. **Let users verify visually** (highlight source region on drawing)
5. **Connect field photos to drawing regions** (visual similarity matching)
6. **Support estimation** (aggregate quantities with full provenance)
7. **Work with any file format** (PDF, DWG, images)

## Initial Focus

**Concrete and structural drawings** - specifically rebar detection, schedules, and callouts.

## Standards

### Canada (Current Focus)
- **Full Standard**: `/home/woodson/Code/projects/sitelink/docs/P26-4-2024-2-eng.pdf` (PSPC National CADD Standard - complete)
- **Callout Symbols Only**: `/home/woodson/Code/projects/sitelink/docs/PSPC National CADD Standard - Callout Symbols.pdf`

### US (Future)
- ACI standards for rebar notation
- Different symbol conventions

## Architecture: Context-Aware Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                        STANDARDS KB                               │
│  (Static library: PSPC, ACI-318 standards as config files)       │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ (optional reference)
                                   ▼
┌─────────────────┐
│  1. INGESTION   │  PDF/DWG/Images → Normalized PNGs (300-400 DPI)
└────────┬────────┘
         ▼
┌─────────────────┐
│  1.5 CONTEXT    │  Detect G-001 Legend sheet → Extract ProjectContext
│   EXTRACTION    │  → {"symbols": [...], "abbreviations": [...]}
└────────┬────────┘
         │ ProjectContext
         ▼
┌─────────────────┐
│  2. EXTRACTION  │  Base model (YOLO/Florence-2) + VLM fallback
│  Context-Aware  │  → Informed by ProjectContext + Standards KB
└────────┬────────┘
         │ ◄──────── Human-in-the-Loop corrections
         ▼          (low confidence → human review → training data)
┌─────────────────┐
│  3. SYNTHESIS   │  Knowledge Graph with dynamic rules
│  Context-Aware  │  → Rules configured by ProjectContext
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. QUERY       │  API + Vector DB (CLIP embeddings)
│                 │  → With full provenance chain
└─────────────────┘
```

## Phase Details

### Phase 1: Ingestion & Normalization
- Accept: PDF, DWG, DWF, JPG, PNG
- Convert to standardized high-resolution PNG (300-400 DPI)
- Use `pdftoppm` for PDFs, Autodesk Platform Services for DWG/DWF
- Create `Sheet` node in Knowledge Graph with basic metadata

### Phase 1.5: Pre-Processing & Context Extraction (NEW)
**Purpose**: Understand the "language" of this drawing set before reading it

1. **Sheet Classification**: Analyze title blocks to identify:
   - Legend sheets (G-001, G-002)
   - General Notes sheets (GN-001)
   - Cover sheets

2. **Legend & Notes Extraction**: Parse key-value pairs from legend
   - Use VLM (GPT-4V/Claude Vision) or fine-tuned Donut model

3. **Output**: ProjectContext JSON
```json
{
  "project_name": "Sample House",
  "standard": "PSPC-2020",
  "country": "Canada",
  "symbols": [
    {"shape": "circle", "pattern": "(\\d+)/([A-Z]\\d+)", "meaning": "detail_callout"},
    {"shape": "circle_with_arrow", "meaning": "section_cut"},
    {"shape": "hexagon", "meaning": "electrical_callout"}
  ],
  "abbreviations": [
    {"abbr": "VIF", "meaning": "Verify In Field"},
    {"abbr": "TYP", "meaning": "Typical"},
    {"abbr": "SIM", "meaning": "Similar"}
  ]
}
```

### Phase 2: Extraction (The "Eyes")
**Purpose**: Find all entities with bounding boxes

**Hybrid approach**:
1. **Base model** (fast, cheap): Fine-tuned YOLO or Florence-2
   - Detects geometric primitives and common symbols
   - Cross-references with ProjectContext for classification

2. **VLM fallback** (powerful, expensive): For ambiguous cases
   - Provides ProjectContext as prompt context
   - Only used for low-confidence detections

**Output per entity**:
```json
{
  "class_label": "detail_callout",
  "bounding_box": [x1, y1, x2, y2],
  "ocr_text": "4/A7",
  "confidence_score": 0.95,
  "source_sheet_id": "sheet-5"
}
```

### Phase 3: Synthesis & Linking (The "Brain")
**Purpose**: Build relationships in Knowledge Graph

**Dynamic rules engine**:
- Loads ProjectContext and Standards KB
- Configures parsing/linking heuristics based on project's conventions

**Example relationships**:
```
(Callout "4/A7" on A3)-[:REFERENCES]->(Detail "4" on A7)
(Beam B-12)-[:SPECIFIED_BY]->(Rebar Schedule Row 5)
(Rebar Tag "8 #5 @ 12")-[:LOCATED_IN]->(Detail "4" on A7)
```

### Phase 4: Query & Application
**Purpose**: Expose knowledge to users with full provenance

**Provenance model**:

| Fact Type | Example | Provenance |
|-----------|---------|------------|
| **Direct** | "8 #5 bars @ 12" | `source_sheet`, `source_bbox` |
| **Derived** | "Total = 500 bars" | `DERIVED_FROM` → [all contributing facts] |
| **Inferred** | "This means lap splice" | `inference_source: "ACI 318-19, 25.5"` |

**UI**: Click any fact → highlights ALL source locations on drawings

## Human-in-the-Loop (HITL)

### Why Required
- Cold start: New plan styles need human validation
- Quality: Construction documents require high accuracy
- Learning: Corrections become training data

### Workflow
```
Extraction with low confidence
         ↓
Flag for human review
         ↓
UI shows: "Is this a detail callout?" [Yes] [No] [Other: ___]
         ↓
Human corrects
         ↓
Correction saved as training data
         ↓
Model improves over time
```

### UI Requirements
- Show extraction with source image region highlighted
- Multiple choice classification
- Free-text correction option
- Batch review for efficiency
- Track reviewer agreement for quality metrics

## Tech Stack

- **Runtime**: Bun
- **UI**: React + shadcn/ui
- **Backend**: Bun.serve()
- **Knowledge Graph**: Neo4j or SQLite with JSON for MVP
- **Vector DB**: For CLIP embeddings (photo matching)
- **ML Models**:
  - Florence-2 or fine-tuned YOLO for extraction
  - CLIP for visual similarity
  - VLM (GPT-4V/Claude) for legend extraction and fallback

## Sample Data

- **Sample PDF**: `/home/woodson/Code/projects/sitelink/apps/sample-plan.pdf`
- **Current output**: `/home/woodson/Code/projects/sitelink/packages/callout-processor-v3/output-improved/`

## Implementation Order

1. **Phase 1**: Basic PDF ingestion (already exists in callout-processor-v3)
2. **Phase 1.5**: Legend detection and ProjectContext extraction
3. **Phase 2**: Improve extraction with context-awareness
4. **Phase 3**: Build Knowledge Graph with relationships
5. **Phase 4**: Query API with provenance
6. **HITL**: Review UI for low-confidence extractions
7. **Integration**: Connect to mobile app

## Success Criteria

- [ ] Can ingest multi-sheet PDF
- [ ] Detects and extracts legend/notes automatically
- [ ] Links callouts across sheets (A3 callout → A7 detail)
- [ ] Every extraction has source_sheet + source_bbox
- [ ] Derived facts show all contributing sources
- [ ] Low-confidence extractions flagged for review
- [ ] Human corrections saved for future training
- [ ] UI allows click-to-verify any fact

## Key Principles

1. **Provenance is non-negotiable**: Every fact links to source
2. **Verifiable, not authoritative**: User always confirms
3. **Adaptive, not rigid**: Legend extraction enables generalization
4. **Hybrid AI**: Fast local models + powerful VLM fallback
5. **Human-in-the-loop**: Quality over automation
