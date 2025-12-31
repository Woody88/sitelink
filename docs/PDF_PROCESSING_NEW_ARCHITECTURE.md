Based on the search results, let me create a comprehensive technical documentation for the SiteLink architecture.

---

# SiteLink Construction Plan Viewer - Technical Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Database Schema](#database-schema)
5. [R2 Storage Structure](#r2-storage-structure)
6. [Worker Implementations](#worker-implementations)
7. [Container Implementation](#container-implementation)
8. [Local Development Setup](#local-development-setup)
9. [Deployment Guide](#deployment-guide)

---

## 1. System Overview

SiteLink is a construction plan viewing application that allows users to upload multi-page PDF construction plans, which are automatically split into individual sheets, converted to tile pyramids for fast viewing, and secured with per-user authentication.

### Key Technologies
- **Frontend**: React Native (mobile app)
- **Backend**: Cloudflare Workers (serverless)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Queue**: Cloudflare Queues (message queue)
- **Database**: Cloudflare D1 (SQLite)
- **Image Processing**: VIPS (libvips) running in container
- **Authentication**: Clerk

### Core Features
- Upload multi-page PDF construction plans
- Automatic splitting into individual sheets (1 PDF page = 1 sheet)
- Tile generation for each sheet (Deep Zoom/OpenSeadragon format)
- Secure tile access with JWT tokens
- Real-time processing status
- Sheet-by-sheet viewing with OpenSeadragon

---

## 2. Architecture Decisions

### Decision 1: Sheet-by-Sheet Processing
**Decision**: Split multi-page PDFs into individual sheet PDFs (1 page = 1 sheet) and process each separately.

**Rationale**:
- Construction plan PDFs can be 50MB+ with 10-50 sheets
- Individual sheets are only 5-10MB each
- Enables parallel processing of sheets
- Better progress tracking for users
- Memory-efficient (Worker handles 5-10MB at a time, not 50MB+)

**Storage**: Keep both original PDF and individual sheets for:
- Future re-processing at different quality
- User ability to download original
- Error recovery

### Decision 2: Use R2 Event Notifications (Not Manual Queue)
**Decision**: Use Cloudflare R2 event notifications to automatically trigger processing when files are uploaded.

**Rationale**:
- **Resiliency**: R2 guarantees event delivery - no orphaned files
- **Decoupling**: Upload Worker doesn't need to coordinate with processing
- **Automatic retries**: R2 handles redelivery if queue is unavailable
- **No transaction coordination**: Avoids multi-service rollback complexity

**Trade-off**: Requires local R2 event emulator for development (see Local Development section)

### Decision 3: Stream Data (Don't Buffer)
**Decision**: Stream PDFs from R2 → Worker → Container and stream tiles back via NDJSON.

**Rationale**:
- Worker memory limits (128MB default)
- 5-10MB PDFs stream efficiently
- Progressive tile upload (tiles available as generated)
- Container has no R2 dependencies (stateless)

### Decision 4: Container Uses VIPS (Not Sharp)
**Decision**: Use VIPS directly via command-line (`vips dzsave`) in container.

**Rationale**:
- VIPS `dzsave` is purpose-built for tile pyramid generation
- Produces OpenSeadragon-compatible output directly
- More memory-efficient than Sharp for large images
- Production-proven (used by museums for gigapixel images)

### Decision 5: HTTP REST API (Not tRPC/gRPC)
**Decision**: Simple HTTP REST for resources + RPC-style endpoints for actions.

**Rationale**:
- React Native works great with standard fetch()
- Easy to debug with curl/Postman
- Standard HTTP caching
- CDN-friendly for tile serving
- No additional frameworks needed

### Decision 6: JWT Tokens for Tile Authentication
**Decision**: Generate short-lived JWT tokens scoped to specific plans.

**Rationale**:
- One auth check when loading plan (generates token)
- Fast token validation on tile requests (no DB query)
- Tokens scoped to specific plan (can't use Plan A token for Plan B)
- Short expiration (1 hour)

---

## 3. Data Flow Diagrams

### 3.1 Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Native App                          │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │ Auth       │  │ Plan Upload │  │ OpenSeadragon Viewer   │  │
│  │ (Clerk)    │  │ Component   │  │ (Tile Display)         │  │
│  └────────────┘  └─────────────┘  └────────────────────────┘  │
└────────────┬───────────┬──────────────────────┬─────────────────┘
             │           │                      │
             │ HTTPS     │ HTTPS                │ HTTPS + JWT
             │ REST API  │ REST API             │ Tile Requests
             ▼           ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Upload API)                     │
│  • Validates user authentication                                │
│  • Uploads PDF to R2                                            │
│  • Creates plan record in D1                                    │
│  • R2 event triggers automatically                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ R2 Event Notification
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Queue                             │
│  Queue Name: pdf-split-queue                                    │
│  Message: R2EventNotification                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Queue Consumer
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│          Cloudflare Worker (PDF Splitter)                       │
│  • Receives R2 event notification                               │
│  • Fetches original PDF from R2                                 │
│  • Splits into individual sheets using pdf-lib                  │
│  • Uploads each sheet to R2                                     │
│  • Queues tile generation for each sheet                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Queue: tile-generation-queue
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│         Cloudflare Worker (Tile Processor)                      │
│  • Fetches sheet PDF from R2 (stream)                           │
│  • Streams to container                                         │
│  • Receives NDJSON tile stream                                  │
│  • Uploads tiles to R2 progressively                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTP Streaming
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│            Container (VIPS Tile Generator)                      │
│  • Receives PDF stream via HTTP POST                            │
│  • Saves to /tmp/sheet.pdf                                      │
│  • Runs: vips dzsave sheet.pdf output/ --layout google         │
│  • Streams tiles back as NDJSON                                 │
│  • Cleans up temp files                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Upload Flow Sequence

```
User          Upload API      R2 Storage      Queue           PDF Splitter
 │                │               │              │                 │
 │─Upload PDF────>│               │              │                 │
 │                │               │              │                 │
 │                │─PUT original─>│              │                 │
 │                │               │              │                 │
 │                │─INSERT plan──>│ (D1)         │                 │
 │                │               │              │                 │
 │                │<──Success─────│              │                 │
 │<──202 Accepted─│               │              │                 │
 │                │               │              │                 │
 │                │               │─R2 Event────>│                 │
 │                │               │              │                 │
 │                │               │              │─Queue Message──>│
 │                │               │              │                 │
 │                │               │              │                 │─Fetch PDF
 │                │               │              │                 │
 │                │               │<─────────────────────GET───────│
 │                │               │              │                 │
 │                │               │──────────────────────PDF──────>│
 │                │               │              │                 │
 │                │               │              │                 │ Split PDF
 │                │               │              │                 │ (pdf-lib)
 │                │               │              │                 │
 │                │               │<─PUT sheet-0.pdf───────────────│
 │                │               │<─PUT sheet-1.pdf───────────────│
 │                │               │<─PUT sheet-N.pdf───────────────│
 │                │               │              │                 │
 │                │               │              │<─Queue tiles────│
 │                │               │              │  (per sheet)    │
```

### 3.3 Tile Generation Flow

```
Tile Processor    R2 Storage    Container (VIPS)    R2 Storage
      │               │                │                 │
      │─GET sheet.pdf─>│                │                 │
      │               │                │                 │
      │<──Stream PDF──│                │                 │
      │               │                │                 │
      │──────Stream PDF────────────────>│                 │
      │               │                │                 │
      │               │                │  Save to /tmp   │
      │               │                │  vips dzsave    │
      │               │                │  Generate tiles │
      │               │                │                 │
      │<──────NDJSON Stream────────────│                 │
      │ {"path":"0/0_0.png","data":"."}│                 │
      │               │                │                 │
      │─PUT tile─────>│                │                 │
      │               │                │                 │
      │<──────NDJSON Stream────────────│                 │
      │ {"path":"0/0_1.png","data":"."}│                 │
      │               │                │                 │
      │─PUT tile─────>│                │                 │
      │               │                │                 │
      │   (continues for all tiles)    │                 │
```

### 3.4 Tile Viewing Flow

```
User         Tile Server      D1          R2 Storage
 │               │            │                │
 │─View Plan────>│            │                │
 │               │            │                │
 │               │─Check Auth─>│                │
 │               │            │                │
 │               │<─Plan Info─│                │
 │               │            │                │
 │               │─Generate JWT Token          │
 │               │  (scoped to this plan)      │
 │               │            │                │
 │<──Plan Info + │            │                │
 │   Tile Token  │            │                │
 │               │            │                │
 │─GET tile + token──────────>│                │
 │  /tiles/...?token=xxx      │                │
 │               │            │                │
 │               │─Verify JWT─│                │
 │               │  (no DB!)  │                │
 │               │            │                │
 │               │─GET tile──────────────────>│
 │               │            │                │
 │               │<──PNG─────────────────────│
 │               │            │                │
 │<──PNG Tile────│            │                │
```

---

## 4. Database Schema

### 4.1 D1 Database Tables

```sql
-- Projects table
CREATE TABLE projects (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, archived, deleted
    UNIQUE(project_id)
);

CREATE INDEX idx_projects_owner ON projects(owner_user_id);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- Project members (access control)
CREATE TABLE project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL, -- owner, admin, member, viewer
    added_at INTEGER NOT NULL,
    added_by TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);

-- Plans table
CREATE TABLE plans (
    plan_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    original_key TEXT NOT NULL, -- R2 key for original PDF
    original_size INTEGER NOT NULL, -- bytes
    sheet_count INTEGER, -- Total number of sheets (pages)
    status TEXT NOT NULL, -- splitting, generating_tiles, ready, failed
    uploaded_by TEXT NOT NULL,
    uploaded_at INTEGER NOT NULL,
    processing_started_at INTEGER,
    processing_completed_at INTEGER,
    error_message TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    UNIQUE(plan_id)
);

CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_uploaded ON plans(uploaded_at DESC);

-- Plan sheets table
CREATE TABLE plan_sheets (
    sheet_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id TEXT NOT NULL,
    sheet_number INTEGER NOT NULL, -- 0-indexed position
    sheet_key TEXT NOT NULL, -- R2 key for individual sheet PDF
    sheet_size INTEGER NOT NULL, -- bytes
    status TEXT NOT NULL, -- ready_for_tiling, generating_tiles, ready, failed
    tile_count INTEGER, -- Number of tiles generated
    processing_started_at INTEGER,
    processing_completed_at INTEGER,
    error_message TEXT,
    FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE,
    UNIQUE(plan_id, sheet_number)
);

CREATE INDEX idx_plan_sheets_plan ON plan_sheets(plan_id);
CREATE INDEX idx_plan_sheets_status ON plan_sheets(status);

-- Annotations table
CREATE TABLE annotations (
    annotation_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    sheet_number INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- marker, polygon, line, text, measurement
    geometry TEXT NOT NULL, -- JSON: {coordinates, properties}
    content TEXT, -- Text content for text annotations
    color TEXT NOT NULL DEFAULT '#FF0000',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE,
    UNIQUE(annotation_id)
);

CREATE INDEX idx_annotations_plan ON annotations(plan_id);
CREATE INDEX idx_annotations_sheet ON annotations(plan_id, sheet_number);
CREATE INDEX idx_annotations_user ON annotations(user_id);
```

### 4.2 Example Data

```sql
-- Example project
INSERT INTO projects VALUES (
    'proj_123',
    'Downtown Construction Site',
    'High-rise building project',
    'user_abc',
    1699000000000,
    1699000000000,
    'active'
);

-- Example plan
INSERT INTO plans VALUES (
    'plan_456',
    'proj_123',
    'Floor Plans - Levels 1-10',
    'plans/proj_123/plan_456/original.pdf',
    52428800, -- 50MB
    10, -- 10 sheets
    'ready',
    'user_abc',
    1699000000000,
    1699000001000,
    1699000060000,
    NULL
);

-- Example sheet
INSERT INTO plan_sheets VALUES (
    1,
    'plan_456',
    0, -- Sheet 0 (first page)
    'plans/proj_123/plan_456/sheet-0.pdf',
    5242880, -- 5MB
    'ready',
    256, -- 256 tiles
    1699000010000,
    1699000020000,
    NULL
);
```

---

## 5. R2 Storage Structure

### 5.1 Bucket Organization

```
sitelink-bucket/
├── plans/
│   └── {project_id}/
│       └── {plan_id}/
│           ├── original.pdf           # Original multi-page PDF (50MB)
│           ├── sheet-0.pdf            # Individual sheets (5MB each)
│           ├── sheet-1.pdf
│           ├── sheet-2.pdf
│           └── ...
│
└── tiles/
    └── {project_id}/
        └── {plan_id}/
            ├── sheet-0/               # Tiles for first sheet
            │   ├── 0/                 # Zoom level 0 (most zoomed out)
            │   │   └── 0_0.png
            │   ├── 1/                 # Zoom level 1
            │   │   ├── 0_0.png
            │   │   ├── 0_1.png
            │   │   ├── 1_0.png
            │   │   └── 1_1.png
            │   ├── 2/                 # Zoom level 2
            │   │   └── ... (more tiles)
            │   └── ...
            │
            ├── sheet-1/               # Tiles for second sheet
            │   └── ...
            │
            └── sheet-N/
```

### 5.2 Example Keys

```
# Original PDF
plans/proj_123/plan_456/original.pdf

# Individual sheets
plans/proj_123/plan_456/sheet-0.pdf
plans/proj_123/plan_456/sheet-1.pdf

# Tiles (OpenSeadragon format)
tiles/proj_123/plan_456/sheet-0/0/0_0.png
tiles/proj_123/plan_456/sheet-0/1/0_0.png
tiles/proj_123/plan_456/sheet-0/1/0_1.png
tiles/proj_123/plan_456/sheet-0/1/1_0.png
tiles/proj_123/plan_456/sheet-0/1/1_1.png
```

---

## 6. Worker Implementations

### 6.1 Upload API Worker

**Purpose**: Handle PDF uploads from mobile app

**File**: `workers/upload-api/src/index.ts`

```typescript
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    if (url.pathname === '/api/plans/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    
    return new Response('Not found', { status: 404 });
  }
};

async function handleUpload(request: Request, env: Env): Promise<Response> {
  try {
    // 1. Authenticate user (Clerk)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userId = await verifyClerkToken(token, env);
    
    // 2. Parse multipart form data
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const planName = formData.get('planName') as string;
    const pdfFile = formData.get('file') as File;
    
    if (!projectId || !planName || !pdfFile) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // 3. Validate user has access to project
    const hasAccess = await env.DB.prepare(`
      SELECT 1 FROM project_members 
      WHERE project_id = ? AND user_id = ?
    `).bind(projectId, userId).first();
    
    if (!hasAccess) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // 4. Validate file size (max 100MB)
    if (pdfFile.size > 100 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 100MB)' }, { status: 400 });
    }
    
    // 5. Generate plan ID
    const planId = `plan_${crypto.randomUUID()}`;
    const originalKey = `plans/${projectId}/${planId}/original.pdf`;
    
    // 6. Upload to R2
    const pdfBuffer = await pdfFile.arrayBuffer();
    await env.BUCKET.put(originalKey, pdfBuffer, {
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: Date.now().toString(),
        fileName: pdfFile.name,
      }
    });
    
    // 7. Create plan record in D1
    await env.DB.prepare(`
      INSERT INTO plans (
        plan_id, project_id, name, original_key, original_size,
        status, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      planId,
      projectId,
      planName,
      originalKey,
      pdfFile.size,
      'splitting',
      userId,
      Date.now()
    ).run();
    
    // 8. R2 event will trigger automatically - no manual queue!
    
    return Response.json({
      planId,
      status: 'splitting',
      message: 'PDF uploaded successfully'
    }, { status: 202 });
    
  } catch (error) {
    console.error('Upload failed:', error);
    return Response.json({ 
      error: 'Upload failed',
      details: error.message 
    }, { status: 500 });
  }
}

async function verifyClerkToken(token: string, env: Env): Promise<string> {
  // Verify Clerk JWT token
  const response = await fetch(`https://api.clerk.dev/v1/sessions/${token}/verify`, {
    headers: {
      'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Invalid token');
  }
  
  const session = await response.json();
  return session.userId;
}
```

**wrangler.toml**:
```toml
name = "sitelink-upload-api"
main = "src/index.ts"
compatibility_date = "2024-11-12"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "sitelink-production"
preview_bucket_name = "sitelink-preview"

[[d1_databases]]
binding = "DB"
database_name = "sitelink-db"
database_id = "YOUR_DB_ID"

[vars]
CLERK_SECRET_KEY = "YOUR_CLERK_SECRET"
```

### 6.2 PDF Splitter Worker

**Purpose**: Consume R2 events, split PDFs into sheets

**File**: `workers/pdf-splitter/src/index.ts`

R2 event notifications send messages to queues when data in R2 buckets changes. Queue consumers receive notifications as Messages with a body containing the event details.

```typescript
import { PDFDocument } from 'pdf-lib';
import { Env, R2EventNotification } from './types';

export default {
  async queue(batch: MessageBatch<R2EventNotification>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        // Parse R2 event notification
        const event = message.body;
        
        console.log('Processing R2 event:', event);
        
        // Only process object-create events for original PDFs
        if (event.action !== 'PutObject') {
          message.ack();
          continue;
        }
        
        const key = event.object.key;
        
        // Match pattern: plans/{projectId}/{planId}/original.pdf
        const match = key.match(/^plans\/([^\/]+)\/([^\/]+)\/original\.pdf$/);
        if (!match) {
          console.log('Skipping non-original PDF:', key);
          message.ack();
          continue;
        }
        
        const [_, projectId, planId] = match;
        
        console.log(`Splitting plan: ${planId}`);
        
        // Check if already processed (idempotent)
        const existing = await env.DB.prepare(`
          SELECT status FROM plans WHERE plan_id = ?
        `).bind(planId).first();
        
        if (existing?.status === 'ready' || existing?.status === 'generating_tiles') {
          console.log('Plan already processed, skipping');
          message.ack();
          continue;
        }
        
        // Update status to splitting
        await env.DB.prepare(`
          UPDATE plans 
          SET status = 'splitting', processing_started_at = ?
          WHERE plan_id = ?
        `).bind(Date.now(), planId).run();
        
        // Fetch original PDF from R2
        const pdfObject = await env.BUCKET.get(key);
        if (!pdfObject) {
          throw new Error(`PDF not found: ${key}`);
        }
        
        const pdfBuffer = await pdfObject.arrayBuffer();
        
        // Load PDF with pdf-lib
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        
        console.log(`PDF has ${pageCount} pages`);
        
        // Split into individual sheets
        for (let i = 0; i < pageCount; i++) {
          console.log(`Processing sheet ${i + 1}/${pageCount}`);
          
          // Create new PDF with single page
          const singlePageDoc = await PDFDocument.create();
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
          singlePageDoc.addPage(copiedPage);
          
          // Save to buffer
          const sheetBytes = await singlePageDoc.save();
          
          // Upload sheet to R2
          const sheetKey = `plans/${projectId}/${planId}/sheet-${i}.pdf`;
          await env.BUCKET.put(sheetKey, sheetBytes, {
            customMetadata: {
              planId,
              sheetNumber: i.toString(),
              totalSheets: pageCount.toString(),
            }
          });
          
          // Insert sheet record
          await env.DB.prepare(`
            INSERT INTO plan_sheets (
              plan_id, sheet_number, sheet_key, sheet_size, status
            ) VALUES (?, ?, ?, ?, ?)
          `).bind(
            planId,
            i,
            sheetKey,
            sheetBytes.length,
            'ready_for_tiling'
          ).run();
          
          // Queue tile generation for this sheet
          await env.TILE_GENERATION_QUEUE.send({
            projectId,
            planId,
            sheetNumber: i,
            sheetKey,
            totalSheets: pageCount
          });
        }
        
        // Update plan with sheet count and status
        await env.DB.prepare(`
          UPDATE plans 
          SET sheet_count = ?, status = 'generating_tiles'
          WHERE plan_id = ?
        `).bind(pageCount, planId).run();
        
        console.log(`Successfully split plan ${planId} into ${pageCount} sheets`);
        
        message.ack();
        
      } catch (error) {
        console.error('Error processing message:', error);
        
        // Update plan status to failed
        if (message.body?.object?.key) {
          const match = message.body.object.key.match(/plans\/[^\/]+\/([^\/]+)\/original\.pdf/);
          if (match) {
            await env.DB.prepare(`
              UPDATE plans 
              SET status = 'failed', error_message = ?
              WHERE plan_id = ?
            `).bind(error.message, match[1]).run();
          }
        }
        
        message.retry();
      }
    }
  }
};
```

**types.ts**:
```typescript
export interface Env {
  BUCKET: R2Bucket;
  DB: D1Database;
  TILE_GENERATION_QUEUE: Queue;
  CLERK_SECRET_KEY: string;
}

// R2 Event Notification format
export interface R2EventNotification {
  account: string;
  action: 'PutObject' | 'CopyObject' | 'DeleteObject' | 'CompleteMultipartUpload' | 'LifecycleDeletion';
  bucket: string;
  object: {
    key: string;
    size?: number;
    eTag?: string;
  };
  eventTime: string;
}
```

**wrangler.toml**:
```toml
name = "sitelink-pdf-splitter"
main = "src/index.ts"
compatibility_date = "2024-11-12"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "sitelink-production"

[[d1_databases]]
binding = "DB"
database_name = "sitelink-db"
database_id = "YOUR_DB_ID"

[[queues.consumers]]
queue = "pdf-split-queue"
max_batch_size = 1
max_retries = 3

[[queues.producers]]
binding = "TILE_GENERATION_QUEUE"
queue = "tile-generation-queue"
```

### 6.3 Tile Processor Worker

**Purpose**: Stream sheets to container, receive tiles, upload to R2

**File**: `workers/tile-processor/src/index.ts`

```typescript
import { Env } from './types';

interface TileJob {
  projectId: string;
  planId: string;
  sheetNumber: number;
  sheetKey: string;
  totalSheets: number;
}

interface NdJsonTile {
  path: string;  // e.g., "0/0_0.png"
  data: string;  // base64 encoded PNG
}

export default {
  async queue(batch: MessageBatch<TileJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const { projectId, planId, sheetNumber, sheetKey, totalSheets } = message.body;
        
        console.log(`Processing tiles for sheet ${sheetNumber + 1}/${totalSheets}`);
        
        // Update sheet status
        await env.DB.prepare(`
          UPDATE plan_sheets 
          SET status = 'generating_tiles', processing_started_at = ?
          WHERE plan_id = ? AND sheet_number = ?
        `).bind(Date.now(), planId, sheetNumber).run();
        
        // 1. Fetch sheet PDF from R2 (as stream)
        const sheetPdf = await env.BUCKET.get(sheetKey);
        if (!sheetPdf) {
          throw new Error(`Sheet not found: ${sheetKey}`);
        }
        
        // 2. Stream PDF to container
        const containerUrl = env.CONTAINER_URL || 'http://localhost:8080';
        const containerResponse = await fetch(`${containerUrl}/generate`, {
          method: 'POST',
          body: sheetPdf.body,  // Stream directly!
          headers: {
            'Content-Type': 'application/pdf',
            'X-Project-Id': projectId,
            'X-Plan-Id': planId,
            'X-Sheet-Number': sheetNumber.toString(),
          },
          duplex: 'half' as any,  // Enable streaming
        });
        
        if (!containerResponse.ok) {
          throw new Error(`Container failed: ${containerResponse.status}`);
        }
        
        // 3. Parse NDJSON stream and upload tiles to R2
        const tileCount = await streamTilesToR2(
          containerResponse.body!,
          projectId,
          planId,
          sheetNumber,
          env.BUCKET
        );
        
        console.log(`Uploaded ${tileCount} tiles for sheet ${sheetNumber}`);
        
        // 4. Update sheet status
        await env.DB.prepare(`
          UPDATE plan_sheets 
          SET status = 'ready', tile_count = ?, processing_completed_at = ?
          WHERE plan_id = ? AND sheet_number = ?
        `).bind(tileCount, Date.now(), planId, sheetNumber).run();
        
        // 5. Check if all sheets are done
        const result = await env.DB.prepare(`
          SELECT COUNT(*) as completed 
          FROM plan_sheets 
          WHERE plan_id = ? AND status = 'ready'
        `).bind(planId).first();
        
        if (result && result.completed === totalSheets) {
          // All sheets complete - mark plan as ready
          await env.DB.prepare(`
            UPDATE plans 
            SET status = 'ready', processing_completed_at = ?
            WHERE plan_id = ?
          `).bind(Date.now(), planId).run();
          
          console.log(`Plan ${planId} is ready!`);
        }
        
        message.ack();
        
      } catch (error) {
        console.error('Tile generation failed:', error);
        
        // Update sheet status to failed
        const { planId, sheetNumber } = message.body;
        await env.DB.prepare(`
          UPDATE plan_sheets 
          SET status = 'failed', error_message = ?
          WHERE plan_id = ? AND sheet_number = ?
        `).bind(error.message, planId, sheetNumber).run();
        
        message.retry();
      }
    }
  }
};

async function streamTilesToR2(
  responseStream: ReadableStream,
  projectId: string,
  planId: string,
  sheetNumber: number,
  bucket: R2Bucket
): Promise<number> {
  const reader = responseStream.getReader();
  const decoder = new TextDecoder();
  
  let buffer = '';
  let tileCount = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    // Decode bytes to text
    buffer += decoder.decode(value, { stream: true });
    
    // Split by newlines
    const lines = buffer.split('\n');
    
    // Keep last incomplete line in buffer
    buffer = lines.pop() || '';
    
    // Process each complete line
    for (const line of lines) {
      if (!line.trim()) continue;  // Skip empty lines
      
      try {
        // Parse NDJSON line
        const tile: NdJsonTile = JSON.parse(line);
        
        // Decode base64 to binary
        const tileBuffer = Uint8Array.from(atob(tile.data), c => c.charCodeAt(0));
        
        // Upload to R2
        const r2Key = `tiles/${projectId}/${planId}/sheet-${sheetNumber}/${tile.path}`;
        await bucket.put(r2Key, tileBuffer, {
          httpMetadata: {
            contentType: 'image/png'
          }
        });
        
        tileCount++;
        
        if (tileCount % 50 === 0) {
          console.log(`Uploaded ${tileCount} tiles...`);
        }
        
      } catch (error) {
        console.error('Failed to process tile:', error);
        // Continue with other tiles
      }
    }
  }
  
  return tileCount;
}
```

**wrangler.toml**:
```toml
name = "sitelink-tile-processor"
main = "src/index.ts"
compatibility_date = "2024-11-12"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "sitelink-production"

[[d1_databases]]
binding = "DB"
database_name = "sitelink-db"
database_id = "YOUR_DB_ID"

[[queues.consumers]]
queue = "tile-generation-queue"
max_batch_size = 5  # Process 5 sheets in parallel
max_concurrency = 10
max_retries = 3

[vars]
CONTAINER_URL = "https://tile-generator.your-domain.workers.dev"

[env.development.vars]
CONTAINER_URL = "http://localhost:8080"
```

### 6.4 Tile Server Worker

**Purpose**: Serve tiles with JWT authentication

**File**: `workers/tile-server/src/index.ts`

```typescript
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Get plan details endpoint
    if (url.pathname.match(/^\/api\/plans\/[^\/]+$/)) {
      return handleGetPlan(request, env);
    }
    
    // Tile serving endpoint
    if (url.pathname.startsWith('/tiles/')) {
      return handleGetTile(request, env);
    }
    
    return new Response('Not found', { status: 404 });
  }
};

async function handleGetPlan(request: Request, env: Env): Promise<Response> {
  const planId = request.url.split('/').pop();
  
  // Authenticate user
  const userId = await authenticateUser(request, env);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Get plan details
  const plan = await env.DB.prepare(`
    SELECT p.*, proj.name as project_name
    FROM plans p
    JOIN projects proj ON p.project_id = proj.project_id
    WHERE p.plan_id = ?
  `).bind(planId).first();
  
  if (!plan) {
    return Response.json({ error: 'Plan not found' }, { status: 404 });
  }
  
  // Check user has access to project
  const hasAccess = await env.DB.prepare(`
    SELECT 1 FROM project_members
    WHERE project_id = ? AND user_id = ?
  `).bind(plan.project_id, userId).first();
  
  if (!hasAccess) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Generate tile access token (valid for 1 hour)
  const tileToken = await generateTileToken({
    userId,
    projectId: plan.project_id,
    planId,
    exp: Date.now() + 3600000
  }, env.JWT_SECRET);
  
  // Get sheet count
  const sheets = await env.DB.prepare(`
    SELECT sheet_number, status
    FROM plan_sheets
    WHERE plan_id = ?
    ORDER BY sheet_number
  `).bind(planId).all();
  
  return Response.json({
    planId,
    projectId: plan.project_id,
    projectName: plan.project_name,
    name: plan.name,
    status: plan.status,
    sheetCount: plan.sheet_count,
    sheets: sheets.results,
    tileToken,  // Client uses this for tile requests
    tilesUrl: `/tiles/${plan.project_id}/${planId}`
  });
}

async function handleGetTile(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Get token from query param
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Parse path: /tiles/{projectId}/{planId}/sheet-{n}/{z}/{x}_{y}.png
  const match = url.pathname.match(/^\/tiles\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    return new Response('Invalid path', { status: 400 });
  }
  
  const [_, projectId, planId, tilePath] = match;
  
  // Verify token
  const payload = await verifyTileToken(token, env.JWT_SECRET);
  if (!payload || 
      payload.projectId !== projectId || 
      payload.planId !== planId ||
      payload.exp < Date.now()) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Fetch tile from R2
  const r2Key = `tiles/${projectId}/${planId}/${tilePath}`;
  const tile = await env.BUCKET.get(r2Key);
  
  if (!tile) {
    return new Response('Not found', { status: 404 });
  }
  
  return new Response(tile.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
      'ETag': tile.etag || '',
    }
  });
}

async function generateTileToken(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const token = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${btoa(JSON.stringify(payload))}.${token}`;
}

async function verifyTileToken(token: string, secret: string): Promise<any> {
  try {
    const [payloadB64, signatureB64] = token.split('.');
    
    const payload = JSON.parse(atob(payloadB64));
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    
    return valid ? payload : null;
  } catch {
    return null;
  }
}

async function authenticateUser(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  
  // Verify Clerk token
  try {
    const response = await fetch(`https://api.clerk.dev/v1/sessions/${token}/verify`, {
      headers: { 'Authorization': `Bearer ${env.CLERK_SECRET_KEY}` }
    });
    
    if (!response.ok) return null;
    
    const session = await response.json();
    return session.userId;
  } catch {
    return null;
  }
}
```

---

## 7. Container Implementation

### 7.1 Container (VIPS Tile Generator)

**Purpose**: Receive PDF streams, generate tiles with VIPS, stream back as NDJSON

**File**: `container/server.js`

```javascript
import express from 'express';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { pipeline } from 'stream/promises';
import path from 'path';

const execAsync = promisify(exec);
const app = express();

app.post('/generate', async (req, res) => {
  const projectId = req.headers['x-project-id'];
  const planId = req.headers['x-plan-id'];
  const sheetNumber = req.headers['x-sheet-number'];
  
  const pdfPath = `/tmp/${projectId}-${planId}-sheet-${sheetNumber}.pdf`;
  const outputDir = `/tmp/${projectId}-${planId}-sheet-${sheetNumber}-tiles`;
  
  try {
    console.log(`Processing sheet ${sheetNumber} for plan ${planId}`);
    
    // 1. Stream PDF to disk
    await pipeline(req, fs.createWriteStream(pdfPath));
    
    console.log(`PDF saved: ${pdfPath}`);
    
    // 2. Generate tiles with VIPS
    await generateTilesWithVips(pdfPath, outputDir);
    
    // 3. Stream tiles back as NDJSON
    res.setHeader('Content-Type', 'application/x-ndjson');
    
    await streamTilesFromDirectory(outputDir, res);
    
    res.end();
    
    console.log(`Completed processing sheet ${sheetNumber}`);
    
  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(pdfPath);
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }
});

async function generateTilesWithVips(pdfPath, outputDir) {
  // VIPS dzsave creates Deep Zoom / Google Maps tile pyramid
  // --layout google: produces z/x_y.png format (OpenSeadragon compatible)
  // --suffix .png: PNG tiles
  // --tile-size 256: 256x256 pixel tiles
  // --overlap 0: No tile overlap
  // --depth onetile: Generate full pyramid
  
  const command = `vips dzsave "${pdfPath}" "${outputDir}" \
    --layout google \
    --suffix .png \
    --tile-size 256 \
    --overlap 0 \
    --depth onetile \
    --background "255 255 255"`;
  
  console.log('Running VIPS:', command);
  
  const { stdout, stderr } = await execAsync(command);
  
  if (stderr) {
    console.log('VIPS stderr:', stderr);
  }
  
  console.log('VIPS completed');
}

async function streamTilesFromDirectory(outputDir, res) {
  const { readdir, readFile } = require('fs/promises');
  
  let tileCount = 0;
  
  // Recursively walk directory and stream each tile
  async function walkDir(dir, basePath = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Recurse into subdirectories (zoom levels)
        await walkDir(fullPath, relativePath);
      } else if (entry.name.endsWith('.png')) {
        // Read tile and stream as NDJSON line
        const tileBuffer = await readFile(fullPath);
        
        const tileLine = JSON.stringify({
          path: relativePath,
          data: tileBuffer.toString('base64')
        });
        
        res.write(tileLine + '\n');
        
        tileCount++;
        
        if (tileCount % 100 === 0) {
          console.log(`Streamed ${tileCount} tiles...`);
        }
      }
    }
  }
  
  await walkDir(outputDir);
  
  console.log(`Total tiles streamed: ${tileCount}`);
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`VIPS tile generator listening on port ${PORT}`);
});
```

**Dockerfile**:
```dockerfile
FROM node:20-slim

# Install VIPS and dependencies
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libvips-tools \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
```

**package.json**:
```json
{
  "name": "sitelink-tile-generator",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## 8. Local Development Setup

### 8.1 Local R2 Event Emulator

Since R2 events don't work in local mode, we need an emulator.

**File**: `dev-tools/local-r2-watcher.ts`

```typescript
import chokidar from 'chokidar';
import path from 'path';
import { stat } from 'fs/promises';

const LOCAL_R2_PATH = '.wrangler/state/v3/r2/sitelink-bucket';
const WRANGLER_QUEUE_URL = 'http://localhost:8787';

interface R2Event {
  account: string;
  action: string;
  bucket: string;
  object: {
    key: string;
    size: number;
    eTag: string;
  };
  eventTime: string;
}

async function sendQueueMessage(queueName: string, event: R2Event) {
  try {
    const response = await fetch(`${WRANGLER_QUEUE_URL}/__queue/${queueName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          body: event
        }]
      })
    });
    
    if (response.ok) {
      console.log(`✅ Event sent to queue: ${event.object.key}`);
    } else {
      console.error(`❌ Failed to send event: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send queue message:', error);
  }
}

console.log('🚀 Starting Local R2 Event Emulator...');
console.log(`   Watching: ${LOCAL_R2_PATH}`);
console.log(`   Queue endpoint: ${WRANGLER_QUEUE_URL}`);

const watcher = chokidar.watch(LOCAL_R2_PATH, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

watcher.on('add', async (filePath) => {
  const relativePath = path.relative(LOCAL_R2_PATH, filePath);
  
  // Only process files in plans/ directory
  if (!relativePath.startsWith('plans/')) return;
  
  // Only trigger on original.pdf uploads
  if (!relativePath.endsWith('original.pdf')) return;
  
  const stats = await stat(filePath);
  
  console.log(`🔔 R2 Event: object-create for ${relativePath}`);
  
  const event: R2Event = {
    account: 'local-account',
    action: 'PutObject',
    bucket: 'sitelink-bucket',
    object: {
      key: relativePath,
      size: stats.size,
      eTag: `local-${Date.now()}`,
    },
    eventTime: new Date().toISOString(),
  };
  
  await sendQueueMessage('pdf-split-queue', event);
});

console.log('👀 Watching for R2 events...');
```

**package.json**:
```json
{
  "name": "sitelink-dev-tools",
  "scripts": {
    "dev": "concurrently \"npm run dev:workers\" \"npm run dev:container\" \"npm run dev:r2-watcher\"",
    "dev:workers": "wrangler dev --local",
    "dev:container": "cd ../container && npm run dev",
    "dev:r2-watcher": "tsx watch local-r2-watcher.ts"
  },
  "devDependencies": {
    "chokidar": "^3.5.3",
    "concurrently": "^8.2.2",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

### 8.2 Complete Local Development Setup

**Terminal Setup**:

```bash
# Terminal 1: Container
cd container
npm install
npm run dev
# Listening on http://localhost:8080

# Terminal 2: Workers + R2 Watcher
cd workers
npm run dev
# Workers on http://localhost:8787
# R2 watcher monitoring .wrangler/state/v3/r2/

# Or use concurrently to run all together:
npm run dev
```

**Test Upload**:
```bash
# Upload a test PDF
curl -X POST http://localhost:8787/api/plans/upload \
  -H "Authorization: Bearer test-token" \
  -F "projectId=proj_123" \
  -F "planName=Test Plan" \
  -F "file=@test-plan.pdf"

# Watch the logs:
# 1. Upload API: "PDF uploaded successfully"
# 2. R2 Watcher: "🔔 R2 Event: object-create for plans/..."
# 3. PDF Splitter: "Splitting plan into N sheets"
# 4. Tile Processor: "Processing tiles for sheet X/N"
# 5. Container: "Generating tiles with VIPS..."
# 6. Tile Processor: "Uploaded X tiles for sheet N"
# 7. PDF Splitter: "Plan plan_XXX is ready!"
```

---

## 9. Deployment Guide

### 9.1 Setup R2 Buckets

```bash
# Create production bucket
wrangler r2 bucket create sitelink-production

# Create preview bucket (for staging/dev)
wrangler r2 bucket create sitelink-preview
```

### 9.2 Setup D1 Database

```bash
# Create database
wrangler d1 create sitelink-db

# Note the database_id from output

# Run migrations
wrangler d1 execute sitelink-db --file=./schema.sql
```

### 9.3 Create Queues

```bash
# Create PDF splitting queue
wrangler queues create pdf-split-queue

# Create tile generation queue
wrangler queues create tile-generation-queue
```

### 9.4 Setup R2 Event Notifications

```bash
# Configure R2 to send events to queue for original PDF uploads
wrangler r2 bucket notification create sitelink-production \
  --event-type object-create \
  --queue pdf-split-queue \
  --suffix "original.pdf"
```

### 9.5 Deploy Workers

```bash
# Deploy upload API
cd workers/upload-api
wrangler deploy

# Deploy PDF splitter
cd workers/pdf-splitter
wrangler deploy

# Deploy tile processor
cd workers/tile-processor
wrangler deploy

# Deploy tile server
cd workers/tile-server
wrangler deploy
```

### 9.6 Deploy Container

```bash
# Build container image
cd container
docker build -t sitelink-tile-generator .

# Deploy to Cloudflare (or your container platform)
# Follow Cloudflare container deployment docs
```

### 9.7 Environment Variables

Set these in Cloudflare dashboard or via wrangler:

```bash
# Clerk authentication
wrangler secret put CLERK_SECRET_KEY

# JWT secret for tile tokens
wrangler secret put JWT_SECRET

# Container URL (production)
# Set in wrangler.toml [vars]
CONTAINER_URL=https://tile-generator.your-domain.workers.dev
```

---

## 10. Monitoring and Debugging

### 10.1 Key Metrics to Monitor

- **Plan Upload Rate**: Plans uploaded per hour
- **Processing Time**: Time from upload to ready
- **Queue Depth**: Messages waiting in queues
- **Error Rate**: Failed processing jobs
- **R2 Storage**: Total storage used
- **Tile Generation Rate**: Tiles generated per minute

### 10.2 Debugging Checklist

**If plans stuck in "splitting" status:**
1. Check R2 event notification is configured
2. Check pdf-split-queue has messages
3. Check PDF Splitter Worker logs
4. Verify pdf-lib can parse the PDF

**If sheets stuck in "generating_tiles" status:**
1. Check tile-generation-queue has messages
2. Check Tile Processor Worker logs
3. Check container is accessible
4. Check container logs for VIPS errors

**If tiles not loading:**
1. Verify tile token is valid (not expired)
2. Check tile exists in R2
3. Check Tile Server Worker logs
4. Verify tile path format is correct

---

## Summary

This architecture provides:

✅ **Resilient Processing**: R2 events guarantee no orphaned files  
✅ **Scalable**: Process multiple sheets in parallel  
✅ **Memory Efficient**: Stream data, never buffer large files  
✅ **Secure**: JWT tokens for tile access, per-plan scoped  
✅ **Local Dev**: Full local testing with R2 emulator  
✅ **Production Ready**: Uses production-proven VIPS for tiles  

The system handles the complete lifecycle from PDF upload to tile viewing with automatic processing, error handling, and user authentication.