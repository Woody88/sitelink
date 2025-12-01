
# Backend Package Guidelines

## Cloudflare Workers + Effect-TS Architecture

This backend is a **Cloudflare Worker** using **Effect-TS HTTP API** with **D1 database**.

## Folder Structure

Follow this exact structure for all backend code:

```
packages/backend/src/
├── core/                    # Core infrastructure services
│   ├── database.ts          # DrizzleD1Client service
│   ├── api.ts              # Base HttpApi definition
│   └── index.ts            # CoreLayer composition
│
├── features/               # Business feature modules
│   ├── health/
│   │   ├── service.ts      # HealthService (business logic)
│   │   ├── http.ts         # HTTP endpoints (HealthAPI)
│   │   └── index.ts        # HealthModule (layer composition)
│   │
│   └── [feature]/          # Organizations, Projects, Plans, Files
│       ├── service.ts      # Business logic
│       ├── http.ts         # HTTP API endpoints
│       └── index.ts        # Module layer composition
│
├── db/
│   └── schema.ts           # Drizzle schema definitions
│
├── api.ts                  # Main SiteLinkApi composition
└── index.ts               # Cloudflare Worker entry point
```

## Architecture Rules

### 1. Core Layer (Infrastructure)
- **Purpose**: Provides foundational services (Database, Config, etc.)
- **Dependencies**: Cloudflare environment bindings only
- **Exports**: Service layers that other modules depend on

### 2. Feature Modules (Business Logic)
- **Structure**: Each feature has `service.ts`, `http.ts`, and `index.ts`
- **Dependencies**: Core layer services only (no cross-feature dependencies)
- **Composition**: Use `Layer.provideMerge()` to satisfy internal dependencies
- **Exports**: Single module layer + HTTP API definitions

### 3. Layer Composition Rules
- **Services**: Declare dependencies by yielding other services in `Effect.gen`
- **Modules**: Use `Layer.provideMerge()` to satisfy feature-internal dependencies
- **App Level**: Use `Layer.provide()` to inject core infrastructure into features

## Effect-TS Patterns

### Service Definition
```typescript
export class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function* () {
    const database = yield* DrizzleD1Client  // Declares dependency

    return {
      myMethod: () => Effect.succeed("result")
    }
  })
}) {}
```

### Module Composition
```typescript
// In features/myfeature/index.ts
export const MyModule = MyHttpLive.pipe(
  Layer.provideMerge(MyService.Default)  // Satisfy HTTP layer's service dependency
)
```

### HTTP API Definition
```typescript
// In features/myfeature/http.ts
export const MyAPI = HttpApiGroup.make("My").pipe(
  HttpApiGroup.addEndpoint(/* endpoints */)
)
```

## Testing

**Use Vitest** (not bun test) for Cloudflare Workers testing:

```bash
bun run vitest
```

Test structure:
```typescript
import { describe, expect, it } from "vitest"
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test"
import worker from "../src/index"

describe("My Feature", () => {
  it("should work", async () => {
    const request = new Request("http://example.com/api/my-endpoint")
    const ctx = createExecutionContext()
    const response = await worker.fetch(request, env, ctx)
    await waitOnExecutionContext(ctx)

    expect(response.status).toBe(200)
  })
})
```

## Development Commands

- **Development**: `bun run dev` (uses Wrangler)
- **Testing**: `bun run vitest`
- **Database**: `bun run db:local:studio`
- **Migrations**: `bun run db:gen:migration`

## Key Dependencies

- **Effect-TS**: `effect`, `@effect/platform`
- **Database**: `drizzle-orm`, `@libsql/client`
- **Testing**: `vitest`, `@cloudflare/vitest-pool-workers`
- **Cloudflare**: `wrangler`, `@cloudflare/workers-types`

---

## 🎯 Implementation Status & TODO

**Last Updated:** November 24, 2025

### ✅ Completed Features

#### Core Infrastructure
- [x] Database (D1 + Drizzle)
- [x] Authentication (Better-Auth with OAuth: Google, Microsoft)
- [x] R2 Storage Service
- [x] Email Service (Resend)
- [x] PDF Processing Pipeline (Docker + vips)
- [x] Tile Generation (DZI format with queue-based processing)
- [x] End-to-end streaming (R2 → Queue → Container → R2)

#### Feature Modules
- [x] Health endpoint
- [x] Registration (creates org + trial subscription)
- [x] Organization management (CRUD, soft delete)
- [x] Projects (CRUD)
- [x] Plans (CRUD + PDF upload/processing)
- [x] Files (metadata + R2 storage)
- [x] Media (photos/videos + R2 storage)

#### PDF Processing
- [x] Docker container with vips for tile generation
- [x] Queue-based processing (Cloudflare Queues)
- [x] Deep Zoom Image (DZI) tiles
- [x] Integration tests with Docker
- [x] Streaming optimizations (wrangler 4.50.0)

---

### 🔴 HIGH PRIORITY - Critical Missing Features

#### 1. Sheet Linking System ⭐⭐⭐⭐⭐ **CRITICAL**
**Status:** NOT IMPLEMENTED
**Priority:** HIGHEST - This is the #1 product differentiator per PRD

**What's Needed:**
- [ ] Add `sheetLinks` table to database schema
- [ ] Implement `SheetLinksService` (business logic)
- [ ] Create HTTP endpoints:
  - `POST /plans/:id/links` - Create clickable region
  - `GET /plans/:id/links` - Get all links for a sheet
  - `DELETE /links/:id` - Delete a link
- [ ] Decision: OCR for automatic sheet reference detection vs manual linking
  - See investigation prompt below for OCR research

**Database Schema (from PRD):**
```sql
CREATE TABLE sheetLink (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  fromSheetId TEXT NOT NULL,
  toSheetId TEXT NOT NULL,
  coordinates TEXT,  -- JSON: {x, y, width, height} in pixels
  label TEXT,
  color TEXT DEFAULT '#0066CC',
  createdBy TEXT NOT NULL,
  createdAt INTEGER NOT NULL
)
```

**Location:** `src/features/sheet-links/`

---

#### 2. Annotations System ⭐⭐⭐⭐
**Status:** NOT IMPLEMENTED
**Priority:** HIGH - MVP feature per PRD

**What's Needed:**
- [ ] Add `annotations` table to database schema
- [ ] Implement `AnnotationsService`
- [ ] Create HTTP endpoints:
  - `POST /plans/:id/annotations` - Create circle annotation
  - `GET /plans/:id/annotations` - List annotations for plan
  - `PATCH /annotations/:id` - Update annotation
  - `DELETE /annotations/:id` - Delete annotation
- [ ] MVP: Circle tool only (Red, Yellow, Green colors)

**Database Schema (from PRD):**
```sql
CREATE TABLE annotation (
  id TEXT PRIMARY KEY,
  planId TEXT NOT NULL,
  type TEXT DEFAULT 'circle',
  color TEXT NOT NULL,  -- red|yellow|green
  coordinates TEXT,     -- JSON: {cx, cy, radius} for circles
  createdBy TEXT NOT NULL,
  createdAt INTEGER NOT NULL
)
```

**Location:** `src/features/annotations/`

---

#### 3. Share Links ⭐⭐⭐
**Status:** PARTIAL - `projects.shareToken` exists but no endpoints
**Priority:** HIGH - Quick sharing is key UX per PRD

**What's Needed:**
- [ ] Implement share link generation
- [ ] Create HTTP endpoints:
  - `POST /projects/:id/share` - Generate shareable URL
  - `GET /shared/:token` - Access shared project (no auth)
- [ ] Public viewer mode (read-only, no authentication required)

**Location:** Add to `src/features/projects/` or create `src/features/sharing/`

---

### 🟡 MEDIUM PRIORITY - Revenue & Polish

#### 4. Payments Integration ⭐⭐⭐
**Status:** NOT IMPLEMENTED
**Priority:** MEDIUM - Revenue critical but can launch with trials

**What's Needed:**
- [ ] Add `subscriptions` table to database schema
- [ ] Polar SDK integration (@polar-sh/sdk)
- [ ] Implement `PaymentsService`
- [ ] Create HTTP endpoints:
  - `POST /subscriptions` - Create subscription
  - `GET /organizations/:orgId/subscription` - Get subscription
  - `PATCH /organizations/:orgId/subscription` - Update seats
  - `DELETE /organizations/:orgId/subscription` - Cancel
  - `POST /webhooks/polar` - Handle Polar webhooks
- [ ] Subscription enforcement middleware
- [ ] Trial expiration checks

**Pricing (from PRD):**
- Trial: 14 days, 2 projects, 3 team members
- Pro: $49/mo, unlimited projects, 20 team members
- Enterprise: $149/mo, unlimited everything

**Location:** `src/features/payments/`

---

#### 5. Usage Tracking & Analytics ⭐⭐
**Status:** NOT IMPLEMENTED
**Priority:** MEDIUM - Needed for billing and product insights

**What's Needed:**
- [ ] Add `usageEvents` table
- [ ] Track key events:
  - Project creation
  - Sheet uploads
  - Media uploads
  - Tile views
- [ ] Aggregate usage for billing
- [ ] Analytics dashboard data

**Location:** `src/features/analytics/` or add to existing modules

---

### 🟢 LOW PRIORITY - Post-MVP

#### 6. Scheduled Deletion Jobs
- [ ] Cloudflare Queue for delayed deletion
- [ ] Hard delete organizations after 30 days of soft delete
- [ ] Clean up R2 storage for deleted resources

#### 7. Enhanced Email Templates
- [ ] HTML templates for magic links
- [ ] Organization invitation emails
- [ ] Trial expiration warnings (7 days, 1 day)

#### 8. Advanced Authorization
- [ ] Action-level permissions beyond org membership
- [ ] Permission policies (e.g., `projects:create`, `files:delete`)

---

### 📱 FUTURE: Mobile App
**Status:** NOT STARTED
**Priority:** After backend features complete

**Tech Stack (from PRD):**
- React Native + Expo
- Expo DOM Components + OpenSeadragon for tile viewing
- Zustand for state management
- SQLite for offline storage

**Depends On:** Sheet linking & annotations being complete

---

## 🔍 Sheet Linking Investigation Prompt

Use this prompt with another Claude agent to research the OCR/sheet linking approach:

```
I'm building a construction plan viewer app where the killer feature is "sheet linking" -
allowing users to click on sheet references in construction drawings (e.g., "See Detail A-1")
and instantly navigate to that referenced sheet.

CONTEXT:
- We already have PDF processing working: PDFs are converted to Deep Zoom Image (DZI) tiles
  using vips in a Docker container
- Tiles are stored in R2 (S3-compatible storage)
- Backend is Cloudflare Workers (Effect-TS) with D1 database
- We can use containerized services for heavy processing

TWO APPROACHES WE'VE DISCUSSED:

1. **Manual Linking** (Simpler MVP)
   - Admin draws rectangles on plans to mark clickable regions
   - Admin manually selects which sheet the region links to
   - No OCR needed, just coordinate tracking

2. **Automatic OCR Detection** (Better UX)
   - Use OCR to detect text like "A-1", "Detail 3", "Section B"
   - Match detected references to sheet numbers in the project
   - Auto-generate clickable regions

QUESTIONS TO INVESTIGATE:

1. What OCR libraries/services would work best for construction drawings?
   - Tesseract OCR (open source)
   - Google Cloud Vision API
   - AWS Textract
   - Azure Computer Vision
   - Others?

2. How would we integrate OCR into our architecture?
   - Run in the same Docker container as PDF processing?
   - Separate containerized service?
   - Cloudflare AI Workers (if capable)?
   - Third-party API?

3. What are the accuracy considerations?
   - Construction drawings often have stylized fonts
   - Sheet references can be in various formats
   - How to handle false positives/negatives?

4. Implementation complexity vs value tradeoff
   - Should we start with manual linking for MVP?
   - Add OCR as Phase 2?
   - Or is OCR essential for the feature to work well?

5. Cost considerations
   - Processing cost per PDF
   - Storage for OCR data
   - API costs if using third-party

SEARCH THE CODEBASE:
- Check docs/ folder for any previous discussions about OCR or sheet linking
- Look for any existing references to text extraction or computer vision
- See if we have any prototypes or experiments

Please provide:
1. Recommendation on which approach to start with (manual vs OCR)
2. If OCR: specific library/service recommendation
3. Architecture proposal for how it would integrate
4. Estimated complexity and timeline
5. Cost analysis if applicable
```

---

## 📝 Notes

- Better Auth handles 95% of auth/org functionality automatically
- PDF processing with streaming is production-ready
- Focus should be on sheet linking (the differentiator!) then annotations
- Payments can wait until we validate the product with trials
