# SiteLink Implementation Agent Prompt

Copy and paste this entire prompt into a fresh Claude Code session:

---

## Task

You are implementing the SiteLink Drawing Interpreter - a system that helps construction workers understand architectural/engineering plans.

**IMPORTANT**: Create a NEW package. Do NOT modify `callout-processor-v3` - it contains working code we want to preserve.

**FIRST**: Read the task and architecture document to gain full context:

```bash
bd update sitelink-x0w --status=in_progress
bd show sitelink-x0w
cat packages/callout-processor-v3/SITELINK_ARCHITECTURE.md
```

## Code Isolation

**Create a new package** for this implementation:

```bash
# Create new package (DO NOT modify callout-processor-v3)
mkdir -p packages/sitelink-interpreter
cd packages/sitelink-interpreter

# Initialize
bun init -y

# The original code is preserved at:
# packages/callout-processor-v3/src/detect.py (reference only, don't modify)
```

**Rules for code isolation**:
- ✅ Create all new code in `packages/sitelink-interpreter/`
- ✅ You can READ `packages/callout-processor-v3/` for reference
- ❌ Do NOT modify any files in `packages/callout-processor-v3/`
- ❌ Do NOT delete or move files from `callout-processor-v3`

**Reference files** (read-only):
- `packages/callout-processor-v3/src/detect.py` - Current detection logic
- `packages/callout-processor-v3/SITELINK_ARCHITECTURE.md` - Architecture doc
- `packages/callout-processor-v3/output-improved/` - Sample output format

## Critical Rules

### 1. VERIFY EVERYTHING - NO CLAIMS WITHOUT PROOF
**NEVER say something "works" or is "complete" without actual verification.**

For every feature you implement:
1. **Run it** - Execute the code with real input
2. **Show output** - Print/log the actual results
3. **Verify correctness** - Check the output matches expectations
4. **Debug failures** - If it fails, fix it before moving on

Examples of what NOT to do:
- ❌ "The ingestion service is complete" (without running it)
- ❌ "This should work" (without testing it)
- ❌ "I've implemented X" (without showing it works)

Examples of what TO do:
- ✅ Run `bun run src/ingestion/index.ts apps/sample-plan.pdf` and show output
- ✅ Verify PNG files were created: `ls -la output/`
- ✅ Check image dimensions: `file output/sheet-1.png`
- ✅ If error occurs, debug and fix before claiming success

### 2. Context Preservation
When you discover important findings, architectural decisions, or blockers, **immediately** add them as comments to the task:

```bash
bd comment sitelink-x0w "FINDING: [description of what you learned]"
bd comment sitelink-x0w "DECISION: [architectural decision and why]"
bd comment sitelink-x0w "BLOCKER: [what's blocking progress]"
bd comment sitelink-x0w "VERIFIED: [what was tested and confirmed working]"
```

This ensures context survives session boundaries.

### 3. Parallelization
Use subagents (Task tool) to parallelize independent work. For example:
- Phase 1 (Ingestion) and Phase 1.5 (Legend Detection) research can happen in parallel
- UI scaffolding and backend API can be built in parallel
- Multiple extraction experiments can run in parallel

### 3. Progress Tracking
Use TodoWrite to track implementation progress. Update todos as you complete work.

### 4. Tech Stack
- **Runtime**: Bun (not Node.js)
- **UI**: React + shadcn/ui
- **Backend**: Bun.serve() with routes
- **Database**: SQLite for MVP (can upgrade to Neo4j later)
- **ML**: Start with VLM calls (Claude/GPT-4V), optimize with local models later

## Implementation Plan

Execute these phases. Parallelize where noted.

### Phase 0: Setup & Context Gathering (PARALLEL)

Launch these subagents in parallel:

**Subagent A: Read PSPC Standard**
```
Read and summarize the PSPC standard document at docs/P26-4-2024-2-eng.pdf
Focus on:
- Symbol definitions (callouts, section cuts, elevations)
- Title block requirements
- Sheet numbering conventions
- Rebar notation standards
Add summary as comment: bd comment sitelink-x0w "PSPC STANDARD SUMMARY: ..."
```

**Subagent B: Analyze Current Code**
```
Read and understand packages/callout-processor-v3/src/detect.py
Document:
- What it currently detects
- Its limitations
- What can be reused vs needs rewriting
Add findings as comment: bd comment sitelink-x0w "CURRENT CODE ANALYSIS: ..."
```

**Subagent C: Analyze Sample Plan**
```
Process apps/sample-plan.pdf
- How many sheets?
- Is there a legend sheet?
- What callout styles are used?
- What's in the title block?
Add findings as comment: bd comment sitelink-x0w "SAMPLE PLAN ANALYSIS: ..."
```

### Phase 1: Project Scaffolding

Create the NEW package structure (do NOT touch callout-processor-v3):

```bash
# From repo root
cd /home/woodson/Code/projects/sitelink

# Create new package
mkdir -p packages/sitelink-interpreter
cd packages/sitelink-interpreter
bun init -y

# Create folder structure
mkdir -p src/{ingestion,context,extraction,synthesis,api,ui}
mkdir -p db standards output
```

```
packages/sitelink-interpreter/     # <-- NEW PACKAGE (all work goes here)
├── src/
│   ├── ingestion/        # Phase 1: PDF → PNG
│   ├── context/          # Phase 1.5: Legend extraction
│   ├── extraction/       # Phase 2: Entity detection
│   ├── synthesis/        # Phase 3: Knowledge graph
│   ├── api/              # Phase 4: Query API
│   └── ui/               # HITL Review UI
├── db/
│   └── schema.sql        # SQLite schema for KG
├── standards/
│   └── pspc.json         # Parsed standard as config
├── output/               # Generated files go here
├── package.json
└── tsconfig.json

packages/callout-processor-v3/     # <-- PRESERVE (read-only reference)
├── src/detect.py         # Original detection code
├── SITELINK_ARCHITECTURE.md
└── output-improved/      # Sample output format
```

### Phase 2: Core Pipeline (SEQUENTIAL)

Implement in order (each phase depends on previous):

1. **Ingestion Service**
   - PDF to PNG conversion (use pdf-poppler or similar)
   - Extract metadata from each sheet
   - Store in database with sheet_id

2. **Context Extraction Service**
   - Detect legend/notes sheets by title block keywords
   - Use VLM to extract ProjectContext JSON from legend
   - Store ProjectContext for use by extraction phase

3. **Extraction Service**
   - Start with VLM-based extraction (simplest)
   - Extract entities with: class_label, bbox, ocr_text, confidence
   - Mark low-confidence (<0.8) for HITL review

4. **Synthesis Service**
   - Parse callout labels (e.g., "4/A7" → detail 4, sheet A7)
   - Create relationships in database
   - Link callouts to their target details

5. **Query API**
   - GET /sheets - list all sheets
   - GET /sheets/:id/entities - entities on a sheet
   - GET /entities/:id/references - what this entity references
   - GET /entities/:id/provenance - source location(s)

### Phase 3: HITL Review UI (PARALLEL with Phase 2.5+)

Build with React + shadcn:

```
/review
├── Queue of low-confidence extractions
├── For each:
│   ├── Show cropped image region
│   ├── Show model's classification + confidence
│   ├── Buttons: [Correct] [Wrong - select correct class] [Not an entity]
│   └── On submit: save correction to training_data table
```

### Phase 4: Integration Testing

Test end-to-end with sample-plan.pdf:
1. Ingest PDF
2. Extract context from legend (if exists)
3. Extract all entities
4. Build relationships
5. Query: "What does callout 4/A7 on sheet 5 reference?"
6. Verify provenance links back to correct bbox

## Database Schema (MVP)

```sql
-- Sheets
CREATE TABLE sheets (
  id TEXT PRIMARY KEY,
  pdf_path TEXT,
  sheet_number TEXT,
  sheet_type TEXT, -- 'plan', 'legend', 'notes', 'detail'
  image_path TEXT,
  width INTEGER,
  height INTEGER
);

-- Project Context (from legend)
CREATE TABLE project_context (
  id TEXT PRIMARY KEY,
  project_name TEXT,
  standard TEXT, -- 'PSPC', 'ACI'
  country TEXT,
  symbols_json TEXT, -- JSON array of symbol definitions
  abbreviations_json TEXT -- JSON array of abbreviations
);

-- Entities (extractions)
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  sheet_id TEXT REFERENCES sheets(id),
  class_label TEXT, -- 'detail_callout', 'section_cut', 'rebar_tag', etc.
  ocr_text TEXT,
  confidence REAL,
  bbox_x1 INTEGER,
  bbox_y1 INTEGER,
  bbox_x2 INTEGER,
  bbox_y2 INTEGER,
  needs_review BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  corrected_label TEXT
);

-- Relationships
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT REFERENCES entities(id),
  target_entity_id TEXT REFERENCES entities(id),
  relationship_type TEXT, -- 'REFERENCES', 'SPECIFIED_BY', 'DERIVED_FROM'
  confidence REAL
);

-- Training data (from HITL corrections)
CREATE TABLE training_data (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  original_label TEXT,
  corrected_label TEXT,
  image_crop_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Success Checkpoints (MUST VERIFY EACH)

After each major milestone, you MUST:
1. Run the actual code with real input
2. Show the actual output (not "it works")
3. Verify the output is correct
4. Only then comment with proof

**Checkpoint verification examples:**

### Ingestion Checkpoint
```bash
# Run ingestion
bun run src/ingestion/index.ts ../../apps/sample-plan.pdf

# Verify output exists
ls -la output/sheets/

# Verify images are valid
file output/sheets/sheet-1.png
# Expected: PNG image data, 5100 x 3300, 8-bit/color RGB

# Only after verification:
bd comment sitelink-x0w "VERIFIED: Ingestion - converted sample-plan.pdf to 7 PNGs at 300 DPI. Sheets: $(ls output/sheets/*.png | wc -l)"
```

### Extraction Checkpoint
```bash
# Run extraction
bun run src/extraction/index.ts output/sheets/sheet-5.png

# Show actual output
cat output/extractions/sheet-5.json | head -50

# Verify callouts found
jq '.entities | length' output/extractions/sheet-5.json
# Expected: 10+ entities

# Verify bbox format
jq '.entities[0]' output/extractions/sheet-5.json
# Expected: {class_label, bbox, ocr_text, confidence}

# Only after verification:
bd comment sitelink-x0w "VERIFIED: Extraction - found $(jq '.entities | length' output/extractions/sheet-5.json) entities on sheet-5. Sample: $(jq '.entities[0].ocr_text' output/extractions/sheet-5.json)"
```

### API Checkpoint
```bash
# Start server
bun run src/api/server.ts &

# Test endpoint
curl http://localhost:3000/sheets | jq

# Test entity query
curl http://localhost:3000/sheets/sheet-5/entities | jq '.entities | length'

# Test provenance
curl http://localhost:3000/entities/marker-5-0/provenance | jq

# Only after verification:
bd comment sitelink-x0w "VERIFIED: API - all endpoints responding. /sheets returns $(curl -s localhost:3000/sheets | jq length) sheets"
```

### HITL UI Checkpoint
```bash
# Start UI dev server
bun run dev &

# Take screenshot or describe what you see
# Navigate to /review
# Verify queue shows low-confidence items
# Verify clicking shows image crop
# Verify correction saves to DB

# Check DB for saved correction
sqlite3 db/sitelink.db "SELECT * FROM training_data LIMIT 1"

# Only after verification:
bd comment sitelink-x0w "VERIFIED: HITL UI - review queue shows N items, corrections saving to training_data table"
```

### End-to-End Checkpoint
```bash
# Full pipeline test
bun run src/e2e-test.ts ../../apps/sample-plan.pdf

# Verify specific query works
# "What does callout 4/A7 on sheet 5 reference?"
curl "http://localhost:3000/entities?sheet=5&label=4/A7" | jq

# Verify it links to correct target
curl "http://localhost:3000/entities/[id]/references" | jq

# Only after verification:
bd comment sitelink-x0w "VERIFIED: E2E - callout 4/A7 correctly links to detail 4 on sheet A7. Full provenance chain working."
```

## Debugging Protocol

When something fails (and things WILL fail):

### 1. Don't skip - Debug immediately
```bash
# If a command fails, don't move on
# Instead, investigate:

# Check error message carefully
bun run src/ingestion/index.ts 2>&1 | tail -20

# Check if dependencies are installed
bun pm ls

# Check file paths exist
ls -la ../../apps/sample-plan.pdf

# Check permissions
file ../../apps/sample-plan.pdf
```

### 2. Add debugging output
```typescript
// Add console.log statements to understand what's happening
console.log("Processing sheet:", sheetNumber);
console.log("Found entities:", entities.length);
console.log("Entity sample:", JSON.stringify(entities[0], null, 2));
```

### 3. Test incrementally
```bash
# Don't run the whole pipeline if ingestion fails
# Test each step separately:

# Step 1: Can we read the PDF?
bun -e "import pdf from 'pdf-poppler'; console.log(pdf)"

# Step 2: Can we convert one page?
bun run src/ingestion/convert-single.ts page-1

# Step 3: Is the output valid?
file output/page-1.png
```

### 4. Report failures with context
```bash
bd comment sitelink-x0w "BLOCKER: Ingestion failing with error: [exact error message]. Attempted fixes: [what you tried]. Need: [what help is needed]"
```

### 5. Never claim success after failure
If something failed and you couldn't fix it, DO NOT:
- ❌ Move on to the next phase
- ❌ Say "this mostly works"
- ❌ Claim the checkpoint is complete

Instead:
- ✅ Document the failure
- ✅ Document what you tried
- ✅ Ask for help or try a different approach

## When Done

```bash
bd comment sitelink-x0w "IMPLEMENTATION COMPLETE: [summary of what was built]"
bd close sitelink-x0w --reason="End-to-end pipeline implemented with HITL UI"
```

## Start Now

Begin by reading the task and architecture, then launch parallel subagents for Phase 0:

```bash
bd update sitelink-x0w --status=in_progress
bd show sitelink-x0w
```
