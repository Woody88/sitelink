-- SiteLink Interpreter Database Schema
-- MVP Knowledge Graph using SQLite

-- Sheets from ingested PDFs
CREATE TABLE IF NOT EXISTS sheets (
  id TEXT PRIMARY KEY,
  pdf_path TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  sheet_number TEXT, -- e.g., "A1", "A3", "B2"
  sheet_type TEXT, -- 'plan', 'legend', 'notes', 'detail', 'elevation', 'section'
  sheet_title TEXT,
  image_path TEXT,
  width INTEGER,
  height INTEGER,
  dpi INTEGER DEFAULT 300,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Project Context extracted from legend sheets
CREATE TABLE IF NOT EXISTS project_context (
  id TEXT PRIMARY KEY,
  project_name TEXT,
  standard TEXT, -- 'PSPC', 'ACI'
  country TEXT,
  symbols_json TEXT, -- JSON array of symbol definitions
  abbreviations_json TEXT, -- JSON array of abbreviations
  notes_json TEXT, -- JSON array of general notes
  created_at TEXT DEFAULT (datetime('now'))
);

-- Extracted entities (callouts, markers, etc.)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES sheets(id),
  class_label TEXT NOT NULL, -- 'detail_callout', 'section_cut', 'elevation_callout', 'title_callout', 'rebar_tag'
  ocr_text TEXT,
  confidence REAL,
  bbox_x1 INTEGER NOT NULL,
  bbox_y1 INTEGER NOT NULL,
  bbox_x2 INTEGER NOT NULL,
  bbox_y2 INTEGER NOT NULL,
  -- Parsed fields from callout
  identifier TEXT, -- "4" from "4/A7"
  target_sheet TEXT, -- "A7" from "4/A7"
  -- Detection metadata
  triangle_count INTEGER,
  triangle_positions TEXT, -- JSON array
  -- Review status
  needs_review INTEGER DEFAULT 0,
  reviewed INTEGER DEFAULT 0,
  reviewed_by TEXT,
  corrected_label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Relationships between entities
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL REFERENCES entities(id),
  target_entity_id TEXT NOT NULL REFERENCES entities(id),
  relationship_type TEXT NOT NULL, -- 'REFERENCES', 'SPECIFIED_BY', 'DERIVED_FROM', 'LOCATED_IN'
  confidence REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Training data from HITL corrections
CREATE TABLE IF NOT EXISTS training_data (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  original_label TEXT,
  corrected_label TEXT,
  image_crop_path TEXT,
  reviewer TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sheets_pdf ON sheets(pdf_path);
CREATE INDEX IF NOT EXISTS idx_sheets_number ON sheets(sheet_number);
CREATE INDEX IF NOT EXISTS idx_entities_sheet ON entities(sheet_id);
CREATE INDEX IF NOT EXISTS idx_entities_label ON entities(class_label);
CREATE INDEX IF NOT EXISTS idx_entities_review ON entities(needs_review, reviewed);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
