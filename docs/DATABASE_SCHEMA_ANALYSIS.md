# Database Schema Analysis: Current vs New Architecture

## Executive Summary

The new architecture document (`PDF_PROCESSING_NEW_ARCHITECTURE.md`) proposes a simplified database schema that **does not account for file versioning** and **missing organization relationships**. 

### Critical Issues Found:

1. **❌ Missing Organization Relationship**
   - New architecture uses `owner_user_id` in projects table
   - **Should be**: `organization_id` (projects belong to organizations, not users)
   - **Impact**: Breaks multi-user organization model, access control, and R2 path structure

2. **❌ Missing OrganizationId in R2 Paths**
   - New architecture: `plans/{projectId}/{planId}/...`
   - **Should be**: `organizations/{orgId}/projects/{projectId}/plans/{planId}/...`
   - **Impact**: No organization isolation, security issues, can't query by organization

3. **❌ Separate `tiles/` Root (Inefficient Structure)**
   - New architecture: Separate `plans/` and `tiles/` roots
   - **Should be**: Everything under `uploads/{uploadId}/` folder
   - **Impact**: Harder to query, version management, deletion, and logical grouping

4. **❌ No File Versioning**
   - Current implementation uses `uploadId` to support multiple uploads of the same plan
   - Important for: Re-uploading corrected plans, version history, rollback, processing job tracking

**Recommendation**: 
- **CRITICAL**: Fix organization relationship immediately
- **CRITICAL**: Consolidate all files (PDFs, sheets, tiles) under `uploads/{uploadId}/` folder
- Keep versioning support but simplify the implementation
- Update R2 paths: `organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/...`

---

## Current Schema (from codebase)

### Key Tables

1. **`plans`** - Plan metadata
   - `id`, `projectId`, `name`, `description`
   - `directoryPath`, `processingStatus`, `tileMetadata`
   - `createdAt`

2. **`files`** - File versions with versioning support
   - `id`, `uploadId` (unique), `planId`
   - `filePath`, `fileType`
   - `isActive` (boolean) - tracks which version is active
   - `createdAt`

3. **`sheets`** - Individual sheet metadata
   - `id`, `planId`, `pageNumber`, `sheetName`
   - `dziPath`, `tileDirectory`
   - `width`, `height`, `tileCount`
   - `processingStatus`, `createdAt`

4. **`processing_jobs`** - Processing state per upload
   - `id`, `uploadId` (references `files.uploadId`)
   - `planId`, `organizationId`, `projectId`
   - `pdfPath`, `status`, `totalPages`, `completedPages`
   - `failedPages`, `progress`, `startedAt`, `completedAt`, `lastError`

### Current R2 Storage Path
```
organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/original.pdf
```

---

## New Architecture Schema (from PDF_PROCESSING_NEW_ARCHITECTURE.md)

### Key Tables

1. **`plans`** - Plan metadata (simplified)
   - `plan_id`, `project_id`, `name`
   - `original_key` (R2 path), `original_size`
   - `sheet_count`, `status`
   - `uploaded_by`, `uploaded_at`
   - `processing_started_at`, `processing_completed_at`, `error_message`

2. **`plan_sheets`** - Individual sheet metadata
   - `sheet_id`, `plan_id`, `sheet_number`
   - `sheet_key` (R2 path), `sheet_size`
   - `status`, `tile_count`
   - `processing_started_at`, `processing_completed_at`, `error_message`

### New R2 Storage Path
```
plans/{projectId}/{planId}/original.pdf
plans/{projectId}/{planId}/sheet-0.pdf
plans/{projectId}/{planId}/sheet-1.pdf
tiles/{projectId}/{planId}/sheet-0/{z}/{x}_{y}.png
```

### Missing from New Architecture

❌ **No `files` table** - No versioning support  
❌ **No `uploadId`** - Can't track multiple uploads  
❌ **No `processing_jobs` table** - No centralized job tracking  
❌ **No `isActive` flag** - Can't mark which version is active  
❌ **Annotations reference `plan_id` directly** - Should reference specific upload version  
❌ **Missing `organization_id` in projects table** - Uses `owner_user_id` instead  
❌ **R2 paths missing `organizationId`** - Current: `organizations/{orgId}/projects/...`, New: `plans/{projectId}/...`

---

## Versioning Use Cases

### Scenario 1: Re-upload Corrected Plan
**User uploads Plan A v1** → Processing completes  
**User discovers error, uploads Plan A v2** → Should:
- Keep v1 tiles available (for comparison)
- Process v2
- Mark v2 as active
- Allow rollback to v1

### Scenario 2: Processing Job Tracking
**Upload creates `uploadId: uuid-123`**  
**Processing job references `uploadId: uuid-123`**  
**If processing fails, can retry same `uploadId`**  
**Can track which upload is currently processing**

### Scenario 3: Annotation Versioning
**Annotations created on Plan A v1**  
**User uploads Plan A v2**  
**Should annotations:**
- Stay with v1? (historical record)
- Migrate to v2? (current view)
- Be versioned separately?

---

## Recommended Schema (Hybrid Approach)

### Option A: Keep Versioning, Simplify Structure

```sql
-- Projects table (MUST include organization_id)
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_projects_organization ON projects(organization_id);

-- Plans table (unchanged concept, updated fields)
CREATE TABLE plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    -- No direct file reference - files table handles versions
);

-- Files table (versioning support)
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL UNIQUE, -- Unique per upload
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL, -- R2 path: organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/original.pdf
    file_type TEXT,
    file_size INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1, -- Boolean: which version is active
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    uploaded_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(plan_id, upload_id) -- Allow multiple uploads per plan
);

CREATE INDEX idx_files_plan ON files(plan_id);
CREATE INDEX idx_files_active ON files(plan_id, is_active) WHERE is_active = 1;

-- Processing jobs (track per upload)
CREATE TABLE processing_jobs (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL REFERENCES files(upload_id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pdf_path TEXT NOT NULL, -- R2 path to original PDF
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, complete, failed
    total_pages INTEGER,
    completed_pages INTEGER DEFAULT 0,
    failed_pages TEXT, -- JSON array
    progress INTEGER DEFAULT 0, -- 0-100
    started_at INTEGER,
    completed_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_processing_jobs_upload ON processing_jobs(upload_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);

-- Plan sheets (reference upload_id for versioning)
CREATE TABLE plan_sheets (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL REFERENCES files(upload_id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    sheet_number INTEGER NOT NULL, -- 0-indexed
    sheet_key TEXT NOT NULL, -- R2 path: organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/sheet-{n}.pdf
    sheet_size INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, ready, failed
    tile_count INTEGER,
    processing_started_at INTEGER,
    processing_completed_at INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(upload_id, sheet_number) -- One sheet per upload/position
);

CREATE INDEX idx_plan_sheets_upload ON plan_sheets(upload_id);
CREATE INDEX idx_plan_sheets_plan ON plan_sheets(plan_id);
CREATE INDEX idx_plan_sheets_status ON plan_sheets(status);

-- Annotations (reference upload_id for versioning)
CREATE TABLE annotations (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL REFERENCES files(upload_id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    sheet_number INTEGER NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON
    page_number INTEGER,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_annotations_upload ON annotations(upload_id);
CREATE INDEX idx_annotations_plan ON annotations(plan_id);
```

### Option B: Simplified (No Versioning)

If versioning is **not needed**, use the new architecture schema as-is, but add:

```sql
-- Projects table (MUST include organization_id)
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Add to plans table
ALTER TABLE plans ADD COLUMN uploaded_by TEXT REFERENCES users(id);
ALTER TABLE plans ADD COLUMN uploaded_at INTEGER;

-- Keep processing_jobs for job tracking
CREATE TABLE processing_jobs (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- ... rest of fields
);
```

---

## Decision: Is Versioning Needed?

### Arguments FOR Versioning:
✅ **Real-world use case**: Construction plans get revised frequently  
✅ **Audit trail**: Track which version was used when  
✅ **Rollback**: Revert to previous version if new upload has issues  
✅ **Processing safety**: Can retry failed uploads without affecting active version  
✅ **Annotation preservation**: Keep annotations tied to specific versions

### Arguments AGAINST Versioning:
❌ **Complexity**: More tables, more joins, more code  
❌ **Storage cost**: Keep multiple versions of large PDFs  
❌ **UI complexity**: Need version selector in frontend  
❌ **YAGNI**: May not be needed initially

---

## Recommendation

**Use Option A (Versioning) with these simplifications:**

1. **Keep `files` table** but rename to `plan_uploads` for clarity
2. **Keep `uploadId`** - essential for processing job tracking
3. **Unified R2 paths** - everything under organization and uploadId:
   ```
   organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/
     ├── original.pdf
     ├── sheet-{n}.pdf
     └── sheet-{n}/
         ├── sheet-{n}.dzi
         └── sheet-{n}_files/{z}/{x}_{y}.png
   ```
   **Key**: No separate `tiles/` root - tiles are stored alongside sheets in the uploadId folder
4. **Keep `processing_jobs`** - needed for job status tracking
5. **Update `plan_sheets`** to reference `upload_id` instead of `plan_id` directly

### Updated R2 Storage Structure (with versioning + organizationId)

**CRITICAL DESIGN DECISIONS:**
1. **Organization first** - All paths start with `organizations/{orgId}/` for easy querying and access control
2. **Everything under uploadId** - All files for one upload version (PDFs, sheets, tiles) are in one folder
3. **No separate `tiles/` root** - Tiles are stored alongside sheets in the uploadId folder

```
organizations/
└── {organizationId}/
    └── projects/
        └── {projectId}/
            └── plans/
                └── {planId}/
                    └── uploads/
                        ├── {uploadId-v1}/
                        │   ├── original.pdf                    # Original multi-page PDF
                        │   ├── sheet-0.pdf                      # Individual sheet PDFs
                        │   ├── sheet-1.pdf
                        │   ├── sheet-0/                          # Tiles for sheet-0
                        │   │   ├── sheet-0.dzi                  # DZI metadata file
                        │   │   └── sheet-0_files/               # Tile pyramid directory
                        │   │       ├── 0/                        # Zoom level 0
                        │   │       │   └── 0_0.png
                        │   │       ├── 1/                        # Zoom level 1
                        │   │       │   ├── 0_0.png
                        │   │       │   ├── 0_1.png
                        │   │       │   ├── 1_0.png
                        │   │       │   └── 1_1.png
                        │   │       └── ...                       # More zoom levels
                        │   ├── sheet-1/                          # Tiles for sheet-1
                        │   │   ├── sheet-1.dzi
                        │   │   └── sheet-1_files/
                        │   │       └── ...
                        │   └── ...
                        └── {uploadId-v2}/                        # New version upload
                            ├── original.pdf
                            ├── sheet-0.pdf
                            └── ...
```

**Example paths:**
- Original PDF: `organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/original.pdf`
- Sheet PDF: `organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/sheet-{n}.pdf`
- DZI file: `organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/sheet-{n}/sheet-{n}.dzi`
- Tile file: `organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/sheet-{n}/sheet-{n}_files/{z}/{x}_{y}.png`

**Benefits of this structure:**
✅ **Easy querying**: `r2.list({ prefix: "organizations/{orgId}/" })` gets everything for an org
✅ **Version isolation**: Each uploadId folder is self-contained
✅ **Easy deletion**: Delete entire uploadId folder to remove a version
✅ **Logical grouping**: All files for one upload are together
✅ **No path confusion**: No need to maintain separate `plans/` and `tiles/` roots

---

## Updated database.mermaid

See updated diagram that includes:
- `plan_uploads` table (renamed from `files`)
- `processing_jobs` table
- `plan_sheets` with `upload_id` reference
- `annotations` with `upload_id` reference

---

## Migration Path

1. **Phase 1**: Add `upload_id` to existing `files` table (if not already present)
2. **Phase 2**: Update `plan_sheets` to reference `upload_id`
3. **Phase 3**: Update `annotations` to reference `upload_id`
4. **Phase 4**: Update R2 storage paths to include `uploads/{uploadId}/`
5. **Phase 5**: Update processing workers to use `upload_id` in paths

---

## Questions to Answer

1. **Do you need versioning?** 
   - If yes → Use Option A
   - If no → Use Option B (simplified)

2. **How to handle annotations on versioned plans?**
   - Option 1: Annotations stay with upload version (historical)
   - Option 2: Annotations migrate to new version (current)
   - Option 3: Annotations are version-agnostic (reference plan only)

3. **Should old versions be automatically deleted?**
   - Keep all versions (audit trail)
   - Keep only last N versions
   - Delete inactive versions after X days

